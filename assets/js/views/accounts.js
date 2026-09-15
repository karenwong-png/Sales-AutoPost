/**
 * Channel accounts and the encrypted credential vault.
 *
 * The repository deliberately contains no logins. Each operator enters them once
 * here; AES-GCM encrypts them under a master passphrase and they stay in this
 * browser. See vault.js for the full trade-off.
 */
import * as store from '../store.js';
import * as vault from '../vault.js';
import { PLATFORMS, REGIONS, platform, platformName, regionName } from '../platforms.js';
import { html, esc, formatDateTime, copyText, toast, download } from '../utils.js';
import {
  pageHeader, badge, section, emptyState, field, input, select, openModal, closeModal, confirmDialog,
} from '../ui.js';

export function render() {
  const v = vault.status();
  const accounts = store.accounts();

  return html`
    ${[pageHeader({
      title: 'Channel accounts',
      subtitle: 'One login per marketplace and region. Stored encrypted in this browser — never in the repository.',
      actions: v.unlocked
        ? html`<button class="btn" data-act="export-vault">Export vault</button>
               <button class="btn" data-act="lock">Lock now</button>`
        : '',
    })]}

    ${[section('Vault', vaultBlock(v), {
      note: v.unlocked
        ? 'Unlocked. It locks itself again after 15 minutes without use.'
        : 'Credentials are unreadable until you unlock.',
    })]}

    ${[section('Accounts', accounts.length ? list(accounts, v) : emptyState({
      title: 'No accounts',
      body: 'Add the logins you post from.',
    }), {
      note: 'iBilik uses a separate login per region; Mudah, Facebook and PropertyGuru are national.',
      actions: '<button class="btn btn--small" data-act="add-account">Add account</button>',
    })]}

    ${[section('How credentials are handled', html`
      <ul class="prose-list">
        <li>Nothing is sent anywhere. The vault is encrypted in the browser with AES-GCM and a key derived from your passphrase (PBKDF2-SHA256, 310 000 iterations).</li>
        <li>This site is served from a public GitHub Pages repository, so no password may ever be written into the source. The vault exists precisely so it does not have to be.</li>
        <li>Losing the passphrase means losing the contents — there is no reset. Export a backup and keep it in a password manager.</li>
        <li>Clearing site data for this domain erases the vault along with the listings.</li>
      </ul>`)]}`;
}

function vaultBlock(v) {
  if (!v.exists) {
    return html`<form id="vault-create" class="form form--inline">
      ${[field('Choose a master passphrase', input('pass', '', { type: 'password', placeholder: 'At least 8 characters', attrs: 'autocomplete="new-password"' }))]}
      ${[field('Repeat it', input('pass2', '', { type: 'password', attrs: 'autocomplete="new-password"' }))]}
      <button class="btn btn--primary" type="submit">Create vault</button>
    </form>
    <p class="muted">Pick something you can reproduce on the other office machines — each browser holds its own copy.</p>`;
  }
  if (!v.unlocked) {
    return html`<form id="vault-unlock" class="form form--inline">
      ${[field('Master passphrase', input('pass', '', { type: 'password', attrs: 'autocomplete="current-password"' }))]}
      <button class="btn btn--primary" type="submit">Unlock</button>
    </form>
    <div class="side-actions">
      <button class="btn btn--small" data-act="import-vault">Import a backup</button>
      <button class="btn btn--small btn--danger btn--ghost" data-act="destroy-vault">Forget this vault</button>
    </div>`;
  }
  return html`<p class="side-status">${[badge(`Unlocked · ${v.count} credential${v.count === 1 ? '' : 's'} stored`, 'good')]}</p>
    <div class="side-actions">
      <button class="btn btn--small" data-act="change-pass">Change passphrase</button>
      <button class="btn btn--small" data-act="import-vault">Import a backup</button>
      <button class="btn btn--small btn--danger btn--ghost" data-act="destroy-vault">Forget this vault</button>
    </div>`;
}

