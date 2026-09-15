/** Listing inventory: the table, the editor, and one unit's channel status. */
import * as store from '../store.js';
import {
  PLATFORMS, REGIONS, ROOM_TYPES, AMENITIES, TENANT_PREFS, LISTING_STATUS,
  platform, platformName, regionName, roomTypeName,
} from '../platforms.js';
import { html, esc, money, formatDate, relativeDays, todayISO, toast, download, toCSV } from '../utils.js';
import {
  pageHeader, statTile, badge, section, emptyState, field, input, textarea, select,
  checkGrid, confirmDialog,
} from '../ui.js';

const STATUS_TONE = Object.fromEntries(LISTING_STATUS.map((s) => [s.id, s.tone]));
const POST_TONE = { live: 'good', duebump: 'warning', expired: 'serious', queued: 'neutral', none: 'neutral' };
const POST_WORD = { live: 'Live', duebump: 'Due bump', expired: 'Expired', queued: 'Queued', none: 'Not listed' };

let filters = { q: '', region: 'all', status: 'all', channel: 'all' };

/* ------------------------------------------------------------------ list */

export function renderList() {
  const today = todayISO();
  const all = store.listings();
  const rows = all.filter(matches);

  return html`
    ${[pageHeader({
      title: 'Listings',
      subtitle: `${all.length} unit${all.length === 1 ? '' : 's'} in inventory.`,
      actions: html`<button class="btn" data-act="export-csv">Export CSV</button>
        <a class="btn btn--primary" href="#/listings/new">New listing</a>`,
    })]}

    <div class="filters">
      <input class="input input--search" id="f-q" type="search" placeholder="Search property, area, reference…" value="${filters.q}" />
      ${[select('f-region', filters.region, [{ id: 'all', name: 'All regions' }, ...REGIONS], { attrs: 'id="f-region"' })]}
      ${[select('f-status', filters.status, [{ id: 'all', name: 'Any status' }, ...LISTING_STATUS], { attrs: 'id="f-status"' })]}
      ${[select('f-channel', filters.channel, [
        { id: 'all', name: 'Any coverage' },
        { id: 'gap', name: 'Has an uncovered channel' },
        { id: 'full', name: 'Live everywhere' },
        ...PLATFORMS.map((p) => ({ id: `missing:${p.id}`, name: `Not live on ${p.name}` })),
      ], { attrs: 'id="f-channel"' })]}
      ${filters.q || filters.region !== 'all' || filters.status !== 'all' || filters.channel !== 'all'
        ? '<button class="btn btn--ghost" data-act="clear-filters">Clear</button>' : ''}
    </div>

    ${[rows.length ? table(rows, today) : emptyState({
      title: all.length ? 'No listing matches those filters' : 'Inventory is empty',
      body: all.length
        ? 'Loosen the filters, or clear them to see every unit again.'
        : 'Add the first room and the composer will draft the copy for all four channels.',
      action: all.length ? '<button class="btn" data-act="clear-filters">Clear filters</button>'
        : '<a class="btn btn--primary" href="#/listings/new">New listing</a>',
    })]}`;
}

function matches(l) {
  const today = todayISO();
  if (filters.region !== 'all' && l.region !== filters.region) return false;
  if (filters.status !== 'all' && l.status !== filters.status) return false;
  if (filters.q) {
    const hay = [l.property, l.area, l.ref, l.unitNo, l.address, roomTypeName(l.roomType)]
      .join(' ').toLowerCase();
    if (!hay.includes(filters.q.toLowerCase())) return false;
  }
  if (filters.channel !== 'all') {
    const liveOn = (pid) => {
      const rec = store.findPost(l.id, pid);
      return rec && store.postState(rec, today) === 'live';
    };
    if (filters.channel === 'gap' && PLATFORMS.every((p) => liveOn(p.id))) return false;
    if (filters.channel === 'full' && !PLATFORMS.every((p) => liveOn(p.id))) return false;
    if (filters.channel.startsWith('missing:')) {
      const pid = filters.channel.split(':')[1];
      if (liveOn(pid)) return false;
    }
  }
  return true;
}

