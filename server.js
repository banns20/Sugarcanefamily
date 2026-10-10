import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { Pool } from 'pg';
import { del, put } from '@vercel/blob';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const dataDir = isProduction ? path.join(os.tmpdir(), 'sugarcanefamily-data') : path.join(dirname, 'data');
const cropsDataDir = path.join(dataDir, 'crops');
const legacySugarcanePath = path.join(dataDir, 'cane-country.sqlite');
const uploadDir = isProduction ? path.join(os.tmpdir(), 'sugarcanefamily-uploads') : path.join(dirname, 'uploads');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
const sessionDuration = 30 * 24 * 60 * 60 * 1000;
const browserSessionDuration = 24 * 60 * 60 * 1000;
const counties = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa',
  'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
  'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu',
  'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa',
  "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua',
  'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi',
  'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot', 'Other',
];
const geocoderContact = process.env.GEOCODER_CONTACT ?? 'http://localhost:3000';
const crops = [
  { id: 'sugarcane', name: 'Sugarcane', standingLabel: 'Standing sugarcane', fieldLabel: 'Sugarcane variety' },
];
const cropById = new Map(crops.map((crop) => [crop.id, crop]));

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for durable marketplace storage.');

async function uploadLegacyPhoto(cropId, listing) {
  if (/^https:\/\//i.test(listing.image_url)) return listing.image_url;
  const relativePath = decodeURIComponent(String(listing.image_url ?? '')).replace(/^\/+/, '');
  const sourcePath = path.resolve(uploadDir, relativePath.replace(/^uploads\//, ''));
  if (!sourcePath.startsWith(`${path.resolve(uploadDir)}${path.sep}`) || !fs.existsSync(sourcePath)) return listing.image_url;
  const content = await fs.promises.readFile(sourcePath);
  const extension = path.extname(sourcePath).toLowerCase();
  const contentType = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extension];
  if (!contentType) return listing.image_url;
  const fingerprint = createHash('sha256').update(content).digest('hex').slice(0, 24);
  const blob = await put(`legacy/${cropId}/${listing.id}-${fingerprint}${extension}`, content, {
    access: 'public', contentType, addRandomSuffix: false, allowOverwrite: true,
  });
  return blob.url;
}

async function migrateLegacyDatabase(crop, sqlitePath) {
  if (!fs.existsSync(sqlitePath)) return;
  const legacy = new DatabaseSync(sqlitePath, { readOnly: true });
  const client = await pool.connect();
  try {
    const userColumns = new Set(legacy.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
    const listingColumns = new Set(legacy.prepare('PRAGMA table_info(listings)').all().map((column) => column.name));
    const notificationColumns = new Set(legacy.prepare('PRAGMA table_info(notifications)').all().map((column) => column.name));
    if (!userColumns.has('phone') || !listingColumns.has('image_url')) return;
    const pick = (row, columns, name, fallback = null) => columns.has(name) ? row[name] : fallback;
    await client.query('BEGIN');
    const userIds = new Map();
    for (const row of legacy.prepare('SELECT * FROM users').all()) {
      const existingAccount = await client.query('SELECT id FROM market_users WHERE crop_id=$1 AND phone=$2', [crop.id, row.phone]);
      const account = existingAccount.rows[0] ?? (await client.query(`
        INSERT INTO market_users (crop_id,phone,password_salt,password_hash,role,display_name,profile_county,bio,listing_notifications_enabled,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::timestamptz,NOW()))
        ON CONFLICT (crop_id, phone) DO NOTHING RETURNING id
      `, [crop.id,row.phone,row.password_salt,row.password_hash,pick(row,userColumns,'role','seller'),pick(row,userColumns,'display_name',''),pick(row,userColumns,'profile_county',''),pick(row,userColumns,'bio',''),Boolean(pick(row,userColumns,'listing_notifications_enabled',0)),pick(row,userColumns,'created_at')])).rows[0] ?? (await client.query('SELECT id FROM market_users WHERE crop_id=$1 AND phone=$2', [crop.id, row.phone])).rows[0];
      userIds.set(row.id, account.id);
    }
    for (const row of legacy.prepare('SELECT * FROM listings').all()) {
      if (pick(row, listingColumns, 'is_sample', 0)) continue;
      const ownerId = userIds.get(row.owner_user_id) ?? null;
      const savedListing = await client.query('SELECT image_url FROM market_listings WHERE id=$1 AND crop_id=$2', [row.id,crop.id]);
      const existingImageUrl = savedListing.rows[0]?.image_url;
      const imageUrl = /^https:\/\//i.test(existingImageUrl ?? '') ? existingImageUrl : await uploadLegacyPhoto(crop.id, row);
      await client.query(`
        INSERT INTO market_listings (id,crop_id,title,county,locality,acres,price_kes,kind,crop_variety,expected_harvest,description,image_url,owner_user_id,is_sample,latitude,longitude,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,FALSE,$14,$15,COALESCE($16::timestamptz,NOW()))
        ON CONFLICT (id) DO UPDATE SET image_url=EXCLUDED.image_url
      `, [row.id, crop.id, row.title, row.county, row.locality, row.acres, row.price_kes, row.kind, row.crop_variety, pick(row, listingColumns, 'expected_harvest', ''), pick(row, listingColumns, 'description', ''), imageUrl, ownerId, pick(row, listingColumns, 'latitude'), pick(row, listingColumns, 'longitude'), pick(row, listingColumns, 'created_at')]);
    }
    if (legacy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get()) {
      for (const row of legacy.prepare('SELECT * FROM sessions WHERE expires_at > ?').all(Date.now())) {
        const userId = userIds.get(row.user_id);
        if (userId) await client.query('INSERT INTO market_sessions (token_hash,crop_id,user_id,expires_at) VALUES ($1,$2,$3,$4) ON CONFLICT (token_hash) DO NOTHING', [row.token_hash, crop.id, userId, row.expires_at]);
      }
    }
    if (notificationColumns.size && legacy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'").get()) {
      for (const row of legacy.prepare('SELECT * FROM notifications').all()) {
        const userId = userIds.get(row.user_id);
        if (userId) await client.query(`INSERT INTO market_notifications (crop_id,user_id,listing_id,title,body,created_at,read_at) VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,NOW()),$7) ON CONFLICT (user_id,listing_id) DO NOTHING`, [crop.id,userId,row.listing_id,row.title,row.body,pick(row, notificationColumns, 'created_at'),pick(row, notificationColumns, 'read_at')]);
      }
    }
    await client.query("SELECT setval(pg_get_serial_sequence('public.market_users','id'), GREATEST(COALESCE((SELECT MAX(id) FROM market_users),1),1), EXISTS(SELECT 1 FROM market_users))");
    await client.query("SELECT setval(pg_get_serial_sequence('public.market_listings','id'), GREATEST(COALESCE((SELECT MAX(id) FROM market_listings),1),1), EXISTS(SELECT 1 FROM market_listings))");
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    legacy.close();
  }
}

for (const crop of crops) {
  const paths = [path.join(cropsDataDir, `${crop.id}.sqlite`), ...(crop.id === 'sugarcane' ? [legacySugarcanePath] : [])];
  for (const sqlitePath of paths) await migrateLegacyDatabase(crop, sqlitePath);
}

pool.on('error', (error) => console.error('Unexpected Neon connection error:', error));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(dirname, 'views'));
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(dirname, 'public'), { maxAge: isProduction ? '1d' : 0 }));
app.use('/vendor/leaflet', express.static(path.join(dirname, 'node_modules/leaflet/dist'), { maxAge: isProduction ? '1d' : 0 }));
app.use((_request, response, next) => {
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.set('X-Frame-Options', 'SAMEORIGIN');
  response.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (_request.secure) response.set('Strict-Transport-Security', 'max-age=63072000');
  next();
});

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizePhone(value) {
  const phone = String(value ?? '').replace(/[\s()-]/g, '');
  if (/^0[17]\d{8}$/.test(phone)) return `+254${phone.slice(1)}`;
  if (/^254[17]\d{8}$/.test(phone)) return `+${phone}`;
  if (/^\+254[17]\d{8}$/.test(phone)) return phone;
  return null;
}

