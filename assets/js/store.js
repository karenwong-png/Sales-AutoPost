/**
 * Application state: a single observable object persisted to localStorage.
 *
 * Only non-secret data lives here. Login e-mails and passwords go through
 * vault.js, which encrypts them under the operator's master passphrase.
 */
import { ACCOUNT_SCAFFOLD, platform } from './platforms.js';
import { uid, todayISO, addDays, daysBetween } from './utils.js';

const KEY = 'belive.autopost.state.v1';
const SCHEMA = 1;

const blank = () => ({
  schema: SCHEMA,
  createdAt: Date.now(),
  listings: [],
  posts: [],
  enquiries: [],
  activity: [],
  accounts: ACCOUNT_SCAFFOLD.map((a) => ({
    ...a, username: '', hasSecret: false, active: true, lastUsedAt: null, notes: '',
  })),
  settings: {
    theme: 'system',
    company: 'BeLive',
    agentName: '',
    agentPhone: '',
    whatsapp: '',
    renTag: '',
    signature: '',
    defaultRegion: 'JB',
    onboarded: false,
  },
});

let state = blank();
const listeners = new Set();

/* ------------------------------------------------------------------ load */

export function load() {
  try {
    const rawText = localStorage.getItem(KEY);
    if (rawText) {
      const parsed = JSON.parse(rawText);
      state = migrate(parsed);
    }
  } catch (err) {
    console.warn('[autopost] could not read saved state, starting fresh', err);
    state = blank();
  }
  return state;
}

function migrate(parsed) {
  const base = blank();
  const next = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
  // Accounts added to the scaffold after a save happened should still appear.
  const known = new Set((next.accounts || []).map((a) => a.id));
  next.accounts = [
    ...(next.accounts || []),
    ...ACCOUNT_SCAFFOLD.filter((a) => !known.has(a.id))
      .map((a) => ({ ...a, username: '', hasSecret: false, active: true, lastUsedAt: null, notes: '' })),
  ];
  next.schema = SCHEMA;
  return next;
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.error('[autopost] save failed', err);
    }
  }, 60);
}

/* ------------------------------------------------------------ observable */

export const get = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  persist();
  listeners.forEach((fn) => fn(state));
}

/** Mutate through here so every change is persisted and broadcast exactly once. */
export function update(mutator) {
  mutator(state);
  commit();
  return state;
}

export function replaceAll(next) {
  state = migrate(next);
  commit();
}

export function resetAll() {
  state = blank();
  commit();
}

/* -------------------------------------------------------------- activity */

export function log(kind, message, meta = {}) {
  update((s) => {
    s.activity.unshift({ id: uid('act'), kind, message, meta, at: Date.now() });
    s.activity = s.activity.slice(0, 500);
  });
}

/* -------------------------------------------------------------- listings */

export const listings = () => state.listings;
export const listing = (id) => state.listings.find((l) => l.id === id);

export function newListing(partial = {}) {
  return {
    id: uid('lst'),
    ref: '',
    property: '',
    unitNo: '',
    region: state.settings.defaultRegion || 'JB',
    area: '',
    address: '',
    roomType: 'medium',
    rent: 0,
    deposit: 0,
    utilities: 'included',
    availableFrom: todayISO(),
    tenantPref: 'Any',
    furnishing: 'Fully furnished',
    size: '',
    amenities: [],
    nearby: [],
    photos: [],
    highlight: '',
    notes: '',
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  };
}

export function saveListing(record) {
  update((s) => {
    const i = s.listings.findIndex((l) => l.id === record.id);
    const next = { ...record, updatedAt: Date.now() };
    if (i === -1) s.listings.unshift(next);
    else s.listings[i] = next;
  });
  log('listing', `Saved listing ${record.ref || record.property}`, { listingId: record.id });
}

export function deleteListing(id) {
  const target = listing(id);
  update((s) => {
    s.listings = s.listings.filter((l) => l.id !== id);
    s.posts = s.posts.filter((p) => p.listingId !== id);
  });
  log('listing', `Deleted listing ${target ? target.ref || target.property : id}`, { listingId: id });
}

/* ----------------------------------------------------------------- posts */

export const posts = () => state.posts;
export const postsFor = (listingId) => state.posts.filter((p) => p.listingId === listingId);
export const post = (id) => state.posts.find((p) => p.id === id);

export function findPost(listingId, platformId) {
  return state.posts.find(
    (p) => p.listingId === listingId && p.platformId === platformId && p.status !== 'removed',
  );
}

/** Queue a platform for a listing (idempotent — returns the existing record). */
export function queuePost(listingId, platformId, accountId = null) {
  const existing = findPost(listingId, platformId);
  if (existing) return existing;
  const record = {
    id: uid('post'),
    listingId,
    platformId,
    accountId,
    status: 'queued',
    url: '',
    postedAt: null,
    lastBumpAt: null,
    nextBumpAt: null,
    expiresAt: null,
    views: 0,
    notes: '',
    createdAt: Date.now(),
  };
  update((s) => { s.posts.unshift(record); });
  return record;
}

