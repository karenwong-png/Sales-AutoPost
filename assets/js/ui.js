/** Shared presentational pieces: tiles, badges, empty states, the modal. */
import { html, esc, $ } from './utils.js';

export function pageHeader({ title, subtitle = '', actions = '' }) {
  return html`<header class="page-head">
    <div>
      <h1 class="page-head__title">${title}</h1>
      ${subtitle ? html`<p class="page-head__sub">${subtitle}</p>` : ''}
    </div>
    ${actions ? html`<div class="page-head__actions">${[actions]}</div>` : ''}
  </header>`;
}

/**
 * A stat tile, not a chart: one number that answers one question.
 * `tone` drives the status colour and is always paired with a word, never
 * carried by colour alone.
 */
export function statTile({ label, value, sub = '', tone = '', href = '' }) {
  const inner = html`<span class="stat__label">${label}</span>
    <strong class="stat__value">${value}</strong>
    ${sub ? html`<span class="stat__sub">${sub}</span>` : ''}`;
  return href
    ? html`<a class="stat stat--${tone || 'plain'}" href="${href}">${[inner]}</a>`
    : html`<div class="stat stat--${tone || 'plain'}">${[inner]}</div>`;
}

const TONE_ICON = { good: '●', warning: '▲', serious: '◆', critical: '■', neutral: '○' };

/** Status pill — icon + label, so the state never depends on hue. */
export function badge(text, tone = 'neutral') {
  return html`<span class="badge badge--${tone}"><span class="badge__icon" aria-hidden="true">${TONE_ICON[tone] || '○'}</span>${text}</span>`;
}

export function emptyState({ title, body, action = '' }) {
  return html`<div class="empty">
    <h3>${title}</h3>
    <p>${body}</p>
    ${action ? html`<div class="empty__action">${[action]}</div>` : ''}
  </div>`;
}

export function section(title, body, { note = '', actions = '' } = {}) {
  return html`<section class="panel">
    <div class="panel__head">
      <h2 class="panel__title">${title}</h2>
      ${note ? html`<p class="panel__note">${note}</p>` : ''}
      ${actions ? html`<div class="panel__actions">${[actions]}</div>` : ''}
    </div>
    <div class="panel__body">${[body]}</div>
  </section>`;
}

/* ----------------------------------------------------------------- modal */

let onClose = null;

export function openModal(title, bodyHTML, { wide = false, onDismiss = null } = {}) {
  const dlg = $('#modal');
  if (!dlg) return;
  dlg.classList.toggle('modal--wide', Boolean(wide));
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML;
  onClose = onDismiss;
  if (!dlg.open) dlg.showModal();
  const focusable = dlg.querySelector('input,select,textarea,button:not(.modal__close)');
  if (focusable) setTimeout(() => focusable.focus(), 30);
}

export function closeModal() {
  const dlg = $('#modal');
  if (dlg && dlg.open) dlg.close();
  if (onClose) { const fn = onClose; onClose = null; fn(); }
}

export function confirmDialog(title, message, confirmLabel = 'Confirm') {
  return new Promise((resolve) => {
    openModal(title, html`<p class="confirm__text">${message}</p>
      <div class="form__actions">
        <button class="btn" data-confirm="no">Cancel</button>
        <button class="btn btn--danger" data-confirm="yes">${confirmLabel}</button>
      </div>`, { onDismiss: () => resolve(false) });
    const body = $('#modal-body');
    body.addEventListener('click', (e) => {
      const choice = e.target.closest('[data-confirm]');
      if (!choice) return;
      onClose = null;
      closeModal();
      resolve(choice.dataset.confirm === 'yes');
    }, { once: true });
  });
}

/* ---------------------------------------------------------------- fields */

export function field(label, control, hint = '') {
  return html`<label class="field">
    <span class="field__label">${label}</span>
    ${[control]}
    ${hint ? html`<span class="field__hint">${hint}</span>` : ''}
  </label>`;
}

export function input(name, value, { type = 'text', placeholder = '', attrs = '' } = {}) {
  return `<input class="input" name="${esc(name)}" type="${esc(type)}" value="${esc(value ?? '')}" placeholder="${esc(placeholder)}" ${attrs} />`;
}

export function textarea(name, value, { rows = 4, placeholder = '' } = {}) {
  return `<textarea class="input input--area" name="${esc(name)}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value ?? '')}</textarea>`;
}

export function select(name, value, options, { attrs = '' } = {}) {
  const opts = options.map((o) => {
    const id = typeof o === 'string' ? o : o.id;
    const label = typeof o === 'string' ? o : o.name;
    return `<option value="${esc(id)}"${String(id) === String(value) ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
  return `<select class="input input--select" name="${esc(name)}" ${attrs}>${opts}</select>`;
}

export function checkGrid(name, values, options) {
  const set = new Set(values || []);
  return html`<div class="checkgrid">${options.map((o) => html`<label class="checkgrid__item">
    <input type="checkbox" name="${name}" value="${o}"${set.has(o) ? ' checked' : ''} />
    <span>${o}</span>
  </label>`)}</div>`;
}