function cookieName(cropId) {
  return `mavuno_${cropId}_session`;
}

function cookieToken(request, cropId) {
  const name = cookieName(cropId);
  const cookieValue = request.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!cookieValue) return null;
  try { return decodeURIComponent(cookieValue); } catch { return null; }
}

async function readSession(request) {
  const token = cookieToken(request, request.crop.id);
  if (!token) return null;
  const result = await pool.query(`
    SELECT u.id, u.phone, u.role, u.display_name, u.profile_county, u.bio,
      u.listing_notifications_enabled, u.listing_credits
    FROM market_sessions s JOIN market_users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.crop_id=$2 AND s.expires_at>$3
  `, [digest(token), request.crop.id, Date.now()]);
  return result.rows[0] ?? null;
}

async function requireAuth(request, response, next) {
  request.user = await readSession(request);
  if (!request.user) return response.status(401).json({ error: 'Sign in with your phone number to continue.' });
  next();
}

async function createSession(request, user, response, rememberMe = true) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + (rememberMe ? sessionDuration : browserSessionDuration);
  await pool.query('INSERT INTO market_sessions (token_hash,crop_id,user_id,expires_at) VALUES ($1,$2,$3,$4)',
    [digest(token), request.crop.id, user.id, expiresAt]);
  const secure = request.secure || process.env.COOKIE_SECURE === 'true';
  const sameSite = secure ? 'None' : 'Lax';
  const maxAge = rememberMe ? `; Max-Age=${Math.floor(sessionDuration / 1000)}` : '';
  response.append('Set-Cookie', `${cookieName(request.crop.id)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}${secure ? '; Secure' : ''}${maxAge}`);
}

function publicListing(row, crop) {
  return {
    id: Number(row.id),
    title: row.title,
    county: row.county,
    locality: row.locality,
    district: `${row.locality}, ${row.county} County`,
    acres: row.acres,
    rate: row.price_kes,
    kind: row.kind,
    cropVariety: row.crop_variety,
    crop: row.expected_harvest ? `${row.crop_variety} · ${row.expected_harvest}` : row.crop_variety,
    seller: row.is_sample ? 'Example listing' : 'Grower',
    verified: !row.is_sample && Boolean(row.owner_user_id),
    image: row.image_url,
    tag: row.is_sample ? 'Example listing' : row.kind === crop.standingLabel ? 'Crop already growing' : 'Land available to lease',
    posted: row.created_at,
    description: row.description,
  };
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a little before trying again.' },
});
const locationLimiter = rateLimit({
  windowMs: 1000,
  limit: 1,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Please wait a moment before looking up another location.' },
});

