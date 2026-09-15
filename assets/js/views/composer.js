/**
 * The posting workspace.
 *
 * The four sites have no public write API, so "automation" here means: generate
 * the exact copy each form wants, hand the operator the credentials and the
 * deep link, and record what went live so the bump clock starts. Everything the
 * operator would otherwise retype four times is produced once.
 */
import * as store from '../store.js';
import * as vault from '../vault.js';
import { compose, composePlain, validate, buildTitle } from '../composer.js';
import { PLATFORMS, platform, platformName, regionName, roomTypeName } from '../platforms.js';
import { html, esc, money, formatDate, relativeDays, todayISO, copyText, toast } from '../utils.js';
import { pageHeader, badge, section, emptyState, field, input, openModal, closeModal } from '../ui.js';

const POST_TONE = { live: 'good', duebump: 'warning', expired: 'serious', queued: 'neutral', none: 'neutral' };
const POST_WORD = { live: 'Live', duebump: 'Due bump', expired: 'Expired', queued: 'Queued', none: 'Not listed' };

/** Copy variant per listing+platform, so a re-render does not reshuffle the text. */
const variants = new Map();
const variantKey = (lid, pid) => `${lid}:${pid}`;
export const getVariant = (lid, pid) => variants.get(variantKey(lid, pid)) || 0;

export function render(listingId, platformId) {
  const l = store.listing(listingId);
  if (!l) {
    return html`${[pageHeader({ title: 'Composer' })]}
      ${[emptyState({ title: 'Pick a listing first', body: 'The composer works on one unit at a time.', action: '<a class="btn btn--primary" href="#/listings">Open inventory</a>' })]}`;
  }
  const pid = platform(platformId) ? platformId : PLATFORMS[0].id;
  const def = platform(pid);
  const today = todayISO();
  const rec = store.findPost(l.id, pid);
  const st = rec ? store.postState(rec, today) : 'none';
  const settings = store.get().settings;
  const variant = getVariant(l.id, pid);
  const fields = compose(l, pid, settings, variant);
  const problems = validate(l, pid);
  const acct = store.pickAccount(pid, l.region);

  return html`
    ${[pageHeader({
      title: 'Composer',
      subtitle: `${l.property || 'Untitled'} · ${roomTypeName(l.roomType)} · ${money(l.rent)}/month · ${regionName(l.region)}`,
      actions: html`<a class="btn" href="#/listings/${l.id}">Edit listing</a>
        <button class="btn" data-act="copy-all">Copy whole draft</button>
        <a class="btn btn--primary" href="${def.postUrl}" target="_blank" rel="noopener" data-act="open-form">Open ${def.name} form</a>`,
    })]}

    <nav class="tabs" aria-label="Channel">
      ${PLATFORMS.map((p) => {
        const r = store.findPost(l.id, p.id);
        const s = r ? store.postState(r, today) : 'none';
        return html`<a class="tab${p.id === pid ? ' is-active' : ''}" href="#/compose/${l.id}/${p.id}">
          <span class="dot dot--s${p.series}" aria-hidden="true"></span>${p.name}
          <span class="tab__state tab__state--${s}">${POST_WORD[s]}</span>
        </a>`;
      })}
    </nav>

    <div class="compose">
      <div class="compose__main">
        ${[section(`${def.name} draft`, fieldList(fields, l.id, pid), {
          note: `Variant ${variant + 1} of 4 — rotate it when you post two rooms in the same block.`,
          actions: html`<button class="btn btn--small" data-act="rotate">Rotate wording</button>`,
        })]}
      </div>

      <aside class="compose__side">
        ${[section('Status', statusBlock(l, def, rec, st, today), { actions: '' })]}
        ${[section('Account', accountBlock(acct, def), { note: def.perRegionAccount ? 'This platform uses a separate login per region.' : 'One national login.' })]}
        ${[section('Before you submit', checks(problems, def))]}
      </aside>
    </div>`;
}

