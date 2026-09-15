/** Operator identity, backups, and the channel reference card. */
import * as store from '../store.js';
import * as vault from '../vault.js';
import { PLATFORMS, REGIONS } from '../platforms.js';
import { html, esc, todayISO, toast, download, addDays } from '../utils.js';
import { pageHeader, section, field, input, textarea, select, confirmDialog, openModal, closeModal } from '../ui.js';

export function render() {
  const s = store.get();
  return html`
    ${[pageHeader({
      title: 'Settings',
      subtitle: 'Who the ads are signed by, how the data is backed up, and what each channel expects.',
    })]}

    <div class="grid grid--2">
      ${[section('Signature on every ad', html`
        <form id="settings-form" class="form">
          <div class="form__grid">
            ${[field('Company', input('company', s.settings.company))]}
            ${[field('Agent name', input('agentName', s.settings.agentName, { placeholder: 'Fatin Nadia' }))]}
            ${[field('Phone', input('agentPhone', s.settings.agentPhone, { placeholder: '+60 1x-xxx xxxx' }))]}
            ${[field('WhatsApp', input('whatsapp', s.settings.whatsapp, { placeholder: 'if different from the phone' }))]}
            ${[field('REN / agency tag', input('renTag', s.settings.renTag, { placeholder: 'REN 12345 · E (3) 1234' }), 'PropertyGuru holds listings without one.')]}
            ${[field('Default region', select('defaultRegion', s.settings.defaultRegion, REGIONS.filter((r) => r.id !== 'ALL')))]}
          </div>
          <div class="form__actions"><button class="btn btn--primary" type="submit">Save settings</button></div>
        </form>`, { note: 'These lines close every generated draft.' })]}

      ${[section('Appearance and data', html`
        ${[field('Theme', select('theme', s.settings.theme, [
          { id: 'system', name: 'Follow the system' },
          { id: 'light', name: 'Light' },
          { id: 'dark', name: 'Dark' },
        ], { attrs: 'id="theme-select"' }))]}
        <div class="side-actions">
          <button class="btn btn--small" data-act="backup">Download a backup</button>
          <button class="btn btn--small" data-act="restore">Restore from backup</button>
          <button class="btn btn--small" data-act="sample">Load sample inventory</button>
          <button class="btn btn--small btn--danger btn--ghost" data-act="wipe">Erase everything</button>
        </div>
        <p class="muted">Listings, postings and enquiries live in this browser's storage. The backup file holds all of them — it does <strong>not</strong> include the credential vault, which is exported separately from the Accounts page.</p>`)]}
    </div>

    ${[section('Channel reference', html`<div class="table-wrap"><table class="table table--compact">
      <thead><tr><th scope="col">Channel</th><th scope="col">Title limit</th><th scope="col">Body limit</th><th scope="col">Photos</th><th scope="col">Bump every</th><th scope="col">Expires after</th><th scope="col">Account model</th></tr></thead>
      <tbody>${PLATFORMS.map((p) => html`<tr>
        <th scope="row"><span class="dot dot--s${p.series}" aria-hidden="true"></span>${p.name}</th>
        <td class="num">${p.titleMax}</td><td class="num">${p.bodyMax}</td><td class="num">${p.photoMax}</td>
        <td class="num">${p.bumpDays} days</td><td class="num">${p.expiryDays} days</td>
        <td>${p.perRegionAccount ? 'one login per region' : 'one national login'}</td>
      </tr>`)}</tbody>
    </table></div>
    <p class="muted">Bump and expiry windows are the app's working assumptions, not a contract with the platforms — adjust them in <code>assets/js/platforms.js</code> if a channel changes its rules.</p>`)]}

    ${[section('About this tool', html`<ul class="prose-list">
      <li>Everything runs in the browser. There is no server, no database and no analytics call — which is also why nothing here can log into a marketplace on your behalf.</li>
      <li>What it removes is the retyping: one unit description becomes four channel-shaped drafts, and the bump clock tells you when each ad is sinking.</li>
      <li>Two people using it on two machines keep two separate sets of data. Use the backup file to move a snapshot between them.</li>
    </ul>`)]}`;
}

export function mount(root, rerender) {
  const form = root.querySelector('#settings-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = new FormData(form);
      store.update((s) => {
        Object.assign(s.settings, {
          company: d.get('company').trim(),
          agentName: d.get('agentName').trim(),
          agentPhone: d.get('agentPhone').trim(),
          whatsapp: d.get('whatsapp').trim(),
          renTag: d.get('renTag').trim(),
          defaultRegion: d.get('defaultRegion'),
        });
      });
      toast('Settings saved', 'good');
    });
  }

  const theme = root.querySelector('#theme-select');
  if (theme) {
    theme.addEventListener('change', () => {
      store.setSetting('theme', theme.value);
      applyTheme(theme.value);
    });
  }

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'backup') {
      download(`belive-autopost-backup-${todayISO()}.json`, JSON.stringify(store.get(), null, 2));
      toast('Backup downloaded', 'good');
    }

    if (act === 'restore') restoreDialog(rerender);

    if (act === 'sample') {
      const ok = await confirmDialog('Load the sample inventory?',
        'Three demo listings are added so you can see the composer working. They are ordinary listings — delete them when you are done.',
        'Add samples');
      if (ok) { loadSamples(); toast('Sample listings added', 'good'); rerender(); }
    }

    if (act === 'wipe') {
      const ok = await confirmDialog('Erase everything on this device?',
        'Listings, postings, enquiries and settings are deleted from this browser. The credential vault is erased separately from the Accounts page.',
        'Erase data');
      if (ok) { store.resetAll(); toast('Data erased'); location.hash = '#/'; rerender(); }
    }
  });
}

function restoreDialog(rerender) {
  openModal('Restore from backup', html`
    <form id="restore-form" class="form">
      <p class="muted">Paste a <code>belive-autopost-backup-*.json</code> file. It replaces everything currently in this browser.</p>
      <textarea class="input input--area" name="blob" rows="8" placeholder='{ "schema": 1, … }'></textarea>
      <div class="form__actions">
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn--primary" type="submit">Replace my data</button>
      </div>
    </form>`);
  const form = document.querySelector('#restore-form');
  form.querySelector('[data-close]').addEventListener('click', closeModal);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(new FormData(form).get('blob'));
      if (!parsed || !Array.isArray(parsed.listings)) throw new Error('That is not a backup file.');
      store.replaceAll(parsed);
      closeModal(); toast('Backup restored', 'good'); rerender();
    } catch (err) { toast(err.message, 'critical'); }
  });
}

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
  else root.removeAttribute('data-theme');
}

function loadSamples() {
  const samples = [
    {
      ref: 'BLV-JB-014', property: 'Ridgewood Residence', unitNo: 'A-12-03', region: 'JB',
      area: 'Taman Molek', roomType: 'master', rent: 950, deposit: 1900, size: '160 sq ft',
      tenantPref: 'Working adult', highlight: 'Corner master with its own bathroom and a study nook by the window.',
      amenities: ['Air-conditioning', 'Private bathroom', 'Water heater', 'Wardrobe', 'Study desk', 'Queen bed', 'Wi-Fi included', 'Utilities included', 'Swimming pool', 'Gymnasium', 'Covered parking', '24-hour security'],
      nearby: ['AEON Tebrau City (6 min)', 'Austin Heights', 'Johor Bahru city centre (15 min)'],
      status: 'active', availableFrom: addDays(todayISO(), 7),
    },
    {
      ref: 'BLV-PNG-007', property: 'Tropicana Bay Residences', unitNo: 'B-25-11', region: 'PNG',
      area: 'Bayan Lepas', roomType: 'queen', rent: 780, deposit: 1560, size: '120 sq ft',
      tenantPref: 'Female only', highlight: 'Sea-facing block, ten minutes from the free industrial zone.',
      amenities: ['Air-conditioning', 'Water heater', 'Wardrobe', 'Study desk', 'Queen bed', 'Window', 'Wi-Fi included', 'Weekly cleaning', 'Swimming pool', 'Gymnasium', 'CCTV', 'Digital door lock'],
      nearby: ['Penang International Airport (8 min)', 'Queensbay Mall', 'Bayan Lepas FIZ'],
      status: 'active', availableFrom: todayISO(),
    },
    {
      ref: 'BLV-KL-031', property: 'Vista Sentul', unitNo: 'C-08-06', region: 'KL',
      area: 'Sentul', roomType: 'single', rent: 620, deposit: 1240, size: '90 sq ft',
      tenantPref: 'Student', highlight: 'Walking distance to the Sentul LRT, rent covers everything.',
      amenities: ['Air-conditioning', 'Wardrobe', 'Study desk', 'Single bed', 'Window', 'Wi-Fi included', 'Utilities included', 'Cooking allowed', 'Washing machine', '24-hour security'],
      nearby: ['Sentul LRT (4 min walk)', 'TAR UMT', 'Sentul Depot'],
      status: 'active', availableFrom: addDays(todayISO(), 14),
    },
  ];
  samples.forEach((sample) => store.saveListing(store.newListing(sample)));
}