function locationFromResult(result) {
  const address = result.address ?? {};
  const countyNames = [address.county, address.state_district, address.state]
    .filter(Boolean)
    .map((name) => String(name).replace(/\s+County$/i, '').trim().toLowerCase());
  const county = counties.find((item) => countyNames.includes(item.toLowerCase())) ?? 'Other';
  const locality = address.city ?? address.town ?? address.village ?? address.municipality
    ?? address.suburb ?? address.neighbourhood ?? String(result.display_name ?? '').split(',')[0];
  return {
    county,
    locality: String(locality ?? '').trim(),
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    displayName: result.display_name,
  };
}

async function fetchGeocoder(url) {
  const result = await fetch(url, {
    headers: {
      'User-Agent': `SugarcaneFamily/1.0 (${geocoderContact})`,
      'Accept-Language': 'en',
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!result.ok) throw new Error(`Geocoder returned ${result.status}`);
  return result.json();
}

app.get('/api/location/search', locationLimiter, async (request, response) => {
  const query = String(request.query.q ?? '').trim();
  if (query.length < 3 || query.length > 120) return response.status(400).json({ error: 'Enter at least 3 characters for the location.' });
  try {
    const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', countrycodes: 'ke', limit: '5' });
    const results = await fetchGeocoder(`https://nominatim.openstreetmap.org/search?${params}`);
    return response.json({ results: results.map(locationFromResult).filter((item) => item.locality && Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) });
  } catch {
    return response.status(502).json({ error: 'The location service is unavailable right now. You can still enter the county and area manually.' });
  }
});

app.get('/api/location/reverse', locationLimiter, async (request, response) => {
  const latitude = Number(request.query.lat);
  const longitude = Number(request.query.lon);
  if (!Number.isFinite(latitude) || latitude < -4.8 || latitude > 5.2 || !Number.isFinite(longitude) || longitude < 33.8 || longitude > 42.2) {
    return response.status(400).json({ error: 'Choose a location within Kenya.' });
  }
  try {
    const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', addressdetails: '1', zoom: '14' });
    const result = await fetchGeocoder(`https://nominatim.openstreetmap.org/reverse?${params}`);
    if (result.address?.country_code !== 'ke') return response.status(400).json({ error: 'Choose a location within Kenya.' });
    return response.json({ location: locationFromResult(result) });
  } catch {
    return response.status(502).json({ error: 'The location service is unavailable right now. You can still enter the county and area manually.' });
  }
});

app.get('/api/crops', (_request, response) => {
  response.json({
    crops: crops.map(({ id, name, standingLabel, fieldLabel }) => ({ id, name, standingLabel, fieldLabel })),
    counties,
  });
});

app.use('/api/:cropId', (request, response, next) => {
  const crop = cropById.get(request.params.cropId);
  if (!crop) return response.status(404).json({ error: 'Choose a supported crop marketplace.' });
  request.crop = crop;
  next();
});

app.post('/api/:cropId/auth/signup', authLimiter, async (request, response) => {
  const phone = normalizePhone(request.body?.phone);
  const password = String(request.body?.password ?? '');
  const role = String(request.body?.role ?? '');
  if (!phone) return response.status(400).json({ error: 'Enter a valid Kenyan mobile number, such as 0712 345 678.' });
  if (password.length < 8 || password.length > 128) return response.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!['buyer', 'seller'].includes(role)) return response.status(400).json({ error: 'Choose whether you are joining as a buyer or seller.' });

  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, salt, 64).toString('hex');
  try {
    const result = await pool.query('INSERT INTO market_users (crop_id,phone,password_salt,password_hash,role) VALUES ($1,$2,$3,$4,$5) RETURNING id', [request.crop.id,phone,salt,passwordHash,role]);
    const user = { id: result.rows[0].id, phone, role };
    await createSession(request, user, response);
    return response.status(201).json({ user: { phone, role, displayName: '', county: '', bio: '', listingCredits: 0 } });
  } catch (error) {
    if (error.code === '23505') return response.status(409).json({ error: 'An account already exists for this crop and number. Sign in instead.' });
    throw error;
  }
});

app.post('/api/:cropId/auth/login', authLimiter, async (request, response) => {
  const phone = normalizePhone(request.body?.phone);
  const password = String(request.body?.password ?? '');
  if (!phone || !password) return response.status(400).json({ error: 'Enter your Kenyan phone number and password.' });
  const result = await pool.query('SELECT id,phone,password_salt,password_hash,role,display_name,profile_county,bio,listing_notifications_enabled,listing_credits FROM market_users WHERE crop_id=$1 AND phone=$2', [request.crop.id,phone]);
  const record = result.rows[0];
  if (!record) return response.status(401).json({ error: 'That number and password do not match.' });
  const candidate = scryptSync(password, record.password_salt, 64);
  const stored = Buffer.from(record.password_hash, 'hex');
  if (stored.length !== candidate.length || !timingSafeEqual(stored, candidate)) return response.status(401).json({ error: 'That number and password do not match.' });
  await createSession(request, record, response, request.body?.rememberMe === true);
  return response.json({ user: {
    phone: record.phone, role: record.role, displayName: record.display_name,
    county: record.profile_county, bio: record.bio,
    listingNotificationsEnabled: Boolean(record.listing_notifications_enabled), listingCredits: record.listing_credits,
  } });
});

