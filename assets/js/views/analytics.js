/** Where the postings went and what came back. */
import * as store from '../store.js';
import { PLATFORMS, platform, platformName, roomTypeName } from '../platforms.js';
import { html, esc, money, todayISO, formatDateTime, toast, download, toCSV, pluralise } from '../utils.js';
import { pageHeader, statTile, section, emptyState, badge, field, input, select, openModal, closeModal } from '../ui.js';
import { stackedColumns, chartTable, horizontalBars } from '../charts.js';

const WEEKS = 8;
const SERIES = PLATFORMS.map((p) => ({ id: p.id, name: p.name, slot: p.series }));

export function render() {
  const s = store.get();
  const today = todayISO();
  const periods = weekBuckets(s, WEEKS);
  const live = s.posts.filter((p) => store.postState(p, today) === 'live');

  const perPlatform = PLATFORMS.map((p) => {
    const mine = s.posts.filter((x) => x.platformId === p.id);
    const enq = s.enquiries.filter((e) => e.platformId === p.id);
    return {
      platform: p,
      posted: mine.filter((x) => x.postedAt).length,
      live: mine.filter((x) => store.postState(x, today) === 'live').length,
      enquiries: enq.length,
      converted: enq.filter((e) => e.outcome === 'booked').length,
    };
  });

  const maxEnq = Math.max(1, ...perPlatform.map((r) => r.enquiries));
  const totalEnq = s.enquiries.length;
  const booked = s.enquiries.filter((e) => e.outcome === 'booked').length;

  return html`
    ${[pageHeader({
      title: 'Performance',
      subtitle: 'Posting effort against the leads it produced.',
      actions: html`<button class="btn" data-act="add-enquiry">Log an enquiry</button>
        <button class="btn" data-act="export-postings">Export postings</button>`,
    })]}

    <div class="stat-row">
      ${[statTile({ label: 'Postings made', value: s.posts.filter((p) => p.postedAt).length, sub: 'all time' })]}
      ${[statTile({ label: 'Live right now', value: live.length, tone: 'good', sub: `${pluralise(PLATFORMS.length, 'channel')}` })]}
      ${[statTile({ label: 'Enquiries', value: totalEnq, sub: 'logged by the team' })]}
      ${[statTile({ label: 'Booked', value: booked, sub: totalEnq ? `${Math.round((booked / totalEnq) * 100)}% of enquiries` : 'none yet', tone: booked ? 'good' : '' })]}
    </div>

    ${[section('Postings and bumps by week', html`
      ${[stackedColumns(periods, SERIES, { title: `Last ${WEEKS} weeks, by channel`, height: 210 })]}
      ${[chartTable(periods, SERIES)]}`, {
      note: 'Each posting or bump counts once, in the week it happened.',
    })]}

    <div class="grid grid--2">
      ${[section('Enquiries by channel', horizontalBars(perPlatform.map((r) => ({
        label: r.platform.name, value: r.enquiries, max: maxEnq, slot: r.platform.series,
      })), { title: 'Leads attributed to each channel' }), {
        note: 'Attribution is whatever the team records when the lead comes in.',
      })]}
      ${[section('Channel scoreboard', scoreboard(perPlatform))]}
    </div>

    ${[section('Enquiry log', enquiryTable(s), {
      note: s.enquiries.length ? `${pluralise(s.enquiries.length, 'entry')}, newest first.` : '',
      actions: '<button class="btn btn--small" data-act="add-enquiry">Log an enquiry</button>',
    })]}`;
}

/** Bucket postings and bumps into the last N ISO weeks. */
function weekBuckets(s, weeks) {
  const out = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(monday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const values = {};
    PLATFORMS.forEach((p) => { values[p.id] = 0; });
    s.activity.forEach((a) => {
      if (!['post', 'bump'].includes(a.kind)) return;
      const at = new Date(a.at);
      if (at >= start && at < end && a.meta && a.meta.platformId && values[a.meta.platformId] !== undefined) {
        values[a.meta.platformId] += 1;
      }
    });
    out.push({
      label: start.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' }),
      values,
    });
  }
  return out;
}