function table(rows, today) {
  return html`<div class="table-wrap">
    <table class="table">
      <thead><tr>
        <th scope="col">Unit</th><th scope="col">Region</th><th scope="col">Rent</th>
        <th scope="col">Available</th><th scope="col">Status</th>
        <th scope="col">Channels</th><th scope="col"><span class="sr-only">Actions</span></th>
      </tr></thead>
      <tbody>${rows.map((l) => html`<tr>
        <th scope="row" class="cell-title">
          <a href="#/listings/${l.id}">${l.property || 'Untitled'}</a>
          <small>${roomTypeName(l.roomType)}${l.unitNo ? ` · ${l.unitNo}` : ''}${l.ref ? ` · ${l.ref}` : ''}</small>
        </th>
        <td>${regionName(l.region)}<small class="cell-sub">${l.area || '—'}</small></td>
        <td class="num">${money(l.rent)}</td>
        <td>${formatDate(l.availableFrom)}</td>
        <td>${[badge(statusName(l.status), STATUS_TONE[l.status] || 'neutral')]}</td>
        <td>${[channelDots(l, today)]}</td>
        <td class="cell-actions">
          <a class="btn btn--small" href="#/compose/${l.id}">Compose</a>
          <button class="btn btn--small btn--ghost" data-act="duplicate" data-id="${l.id}">Duplicate</button>
        </td>
      </tr>`)}</tbody>
    </table>
  </div>`;
}

const statusName = (id) => (LISTING_STATUS.find((s) => s.id === id) || {}).name || id;

function channelDots(l, today) {
  return html`<span class="dots">${PLATFORMS.map((p) => {
    const rec = store.findPost(l.id, p.id);
    const st = rec ? store.postState(rec, today) : 'none';
    return html`<span class="dot dot--s${p.series} dot--${st}" title="${`${p.name}: ${POST_WORD[st]}`}">
      <span class="sr-only">${p.name}: ${POST_WORD[st]}</span></span>`;
  })}</span>`;
}

/* ---------------------------------------------------------------- editor */

export function renderEditor(id) {
  const isNew = !id || id === 'new';
  const l = isNew ? store.newListing() : store.listing(id);
  if (!l) return notFound();
  const today = todayISO();

  return html`
    ${[pageHeader({
      title: isNew ? 'New listing' : (l.property || 'Untitled listing'),
      subtitle: isNew ? 'One unit, then push it to every channel.'
        : `${roomTypeName(l.roomType)} · ${regionName(l.region)} · last edited ${relativeDays(new Date(l.updatedAt).toISOString().slice(0, 10), today)}`,
      actions: isNew ? '<a class="btn" href="#/listings">Cancel</a>'
        : html`<a class="btn btn--primary" href="#/compose/${l.id}">Open composer</a>
          <button class="btn btn--danger btn--ghost" data-act="delete" data-id="${l.id}">Delete</button>`,
    })]}

    <form id="listing-form" class="form" data-id="${isNew ? '' : l.id}" novalidate>
      <div class="grid grid--2">
        ${[section('The unit', html`
          <div class="form__grid">
            ${[field('Property / condo name', input('property', l.property, { placeholder: 'e.g. Ridgewood Residence' }))]}
            ${[field('Internal reference', input('ref', l.ref, { placeholder: 'BLV-JB-014' }), 'Your own code — shown in exports, never in the ad.')]}
            ${[field('Unit number', input('unitNo', l.unitNo, { placeholder: 'A-12-03' }))]}
            ${[field('Room type', select('roomType', l.roomType, ROOM_TYPES))]}
            ${[field('Region', select('region', l.region, REGIONS.filter((r) => r.id !== 'ALL')))]}
            ${[field('Area / district', input('area', l.area, { placeholder: 'Taman Molek' }))]}
            ${[field('Full address', input('address', l.address, { placeholder: 'Jalan …' }))]}
            ${[field('Room size', input('size', l.size, { placeholder: '120 sq ft' }))]}
            ${[field('Furnishing', select('furnishing', l.furnishing, ['Fully furnished', 'Partially furnished', 'Unfurnished']))]}
            ${[field('Listing status', select('status', l.status, LISTING_STATUS))]}
          </div>`)]}

        ${[section('The offer', html`
          <div class="form__grid">
            ${[field('Monthly rent (RM)', input('rent', l.rent, { type: 'number', attrs: 'min="0" step="10"' }))]}
            ${[field('Deposit (RM)', input('deposit', l.deposit, { type: 'number', attrs: 'min="0" step="10"' }), 'Leave at 0 to keep it out of the copy.')]}
            ${[field('Utilities', select('utilities', l.utilities, [
              { id: 'included', name: 'Included in rent' },
              { id: 'split', name: 'Split between housemates' },
              { id: 'excluded', name: 'Billed separately' },
            ]))]}
            ${[field('Available from', input('availableFrom', l.availableFrom, { type: 'date' }))]}
            ${[field('Preferred tenant', select('tenantPref', l.tenantPref, TENANT_PREFS))]}
          </div>
          ${[field('Headline highlight', textarea('highlight', l.highlight, { rows: 2, placeholder: 'One sentence the ad should lead with.' }))]}
          ${[field('Nearby landmarks', textarea('nearby', (l.nearby || []).join('\n'), { rows: 4, placeholder: 'One per line\nAEON Tebrau\nUTM Skudai' }), 'Each line becomes a "Near …" bullet.')]}
        `)]}
      </div>

      ${[section('Amenities', checkGrid('amenities', l.amenities, AMENITIES), {
        note: 'Ticked items become the feature bullets in every channel’s copy.',
      })]}

      <div class="grid grid--2">
        ${[section('Photos', html`
          ${[field('Photo links', textarea('photos', (l.photos || []).join('\n'), { rows: 5, placeholder: 'https://…/room-1.jpg' }), 'One URL per line. The app keeps links, not files — upload the images on each platform as usual.')]}
          ${[photoStrip(l.photos || [])]}
        `)]}
        ${[section('Internal notes', textarea('notes', l.notes, { rows: 7, placeholder: 'Access instructions, owner quirks, anything the ad should never say.' }), {
          note: 'Never included in generated copy.',
        })]}
      </div>

      <div class="form__actions form__actions--sticky">
        <a class="btn" href="#/listings">Back to inventory</a>
        <button class="btn btn--primary" type="submit">${isNew ? 'Create listing' : 'Save changes'}</button>
      </div>
    </form>

    ${isNew ? '' : [section('Channels', channelPanel(l, today), {
      note: 'Queue a channel here, then use the composer to generate and post the copy.',
    })]}`;
}