app.get('/api/:cropId/auth/session', async (request, response) => {
  const user = await readSession(request);
  response.json({ user: user ? {
    phone: user.phone, role: user.role, displayName: user.display_name,
    county: user.profile_county, bio: user.bio,
    listingNotificationsEnabled: Boolean(user.listing_notifications_enabled), listingCredits: user.listing_credits,
  } : null });
});

app.patch('/api/:cropId/auth/role', requireAuth, async (request, response) => {
  const role = String(request.body?.role ?? '');
  if (!['buyer', 'seller'].includes(role)) return response.status(400).json({ error: 'Choose buyer or seller mode.' });
  await pool.query('UPDATE market_users SET role=$1 WHERE id=$2 AND crop_id=$3', [role,request.user.id,request.crop.id]);
  response.json({ user: {
    phone: request.user.phone, role, displayName: request.user.display_name,
    county: request.user.profile_county, bio: request.user.bio,
    listingNotificationsEnabled: Boolean(request.user.listing_notifications_enabled), listingCredits: request.user.listing_credits,
  } });
});

app.patch('/api/:cropId/auth/profile', requireAuth, async (request, response) => {
  const displayName = String(request.body?.displayName ?? '').trim();
  const county = String(request.body?.county ?? '').trim();
  const bio = String(request.body?.bio ?? '').trim();
  const listingNotificationsEnabled = request.body?.listingNotificationsEnabled === true;
  if (displayName.length < 2 || displayName.length > 60) return response.status(400).json({ error: 'Your name must be between 2 and 60 characters.' });
  if (county && !counties.includes(county)) return response.status(400).json({ error: 'Choose a valid county or leave it blank.' });
  if (bio.length > 500) return response.status(400).json({ error: 'Your introduction must be 500 characters or fewer.' });
  if (listingNotificationsEnabled && !county) return response.status(400).json({ error: 'Choose a county before turning on new-listing notifications.' });
  await pool.query('UPDATE market_users SET display_name=$1,profile_county=$2,bio=$3,listing_notifications_enabled=$4 WHERE id=$5 AND crop_id=$6', [displayName,county,bio,listingNotificationsEnabled,request.user.id,request.crop.id]);
  response.json({ user: {
    phone: request.user.phone, role: request.user.role, displayName, county, bio,
    listingNotificationsEnabled, listingCredits: request.user.listing_credits,
  } });
});

app.post('/api/:cropId/auth/logout', async (request, response) => {
  const token = cookieToken(request, request.crop.id);
  if (token) await pool.query('DELETE FROM market_sessions WHERE token_hash=$1 AND crop_id=$2', [digest(token),request.crop.id]);
  const secure = request.secure || process.env.COOKIE_SECURE === 'true';
  response.append('Set-Cookie', `${cookieName(request.crop.id)}=; Path=/; HttpOnly; SameSite=${secure ? 'None' : 'Lax'}; Max-Age=0${secure ? '; Secure' : ''}`);
  response.json({ ok: true });
});

app.get('/api/:cropId/notifications', requireAuth, async (request, response) => {
  const result = await pool.query(`
    SELECT id,listing_id AS "listingId",title,body,created_at AS "createdAt",read_at AS "readAt"
    FROM market_notifications WHERE user_id=$1 AND crop_id=$2 ORDER BY created_at DESC,id DESC LIMIT 30
  `, [request.user.id,request.crop.id]);
  const unread = await pool.query('SELECT COUNT(*)::integer AS count FROM market_notifications WHERE user_id=$1 AND crop_id=$2 AND read_at IS NULL', [request.user.id,request.crop.id]);
  response.json({ notifications: result.rows, unreadCount: unread.rows[0].count });
});

app.post('/api/:cropId/notifications/read-all', requireAuth, async (request, response) => {
  await pool.query('UPDATE market_notifications SET read_at=NOW() WHERE user_id=$1 AND crop_id=$2 AND read_at IS NULL', [request.user.id,request.crop.id]);
  response.json({ ok: true });
});

app.post('/api/:cropId/notifications/:id/read', requireAuth, async (request, response) => {
  const notificationId = Number(request.params.id);
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) return response.status(400).json({ error: 'Choose a valid notification.' });
  await pool.query('UPDATE market_notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2 AND crop_id=$3', [notificationId,request.user.id,request.crop.id]);
  response.json({ ok: true });
});

const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Please wait before trying again.' },
});
const listingPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many listing attempts. Please try again later.' },
});
const DARAJA_BASE_URL = process.env.DARAJA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';
let cachedDarajaToken = null;
let cachedDarajaTokenExpiresAt = 0;

function darajaTimestamp() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => part.value).join('');
}

