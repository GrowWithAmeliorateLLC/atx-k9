// POST /api/lead
// Creates or updates the website inquiry contact in GoHighLevel.
// The GHL Private Integration token lives in the GHL_PIT environment variable
// (Netlify > atx-k9 > Environment variables). It is never sent to the browser.

const LOCATION_ID = 'LeevxXmazNHLFNJP9j3C';
const API = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';
const ALLOWED_ORIGINS = ['https://atxk9.com', 'https://www.atxk9.com'];

let fieldMapCache = null;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const ghlHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Version: VERSION,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const clean = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function toE164(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10) return '+1' + d;
  return '+' + d;
}

function splitName(n) {
  const i = n.indexOf(' ');
  return i === -1 ? { f: n, l: '' } : { f: n.slice(0, i), l: n.slice(i + 1) };
}

async function getFieldMap(token) {
  if (fieldMapCache) return fieldMapCache;
  const r = await fetch(`${API}/locations/${LOCATION_ID}/customFields`, { headers: ghlHeaders(token) });
  if (!r.ok) throw new Error(`GHL customFields ${r.status}`);
  const j = await r.json();
  const m = {};
  for (const f of j.customFields || []) if (f.fieldKey) m[f.fieldKey] = f.id;
  fieldMapCache = m;
  return m;
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const origin = req.headers.get('origin') || '';
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json(403, { error: 'Forbidden' });

  const token = process.env.GHL_PIT;
  if (!token) {
    console.error('GHL_PIT env var is not set');
    return json(500, { error: 'Server not configured' });
  }

  let b;
  try {
    b = await req.json();
  } catch {
    return json(400, { error: 'Invalid request' });
  }

  const name = clean(b.name, 200);
  const email = clean(b.email, 200);
  const phone = toE164(clean(b.phone, 40));
  if (!name || (!email && !phone)) return json(400, { error: 'Name and email or phone are required' });

  let map = {};
  try {
    map = await getFieldMap(token);
  } catch (e) {
    console.error(e);
  }

  let msg = clean(b.message);
  const dates = clean(b.dates, 200);
  const ref = clean(b.referral, 200);
  if (dates) msg = (msg ? msg + '\n' : '') + 'Travel dates: ' + dates;
  if (ref) msg = (msg ? msg + '\n' : '') + 'Heard about us: ' + ref;

  const customFields = [
    { id: map['contact.dog_name'], field_value: clean(b.dog, 200) },
    { id: map['contact.dog_breed'], field_value: clean(b.breed, 200) },
    { id: map['contact.dog_age'], field_value: clean(b.age, 100) },
    { id: map['contact.program_interest'], field_value: clean(b.program, 100) },
    { id: map['contact.whats_going_on'], field_value: msg },
  ].filter((c) => c.id);

  const tags = ['inquiry'];
  if (b.sms_transactional === true) tags.push('sms-consent-transactional');
  if (b.sms_marketing === true) tags.push('sms-consent-marketing');

  const nm = splitName(name);
  const payload = {
    firstName: nm.f,
    lastName: nm.l,
    email,
    phone,
    locationId: LOCATION_ID,
    source: 'Website inquiry form',
    tags,
    customFields,
  };

  const res = await fetch(`${API}/contacts/upsert`, {
    method: 'POST',
    headers: ghlHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error('GHL upsert failed', res.status, await res.text());
    return json(502, { error: 'Could not save inquiry' });
  }

  return json(200, { ok: true });
};

export const config = { path: '/api/lead' };
