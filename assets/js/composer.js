/**
 * Copy generation.
 *
 * One listing in, four platform-shaped drafts out. Each platform gets its own
 * field set because each form is different: iBilik wants a short title and a
 * feature list, Mudah ranks on structured fields, Facebook needs a hook in the
 * first line, PropertyGuru wants a long indexed description.
 *
 * `variant` rotates the wording. Mudah and Facebook both penalise identical
 * bodies posted back-to-back, so a second room in the same block should go out
 * on a different variant.
 */
import { platform, regionName, roomTypeName } from './platforms.js';
import { money, formatDate } from './utils.js';

const HOOKS = [
  'Move-in ready',
  'Available now',
  'Fully furnished',
  'Zero-hassle co-living',
  'Room ready this week',
];

const OPENERS = [
  (l) => `A ${roomTypeName(l.roomType).toLowerCase()} at ${l.property}, kept move-in ready and managed end to end by BeLive.`,
  (l) => `${l.property} — ${roomTypeName(l.roomType).toLowerCase()} available ${l.availableFrom ? `from ${formatDate(l.availableFrom)}` : 'now'}. Furnished, cleaned and managed for you.`,
  (l) => `Looking for a ${roomTypeName(l.roomType).toLowerCase()} in ${l.area || regionName(l.region)}? This one at ${l.property} is ready to move into.`,
  (l) => `Co-living done properly: a ${roomTypeName(l.roomType).toLowerCase()} at ${l.property}, professionally managed with real support behind it.`,
];

const CLOSERS = [
  'Viewing slots open daily — WhatsApp to book one.',
  'Drop us a WhatsApp for the full photo set and a viewing slot.',
  'Message now to reserve before the next tenant does.',
  'WhatsApp us and we will send the video walkthrough today.',
];

const pick = (arr, variant) => arr[((variant % arr.length) + arr.length) % arr.length];

const clean = (s) => String(s || '').trim();

function contactLine(settings) {
  const bits = [];
  if (settings.agentName) bits.push(settings.agentName);
  if (settings.agentPhone) bits.push(settings.agentPhone);
  if (settings.whatsapp && settings.whatsapp !== settings.agentPhone) bits.push(`WhatsApp ${settings.whatsapp}`);
  if (settings.renTag) bits.push(settings.renTag);
  return bits.join(' · ');
}

/** "Master Room at Ridgewood Residence, Johor Bahru — RM850/month" */
export function buildTitle(listing, limit = 60) {
  const room = roomTypeName(listing.roomType);
  const place = clean(listing.property) || clean(listing.area) || regionName(listing.region);
  const price = `${money(listing.rent)}/mo`;
  const full = `${room} at ${place}, ${clean(listing.area) || regionName(listing.region)} — ${price}`;
  if (full.length <= limit) return full;
  const medium = `${room} @ ${place} — ${price}`;
  if (medium.length <= limit) return medium;
  const short = `${room} ${place} ${price}`;
  return short.length <= limit ? short : `${short.slice(0, limit - 1).trimEnd()}…`;
}

function featureLines(listing) {
  const out = [];
  if (listing.size) out.push(`Room size: ${listing.size}`);
  if (listing.furnishing) out.push(listing.furnishing);
  if (listing.utilities === 'included') out.push('Utilities and Wi-Fi included in the rent');
  else if (listing.utilities === 'split') out.push('Utilities split evenly between housemates');
  else if (listing.utilities === 'excluded') out.push('Utilities billed separately by usage');
  // Skip amenities the utilities line has already said.
  const said = listing.utilities === 'included' ? new Set(['Utilities included', 'Wi-Fi included']) : new Set();
  (listing.amenities || []).forEach((a) => { if (!said.has(a)) out.push(a); });
  return out;
}

function termsLines(listing) {
  const out = [];
  out.push(`Rent: ${money(listing.rent)} per month`);
  if (listing.deposit) out.push(`Deposit: ${money(listing.deposit)}`);
  out.push(`Available from: ${listing.availableFrom ? formatDate(listing.availableFrom) : 'immediately'}`);
  if (listing.tenantPref && listing.tenantPref !== 'Any') out.push(`Preferred tenant: ${listing.tenantPref}`);
  return out;
}

