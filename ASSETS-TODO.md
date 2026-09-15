# Image assets still to drop in

The INTI × BeLive Nilai page (`index.html`) is fully wired, but the photography for
the two Nilai residences is not in the repo yet. Any file listed below that is
missing renders as a tidy "Photo coming soon" panel (or, for the route guides and
the partnership photo, the block hides itself), so the page never shows a broken
image. Drop a file in at the repo root with the exact name and it appears — no
code change needed.

## Campus / partnership

| File | Where it appears | Status |
| --- | --- | --- |
| `INTI-campus.jpg` | Hero background (INTI Nilai campus photo) | in repo — only 680x454, so a higher-resolution original would render sharper |
| `BeLivexINTI_photo.jpg` | "Built Together with INTI" partnership card | still needed |

## Youth City Residence

| File | Where it appears | Status |
| --- | --- | --- |
| `YouthCity_condo.jpg` | Building photo on the Youth City tab | in repo |
| `YC_pool.jpg`, `YC_gym.jpg`, `YC_playground.jpg` | Facility strip | in repo |
| `YC_master.jpg`, `YC_double_1.jpg` (RM878), `YC_double_2.jpg` (RM678) | Room cards | in repo |
| `YC_kitchen.jpg`, `YC_dining.jpg`, `YC_yard.jpg` | Shared spaces | in repo |
| `BeLive_YouthCity_INTI.jpg` | "Getting to INTI International University" route guide | still needed |

## Akasia @ Bandar Belia

| File | Where it appears | Status |
| --- | --- | --- |
| `Akasia_condo.jpg` | Building photo on the Akasia tab | in repo |
| `AK_pool.jpg`, `AK_gym.jpg`, `AK_playground.jpg` | Facility strip | in repo |
| `AK_master.jpg`, `AK_double.jpg`, `AK_single.jpg` | Room cards | in repo |
| `AK_kitchen.jpg`, `AK_living.jpg`, `AK_yard.jpg` | Shared spaces | in repo |
| `BeLive_Akasia_INTI.jpg` | "Getting to INTI International University" route guide | still needed |

## Logo

`inti-logo.png` is INTI's official International University & Colleges lockup
(2000x433, transparent, with the "Your Future Built Today" bar). It is used in
the nav, the partnership card and the footer. Because the type is black and
grey, the footer places it on a white plaque rather than recolouring the mark.

## Deployment

The site deploys to GitHub Pages from `main` via `.github/workflows/deploy-pages.yml`,
and the `CNAME` file at the repo root points it at **inti.belive.my**.

Two things have to be true for that URL to work, and neither can be done from
the repository:

1. **Pages must be enabled** — Settings → Pages → Build and deployment →
   Source: **GitHub Actions**. Until this is set every workflow run fails at
   `Configure Pages` with "Resource not accessible by integration".
2. **DNS must point at GitHub** — in the DNS provider for `belive.my`
   (currently Cloudflare), add a `CNAME` record: name `inti`, target
   `karenwong-png.github.io`. Leave it DNS-only (grey cloud) until GitHub has
   issued the TLS certificate, otherwise certificate provisioning fails.