function fieldList(fields, listingId, pid) {
  return html`<div class="fields">${fields.map((f) => {
    const over = f.limit && f.value.length > f.limit;
    return html`<div class="fieldblock${over ? ' is-over' : ''}">
      <div class="fieldblock__head">
        <span class="fieldblock__label">${f.label}</span>
        ${f.limit ? html`<span class="fieldblock__count${over ? ' is-over' : ''}">${f.value.length} / ${f.limit}</span>` : ''}
        <button class="btn btn--tiny" data-act="copy-field" data-key="${f.key}">Copy</button>
      </div>
      ${f.multiline
        ? html`<pre class="fieldblock__value" data-field="${f.key}">${f.value}</pre>`
        : html`<p class="fieldblock__value fieldblock__value--one" data-field="${f.key}">${f.value || '—'}</p>`}
    </div>`;
  })}</div>`;
}

function statusBlock(l, def, rec, st, today) {
  return html`
    <p class="side-status">${[badge(POST_WORD[st], POST_TONE[st])]}</p>
    <dl class="facts">
      <div><dt>Posted</dt><dd>${rec && rec.postedAt ? formatDate(rec.postedAt) : '—'}</dd></div>
      <div><dt>Last bump</dt><dd>${rec && rec.lastBumpAt ? formatDate(rec.lastBumpAt) : '—'}</dd></div>
      <div><dt>Next bump</dt><dd>${rec && rec.nextBumpAt ? `${formatDate(rec.nextBumpAt)} · ${relativeDays(rec.nextBumpAt, today)}` : `every ${def.bumpDays} days`}</dd></div>
      <div><dt>Expires</dt><dd>${rec && rec.expiresAt ? formatDate(rec.expiresAt) : `${def.expiryDays} days after posting`}</dd></div>
      <div><dt>Live URL</dt><dd>${rec && rec.url ? html`<a href="${rec.url}" target="_blank" rel="noopener">open ad</a>` : '—'}</dd></div>
    </dl>
    <div class="side-actions">
      <button class="btn btn--primary btn--small" data-act="mark-posted">${rec && rec.postedAt ? 'Update posting' : 'Mark as posted'}</button>
      ${rec ? html`<button class="btn btn--small" data-act="bump">Mark bumped today</button>` : ''}
      ${rec ? html`<button class="btn btn--small btn--ghost" data-act="unqueue">Remove record</button>`
            : html`<button class="btn btn--small" data-act="queue">Queue it</button>`}
      <a class="btn btn--small btn--ghost" href="${def.manageUrl}" target="_blank" rel="noopener">Manage on ${def.name}</a>
    </div>`;
}

function accountBlock(acct, def) {
  if (!acct) {
    return html`<p class="muted">No account is configured for this channel and region.</p>
      <a class="btn btn--small" href="#/accounts">Set one up</a>`;
  }
  const v = vault.status();
  return html`<p class="account-line"><strong>${acct.label}</strong><small>${acct.username || 'login not saved yet'}</small></p>
    <div class="side-actions">
      <a class="btn btn--small" href="${def.loginUrl}" target="_blank" rel="noopener">Open login page</a>
      ${v.unlocked
        ? html`<button class="btn btn--small" data-act="copy-user" data-acc="${acct.id}">Copy e-mail</button>
               <button class="btn btn--small" data-act="copy-pass" data-acc="${acct.id}">Copy password</button>`
        : html`<button class="btn btn--small" data-act="unlock-vault">${v.exists ? 'Unlock vault' : 'Set up vault'}</button>`}
    </div>`;
}

function checks(problems, def) {
  const errors = problems.filter((p) => p.level === 'error');
  const warns = problems.filter((p) => p.level === 'warn');
  return html`
    ${errors.length ? html`<ul class="checks checks--error">${errors.map((p) => html`<li><span aria-hidden="true">■</span>${p.text}</li>`)}</ul>` : ''}
    ${warns.length ? html`<ul class="checks checks--warn">${warns.map((p) => html`<li><span aria-hidden="true">▲</span>${p.text}</li>`)}</ul>` : ''}
    ${!errors.length && !warns.length ? '<p class="checks__ok"><span aria-hidden="true">●</span> Nothing blocking — the draft fits the form.</p>' : ''}
    <ol class="checklist">${def.checklist.map((c) => html`<li>${c}</li>`)}</ol>`;
}

