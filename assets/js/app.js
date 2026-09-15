/** Router, shell chrome, keyboard shortcuts and the command palette. */
import * as store from './store.js';
import * as vault from './vault.js';
import { PLATFORMS, platformName, regionName, roomTypeName } from './platforms.js';
import { $, $$, html, esc, todayISO, pluralise } from './utils.js';
import { openModal, closeModal } from './ui.js';

import * as dashboard from './views/dashboard.js';
import * as listings from './views/listings.js';
import * as composer from './views/composer.js';
import * as pipeline from './views/pipeline.js';
import * as accounts from './views/accounts.js';
import * as analytics from './views/analytics.js';
import * as settings from './views/settings.js';

const NAV = [
  { href: '#/', label: 'Control tower', key: 'dashboard' },
  { href: '#/listings', label: 'Listings', key: 'listings' },
  { href: '#/pipeline', label: 'Work queue', key: 'pipeline' },
  { href: '#/analytics', label: 'Performance', key: 'analytics' },
  { href: '#/accounts', label: 'Accounts', key: 'accounts' },
  { href: '#/settings', label: 'Settings', key: 'settings' },
];

let current = { key: 'dashboard', params: [] };

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { key: 'dashboard', params: [] };
  const [head, ...rest] = parts;
  if (head === 'listings') {
    if (!rest.length) return { key: 'listings', params: [] };
    return { key: 'listing', params: rest };
  }
  if (head === 'compose') return { key: 'compose', params: rest };
  if (['pipeline', 'accounts', 'analytics', 'settings'].includes(head)) return { key: head, params: rest };
  return { key: 'dashboard', params: [] };
}

function viewFor(route) {
  switch (route.key) {
    case 'listings':  return { html: listings.renderList(), mount: (r) => listings.mountList(r, rerender) };
    case 'listing':   return { html: listings.renderEditor(route.params[0]), mount: (r) => listings.mountEditor(r, rerender, route.params[0]) };
    case 'compose':   return { html: composer.render(route.params[0], route.params[1]), mount: (r) => composer.mount(r, rerender, route.params[0], route.params[1]) };
    case 'pipeline':  return { html: pipeline.render(), mount: (r) => pipeline.mount(r, rerender) };
    case 'accounts':  return { html: accounts.render(), mount: (r) => accounts.mount(r, rerender) };
    case 'analytics': return { html: analytics.render(), mount: (r) => analytics.mount(r, rerender) };
    case 'settings':  return { html: settings.render(), mount: (r) => settings.mount(r, rerender) };
    default:          return { html: dashboard.render(), mount: (r) => dashboard.mount(r, rerender) };
  }
}

function render(opts = {}) {
  const root = $('#view');
  const view = viewFor(current);
  root.innerHTML = view.html;
  view.mount(root);
  paintNav();
  paintStatus();
  if (opts.keepFocus) {
    const el = document.getElementById(opts.keepFocus);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  } else if (!opts.preserveScroll) {
    window.scrollTo({ top: 0 });
  }
}

const rerender = (opts = {}) => render({ preserveScroll: true, ...opts });

function paintNav() {
  $$('#nav a').forEach((a) => {
    const key = a.dataset.key;
    const active = key === current.key
      || (key === 'listings' && current.key === 'listing')
      || (key === 'listings' && current.key === 'compose');
    a.classList.toggle('is-active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function paintStatus() {
  const today = todayISO();
  const due = store.dueQueue(today).length;
  const badge = $('#nav-due');
  if (badge) {
    badge.textContent = due ? String(due) : '';
    badge.hidden = !due;
  }
  const v = vault.status();
  const lock = $('#vault-indicator');
  if (lock) {
    lock.textContent = v.unlocked ? 'Vault unlocked' : v.exists ? 'Vault locked' : 'Vault not set up';
    lock.className = `vault-pill vault-pill--${v.unlocked ? 'open' : 'shut'}`;
  }
}

/* ------------------------------------------------------- command palette */

function openPalette() {
  const s = store.get();
  const items = [
    ...NAV.map((n) => ({ label: n.label, hint: 'Go to', href: n.href })),
    { label: 'New listing', hint: 'Create', href: '#/listings/new' },
    ...s.listings.slice(0, 50).map((l) => ({
      label: `${l.property || 'Untitled'} · ${roomTypeName(l.roomType)}`,
      hint: `${regionName(l.region)} · open composer`,
      href: `#/compose/${l.id}`,
    })),
  ];
  openModal('Jump to', html`
    <input class="input input--search" id="palette-input" type="search" placeholder="Type a listing, a page…" autocomplete="off" />
    <ul class="palette" id="palette-list">${items.map((i, idx) => html`<li>
      <a class="palette__item${idx === 0 ? ' is-active' : ''}" href="${i.href}" data-idx="${idx}">
        <span>${i.label}</span><small>${i.hint}</small></a></li>`)}</ul>`);

  const input = $('#palette-input');
  const list = $('#palette-list');
  const rows = () => $$('#palette-list li').filter((li) => !li.hidden);

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    $$('#palette-list li').forEach((li) => {
      li.hidden = Boolean(q) && !li.textContent.toLowerCase().includes(q);
    });
    $$('#palette-list .palette__item').forEach((a, i) => a.classList.toggle('is-active', i === 0));
    const first = rows()[0];
    if (first) {
      $$('#palette-list .palette__item').forEach((a) => a.classList.remove('is-active'));
      first.querySelector('.palette__item').classList.add('is-active');
    }
  });

  input.addEventListener('keydown', (e) => {
    const visible = rows();
    const activeIdx = visible.findIndex((li) => li.querySelector('.is-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.max(0, Math.min(visible.length - 1, activeIdx + (e.key === 'ArrowDown' ? 1 : -1)));
      visible.forEach((li) => li.querySelector('.palette__item').classList.remove('is-active'));
      if (visible[next]) {
        const a = visible[next].querySelector('.palette__item');
        a.classList.add('is-active');
        a.scrollIntoView({ block: 'nearest' });
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = visible[activeIdx === -1 ? 0 : activeIdx];
      const a = row && row.querySelector('.palette__item');
      if (a) { location.hash = a.getAttribute('href'); closeModal(); }
    }
  });

  list.addEventListener('click', () => closeModal());
}

/* ------------------------------------------------------------- bootstrap */

function shortcuts(e) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const map = {
    n: '#/listings/new', d: '#/', l: '#/listings',
    q: '#/pipeline', a: '#/analytics', s: '#/settings', v: '#/accounts',
  };
  const target = map[e.key.toLowerCase()];
  if (target) location.hash = target;
}

function boot() {
  store.load();
  settings.applyTheme(store.get().settings.theme);

  $('#nav').innerHTML = NAV.map((n) => html`<a href="${n.href}" data-key="${n.key}">${n.label}${
    n.key === 'pipeline' ? ['<span class="nav__due" id="nav-due" hidden></span>'] : ''
  }</a>`).join('');

  window.addEventListener('hashchange', () => { current = parseHash(); render(); });
  document.addEventListener('keydown', shortcuts);
  vault.subscribe(() => paintStatus());
  store.subscribe(() => paintStatus());

  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  $('.modal__close').addEventListener('click', () => closeModal());
  $('#palette-trigger').addEventListener('click', openPalette);
  $('#theme-toggle').addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(store.get().settings.theme) + 1) % order.length];
    store.setSetting('theme', next);
    settings.applyTheme(next);
    $('#theme-toggle').setAttribute('title', `Theme: ${next}`);
    if (current.key === 'settings') rerender();
  });

  current = parseHash();
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