function scoreboard(rows) {
  return html`<div class="table-wrap"><table class="table table--compact">
    <thead><tr><th scope="col">Channel</th><th scope="col">Posted</th><th scope="col">Live</th><th scope="col">Enquiries</th><th scope="col">Booked</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr>
      <th scope="row"><span class="dot dot--s${r.platform.series}" aria-hidden="true"></span>${r.platform.name}</th>
      <td class="num">${r.posted}</td><td class="num">${r.live}</td>
      <td class="num">${r.enquiries}</td><td class="num">${r.converted}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

const OUTCOMES = [
  { id: 'new', name: 'New' },
  { id: 'viewing', name: 'Viewing booked' },
  { id: 'booked', name: 'Booked' },
  { id: 'lost', name: 'Lost' },
];
const OUTCOME_TONE = { new: 'neutral', viewing: 'warning', booked: 'good', lost: 'serious' };

function enquiryTable(s) {
  if (!s.enquiries.length) {
    return emptyState({
      title: 'No enquiries logged',
      body: 'Log each WhatsApp or platform message so you can see which channel is actually worth the effort.',
      action: '<button class="btn btn--primary" data-act="add-enquiry">Log an enquiry</button>',
    });
  }
  return html`<div class="table-wrap"><table class="table">
    <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Channel</th><th scope="col">Listing</th><th scope="col">Outcome</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${s.enquiries.map((e) => {
      const l = store.listing(e.listingId);
      return html`<tr>
        <td>${formatDateTime(e.at)}</td>
        <th scope="row" class="cell-title">${e.name || 'Anonymous'}<small>${e.contact || ''}</small></th>
        <td>${e.platformId ? platformName(e.platformId) : '—'}</td>
        <td>${l ? html`<a href="#/listings/${l.id}">${l.property || 'Untitled'}</a>` : '—'}</td>
        <td>${[badge((OUTCOMES.find((o) => o.id === e.outcome) || {}).name || e.outcome, OUTCOME_TONE[e.outcome] || 'neutral')]}</td>
        <td class="cell-actions">
          <button class="btn btn--small btn--ghost" data-act="edit-enquiry" data-id="${e.id}">Edit</button>
        </td>
      </tr>`;
    })}</tbody>
  </table></div>`;
}

/* ----------------------------------------------------------------- mount */

export function mount(root, rerender) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'add-enquiry') enquiryDialog(null, rerender);
    if (btn.dataset.act === 'edit-enquiry') enquiryDialog(btn.dataset.id, rerender);
    if (btn.dataset.act === 'export-postings') exportPostings();
  });
}

function enquiryDialog(id, rerender) {
  const s = store.get();
  const existing = id ? s.enquiries.find((x) => x.id === id) : null;
  const listingOptions = [{ id: '', name: '— no specific listing —' },
    ...s.listings.map((l) => ({ id: l.id, name: `${l.property || 'Untitled'} · ${roomTypeName(l.roomType)}` }))];

  openModal(existing ? 'Edit enquiry' : 'Log an enquiry', html`
    <form id="enq-form" class="form">
      ${[field('Name', input('name', existing ? existing.name : '', { placeholder: 'Who got in touch' }))]}
      ${[field('Contact', input('contact', existing ? existing.contact : '', { placeholder: 'Phone or handle' }))]}
      ${[field('Channel', select('platformId', existing ? existing.platformId : '',
        [{ id: '', name: '— unknown —' }, ...PLATFORMS.map((p) => ({ id: p.id, name: p.name }))]))]}
      ${[field('Listing', select('listingId', existing ? existing.listingId : '', listingOptions))]}
      ${[field('Outcome', select('outcome', existing ? existing.outcome : 'new', OUTCOMES))]}
      ${[field('Note', input('note', existing ? existing.note : ''))]}
      <div class="form__actions">
        ${existing ? '<button class="btn btn--danger btn--ghost" type="button" data-act="drop">Delete</button>' : ''}
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn--primary" type="submit">Save</button>
      </div>
    </form>`);

  const form = document.querySelector('#enq-form');
  form.querySelector('[data-close]').addEventListener('click', closeModal);
  const drop = form.querySelector('[data-act=drop]');
  if (drop) drop.addEventListener('click', () => { store.deleteEnquiry(id); closeModal(); rerender(); });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
    const patch = {
      name: d.get('name').trim(), contact: d.get('contact').trim(),
      platformId: d.get('platformId'), listingId: d.get('listingId'),
      outcome: d.get('outcome'), note: d.get('note').trim(),
    };
    if (existing) store.updateEnquiry(id, patch);
    else store.addEnquiry(patch);
    closeModal(); toast('Enquiry saved', 'good'); rerender();
  });
}

function exportPostings() {
  const rows = store.posts();
  if (!rows.length) { toast('No postings to export', 'warning'); return; }
  const today = todayISO();
  const csv = toCSV(rows, [
    { label: 'Listing', get: (p) => (store.listing(p.listingId) || {}).property || '' },
    { label: 'Reference', get: (p) => (store.listing(p.listingId) || {}).ref || '' },
    { label: 'Channel', get: (p) => platformName(p.platformId) },
    { label: 'State', get: (p) => store.postState(p, today) },
    { label: 'Posted', get: (p) => p.postedAt || '' },
    { label: 'Last bump', get: (p) => p.lastBumpAt || '' },
    { label: 'Next bump', get: (p) => p.nextBumpAt || '' },
    { label: 'Expires', get: (p) => p.expiresAt || '' },
    { label: 'URL', get: (p) => p.url || '' },
    { label: 'Notes', get: (p) => p.notes || '' },
  ]);
  download(`belive-postings-${today}.csv`, csv, 'text/csv');
  toast('Postings exported', 'good');
}