function list(accounts, v) {
  return html`<div class="account-grid">${accounts.map((a) => {
    const def = platform(a.platformId) || {};
    const saved = v.unlocked ? Boolean(vault.getCredential(a.id)) : a.hasSecret;
    return html`<article class="account account--s${def.series || 1}">
      <header class="account__head">
        <span class="account__title"><span class="dot dot--s${def.series || 1}" aria-hidden="true"></span>${a.label}</span>
        ${[badge(saved ? 'Saved' : 'Not set', saved ? 'good' : 'warning')]}
      </header>
      <dl class="facts">
        <div><dt>Channel</dt><dd>${platformName(a.platformId)}</dd></div>
        <div><dt>Region</dt><dd>${regionName(a.region)}</dd></div>
        <div><dt>Login</dt><dd>${a.username || '—'}</dd></div>
        <div><dt>Last used</dt><dd>${a.lastUsedAt ? formatDateTime(a.lastUsedAt) : '—'}</dd></div>
      </dl>
      ${a.notes ? html`<p class="account__notes">${a.notes}</p>` : ''}
      <div class="account__actions">
        ${def.loginUrl ? html`<a class="btn btn--small" href="${def.loginUrl}" target="_blank" rel="noopener">Login page</a>` : ''}
        ${v.unlocked
          ? html`<button class="btn btn--small btn--primary" data-act="edit-cred" data-id="${a.id}">${saved ? 'Edit login' : 'Add login'}</button>
                 ${saved ? html`<button class="btn btn--small" data-act="copy-user" data-id="${a.id}">Copy e-mail</button>
                                <button class="btn btn--small" data-act="copy-pass" data-id="${a.id}">Copy password</button>` : ''}`
          : '<span class="muted">Unlock to view or edit</span>'}
        <button class="btn btn--small btn--ghost" data-act="edit-meta" data-id="${a.id}">Rename</button>
      </div>
    </article>`;
  })}</div>`;
}

/* ----------------------------------------------------------------- mount */

export function mount(root, rerender) {
  const create = root.querySelector('#vault-create');
  if (create) {
    create.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(create);
      if (d.get('pass') !== d.get('pass2')) { toast('The two passphrases differ', 'critical'); return; }
      try { await vault.create(d.get('pass')); toast('Vault created', 'good'); rerender(); }
      catch (err) { toast(err.message, 'critical'); }
    });
  }

  const unlock = root.querySelector('#vault-unlock');
  if (unlock) {
    unlock.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await vault.unlock(new FormData(unlock).get('pass')); toast('Unlocked', 'good'); rerender(); }
      catch (err) { toast(err.message, 'critical'); }
    });
  }

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if (act === 'lock') { vault.lock(); toast('Vault locked'); rerender(); }

    if (act === 'edit-cred') credentialDialog(id, rerender);
    if (act === 'edit-meta') metaDialog(id, rerender);

    if (act === 'copy-user' || act === 'copy-pass') {
      try {
        const cred = vault.getCredential(id);
        if (!cred) { toast('Nothing saved yet', 'warning'); return; }
        await copyText(act === 'copy-user' ? cred.username : cred.password,
          act === 'copy-user' ? 'E-mail copied' : 'Password copied');
        store.saveAccount({ id, lastUsedAt: Date.now() });
      } catch (err) { toast(err.message, 'critical'); }
    }

    if (act === 'add-account') {
      const rec = store.addAccount({ label: 'New account', platformId: PLATFORMS[0].id, region: 'ALL' });
      metaDialog(rec.id, rerender);
    }

    if (act === 'export-vault') {
      try {
        download(`belive-vault-backup-${new Date().toISOString().slice(0, 10)}.json`, vault.exportBlob());
        toast('Encrypted backup downloaded', 'good');
      } catch (err) { toast(err.message, 'critical'); }
    }

    if (act === 'import-vault') importDialog(rerender);

    if (act === 'change-pass') changePassDialog(rerender);

    if (act === 'destroy-vault') {
      const ok = await confirmDialog('Forget the vault on this device?',
        'Every stored login is erased from this browser. Listings are untouched. Without a backup this cannot be undone.',
        'Erase vault');
      if (ok) { vault.destroy(); toast('Vault erased'); rerender(); }
    }
  });
}