function photoStrip(photos) {
  if (!photos.length) return '<p class="muted">No photo links yet.</p>';
  return html`<div class="photo-strip">${photos.map((src) => html`<a class="photo-strip__item" href="${src}" target="_blank" rel="noopener">
    <img src="${src}" alt="" loading="lazy" onerror="this.closest('.photo-strip__item').classList.add('is-broken')" />
    <span class="photo-strip__fallback">Link unreachable</span>
  </a>`)}</div>`;
}

function channelPanel(l, today) {
  return html`<div class="channel-grid">${PLATFORMS.map((p) => {
    const rec = store.findPost(l.id, p.id);
    const st = rec ? store.postState(rec, today) : 'none';
    const acct = store.pickAccount(p.id, l.region);
    return html`<article class="channel channel--s${p.series}">
      <header class="channel__head">
        <span class="channel__name"><span class="dot dot--s${p.series}" aria-hidden="true"></span>${p.name}</span>
        ${[badge(POST_WORD[st], POST_TONE[st])]}
      </header>
      <dl class="channel__facts">
        <div><dt>Account</dt><dd>${acct ? acct.label : 'none configured'}</dd></div>
        <div><dt>Posted</dt><dd>${rec && rec.postedAt ? formatDate(rec.postedAt) : '—'}</dd></div>
        <div><dt>Next bump</dt><dd>${rec && rec.nextBumpAt ? `${formatDate(rec.nextBumpAt)} (${relativeDays(rec.nextBumpAt, today)})` : `every ${p.bumpDays} days once live`}</dd></div>
        <div><dt>Live URL</dt><dd>${rec && rec.url ? html`<a href="${rec.url}" target="_blank" rel="noopener">open ad</a>` : '—'}</dd></div>
      </dl>
      <div class="channel__actions">
        <a class="btn btn--small btn--primary" href="#/compose/${l.id}/${p.id}">Compose</a>
        ${rec ? html`<button class="btn btn--small" data-act="bump" data-post="${rec.id}">Mark bumped</button>
          <button class="btn btn--small btn--ghost" data-act="unqueue" data-post="${rec.id}">Remove</button>`
        : html`<button class="btn btn--small" data-act="queue" data-listing="${l.id}" data-platform="${p.id}">Queue</button>`}
      </div>
    </article>`;
  })}</div>`;
}

function notFound() {
  return html`${[pageHeader({ title: 'Listing not found' })]}
    ${[emptyState({ title: 'That listing is gone', body: 'It may have been deleted on this device.', action: '<a class="btn btn--primary" href="#/listings">Back to inventory</a>' })]}`;
}

/* ----------------------------------------------------------------- mount */