/* ----------------------------------------------------------------- mount */

export function mount(root, rerender, listingId, platformId) {
  const pid = platform(platformId) ? platformId : PLATFORMS[0].id;
  const l = store.listing(listingId);
  if (!l) return;

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const settings = store.get().settings;
    const variant = getVariant(l.id, pid);

    if (act === 'rotate') {
      variants.set(variantKey(l.id, pid), (variant + 1) % 4);
      rerender();
    }

    if (act === 'copy-field') {
      const f = compose(l, pid, settings, variant).find((x) => x.key === btn.dataset.key);
      if (f) await copyText(f.value, f.label);
    }

    if (act === 'copy-all') {
      await copyText(composePlain(l, pid, settings, variant), 'Full draft copied');
    }

    if (act === 'open-form') {
      // Queue the record on first open so the channel shows up in the pipeline.
      if (!store.findPost(l.id, pid)) {
        store.queuePost(l.id, pid, (store.pickAccount(pid, l.region) || {}).id || null);
        setTimeout(rerender, 50);
      }
    }

    if (act === 'queue') {
      store.queuePost(l.id, pid, (store.pickAccount(pid, l.region) || {}).id || null);
      toast(`${platformName(pid)} queued`, 'good');
      rerender();
    }

    if (act === 'bump') {
      const rec = store.findPost(l.id, pid);
      if (rec) { store.bumpPost(rec.id); toast('Bump recorded', 'good'); rerender(); }
    }

    if (act === 'unqueue') {
      const rec = store.findPost(l.id, pid);
      if (rec) { store.removePost(rec.id); rerender(); }
    }

    if (act === 'mark-posted') markPostedDialog(l, pid, rerender);

    if (act === 'copy-user' || act === 'copy-pass') {
      try {
        const cred = vault.getCredential(btn.dataset.acc);
        if (!cred) { toast('Nothing saved for this account yet', 'warning'); return; }
        await copyText(act === 'copy-user' ? cred.username : cred.password,
          act === 'copy-user' ? 'E-mail copied' : 'Password copied');
        store.saveAccount({ id: btn.dataset.acc, lastUsedAt: Date.now() });
      } catch (err) {
        toast(err.message, 'critical');
      }
    }

    if (act === 'unlock-vault') location.hash = '#/accounts';
  });
}

function markPostedDialog(l, pid, rerender) {
  const rec = store.findPost(l.id, pid) || store.queuePost(l.id, pid, (store.pickAccount(pid, l.region) || {}).id || null);
  const def = platform(pid);
  openModal(`Record the ${def.name} posting`, html`
    <form id="posted-form" class="form">
      ${[field('Live ad URL', input('url', rec.url, { placeholder: 'https://…' }), 'Paste the address of the published ad so the queue can link straight to it.')]}
      ${[field('Date posted', input('when', rec.postedAt || todayISO(), { type: 'date' }))]}
      ${[field('Notes', input('notes', rec.notes, { placeholder: 'Ad ID, which group it went into, anything worth remembering.' }))]}
      <p class="muted">Recording this starts the bump clock: ${def.name} gets nudged every ${def.bumpDays} days and expires after ${def.expiryDays}.</p>
      <div class="form__actions">
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn--primary" type="submit">Save posting</button>
      </div>
    </form>`);
  const form = document.querySelector('#posted-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    store.updatePost(rec.id, { notes: data.get('notes') });
    store.markPosted(rec.id, { url: data.get('url').trim(), when: data.get('when') || todayISO() });
    closeModal();
    toast('Posting recorded', 'good');
    rerender();
  });
  form.querySelector('[data-close]').addEventListener('click', closeModal);
}
