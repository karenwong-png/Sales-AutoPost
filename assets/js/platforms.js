/**
 * Platform catalogue for the BeLive Indoor Tenant Sales Listing autoposter.
 *
 * Nothing secret lives here. Login e-mails and passwords are entered once by the
 * operator and stored encrypted in their own browser (see vault.js) -- they are
 * deliberately NOT part of the source tree, because this repository is published
 * to GitHub Pages.
 */

/** Marketing regions BeLive lists in. `ALL` = one national account. */
export const REGIONS = [
  { id: 'JB',  name: 'Johor Bahru',   state: 'Johor' },
  { id: 'PNG', name: 'Penang',        state: 'Pulau Pinang' },
  { id: 'KL',  name: 'Kuala Lumpur',  state: 'W.P. Kuala Lumpur' },
  { id: 'SGR', name: 'Selangor',      state: 'Selangor' },
  { id: 'NS',  name: 'Nilai',         state: 'Negeri Sembilan' },
  { id: 'ALL', name: 'Nationwide',    state: 'Malaysia' },
];

export const regionName = (id) => (REGIONS.find((r) => r.id === id) || {}).name || id;

/**
 * Each platform declares how BeLive actually posts to it: where to log in, where
 * the "create listing" form lives, the limits its form enforces, how often the ad
 * has to be bumped to stay near the top of search, and which composer template
 * produces its copy.
 */