function locationLines(listing) {
  const out = [];
  const where = [clean(listing.area), regionName(listing.region)].filter(Boolean).join(', ');
  if (where) out.push(where);
  if (listing.address) out.push(listing.address);
  (listing.nearby || []).forEach((n) => out.push(`Near ${n}`));
  return out;
}

/* --------------------------------------------------------- per platform */

function ibilik(listing, settings, variant) {
  const body = [
    pick(OPENERS, variant)(listing),
    '',
    'WHAT YOU GET',
    ...featureLines(listing).map((f) => `- ${f}`),
    '',
    'THE NUMBERS',
    ...termsLines(listing).map((t) => `- ${t}`),
    '',
    'GETTING AROUND',
    ...locationLines(listing).map((n) => `- ${n}`),
    listing.highlight ? `\n${listing.highlight}` : '',
    '',
    pick(CLOSERS, variant),
    contactLine(settings),
  ].filter((line) => line !== null && line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return [
    { key: 'title', label: 'Ad title', value: buildTitle(listing, 60), limit: 60 },
    { key: 'rent', label: 'Monthly rental (RM)', value: String(listing.rent || '') },
    { key: 'deposit', label: 'Deposit (RM)', value: String(listing.deposit || '') },
    { key: 'roomtype', label: 'Room type', value: roomTypeName(listing.roomType) },
    { key: 'available', label: 'Available from', value: listing.availableFrom || '' },
    { key: 'area', label: 'Area / district', value: `${clean(listing.area)}${listing.area ? ', ' : ''}${regionName(listing.region)}` },
    { key: 'body', label: 'Description', value: body, multiline: true, limit: 4000 },
  ];
}

function mudah(listing, settings, variant) {
  const body = [
    pick(OPENERS, variant)(listing),
    '',
    ...featureLines(listing).map((f) => `• ${f}`),
    '',
    ...termsLines(listing).map((t) => `• ${t}`),
    '',
    ...locationLines(listing).map((n) => `• ${n}`),
    listing.highlight ? `\n${listing.highlight}` : '',
    '',
    pick(CLOSERS, variant),
    contactLine(settings),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return [
    { key: 'title', label: 'Ad title', value: buildTitle(listing, 70), limit: 70 },
    { key: 'category', label: 'Category path', value: 'Property → For Rent → Room' },
    { key: 'state', label: 'State', value: regionName(listing.region) },
    { key: 'area', label: 'Area', value: clean(listing.area) || regionName(listing.region) },
    { key: 'price', label: 'Monthly rent (RM)', value: String(listing.rent || '') },
    { key: 'roomtype', label: 'Room type', value: roomTypeName(listing.roomType) },
    { key: 'body', label: 'Ad description', value: body, multiline: true, limit: 3000 },
  ];
}

function facebook(listing, settings, variant) {
  const hook = `${pick(HOOKS, variant)}: ${roomTypeName(listing.roomType)} at ${clean(listing.property)} — ${money(listing.rent)}/month`;
  const tags = [
    'RoomForRent', 'CoLiving', 'BeLive',
    (clean(listing.area) || regionName(listing.region)).replace(/[^A-Za-z0-9]/g, ''),
    regionName(listing.region).replace(/[^A-Za-z0-9]/g, ''),
    roomTypeName(listing.roomType).replace(/[^A-Za-z0-9]/g, ''),
  ].filter(Boolean).map((t) => `#${t}`).join(' ');

  const body = [
    hook,
    '',
    pick(OPENERS, variant)(listing),
    '',
    ...featureLines(listing).slice(0, 10).map((f) => `✅ ${f}`),
    '',
    ...termsLines(listing).map((t) => `💰 ${t}`),
    '',
    ...locationLines(listing).map((n) => `📍 ${n}`),
    listing.highlight ? `\n${listing.highlight}` : '',
    '',
    pick(CLOSERS, variant),
    contactLine(settings),
    '',
    tags,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return [
    { key: 'title', label: 'Marketplace title', value: buildTitle(listing, 100), limit: 100 },
    { key: 'price', label: 'Price (RM / month)', value: String(listing.rent || '') },
    { key: 'proptype', label: 'Property type', value: 'Room' },
    { key: 'location', label: 'Location', value: [clean(listing.area), regionName(listing.region)].filter(Boolean).join(', ') },
    { key: 'body', label: 'Post body', value: body, multiline: true, limit: 5000 },
    { key: 'tags', label: 'Hashtags', value: tags },
  ];
}

function propertyguru(listing, settings, variant) {
  const headline = `${roomTypeName(listing.roomType)} for rent at ${clean(listing.property)}, ${clean(listing.area) || regionName(listing.region)}`;
  const body = [
    pick(OPENERS, variant)(listing),
    '',
    'Unit details',
    ...featureLines(listing).map((f) => `— ${f}`),
    '',
    'Tenancy terms',
    ...termsLines(listing).map((t) => `— ${t}`),
    '',
    'Location and access',
    ...locationLines(listing).map((n) => `— ${n}`),
    '',
    'About the management',
    'BeLive manages the unit end to end: tenant screening, a signed tenancy agreement, scheduled cleaning of shared areas and a maintenance hotline. Tenants deal with one managing party, not a chain of sub-landlords.',
    listing.highlight ? `\n${listing.highlight}` : '',
    '',
    pick(CLOSERS, variant),
    contactLine(settings),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return [
    { key: 'title', label: 'Listing headline', value: headline.slice(0, 100), limit: 100 },
    { key: 'project', label: 'Project / building name', value: clean(listing.property) },
    { key: 'unit', label: 'Unit number', value: clean(listing.unitNo) },
    { key: 'price', label: 'Asking rent (RM / month)', value: String(listing.rent || '') },
    { key: 'size', label: 'Built-up / room size', value: clean(listing.size) },
    { key: 'furnishing', label: 'Furnishing', value: clean(listing.furnishing) },
    { key: 'available', label: 'Available from', value: listing.availableFrom || '' },
    { key: 'body', label: 'Property description', value: body, multiline: true, limit: 6000 },
  ];
}

const TEMPLATES = { ibilik, mudah, facebook, propertyguru };

/** Returns the field set a platform's form needs, already filled in. */
export function compose(listing, platformId, settings = {}, variant = 0) {
  const def = platform(platformId);
  const fn = TEMPLATES[def ? def.template : platformId] || ibilik;
  return fn(listing, settings, variant);
}

/** The whole draft as one block, for operators who prefer to paste and trim. */
export function composePlain(listing, platformId, settings = {}, variant = 0) {
  return compose(listing, platformId, settings, variant)
    .map((f) => (f.multiline ? `${f.label}:\n${f.value}` : `${f.label}: ${f.value}`))
    .join('\n\n');
}

/** Blocking problems the platform form will reject, and softer warnings. */
export function validate(listing, platformId) {
  const def = platform(platformId) || {};
  const problems = [];
  if (!listing.property) problems.push({ level: 'error', text: 'Property name is empty.' });
  if (!listing.rent) problems.push({ level: 'error', text: 'Monthly rent is not set.' });
  if (!listing.area) problems.push({ level: 'warn', text: 'No area — search ranking on Mudah and iBilik depends on it.' });
  if (!(listing.photos || []).length) {
    problems.push({ level: 'warn', text: 'No photo links saved. Listings without photos get a fraction of the views.' });
  } else if (def.photoMax && listing.photos.length > def.photoMax) {
    problems.push({ level: 'warn', text: `${def.name} accepts ${def.photoMax} photos; you have ${listing.photos.length}.` });
  }
  if (!(listing.amenities || []).length) problems.push({ level: 'warn', text: 'No amenities ticked — the body text will read thin.' });
  const fields = compose(listing, platformId, {}, 0);
  fields.forEach((f) => {
    if (f.limit && f.value.length > f.limit) {
      problems.push({ level: 'error', text: `${f.label} is ${f.value.length} characters; the limit is ${f.limit}.` });
    }
  });
  return problems;
}
