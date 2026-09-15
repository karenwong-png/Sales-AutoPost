# BeLive AutoPost — Indoor Tenant Sales Listing

An internal console for putting one room onto every channel BeLive sells through:
**iBilik**, **Mudah.my**, **Facebook** (Marketplace + rental groups) and
**PropertyGuru AgentNet**.

One room record in, four channel-shaped drafts out, plus a bump clock that says
which ads are sinking today. It replaces the old INTI Nilai marketing page that
used to live in this repository.

---

## What it does

| Page | What it is for |
| --- | --- |
| **Control tower** | Live coverage, what needs a human today, recent activity. |
| **Listings** | The inventory: property, room type, rent, deposit, amenities, photo links, availability. Filter by region, status, or "not live on Mudah". Export to CSV. |
| **Composer** | Per-channel drafts. Each field is sized to the form it goes into (iBilik title 60 chars, Mudah 70, Facebook 100), with a copy button per field, four wording variants to dodge duplicate-content flags, and a pre-submit checklist per platform. |
| **Work queue** | Expired ads first, then ads due a bump, then queued-but-never-posted. Bump cadences: iBilik 7 days, Mudah 14, Facebook 7, PropertyGuru 30. |
| **Performance** | Postings and bumps per week per channel, enquiries by channel, and a scoreboard of posted → live → enquiry → booked. |
| **Accounts** | The six logins, held in an encrypted vault (see below). |
| **Settings** | Agent signature, theme, backup and restore, channel reference card. |

Keyboard: <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> to jump anywhere, <kbd>N</kbd>
new listing, <kbd>Q</kbd> work queue, <kbd>L</kbd> listings, <kbd>D</kbd> control
tower, <kbd>A</kbd> performance, <kbd>V</kbd> accounts, <kbd>S</kbd> settings.

## What it deliberately does not do

None of the four platforms exposes a public write API, and all four treat
scripted form submission as abuse. So this tool does not log in and post for
you. What it removes is the retyping and the forgetting: the copy is generated,
the credentials are one click from the clipboard, the deep link opens the right
form, and the bump clock tracks what you posted.

## Credentials

**No login, for any platform, is stored in this repository — and none should
ever be added to it.** The site is published to GitHub Pages, so anything
committed here is public.

Instead, the Accounts page holds a vault:

* AES-GCM encryption, key derived from a master passphrase with PBKDF2-SHA256
  (310 000 iterations).
* Ciphertext is written to this browser's `localStorage`. It is never sent
  anywhere — there is no server to send it to.
* It re-locks itself after 15 minutes of inactivity.
* **Lose the passphrase and the contents are gone.** There is no reset. Export a
  backup (Accounts → Export vault) and keep the file in a password manager.
* Clearing site data for this domain erases the vault *and* the listings. Take a
  backup first (Settings → Download a backup for the listings; the vault exports
  separately).

Each operator sets the vault up once per browser. Two machines hold two separate
copies; move a snapshot with the export/import buttons.

The six account slots ship pre-labelled and empty:

| Slot | Channel | Region |
| --- | --- | --- |
| iBilik — Johor Bahru | iBilik | JB |
| iBilik — Penang | iBilik | Penang |
| iBilik — Kuala Lumpur | iBilik | KL |
| Mudah.my — main account | Mudah | national |
| Facebook — RoomNow | Facebook | national |
| PropertyGuru — AgentNet | PropertyGuru | national |

## Data

Everything — listings, postings, enquiries, settings — lives in `localStorage`
under `belive.autopost.state.v1`. There is no backend and no analytics call.
Settings → **Download a backup** writes the whole state as JSON; **Restore**
reads it back. Settings → **Load sample inventory** adds three demo listings so
a new operator can see the composer working.

## Running it

It is a static site with no build step. Open `index.html` through any web
server:

```sh
python3 -m http.server 8777
# then visit http://127.0.0.1:8777
```

(ES modules need a server — opening the file directly with `file://` will not
work.)

## Deployment

`.github/workflows/deploy-pages.yml` publishes the repository root to GitHub
Pages on every push to `main`. `CNAME` points the site at **inti.belive.my**,
inherited from the page that used to live here.

Two notes on that:

1. This is an internal tool on a public URL. Nothing sensitive is served — the
   vault is per-browser and the page carries `noindex` — but a dedicated
   subdomain (`autopost.belive.my`) would be a tidier home. Changing it means
   editing `CNAME` and adding the matching DNS record.
2. Pages must be set to **Settings → Pages → Source: GitHub Actions**, and DNS
   must have a `CNAME` record pointing the chosen subdomain at
   `karenwong-png.github.io`.

## Layout

```
index.html               app shell
assets/css/app.css       design tokens, light + dark, all components
assets/js/
  app.js                 router, shell chrome, command palette, shortcuts
  store.js               state, persistence, bump-clock logic
  vault.js               AES-GCM credential vault
  composer.js            per-channel copy generation
  platforms.js           channel catalogue: limits, cadences, URLs, checklists
  charts.js              the dashboard charts
  ui.js                  tiles, badges, modal, form controls
  utils.js               escaping template tag, dates, CSV, clipboard
  views/                 one module per page
```

Channel rules (title limits, bump cadence, expiry, checklists) all live in
`assets/js/platforms.js` — that is the file to edit when a platform changes its
behaviour.
