/** The work queue: what to post, bump or re-list, ordered by how late it is. */
import * as store from '../store.js';
import { PLATFORMS, platform, platformName, regionName, roomTypeName } from '../platforms.js';
import { html, esc, formatDate, relativeDays, todayISO, daysBetween, toast, pluralise } from '../utils.js';
import { pageHeader, statTile, badge, section, emptyState, confirmDialog } from '../ui.js';

export function render() {
  const today = todayISO();
  const all = store.posts().map((p) => ({
    post: p, listing: store.listing(p.listingId), state: store.postState(p, today),
  })).filter((r) => r.listing);

  const expired = all.filter((r) => r.state === 'expired');
  const due = all.filter((r) => r.state === 'duebump');
  const queued = all.filter((r) => r.state === 'queued');
  const soon = all.filter((r) => r.state === 'live' && r.post.nextBumpAt && daysBetween(today, r.post.nextBumpAt) <= 7)
    .sort((a, b) => (a.post.nextBumpAt < b.post.nextBumpAt ? -1 : 1));
  const live = all.filter((r) => r.state === 'live');

  return html`
    ${[pageHeader({
      title: 'Work queue',
      subtitle: 'Every ad that needs a human today, plus what falls due this week.',
      actions: html`<button class="btn" data-act="bump-all-due">Mark all due as bumped</button>
        <a class="btn btn--primary" href="#/listings">Inventory</a>`,
    })]}

    <div class="stat-row">
      ${[statTile({ label: 'Expired', value: expired.length, sub: 'need re-listing', tone: expired.length ? 'serious' : 'good' })]}
      ${[statTile({ label: 'Due a bump', value: due.length, sub: 'inside the bump window', tone: due.length ? 'warning' : 'good' })]}
      ${[statTile({ label: 'Queued, not posted', value: queued.length, sub: 'drafted but not live' })]}
      ${[statTile({ label: 'Live', value: live.length, sub: `${soon.length} due within 7 days`, tone: 'good' })]}
    </div>

    ${[section('Expired — re-list these first', group(expired, today, 'serious'), {
      note: expired.length ? 'The ad is gone from the site. Re-post, do not edit.' : 'Nothing expired.',
    })]}
    ${[section('Due a bump', group(due, today, 'warning'), {
      note: due.length ? 'Still live, but sinking down the search results.' : 'Every live ad is inside its window.',
    })]}
    ${[section('Queued but never posted', group(queued, today, 'neutral'), {
      note: queued.length ? 'Drafted in the composer, not yet submitted to the platform.' : 'Nothing waiting.',
    })]}
    ${[section('Falling due within 7 days', upcoming(soon, today), { note: 'Plan the week from here.' })]}`;
}

function group(rows, today, tone) {
  if (!rows.length) {
    return emptyState({ title: 'Clear', body: 'Nothing in this bucket right now.' });
  }
  const sorted = rows.slice().sort((a, b) => {
    const ax = a.post.nextBumpAt || a.post.createdAt;
    const bx = b.post.nextBumpAt || b.post.createdAt;
    return ax < bx ? -1 : 1;
  });
  return html`<ul class="queue queue--full">${sorted.map((r) => {
    const p = platform(r.post.platformId) || {};
    const late = r.post.nextBumpAt ? -daysBetween(today, r.post.nextBumpAt) : null;
    return html`<li class="queue__row">
      <span class="dot dot--s${p.series || 1}" aria-hidden="true"></span>
      <div class="queue__main">
        <a class="queue__title" href="#/compose/${r.listing.id}/${r.post.platformId}">
          ${r.listing.property || 'Untitled'} · ${roomTypeName(r.listing.roomType)}
        </a>
        <span class="queue__meta">
          ${platformName(r.post.platformId)} · ${regionName(r.listing.region)}
          ${r.post.postedAt ? ` · posted ${formatDate(r.post.postedAt)}` : ' · never posted'}
          ${late && late > 0 ? ` · ${pluralise(late, 'day')} late` : ''}
        </span>
      </div>
      ${[badge(r.state === 'expired' ? 'Expired' : r.state === 'duebump' ? 'Due bump' : 'Queued', tone)]}
      <div class="queue__actions">
        ${r.post.url ? html`<a class="btn btn--small btn--ghost" href="${r.post.url}" target="_blank" rel="noopener">View ad</a>` : ''}
        <a class="btn btn--small" href="#/compose/${r.listing.id}/${r.post.platformId}">Compose</a>
        <button class="btn btn--small btn--primary" data-act="bump" data-post="${r.post.id}">
          ${r.state === 'queued' ? 'Mark posted' : 'Mark bumped'}
        </button>
      </div>
    </li>`;
  })}</ul>`;
}

function upcoming(rows, today) {
  if (!rows.length) return '<p class="muted">Nothing falls due in the next seven days.</p>';
  return html`<ol class="timeline">${rows.map((r) => {
    const p = platform(r.post.platformId) || {};
    return html`<li class="timeline__row">
      <span class="timeline__when">${formatDate(r.post.nextBumpAt)}<small>${relativeDays(r.post.nextBumpAt, today)}</small></span>
      <span class="dot dot--s${p.series || 1}" aria-hidden="true"></span>
      <a class="timeline__title" href="#/compose/${r.listing.id}/${r.post.platformId}">
        ${r.listing.property || 'Untitled'} · ${platformName(r.post.platformId)}
      </a>
    </li>`;
  })}</ol>`;
}

export function mount(root, rerender) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'bump') {
      const rec = store.post(btn.dataset.post);
      if (!rec) return;
      if (rec.postedAt) store.bumpPost(rec.id);
      else store.markPosted(rec.id, {});
      toast('Recorded', 'good');
      rerender();
    }
    if (btn.dataset.act === 'bump-all-due') {
      const today = todayISO();
      const rows = store.posts().filter((p) => ['duebump', 'expired'].includes(store.postState(p, today)));
      if (!rows.length) { toast('Nothing is due', 'warning'); return; }
      const ok = await confirmDialog('Mark everything as bumped?',
        `${pluralise(rows.length, 'ad')} will be stamped as bumped today. Only do this once you have actually renewed them on the platforms.`,
        'Mark them bumped');
      if (!ok) return;
      rows.forEach((p) => store.bumpPost(p.id));
      toast(`${pluralise(rows.length, 'ad')} updated`, 'good');
      rerender();
    }
  });
}