export const PLATFORMS = [
  {
    id: 'ibilik',
    name: 'iBilik',
    tagline: 'Room-rental marketplace — the main source of indoor tenant leads.',
    series: 1,
    perRegionAccount: true,
    titleMax: 60,
    bodyMax: 4000,
    photoMax: 10,
    bumpDays: 7,
    expiryDays: 60,
    loginUrl: 'https://www.ibilik.my/users/login',
    postUrl: 'https://www.ibilik.my/rooms/new',
    manageUrl: 'https://www.ibilik.my/users/my_ads',
    template: 'ibilik',
    checklist: [
      'Pick the correct region account before posting (JB / Penang / KL are separate logins).',
      'Set the property type to Condominium / Apartment and the room type to match the unit.',
      'Upload the room photo first — it becomes the thumbnail in search results.',
      'Renew the ad every 7 days, otherwise it sinks below competitor rooms.',
    ],
  },
  {
    id: 'mudah',
    name: 'Mudah.my',
    tagline: 'General classifieds — highest raw traffic, weakest lead quality.',
    series: 2,
    perRegionAccount: false,
    titleMax: 70,
    bodyMax: 3000,
    photoMax: 12,
    bumpDays: 14,
    expiryDays: 30,
    loginUrl: 'https://www.mudah.my/login',
    postUrl: 'https://www.mudah.my/insert-ad',
    manageUrl: 'https://www.mudah.my/my-account/ads',
    template: 'mudah',
    checklist: [
      'Category: Property → For Rent → Room.',
      'Fill the structured fields (state, area, monthly rent) — Mudah ranks on them, not on the body text.',
      'Mudah rejects duplicate bodies posted back-to-back; use the rotate-copy button for a second unit in the same block.',
      'Free ads expire after 30 days — re-insert rather than edit once expired.',
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    tagline: 'Marketplace post + the local rental groups RoomNow belongs to.',
    series: 3,
    perRegionAccount: false,
    titleMax: 100,
    bodyMax: 5000,
    photoMax: 20,
    bumpDays: 7,
    expiryDays: 30,
    loginUrl: 'https://www.facebook.com/login',
    postUrl: 'https://www.facebook.com/marketplace/create/rental',
    manageUrl: 'https://www.facebook.com/marketplace/you/selling',
    template: 'facebook',
    checklist: [
      'Post to Marketplace first, then share the same listing into each rental group.',
      'Keep the first line hook under 80 characters — that is all the feed shows.',
      'Never paste the same text into two groups within the hour; Facebook flags it as spam.',
      'Re-list (not edit) weekly so the post re-enters the feed.',
    ],
  },
  {
    id: 'propertyguru',
    name: 'PropertyGuru',
    tagline: 'AgentNet — whole-unit and premium listings, agency-grade leads.',
    series: 4,
    perRegionAccount: false,
    titleMax: 100,
    bodyMax: 6000,
    photoMax: 30,
    bumpDays: 30,
    expiryDays: 90,
    loginUrl: 'https://agentnet.propertyguru.com.my',
    postUrl: 'https://agentnet.propertyguru.com.my/listing/create',
    manageUrl: 'https://agentnet.propertyguru.com.my/listing/manage',
    template: 'propertyguru',
    checklist: [
      'AgentNet requires the property to exist in its project database — search the condo name before creating.',
      'Attach the REN/agency details; listings without them are held in review.',
      'Use the long description field — PropertyGuru indexes it for search.',
      'Refresh the listing monthly to keep the Guru score up.',
    ],
  },
];

export const platform = (id) => PLATFORMS.find((p) => p.id === id);
export const platformName = (id) => (platform(id) || {}).name || id;

/**
 * The six logins BeLive actually operates, as empty slots. The operator fills in
 * the e-mail and password once, in the browser, and the vault encrypts them.
 */
export const ACCOUNT_SCAFFOLD = [
  { id: 'ibilik-jb',   platformId: 'ibilik',       region: 'JB',  label: 'iBilik — Johor Bahru' },
  { id: 'ibilik-png',  platformId: 'ibilik',       region: 'PNG', label: 'iBilik — Penang' },
  { id: 'ibilik-kl',   platformId: 'ibilik',       region: 'KL',  label: 'iBilik — Kuala Lumpur' },
  { id: 'mudah-main',  platformId: 'mudah',        region: 'ALL', label: 'Mudah.my — main account' },
  { id: 'fb-roomnow',  platformId: 'facebook',     region: 'ALL', label: 'Facebook — RoomNow' },
  { id: 'pg-agentnet', platformId: 'propertyguru', region: 'ALL', label: 'PropertyGuru — AgentNet' },
];

/** Room types BeLive sells, with the deposit convention used in the copy. */
export const ROOM_TYPES = [
  { id: 'master',  name: 'Master Room',  blurb: 'private bathroom' },
  { id: 'queen',   name: 'Queen Room',   blurb: 'queen bed, shared bathroom' },
  { id: 'medium',  name: 'Medium Room',  blurb: 'single or super-single bed' },
  { id: 'single',  name: 'Single Room',  blurb: 'single bed, shared bathroom' },
  { id: 'studio',  name: 'Studio',       blurb: 'self-contained unit' },
  { id: 'whole',   name: 'Whole Unit',   blurb: 'entire unit' },
];

export const roomTypeName = (id) => (ROOM_TYPES.find((r) => r.id === id) || {}).name || id;

export const AMENITIES = [
  'Air-conditioning', 'Private bathroom', 'Water heater', 'Wardrobe', 'Study desk',
  'Queen bed', 'Single bed', 'Window', 'Balcony access', 'Washing machine',
  'Fridge', 'Cooking allowed', 'Wi-Fi included', 'Utilities included', 'Weekly cleaning',
  'Swimming pool', 'Gymnasium', 'Covered parking', '24-hour security', 'CCTV',
  'Digital door lock', 'Playground', 'Surau', 'Mini market', 'Shuttle service',
];

export const TENANT_PREFS = ['Any', 'Female only', 'Male only', 'Working adult', 'Student', 'Couple friendly'];

export const LISTING_STATUS = [
  { id: 'draft',    name: 'Draft',    tone: 'neutral' },
  { id: 'active',   name: 'Active',   tone: 'good' },
  { id: 'reserved', name: 'Reserved', tone: 'warning' },
  { id: 'occupied', name: 'Occupied', tone: 'neutral' },
  { id: 'archived', name: 'Archived', tone: 'neutral' },
];

export const POST_STATUS = [
  { id: 'queued',  name: 'Queued',  tone: 'neutral' },
  { id: 'live',    name: 'Live',    tone: 'good' },
  { id: 'duebump', name: 'Due bump', tone: 'warning' },
  { id: 'expired', name: 'Expired', tone: 'serious' },
  { id: 'removed', name: 'Removed', tone: 'neutral' },
];