async function darajaToken() {
  if (cachedDarajaToken && Date.now() < cachedDarajaTokenExpiresAt) return cachedDarajaToken;
  const { DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET } = process.env;
  if (!DARAJA_CONSUMER_KEY || !DARAJA_CONSUMER_SECRET) throw new Error('Daraja credentials are not configured.');
  const authorization = Buffer.from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`).toString('base64');
  const response = await fetch(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${authorization}` }, signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Daraja OAuth returned ${response.status}.`);
  const data = await response.json();
  cachedDarajaToken = data.access_token;
  cachedDarajaTokenExpiresAt = Date.now() + Math.max(0, Number(data.expires_in ?? 3599) - 60) * 1000;
  return cachedDarajaToken;
}

function darajaCallbackUrl(request) {
  const configured = process.env.DARAJA_CALLBACK_URL;
  const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const origin = configured ? new URL(configured).origin : deploymentHost ? `https://${deploymentHost}` : `${request.protocol}://${request.get('host')}`;
  const callbackUrl = configured ?? `${origin}/api/${request.crop.id}/payments/callback`;
  const parsed = new URL(callbackUrl);
  if (parsed.protocol !== 'https:' || !parsed.pathname.endsWith(`/api/${request.crop.id}/payments/callback`)) {
    throw new Error('Configure an HTTPS Daraja callback URL for this crop marketplace.');
  }
  return parsed.toString();
}

async function initiateDaraja(payment, request) {
  const shortcode = process.env.DARAJA_SHORTCODE;
  const passkey = process.env.DARAJA_PASSKEY;
  if (!shortcode || !passkey) throw new Error('Daraja shortcode and passkey are not configured.');
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const token = await darajaToken();
  const response = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      BusinessShortCode: shortcode, Password: password, Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline', Amount: 500,
      PartyA: payment.phone.slice(1), PartyB: shortcode, PhoneNumber: payment.phone.slice(1),
      CallBackURL: darajaCallbackUrl(request),
      AccountReference: payment.purpose === 'seller_listing_credit' ? 'SUGARCANEPOST' : `LAND${payment.listing_id}`.slice(0, 12),
      TransactionDesc: payment.purpose === 'seller_listing_credit' ? 'Sugarcane listing credit' : 'Sugarcane land check',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ResponseCode !== '0' || !data.CheckoutRequestID) {
    throw new Error('Safaricom could not start the M-Pesa payment. Check the phone number and try again.');
  }
  await pool.query(`UPDATE market_payments SET status='pending',merchant_request_id=$1,checkout_request_id=$2,updated_at=NOW() WHERE id=$3`,
    [data.MerchantRequestID,data.CheckoutRequestID,payment.id]);
  return data.CheckoutRequestID;
}