/** Record that the ad is now live: sets the bump clock and the expiry clock. */
export function markPosted(postId, { url = '', accountId = null, when = todayISO() } = {}) {
  const p = post(postId);
  if (!p) return null;
  const def = platform(p.platformId) || { bumpDays: 7, expiryDays: 30 };
  update(() => {
    p.status = 'live';
    p.url = url || p.url;
    if (accountId) p.accountId = accountId;
    p.postedAt = when;
    p.lastBumpAt = when;
    p.nextBumpAt = addDays(when, def.bumpDays);
    p.expiresAt = addDays(when, def.expiryDays);
  });
  log('post', `Posted to ${p.platformId}`, { listingId: p.listingId, platformId: p.platformId });
  return p;
}

export function bumpPost(postId, when = todayISO()) {
  const p = post(postId);
  if (!p) return null;
  const def = platform(p.platformId) || { bumpDays: 7, expiryDays: 30 };
  update(() => {
    p.status = 'live';
    p.lastBumpAt = when;
    p.nextBumpAt = addDays(when, def.bumpDays);
    p.expiresAt = addDays(when, def.expiryDays);
  });
  log('bump', `Bumped ${p.platformId}`, { listingId: p.listingId, platformId: p.platformId });
  return p;
}

export function updatePost(postId, patch) {
  const p = post(postId);
  if (!p) return null;
  update(() => Object.assign(p, patch));
  return p;
}

export function removePost(postId) {
  const p = post(postId);
  if (!p) return;
  update((s) => { s.posts = s.posts.filter((x) => x.id !== postId); });
  log('post', `Removed ${p.platformId} posting`, { listingId: p.listingId, platformId: p.platformId });
}

/**
 * Live status of a posting, derived from the clocks rather than stored, so a tab
 * left open overnight still reports the truth.
 */
export function postState(p, today = todayISO()) {
  if (!p) return 'none';
  if (p.status === 'queued' || p.status === 'removed') return p.status;
  if (p.expiresAt && daysBetween(today, p.expiresAt) < 0) return 'expired';
  if (p.nextBumpAt && daysBetween(today, p.nextBumpAt) <= 0) return 'duebump';
  return 'live';
}

/** Everything that needs an operator action today, most urgent first. */
export function dueQueue(today = todayISO()) {
  return state.posts
    .map((p) => ({ post: p, state: postState(p, today), listing: listing(p.listingId) }))
    .filter((row) => row.listing && ['queued', 'duebump', 'expired'].includes(row.state))
    .map((row) => ({
      ...row,
      overdueBy: row.post.nextBumpAt ? -daysBetween(today, row.post.nextBumpAt) : 0,
      rank: row.state === 'expired' ? 0 : row.state === 'duebump' ? 1 : 2,
    }))
    .sort((a, b) => a.rank - b.rank || b.overdueBy - a.overdueBy);
}

/* -------------------------------------------------------------- accounts */

export const accounts = () => state.accounts;
export const account = (id) => state.accounts.find((a) => a.id === id);

export function accountsFor(platformId, region) {
  return state.accounts.filter(
    (a) => a.platformId === platformId && (a.region === 'ALL' || !region || a.region === region),
  );
}

/** The account that should post a given listing on a given platform. */
export function pickAccount(platformId, region) {
  const matches = accountsFor(platformId, region).filter((a) => a.active);
  return matches.find((a) => a.region === region) || matches[0] || null;
}

export function saveAccount(record) {
  update((s) => {
    const i = s.accounts.findIndex((a) => a.id === record.id);
    if (i === -1) s.accounts.push(record);
    else s.accounts[i] = { ...s.accounts[i], ...record };
  });
}

export function addAccount(partial) {
  const record = {
    id: uid('acc'), platformId: 'ibilik', region: 'ALL', label: 'New account',
    username: '', hasSecret: false, active: true, lastUsedAt: null, notes: '', ...partial,
  };
  update((s) => { s.accounts.push(record); });
  return record;
}

export function deleteAccount(id) {
  update((s) => { s.accounts = s.accounts.filter((a) => a.id !== id); });
}

/* ------------------------------------------------------------- enquiries */

export function addEnquiry(partial) {
  const record = {
    id: uid('enq'), listingId: '', platformId: '', name: '', contact: '',
    note: '', outcome: 'new', at: Date.now(), ...partial,
  };
  update((s) => { s.enquiries.unshift(record); });
  log('enquiry', `Enquiry logged from ${record.platformId || 'unknown source'}`, { listingId: record.listingId });
  return record;
}

export function updateEnquiry(id, patch) {
  update((s) => {
    const e = s.enquiries.find((x) => x.id === id);
    if (e) Object.assign(e, patch);
  });
}

export function deleteEnquiry(id) {
  update((s) => { s.enquiries = s.enquiries.filter((e) => e.id !== id); });
}

/* -------------------------------------------------------------- settings */

export function setSetting(key, value) {
  update((s) => { s.settings[key] = value; });
}
