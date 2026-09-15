/** Small DOM / formatting helpers shared by every view. */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** HTML-escape everything that comes from operator input before it reaches innerHTML. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Tagged template for building markup.
 *
 * Interpolated values are HTML-escaped by default, so operator text can never
 * break the page. Two things are treated as trusted markup instead: the result
 * of another html`` call, and an array — arrays are the deliberate escape hatch
 * for composing fragments, e.g. ${[section(...)]} or ${items.map(row)}.
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += resolve(values[i]) + strings[i + 1];
  return markRaw(out);
}

function markRaw(text) {
  const s = new String(text);
  s.__raw = true;
  return s;
}

/** Mark a string as already-safe HTML inside an html`` template. */
export const raw = (value) => markRaw(value == null ? '' : String(value));

function resolve(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(resolveTrusted).join('');
  if (v.__raw) return String(v);
  return esc(v);
}

function resolveTrusted(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(resolveTrusted).join('');
  return String(v);
}

export const money = (n) => `RM${Number(n || 0).toLocaleString('en-MY', { maximumFractionDigits: 0 })}`;

export const DAY = 86400000;

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function addDays(iso, days) {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISO}T00:00:00`).getTime();
  return Math.round((b - a) / DAY);
}

/** "in 3 days" / "2 days ago" / "today" — null-safe. */
export function relativeDays(iso, from = todayISO()) {
  const d = daysBetween(from, iso);
  if (d === null) return '—';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${Math.abs(d)} days ago`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-MY', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export const pluralise = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const slug = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Sort helper that keeps undefined values at the end. */
export const by = (key, dir = 1) => (a, b) => {
  const x = a[key], y = b[key];
  if (x === y) return 0;
  if (x === undefined || x === null) return 1;
  if (y === undefined || y === null) return -1;
  return x > y ? dir : -dir;
};

let toastTimer = null;
export function toast(message, tone = 'info') {
  const host = $('#toast-host');
  if (!host) return;
  host.innerHTML = html`<div class="toast toast--${tone}" role="status">${message}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.innerHTML = ''; }, 3200);
}

export async function copyText(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} to clipboard`, 'good');
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back to a hidden textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    toast(ok ? `${label} to clipboard` : 'Could not copy — select the text manually', ok ? 'good' : 'critical');
    return ok;
  }
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Minimal CSV writer — quotes everything, so Excel never re-types a column. */
export function toCSV(rows, headers) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = headers.map((h) => cell(h.label)).join(',');
  const body = rows.map((r) => headers.map((h) => cell(h.get(r))).join(',')).join('\n');
  return `${head}\n${body}`;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
