/** Control tower: what is live, what needs an operator today, what happened. */
import * as store from '../store.js';
import { PLATFORMS, platform, platformName, regionName, roomTypeName } from '../platforms.js';
import { html, esc, money, formatDate, relativeDays, todayISO, daysBetween, pluralise } from '../utils.js';
import { pageHeader, statTile, badge, section, emptyState } from '../ui.js';
import { horizontalBars } from '../charts.js';

const ACTIVE = new Set(['draft', 'active', 'reserved']);

export function render() {
  const s = store.get();
  const today = todayISO();
  const sellable = s.listings.filter((l) => ACTIVE.has(l.status));
  const live = s.posts.filter((p) => store.postState(p, today) === 'live');
  const queue = store.dueQueue(today);
  const overdue = queue.filter((q) => q.state !== 'queued');
  const weekAgo = Date.now() - 7 * 86400000;
  const enquiriesWeek = s.enquiries.filter((e) => e.at >= weekAgo).length;

  const slots = sellable.length * PLATFORMS.length;
  const coveragePct = slots ? Math.round((live.length / slots) * 100) : 0;

  const coverageRows = PLATFORMS.map((p) => ({
    label: p.name,
    slot: p.series,
    value: sellable.filter((l) => {
      const rec = store.findPost(l.id, p.id);
      return rec && store.postState(rec, today) === 'live';
    }).length,
    max: Math.max(sellable.length, 1),
  }));

  return html`
    ${[pageHeader({
      title: 'Control tower',
      subtitle: 'Indoor tenant sales listings across iBilik, Mudah, Facebook and PropertyGuru.',
      actions: html`<a class="btn btn--primary" href="#/listings/new">New listing</a>
        <a class="btn" href="#/pipeline">Open work queue</a>`,
    })]}

    <div class="stat-row">
      ${[statTile({ label: 'Sellable listings', value: sellable.length, sub: `${s.listings.length} in total`, href: '#/listings' })]}
      ${[statTile({ label: 'Live postings', value: live.length, sub: `across ${pluralise(PLATFORMS.length, 'channel')}`, tone: 'good' })]}
      ${[statTile({ label: 'Needs action today', value: queue.length, sub: overdue.length ? `${overdue.length} already overdue` : 'nothing overdue', tone: queue.length ? (overdue.length ? 'serious' : 'warning') : 'good', href: '#/pipeline' })]}
      ${[statTile({ label: 'Channel coverage', value: `${coveragePct}%`, sub: `${live.length} of ${slots} slots filled` })]}
      ${[statTile({ label: 'Enquiries this week', value: enquiriesWeek, sub: 'logged by hand', href: '#/analytics' })]}
    </div>

    <div class="grid grid--2">
      ${[section('Work queue', queueBlock(queue.slice(0, 7), today), {
        note: queue.length ? `${pluralise(queue.length, 'item')} waiting — oldest first.` : 'Everything is bumped and live.',
        actions: html`<a class="btn btn--ghost" href="#/pipeline">See all</a>`,
      })]}
      ${[section('Coverage by channel', horizontalBars(coverageRows, { title: 'Sellable listings live on each channel' }), {
        note: 'A listing counts as covered only while its ad is live and inside its bump window.',
      })]}
    </div>

    <div class="grid grid--2">
      ${[section('Recently touched listings', recentListings(s.listings.slice(0, 6), today))]}
      ${[section('Activity', activityFeed(s.activity.slice(0, 12)))]}
    </div>`;
}

function queueBlock(queue, today) {
  if (!queue.length) {
    return emptyState({
      title: 'Nothing due',
      body: 'No ad is expired or inside its bump window. Add a listing or queue another channel to keep the funnel fed.',
      action: '<a class="btn btn--primary" href="#/listings/new">New listing</a>',
    });
  }
  return html`<ul class="queue">${queue.map((row) => {
    const tone = row.state === 'expired' ? 'serious' : row.state === 'duebump' ? 'warning' : 'neutral';
    const word = row.state === 'expired' ? 'Expired' : row.state === 'duebump' ? 'Due bump' : 'Not posted yet';
    const when = row.post.nextBumpAt ? relativeDays(row.post.nextBumpAt, today) : 'never posted';
    return html`<li class="queue__row">
      <span class="dot dot--s${platform(row.post.platformId) ? platform(row.post.platformId).series : 1}" aria-hidden="true"></span>
      <div class="queue__main">
        <a class="queue__title" href="#/listings/${row.listing.id}">${row.listing.property || 'Untitled'} · ${roomTypeName(row.listing.roomType)}</a>
        <span class="queue__meta">${platformName(row.post.platformId)} · ${regionName(row.listing.region)} · ${when}</span>
      </div>
      ${[badge(word, tone)]}
      <a class="btn btn--small" href="#/compose/${row.listing.id}/${row.post.platformId}">Open</a>
    </li>`;
  })}</ul>`;
}

function recentListings(items, today) {
  if (!items.length) {
    return emptyState({
      title: 'No listings yet',
      body: 'Create the first unit and the composer will write the iBilik, Mudah, Facebook and PropertyGuru copy for it.',
      action: '<a class="btn btn--primary" href="#/listings/new">New listing</a>',
    });
  }
  return html`<ul class="mini-list">${items.map((l) => {
    const live = store.postsFor(l.id).filter((p) => store.postState(p, today) === 'live').length;
    return html`<li class="mini-list__row">
      <a href="#/listings/${l.id}" class="mini-list__title">${l.property || 'Untitled'}<small>${roomTypeName(l.roomType)} · ${regionName(l.region)}</small></a>
      <span class="mini-list__value">${money(l.rent)}<small>${live}/${PLATFORMS.length} live</small></span>
    </li>`;
  })}</ul>`;
}

function activityFeed(items) {
  if (!items.length) return '<p class="muted">Nothing logged yet.</p>';
  return html`<ol class="feed">${items.map((a) => html`<li class="feed__row">
    <span class="feed__when">${new Date(a.at).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
    <span class="feed__text">${a.message}</span>
  </li>`)}</ol>`;
}

export function mount() { /* dashboard is read-only; links do the work */ }