function credentialDialog(id, rerender) {
  const acc = store.account(id);
  if (!acc) return;
  let cred = null;
  try { cred = vault.getCredential(id); } catch { toast('Unlock the vault first', 'warning'); return; }

  openModal(`Login for ${acc.label}`, html`
    <form id="cred-form" class="form">
      ${[field('E-mail or username', input('username', cred ? cred.username : acc.username, { attrs: 'autocomplete="off"' }))]}
      ${[field('Password', input('password', cred ? cred.password : '', { type: 'password', attrs: 'autocomplete="off"' }))]}
      <label class="field field--inline"><input type="checkbox" id="show-pass" /> <span>Show password</span></label>
      <p class="muted">Encrypted before it is written to disk. It never leaves this browser and is not part of the deployed site.</p>
      <div class="form__actions">
        ${cred ? '<button class="btn btn--danger btn--ghost" type="button" data-act="drop">Delete login</button>' : ''}
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn--primary" type="submit">Save</button>
      </div>
    </form>`);

  const form = document.querySelector('#cred-form');
  form.querySelector('#show-pass').addEventListener('change', (e) => {
    form.querySelector('[name=password]').type = e.target.checked ? 'text' : 'password';
  });
  form.querySelector('[data-close]').addEventListener('click', closeModal);
  const drop = form.querySelector('[data-act=drop]');
  if (drop) {
    drop.addEventListener('click', async () => {
      await vault.removeCredential(id);
      store.saveAccount({ id, username: '', hasSecret: false });
      closeModal(); toast('Login deleted'); rerender();
    });
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    try {
      await vault.setCredential(id, { username: d.get('username').trim(), password: d.get('password') });
      store.saveAccount({ id, username: d.get('username').trim(), hasSecret: true });
      closeModal(); toast('Login saved', 'good'); rerender();
    } catch (err) { toast(err.message, 'critical'); }
  });
}

function metaDialog(id, rerender) {
  const acc = store.account(id);
  if (!acc) return;
  openModal('Account details', html`
    <form id="meta-form" class="form">
      ${[field('Label', input('label', acc.label))]}
      ${[field('Channel', select('platformId', acc.platformId, PLATFORMS.map((p) => ({ id: p.id, name: p.name }))))]}
      ${[field('Region', select('region', acc.region, REGIONS))]}
      ${[field('Notes', input('notes', acc.notes, { placeholder: 'Which team uses it, renewal date, anything non-secret.' }))]}
      <div class="form__actions">
        <button class="btn btn--danger btn--ghost" type="button" data-act="drop">Remove account</button>
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn--primary" type="submit">Save</button>
      </div>
    </form>`);
  const form = document.querySelector('#meta-form');
  form.querySelector('[data-close]').addEventListener('click', closeModal);
  form.querySelector('[data-act=drop]').addEventListener('click', async () => {
    const ok = await confirmDialog('Remove this account?', 'The stored login for it is deleted too.', 'Remove');
    if (!ok) return;
    try { await vault.removeCredential(id); } catch { /* vault locked — metadata still goes */ }
    store.deleteAccount(id);
    closeModal(); rerender();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    store.saveAccount({
      id, label: d.get('label').trim() || 'Untitled account',
      platformId: d.get('platformId'), region: d.get('region'), notes: d.get('notes').trim(),
    });
    closeModal(); toast('Account updated', 'good'); rerender();
  });
}

function importDialog(rerender) {
  openModal('Import a vault backup', html`
    <form id="import-form" class="form">
      <p class="muted">Paste the contents of a <code>belive-vault-backup-*.json</code> file. It stays encrypted — you will still need its passphrase to unlock.</p>
      <textarea class="input input--area" name="blob" rows="8" placeholder='{ "v": 1, … }'></textarea>
      <div class="form__actions">
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn--primary" type="submit">Import</button>
      </div>
    </form>`);
  const form = document.querySelector('#import-form');
  form.querySelector('[data-close]').addEventListener('click', closeModal);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      vault.importBlob(new FormData(form).get('blob'));
      closeModal(); toast('Backup imported — unlock it now', 'good'); rerender();
    } catch (err) { toast(err.message, 'critical'); }
  });
}

function changePassDialog(rerender) {
  openModal('Change the master passphrase', html`
    <form id="pass-form" class="form">
      ${[field('Current passphrase', input('current', '', { type: 'password' }))]}
      ${[field('New passphrase', input('next', '', { type: 'password' }))]}
      ${[field('Repeat the new one', input('next2', '', { type: 'password' }))]}
      <div class="form__actions">
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn--primary" type="submit">Change it</button>
      </div>
    </form>`);
  const form = document.querySelector('#pass-form');
  form.querySelector('[data-close]').addEventListener('click', closeModal);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    if (d.get('next') !== d.get('next2')) { toast('The two new passphrases differ', 'critical'); return; }
    if (String(d.get('next')).length < 8) { toast('Use at least 8 characters', 'critical'); return; }
    try {
      await vault.changePassphrase(d.get('current'), d.get('next'));
      closeModal(); toast('Passphrase changed', 'good'); rerender();
    } catch (err) { toast(err.message, 'critical'); }
  });
}
