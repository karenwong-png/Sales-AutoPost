/**
 * Credential vault.
 *
 * Login e-mails and passwords for iBilik / Mudah / Facebook / PropertyGuru are
 * encrypted with AES-GCM under a key derived from a master passphrase
 * (PBKDF2-SHA256, 310 000 iterations) and kept in this browser's localStorage.
 *
 * Consequences worth knowing before you rely on it:
 *   - The ciphertext never leaves the device and is never committed to the repo.
 *   - Nobody — including whoever deploys this site — can recover the contents
 *     without the passphrase. There is no reset, only "wipe and re-enter".
 *   - Clearing site data in the browser destroys the vault. Use Export first.
 */

const KEY = 'belive.autopost.vault.v1';
const ITERATIONS = 310000;
const AUTO_LOCK_MS = 15 * 60 * 1000;

const enc = new TextEncoder();
const dec = new TextDecoder();

let cryptoKey = null;     // CryptoKey while unlocked, null while locked
let plain = null;         // { [accountId]: { username, password, updatedAt } }
let lockTimer = null;
const listeners = new Set();

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn(status()));

const b64 = {
  to: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  from: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

function readBlob() {
  try {
    const rawText = localStorage.getItem(KEY);
    return rawText ? JSON.parse(rawText) : null;
  } catch {
    return null;
  }
}

export const exists = () => Boolean(readBlob());
export const isUnlocked = () => Boolean(cryptoKey);

export function status() {
  return { exists: exists(), unlocked: isUnlocked(), count: plain ? Object.keys(plain).length : 0 };
}

async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function writeBlob(salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, cryptoKey, enc.encode(JSON.stringify(plain)),
  );
  const blob = {
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS },
    salt: b64.to(salt),
    iv: b64.to(iv),
    data: b64.to(cipher),
    updatedAt: Date.now(),
  };
  localStorage.setItem(KEY, JSON.stringify(blob));
  return blob;
}

/** Salt is per-vault, kept alongside the ciphertext. */
let activeSalt = null;

export async function create(passphrase) {
  if (!passphrase || passphrase.length < 8) throw new Error('Use at least 8 characters.');
  activeSalt = crypto.getRandomValues(new Uint8Array(16));
  cryptoKey = await deriveKey(passphrase, activeSalt);
  plain = {};
  await writeBlob(activeSalt);
  armAutoLock();
  emit();
}

export async function unlock(passphrase) {
  const blob = readBlob();
  if (!blob) throw new Error('No vault on this device yet.');
  const salt = b64.from(blob.salt);
  const key = await deriveKey(passphrase, salt);
  let decrypted;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64.from(blob.iv) }, key, b64.from(blob.data),
    );
  } catch {
    throw new Error('Wrong passphrase.');
  }
  cryptoKey = key;
  activeSalt = salt;
  plain = JSON.parse(dec.decode(decrypted));
  armAutoLock();
  emit();
}

export function lock() {
  cryptoKey = null;
  plain = null;
  activeSalt = null;
  clearTimeout(lockTimer);
  emit();
}

function armAutoLock() {
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => {
    if (isUnlocked()) { lock(); }
  }, AUTO_LOCK_MS);
}

/** Any interaction with the vault pushes the auto-lock back. */
export const touch = () => { if (isUnlocked()) armAutoLock(); };

function assertUnlocked() {
  if (!isUnlocked()) throw new Error('Vault is locked.');
  touch();
}

export function getCredential(accountId) {
  assertUnlocked();
  return plain[accountId] || null;
}

export function allAccountIds() {
  return plain ? Object.keys(plain) : [];
}

export async function setCredential(accountId, { username, password }) {
  assertUnlocked();
  plain[accountId] = {
    username: username || '',
    password: password || '',
    updatedAt: Date.now(),
  };
  await writeBlob(activeSalt);
  emit();
}

export async function removeCredential(accountId) {
  assertUnlocked();
  delete plain[accountId];
  await writeBlob(activeSalt);
  emit();
}

export async function changePassphrase(current, next) {
  await unlock(current);
  const snapshot = { ...plain };
  activeSalt = crypto.getRandomValues(new Uint8Array(16));
  cryptoKey = await deriveKey(next, activeSalt);
  plain = snapshot;
  await writeBlob(activeSalt);
  emit();
}

/** Encrypted backup — safe to store in a password manager, useless without the passphrase. */
export function exportBlob() {
  const blob = readBlob();
  if (!blob) throw new Error('Nothing to export.');
  return JSON.stringify(blob, null, 2);
}

export function importBlob(text) {
  const blob = JSON.parse(text);
  if (!blob || blob.v !== 1 || !blob.data || !blob.salt || !blob.iv) {
    throw new Error('That file is not a vault backup.');
  }
  localStorage.setItem(KEY, JSON.stringify(blob));
  lock();
  emit();
}

export function destroy() {
  localStorage.removeItem(KEY);
  lock();
}