async function queryDarajaPayment(checkoutRequestId) {
  const shortcode = process.env.DARAJA_SHORTCODE;
  const passkey = process.env.DARAJA_PASSKEY;
  if (!shortcode || !passkey) throw new Error('Daraja shortcode and passkey are not configured.');
  const timestamp = darajaTimestamp();
  const token = await darajaToken();
  const response = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64'),
      Timestamp: timestamp, CheckoutRequestID: checkoutRequestId,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Safaricom payment query returned ${response.status}.`);
  return data;
}

async function reconcileSuccessfulPayment(payment, callbackMetadata = null) {
  if (callbackMetadata) {
    const paidAmount = Number(callbackMetadata.Amount);
    const paidPhone = callbackMetadata.PhoneNumber == null ? payment.phone.slice(1) : String(callbackMetadata.PhoneNumber);
    if (paidAmount !== 500 || paidPhone !== payment.phone.slice(1)) return false;
  }
  const query = await queryDarajaPayment(payment.checkout_request_id);
  if (query.ResponseCode !== '0' || String(query.ResultCode) !== '0') return false;
  const receipt = callbackMetadata?.MpesaReceiptNumber ? String(callbackMetadata.MpesaReceiptNumber) : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query('SELECT * FROM market_payments WHERE id=$1 AND crop_id=$2 FOR UPDATE', [payment.id,payment.crop_id]);
    const current = locked.rows[0];
    if (!current) { await client.query('ROLLBACK'); return false; }
    if (current.status !== 'confirmed') {
      await client.query(`UPDATE market_payments SET status='confirmed',mpesa_receipt=COALESCE($1,mpesa_receipt),result_code='0',result_description='Verified by Safaricom STK Query',confirmed_at=COALESCE(confirmed_at,NOW()),updated_at=NOW() WHERE id=$2`, [receipt,current.id]);
      if (current.purpose === 'seller_listing_credit') {
        await client.query('UPDATE market_users SET listing_credits=listing_credits+1 WHERE id=$1 AND crop_id=$2', [current.user_id,current.crop_id]);
      } else {
        await client.query(`INSERT INTO market_entitlements (crop_id,user_id,listing_id,payment_id) VALUES ($1,$2,$3,$4) ON CONFLICT (crop_id,user_id,listing_id) DO NOTHING`, [current.crop_id,current.user_id,current.listing_id,current.id]);
      }
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505' && receipt) return false;
    throw error;
  } finally {
    client.release();
  }
}

function publicPayment(row) {
  return { id: Number(row.id), status: row.status, purpose: row.purpose, amountKes: row.amount_kes, checkoutRequestId: row.checkout_request_id };
}

app.post('/api/:cropId/payments', requireAuth, paymentLimiter, async (request, response) => {
  const purpose = String(request.body?.purpose ?? '');
  const listingId = Number(request.body?.listingId);
  const phone = normalizePhone(request.body?.phone);
  const idempotencyKey = String(request.body?.idempotencyKey ?? '');
  if (!phone || !/^[\w-]{16,80}$/.test(idempotencyKey)) return response.status(400).json({ error: 'Enter a valid mobile number and retry the payment.' });
  const accountResult = await pool.query('SELECT role,listing_credits FROM market_users WHERE id=$1 AND crop_id=$2', [request.user.id,request.crop.id]);
  const account = accountResult.rows[0];
  if (!account) return response.status(401).json({ error: 'Sign in with your phone number to continue.' });
  if (purpose === 'seller_listing_credit' && (account.role !== 'seller' || account.listing_credits > 0)) {
    return response.status(400).json({ error: account.role !== 'seller' ? 'Switch to seller mode to buy a listing credit.' : 'You already have a listing credit.' });
  }
  if (purpose === 'buyer_listing_reveal') {
    if (account.role !== 'buyer' || !Number.isSafeInteger(listingId) || listingId <= 0) return response.status(400).json({ error: 'Choose a valid listing as a buyer.' });
    const listing = await pool.query('SELECT owner_user_id FROM market_listings WHERE id=$1 AND crop_id=$2', [listingId,request.crop.id]);
    if (!listing.rows[0]) return response.status(404).json({ error: 'This listing is no longer available.' });
    if (String(listing.rows[0].owner_user_id) === String(request.user.id)) return response.status(403).json({ error: 'You cannot purchase access to your own listing.' });
    const existing = await pool.query('SELECT id FROM market_entitlements WHERE crop_id=$1 AND user_id=$2 AND listing_id=$3', [request.crop.id,request.user.id,listingId]);
    if (existing.rows.length) return response.json({ alreadyUnlocked: true });
  } else if (purpose !== 'seller_listing_credit') {
    return response.status(400).json({ error: 'Choose a valid payment type.' });
  }
  const client = await pool.connect();
  let payment;
  let reusedActivePayment = false;
  try {
    await client.query('BEGIN');
    const paymentScope = `${request.crop.id}:${request.user.id}:${purpose}:${purpose === 'buyer_listing_reveal' ? listingId : 'credit'}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [paymentScope]);
    if (purpose === 'seller_listing_credit') {
      const freshAccount = await client.query('SELECT listing_credits FROM market_users WHERE id=$1 AND crop_id=$2', [request.user.id,request.crop.id]);
      if (freshAccount.rows[0]?.listing_credits > 0) {
        await client.query('COMMIT');
        return response.status(400).json({ error: 'You already have a listing credit.' });
      }
    } else {
      const existingEntitlement = await client.query('SELECT id FROM market_entitlements WHERE crop_id=$1 AND user_id=$2 AND listing_id=$3', [request.crop.id,request.user.id,listingId]);
      if (existingEntitlement.rows.length) {
        await client.query('COMMIT');
        return response.json({ alreadyUnlocked: true });
      }
    }
    const active = await client.query(`
      SELECT * FROM market_payments WHERE crop_id=$1 AND user_id=$2 AND purpose=$3
        AND listing_id IS NOT DISTINCT FROM $4 AND status IN ('initiating','pending')
        AND updated_at>NOW()-INTERVAL '15 minutes' ORDER BY id DESC LIMIT 1
    `, [request.crop.id,request.user.id,purpose,purpose === 'buyer_listing_reveal' ? listingId : null]);
    if (active.rows[0]) {
      payment = active.rows[0];
      reusedActivePayment = true;
    } else {
      const created = await client.query(`
        INSERT INTO market_payments (crop_id,user_id,purpose,listing_id,amount_kes,phone,idempotency_key)
        VALUES ($1,$2,$3,$4,500,$5,$6)
        ON CONFLICT (user_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING *
      `, [request.crop.id,request.user.id,purpose,purpose === 'buyer_listing_reveal' ? listingId : null,phone,idempotencyKey]);
      payment = created.rows[0] ?? (await client.query('SELECT * FROM market_payments WHERE user_id=$1 AND idempotency_key=$2', [request.user.id,idempotencyKey])).rows[0];
    }
    if (!payment || payment.crop_id !== request.crop.id || payment.purpose !== purpose || String(payment.listing_id ?? '') !== String(purpose === 'buyer_listing_reveal' ? listingId : '')) {
      await client.query('ROLLBACK');
      return response.status(409).json({ error: 'This retry key was already used for a different payment.' });
    }
    if (reusedActivePayment && payment.phone !== phone) {
      await client.query('ROLLBACK');
      return response.status(409).json({ error: 'A payment request is already waiting for another number. Finish that prompt or try again after it expires.' });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  if (payment.status === 'initiating' && !payment.checkout_request_id && !reusedActivePayment) {
    try {
      await initiateDaraja(payment, request);
      payment = (await pool.query('SELECT * FROM market_payments WHERE id=$1', [payment.id])).rows[0];
    } catch (error) {
      await pool.query("UPDATE market_payments SET status='failed',result_description=$1,updated_at=NOW() WHERE id=$2 AND status='initiating'", [error.message.includes('credentials') || error.message.includes('Configure') ? error.message : 'Safaricom could not start the payment.',payment.id]);
      if (error.message.includes('credentials') || error.message.includes('Configure')) return response.status(503).json({ error: error.message });
      return response.status(502).json({ error: 'Safaricom could not start the M-Pesa payment. Please try again.' });
    }
  }
  response.status(202).json({ payment: publicPayment(payment) });
});