export function mountList(root, rerender) {
  root.addEventListener('input', (e) => {
    if (e.target.id === 'f-q') { filters.q = e.target.value; rerender({ keepFocus: 'f-q' }); }
  });
  root.addEventListener('change', (e) => {
    const map = { 'f-region': 'region', 'f-status': 'status', 'f-channel': 'channel' };
    if (map[e.target.id]) { filters[map[e.target.id]] = e.target.value; rerender(); }
  });
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'clear-filters') {
      filters = { q: '', region: 'all', status: 'all', channel: 'all' };
      rerender();
    }
    if (btn.dataset.act === 'duplicate') {
      const src = store.listing(btn.dataset.id);
      if (!src) return;
      const { id, createdAt, updatedAt, ...carried } = src;
      const fresh = store.newListing({
        ...carried,
        ref: src.ref ? `${src.ref}-COPY` : '',
        unitNo: '',
        status: 'draft',
      });
      store.saveListing(fresh);
      toast('Listing duplicated', 'good');
      location.hash = `#/listings/${fresh.id}`;
    }
    if (btn.dataset.act === 'export-csv') exportCSV();
  });
}

function exportCSV() {
  const today = todayISO();
  const rows = store.listings();
  if (!rows.length) { toast('Nothing to export', 'warning'); return; }
  const csv = toCSV(rows, [
    { label: 'Reference', get: (l) => l.ref },
    { label: 'Property', get: (l) => l.property },
    { label: 'Unit', get: (l) => l.unitNo },
    { label: 'Room type', get: (l) => roomTypeName(l.roomType) },
    { label: 'Region', get: (l) => regionName(l.region) },
    { label: 'Area', get: (l) => l.area },
    { label: 'Rent', get: (l) => l.rent },
    { label: 'Deposit', get: (l) => l.deposit },
    { label: 'Available', get: (l) => l.availableFrom },
    { label: 'Status', get: (l) => statusName(l.status) },
    ...PLATFORMS.map((p) => ({
      label: p.name,
      get: (l) => {
        const rec = store.findPost(l.id, p.id);
        return rec ? POST_WORD[store.postState(rec, today)] : 'Not listed';
      },
    })),
  ]);
  download(`belive-listings-${today}.csv`, csv, 'text/csv');
  toast('CSV exported', 'good');
}

export function mountEditor(root, rerender, id) {
  const form = root.querySelector('#listing-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const existing = id && id !== 'new' ? store.listing(id) : null;
      const base = existing || store.newListing();
      const record = {
        ...base,
        property: data.get('property').trim(),
        ref: data.get('ref').trim(),
        unitNo: data.get('unitNo').trim(),
        roomType: data.get('roomType'),
        region: data.get('region'),
        area: data.get('area').trim(),
        address: data.get('address').trim(),
        size: data.get('size').trim(),
        furnishing: data.get('furnishing'),
        status: data.get('status'),
        rent: Number(data.get('rent') || 0),
        deposit: Number(data.get('deposit') || 0),
        utilities: data.get('utilities'),
        availableFrom: data.get('availableFrom'),
        tenantPref: data.get('tenantPref'),
        highlight: data.get('highlight').trim(),
        nearby: splitLines(data.get('nearby')),
        photos: splitLines(data.get('photos')),
        notes: data.get('notes').trim(),
        amenities: data.getAll('amenities'),
      };
      if (!record.property) { toast('Give the property a name first', 'critical'); return; }
      store.saveListing(record);
      toast('Listing saved', 'good');
      if (!existing) location.hash = `#/listings/${record.id}`;
      else rerender();
    });
  }

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'queue') {
      store.queuePost(btn.dataset.listing, btn.dataset.platform, (store.pickAccount(btn.dataset.platform, (store.listing(btn.dataset.listing) || {}).region) || {}).id);
      toast(`${platformName(btn.dataset.platform)} queued`, 'good');
      rerender();
    }
    if (act === 'bump') { store.bumpPost(btn.dataset.post); toast('Bump recorded', 'good'); rerender(); }
    if (act === 'unqueue') { store.removePost(btn.dataset.post); rerender(); }
    if (act === 'delete') {
      const ok = await confirmDialog('Delete this listing?',
        'The listing and every posting record attached to it are removed from this browser. This cannot be undone.',
        'Delete listing');
      if (ok) { store.deleteListing(btn.dataset.id); toast('Listing deleted'); location.hash = '#/listings'; }
    }
  });
}

const splitLines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