app.post('/api/:cropId/payments/callback', async (request, response) => {
  const callback = request.body?.Body?.stkCallback;
  const checkoutRequestId = String(callback?.CheckoutRequestID ?? '');
  if (!checkoutRequestId) return response.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  try {
    const found = await pool.query('SELECT * FROM market_payments WHERE crop_id=$1 AND checkout_request_id=$2', [request.crop.id,checkoutRequestId]);
    const payment = found.rows[0];
    if (payment) {
      if (String(callback.ResultCode) === '0') {
        const items = callback.CallbackMetadata?.Item ?? [];
        const metadata = Object.fromEntries(items.map((item) => [item.Name,item.Value]));
        await reconcileSuccessfulPayment(payment, metadata);
      } else {
        const query = await queryDarajaPayment(payment.checkout_request_id);
        if (query.ResponseCode === '0' && query.ResultCode != null && String(query.ResultCode) !== '0') {
          await pool.query("UPDATE market_payments SET status='failed',result_code=$1,result_description=$2,updated_at=NOW() WHERE id=$3 AND status<>'confirmed'", [String(query.ResultCode),String(query.ResultDesc ?? callback.ResultDesc ?? 'Payment was not completed').slice(0,250),payment.id]);
        }
      }
    }
  } catch (error) {
    console.error('Daraja callback reconciliation failed:', error.message);
  }
  response.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/api/:cropId/payments/:id', requireAuth, async (request, response) => {
  const paymentId = Number(request.params.id);
  if (!Number.isSafeInteger(paymentId) || paymentId <= 0) return response.status(400).json({ error: 'Choose a valid payment.' });
  const result = await pool.query('SELECT * FROM market_payments WHERE id=$1 AND crop_id=$2 AND user_id=$3', [paymentId,request.crop.id,request.user.id]);
  let payment = result.rows[0];
  if (!payment) return response.status(404).json({ error: 'Payment was not found.' });
  if (payment.checkout_request_id && ['pending','initiating'].includes(payment.status)) {
    try {
      const query = await queryDarajaPayment(payment.checkout_request_id);
      if (query.ResponseCode === '0' && String(query.ResultCode) === '0') {
        await reconcileSuccessfulPayment(payment);
      } else if (query.ResponseCode === '0' && query.ResultCode != null && String(query.ResultCode) !== '0') {
        await pool.query("UPDATE market_payments SET status='failed',result_code=$1,result_description=$2,updated_at=NOW() WHERE id=$3 AND status<>'confirmed'", [String(query.ResultCode),String(query.ResultDesc ?? 'Payment was not completed').slice(0,250),payment.id]);
      }
      payment = (await pool.query('SELECT * FROM market_payments WHERE id=$1 AND crop_id=$2 AND user_id=$3', [paymentId,request.crop.id,request.user.id])).rows[0];
    } catch (error) {
      console.error('Daraja status reconciliation failed:', error.message);
    }
  }
  const credits = await pool.query('SELECT listing_credits FROM market_users WHERE id=$1 AND crop_id=$2', [request.user.id,request.crop.id]);
  response.json({ payment: publicPayment(payment), listingCredits: credits.rows[0]?.listing_credits ?? 0 });
});

app.get('/api/:cropId/listings', async (request, response) => {
  const result = await pool.query('SELECT * FROM market_listings WHERE crop_id=$1 ORDER BY created_at DESC,id DESC', [request.crop.id]);
  response.json({ listings: result.rows.map((row) => publicListing(row, request.crop)) });
});

async function requireListingCredit(request, response, next) {
  if (request.user.role !== 'seller') return response.status(403).json({ error: 'Switch to seller mode to post a listing.' });
  const result = await pool.query('SELECT listing_credits FROM market_users WHERE id=$1 AND crop_id=$2', [request.user.id,request.crop.id]);
  if (!result.rows[0] || result.rows[0].listing_credits < 1) return response.status(402).json({ error: 'A KSh 500 listing credit is required before publishing.' });
  next();
}

app.post('/api/:cropId/listings', requireAuth, listingPostLimiter, requireListingCredit, upload.single('image'), async (request, response) => {
  if (request.user.role !== 'seller') return response.status(403).json({ error: 'Switch to seller mode to post a listing.' });
  const body = request.body;
  const title = String(body.title ?? '').trim();
  const county = String(body.county ?? '').trim();
  const locality = String(body.locality ?? '').trim();
  const acres = Number(body.acres);
  const priceKes = Number(body.priceKes);
  const kind = String(body.kind ?? '');
  const cropVariety = String(body.cropVariety ?? '').trim();
  const expectedHarvest = String(body.expectedHarvest ?? '').trim();
  const description = String(body.description ?? '').trim();
  const latitude = body.latitude === '' || body.latitude == null ? null : Number(body.latitude);
  const longitude = body.longitude === '' || body.longitude == null ? null : Number(body.longitude);

  if (!request.file) return response.status(400).json({ error: 'Add a clear photo of the land or crop.' });
  if (title.length < 5 || title.length > 100 || locality.length < 2 || locality.length > 80) return response.status(400).json({ error: 'Add a title and a valid town or area.' });
  if (!counties.includes(county) || !Number.isFinite(acres) || acres <= 0 || acres > 100000) return response.status(400).json({ error: 'Check the county and acreage fields.' });
  if (!Number.isSafeInteger(priceKes) || priceKes <= 0 || ![request.crop.standingLabel, 'Land for lease'].includes(kind)) return response.status(400).json({ error: 'Choose a listing type and enter a valid price in KSh.' });
  if (cropVariety.length < 2 || cropVariety.length > 80 || expectedHarvest.length > 80 || description.length < 20 || description.length > 1000) return response.status(400).json({ error: 'Check the crop details and description.' });
  const hasLatitude = latitude !== null;
  const hasLongitude = longitude !== null;
  if (hasLatitude !== hasLongitude || (hasLatitude && (!Number.isFinite(latitude) || latitude < -4.8 || latitude > 5.2 || !Number.isFinite(longitude) || longitude < 33.8 || longitude > 42.2))) return response.status(400).json({ error: 'Choose a valid map location within Kenya.' });

  const fileType = await fileTypeFromBuffer(request.file.buffer);
  const fileExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  if (!fileType || !fileExtensions[fileType.mime]) return response.status(400).json({ error: 'Upload a valid JPG, PNG, or WebP image.' });
  const filename = `${randomBytes(18).toString('hex')}${fileExtensions[fileType.mime]}`;
  const blob = await put(`listings/${request.crop.id}/${filename}`, request.file.buffer, {
    access: 'public', contentType: fileType.mime, addRandomSuffix: false,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const credit = await client.query('UPDATE market_users SET listing_credits=listing_credits-1 WHERE id=$1 AND crop_id=$2 AND role=\'seller\' AND listing_credits>0 RETURNING listing_credits', [request.user.id,request.crop.id]);
    if (!credit.rows[0]) {
      await client.query('ROLLBACK');
      await del(blob.url).catch(() => {});
      return response.status(402).json({ error: 'A KSh 500 listing credit is required before publishing.' });
    }
    const inserted = await client.query(`
      INSERT INTO market_listings (crop_id,title,county,locality,acres,price_kes,kind,crop_variety,expected_harvest,description,image_url,owner_user_id,latitude,longitude)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
    `, [request.crop.id,title,county,locality,acres,priceKes,kind,cropVariety,expectedHarvest,description,blob.url,request.user.id,latitude,longitude]);
    const listing = inserted.rows[0];
    await client.query(`
      INSERT INTO market_notifications (crop_id,user_id,listing_id,title,body)
      SELECT $1,id,$2,$3,$4 FROM market_users
      WHERE crop_id=$1 AND id<>$5 AND listing_notifications_enabled=TRUE AND profile_county=$6
      ON CONFLICT (user_id,listing_id) DO NOTHING
    `, [request.crop.id,listing.id,'New sugarcane listing in your county',`${listing.title} · ${listing.locality}, ${listing.county}`,request.user.id,listing.county]);
    await client.query('COMMIT');
    response.status(201).json({ listing: publicListing(listing,request.crop), listingCredits: credit.rows[0].listing_credits });
  } catch (error) {
    await client.query('ROLLBACK');
    await del(blob.url).catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});

app.all('/api/:cropId/listings', (_request, response) => {
  response.status(405).json({ error: 'This listing action is not supported.' });
});

app.get('/api/:cropId/listings/:id/contact', requireAuth, async (request, response) => {
  const listingId = Number(request.params.id);
  if (!Number.isSafeInteger(listingId) || listingId <= 0) return response.status(400).json({ error: 'Choose a valid listing.' });
  const result = await pool.query(`
    SELECT l.id,l.owner_user_id,l.latitude,l.longitude,u.phone FROM market_listings l
    LEFT JOIN market_users u ON u.id=l.owner_user_id AND u.crop_id=l.crop_id
    WHERE l.id=$1 AND l.crop_id=$2
  `, [listingId,request.crop.id]);
  const listing = result.rows[0];
  if (!listing) return response.status(404).json({ error: 'This listing is no longer available.' });
  if (!listing.phone) return response.status(404).json({ error: 'This grower has not shared a phone number.' });
  if (request.user.role !== 'buyer') return response.status(403).json({ error: 'Switch to buyer mode to contact a grower.' });
  if (String(listing.owner_user_id ?? '') === String(request.user.id)) return response.status(403).json({ error: 'You cannot buy access to your own listing.' });
  const entitlement = await pool.query('SELECT id FROM market_entitlements WHERE crop_id=$1 AND user_id=$2 AND listing_id=$3', [request.crop.id,request.user.id,listingId]);
  if (!entitlement.rows.length) return response.status(402).json({ error: 'A KSh 500 land-check payment is required to reveal the grower’s contact and location.', paymentRequired: true });
  response.json({ phone: listing.phone, latitude: listing.latitude == null ? null : Number(listing.latitude), longitude: listing.longitude == null ? null : Number(listing.longitude) });
});

app.use((error, _request, response, _next) => {
  if (error) {
    console.error(error);
    return response.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  return response.status(404).end();
});

app.get('*path', (_request, response) => {
  response.render('index');
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`SugarcaneFamily is listening at http://localhost:${port}`);
});
