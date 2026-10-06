import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { backup, DatabaseSync } from 'node:sqlite';
import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const dataDir = path.join(dirname, 'data');
const cropsDataDir = path.join(dataDir, 'crops');
const legacySugarcanePath = path.join(dataDir, 'cane-country.sqlite');
const uploadDir = path.join(dirname, 'uploads');
const sessionDuration = 30 * 24 * 60 * 60 * 1000;
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
  { id: 'maize', name: 'Maize', standingLabel: 'Standing maize', fieldLabel: 'Maize variety' },
  { id: 'beans', name: 'Beans', standingLabel: 'Standing beans', fieldLabel: 'Bean variety' },
  { id: 'rice', name: 'Rice', standingLabel: 'Standing rice', fieldLabel: 'Rice variety' },
  { id: 'potatoes', name: 'Potatoes', standingLabel: 'Standing potato crop', fieldLabel: 'Potato variety' },
  { id: 'coffee', name: 'Coffee', standingLabel: 'Standing coffee', fieldLabel: 'Coffee variety' },
  { id: 'tea', name: 'Tea', standingLabel: 'Standing tea', fieldLabel: 'Tea variety' },
  { id: 'avocado', name: 'Avocado', standingLabel: 'Standing avocado', fieldLabel: 'Avocado variety' },
];
const cropById = new Map(crops.map((crop) => [crop.id, crop]));
const databases = new Map();

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(cropsDataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

async function migrateLegacySugarcane() {
  const targetPath = path.join(cropsDataDir, 'sugarcane.sqlite');
  if (fs.existsSync(targetPath) || !fs.existsSync(legacySugarcanePath)) return;

  const legacyDatabase = new DatabaseSync(legacySugarcanePath);
  try {
    await backup(legacyDatabase, targetPath);
  } finally {
    legacyDatabase.close();
  }
}

await migrateLegacySugarcane();

const sampleListings = [
  {
    title: 'Mumias cane, ready to harvest', county: 'Kakamega', locality: 'Mumias West', acres: 4.5,
    priceKes: 185000, kind: 'Standing sugarcane', cropVariety: 'NCo 334', expectedHarvest: 'Ready in 2 months',
    description: 'Example only. Established crop with reliable access and a clear harvest window.', imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=82',
  },
  {
    title: 'Fertile acreage near the mill', county: 'Bungoma', locality: 'Webuye', acres: 6,
    priceKes: 28000, kind: 'Land for lease', cropVariety: 'Suitable for sugarcane', expectedHarvest: 'Lease: 3 years',
    description: 'Example only. Cleared, accessible land with a dependable water source nearby.', imageUrl: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=900&q=82',
  },
  {
    title: 'Healthy first ratoon crop', county: 'Busia', locality: 'Nambale', acres: 3.25,
    priceKes: 152000, kind: 'Standing sugarcane', cropVariety: 'NCo 334', expectedHarvest: 'Ready in 5 months',
    description: 'Example only. Even stand and good access for collection.', imageUrl: 'https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=82',
  },
  {
    title: 'A fresh start for your next crop', county: 'Kisumu', locality: 'Muhoroni', acres: 8,
    priceKes: 32000, kind: 'Land for lease', cropVariety: 'Suitable for sugarcane', expectedHarvest: 'Lease: 5 years',
    description: 'Example only. Open plot with road access and room to plan a full growing cycle.', imageUrl: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=82',
  },
];

function ensureColumn(database, table, columnName, definition, migration) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === columnName)) database.exec(migration ?? `ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function openCropDatabase(crop) {
  const database = new DatabaseSync(path.join(cropsDataDir, `${crop.id}.sqlite`));
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'seller',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      county TEXT NOT NULL,
      locality TEXT NOT NULL,
      acres REAL NOT NULL,
      price_kes INTEGER NOT NULL,
      kind TEXT NOT NULL,
      crop_variety TEXT NOT NULL,
      expected_harvest TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_sample INTEGER NOT NULL DEFAULT 0,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS listings_created_at_idx ON listings(created_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  `);

  ensureColumn(database, 'users', 'role', 'role TEXT NOT NULL DEFAULT \'seller\'');
  const listingColumns = database.prepare('PRAGMA table_info(listings)').all();
  if (!listingColumns.some((column) => column.name === 'is_sample')) {
    database.exec('ALTER TABLE listings ADD COLUMN is_sample INTEGER NOT NULL DEFAULT 0');
    database.exec('UPDATE listings SET is_sample = 1 WHERE owner_user_id IS NULL');
  }
  ensureColumn(database, 'listings', 'latitude', 'latitude REAL');
  ensureColumn(database, 'listings', 'longitude', 'longitude REAL');
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());

  if (crop.id === 'sugarcane' && database.prepare('SELECT COUNT(*) AS count FROM listings').get().count === 0) {
    const insertSample = database.prepare(`
      INSERT INTO listings (title, county, locality, acres, price_kes, kind, crop_variety, expected_harvest, description, image_url, is_sample)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (const listing of sampleListings) {
      insertSample.run(listing.title, listing.county, listing.locality, listing.acres, listing.priceKes,
        listing.kind, listing.cropVariety, listing.expectedHarvest, listing.description, listing.imageUrl);
    }
  }
  databases.set(crop.id, database);
}

for (const crop of crops) openCropDatabase(crop);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

app.set('view engine', 'ejs');
app.set('views', path.join(dirname, 'views'));
app.use(express.json({ limit: '16kb' }));
app.use('/uploads', express.static(uploadDir, { maxAge: '1d', immutable: true }));

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

function readSession(request) {
  const name = cookieName(request.crop.id);
  const cookieValue = request.headers.cookie?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!cookieValue) return null;

  let token;
  try {
    token = decodeURIComponent(cookieValue);
  } catch {
    return null;
  }

  const session = request.database.prepare(`
    SELECT users.id, users.phone, users.role FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(digest(token), Date.now());
  return session ?? null;
}

function requireAuth(request, response, next) {
  request.user = readSession(request);
  if (!request.user) return response.status(401).json({ error: 'Sign in with your phone number to continue.' });
  next();
}

function createSession(request, user, response) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + sessionDuration;
  request.database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(digest(token), user.id, expiresAt);
  response.cookie(cookieName(request.crop.id), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: sessionDuration,
  });
}

function publicListing(row, crop) {
  return {
    id: row.id,
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
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
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
  const countyName = String(address.county ?? address.state_district ?? address.state ?? '')
    .replace(/\s+County$/i, '').trim();
  const county = counties.find((item) => item.toLowerCase() === countyName.toLowerCase()) ?? 'Other';
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
      'User-Agent': `MavunoMarket/1.0 (${geocoderContact})`,
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
  response.json({ crops: crops.map(({ id, name, standingLabel, fieldLabel }) => ({ id, name, standingLabel, fieldLabel })) });
});

app.use('/api/:cropId', (request, response, next) => {
  const crop = cropById.get(request.params.cropId);
  if (!crop) return response.status(404).json({ error: 'Choose a supported crop marketplace.' });
  request.crop = crop;
  request.database = databases.get(crop.id);
  next();
});

app.post('/api/:cropId/auth/signup', authLimiter, (request, response) => {
  const phone = normalizePhone(request.body?.phone);
  const password = String(request.body?.password ?? '');
  const role = String(request.body?.role ?? '');
  if (!phone) return response.status(400).json({ error: 'Enter a valid Kenyan mobile number, such as 0712 345 678.' });
  if (password.length < 8 || password.length > 128) return response.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!['buyer', 'seller'].includes(role)) return response.status(400).json({ error: 'Choose whether you are joining as a buyer or seller.' });

  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, salt, 64).toString('hex');
  try {
    const result = request.database.prepare('INSERT INTO users (phone, password_salt, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(phone, salt, passwordHash, role);
    const user = { id: Number(result.lastInsertRowid), phone, role };
    createSession(request, user, response);
    return response.status(201).json({ user: { phone, role } });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: users.phone')) {
      return response.status(409).json({ error: 'An account already exists for this crop and number. Sign in instead.' });
    }
    throw error;
  }
});

app.post('/api/:cropId/auth/login', authLimiter, (request, response) => {
  const phone = normalizePhone(request.body?.phone);
  const password = String(request.body?.password ?? '');
  if (!phone || !password) return response.status(400).json({ error: 'Enter your Kenyan phone number and password.' });

  const record = request.database.prepare('SELECT id, phone, password_salt, password_hash, role FROM users WHERE phone = ?').get(phone);
  if (!record) return response.status(401).json({ error: 'That number and password do not match.' });
  const candidate = scryptSync(password, record.password_salt, 64);
  const stored = Buffer.from(record.password_hash, 'hex');
  if (stored.length !== candidate.length || !timingSafeEqual(stored, candidate)) {
    return response.status(401).json({ error: 'That number and password do not match.' });
  }

  createSession(request, { id: record.id, phone: record.phone, role: record.role }, response);
  return response.json({ user: { phone: record.phone, role: record.role } });
});

app.get('/api/:cropId/auth/session', (request, response) => {
  const user = readSession(request);
  response.json({ user: user ? { phone: user.phone, role: user.role } : null });
});

app.patch('/api/:cropId/auth/role', requireAuth, (request, response) => {
  const role = String(request.body?.role ?? '');
  if (!['buyer', 'seller'].includes(role)) return response.status(400).json({ error: 'Choose buyer or seller mode.' });
  request.database.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, request.user.id);
  response.json({ user: { phone: request.user.phone, role } });
});

app.post('/api/:cropId/auth/logout', (request, response) => {
  const name = cookieName(request.crop.id);
  const user = readSession(request);
  if (user) {
    const token = request.headers.cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
    if (token) request.database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(decodeURIComponent(token)));
  }
  response.clearCookie(name, { httpOnly: true, sameSite: 'lax', path: '/' });
  response.json({ ok: true });
});

app.get('/api/:cropId/listings', (request, response) => {
  const rows = request.database.prepare('SELECT * FROM listings ORDER BY created_at DESC, id DESC').all();
  response.json({ listings: rows.map((row) => publicListing(row, request.crop)) });
});

app.post('/api/:cropId/listings', requireAuth, upload.single('image'), async (request, response) => {
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
  if (title.length < 5 || title.length > 100 || locality.length < 2 || locality.length > 80) {
    return response.status(400).json({ error: 'Add a title and a valid town or area.' });
  }
  if (!counties.includes(county) || !Number.isFinite(acres) || acres <= 0 || acres > 100000) {
    return response.status(400).json({ error: 'Check the county and acreage fields.' });
  }
  if (!Number.isSafeInteger(priceKes) || priceKes <= 0 || ![request.crop.standingLabel, 'Land for lease'].includes(kind)) {
    return response.status(400).json({ error: 'Choose a listing type and enter a valid price in KSh.' });
  }
  if (cropVariety.length < 2 || cropVariety.length > 80 || expectedHarvest.length > 80 || description.length < 20 || description.length > 1000) {
    return response.status(400).json({ error: 'Check the crop details and description.' });
  }
  const hasLatitude = latitude !== null;
  const hasLongitude = longitude !== null;
  if (hasLatitude !== hasLongitude || (hasLatitude && (!Number.isFinite(latitude) || latitude < -4.8 || latitude > 5.2 || !Number.isFinite(longitude) || longitude < 33.8 || longitude > 42.2))) {
    return response.status(400).json({ error: 'Choose a valid map location within Kenya.' });
  }

  const fileType = await fileTypeFromBuffer(request.file.buffer);
  const fileExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  if (!fileType || !fileExtensions[fileType.mime]) return response.status(400).json({ error: 'Upload a valid JPG, PNG, or WebP image.' });
  const cropUploadDir = path.join(uploadDir, request.crop.id);
  fs.mkdirSync(cropUploadDir, { recursive: true });
  const filename = `${randomBytes(18).toString('hex')}${fileExtensions[fileType.mime]}`;
  await fs.promises.writeFile(path.join(cropUploadDir, filename), request.file.buffer, { flag: 'wx' });
  const imageUrl = `/uploads/${request.crop.id}/${filename}`;
  const result = request.database.prepare(`
    INSERT INTO listings (title, county, locality, acres, price_kes, kind, crop_variety, expected_harvest, description, image_url, owner_user_id, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, county, locality, acres, priceKes, kind, cropVariety, expectedHarvest, description, imageUrl, request.user.id, latitude, longitude);
  const listing = request.database.prepare('SELECT * FROM listings WHERE id = ?').get(Number(result.lastInsertRowid));
  response.status(201).json({ listing: publicListing(listing, request.crop) });
});

app.get('/api/:cropId/listings/:id/contact', requireAuth, (request, response) => {
  const listing = request.database.prepare(`
    SELECT users.phone FROM listings
    LEFT JOIN users ON users.id = listings.owner_user_id
    WHERE listings.id = ?
  `).get(Number(request.params.id));
  if (!listing) return response.status(404).json({ error: 'This listing is no longer available.' });
  if (!listing.phone) return response.status(404).json({ error: 'This grower has not shared a phone number.' });
  response.json({ phone: listing.phone });
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Choose a photo smaller than 6 MB.' : 'Upload one JPG, PNG, or WebP photo.';
    return response.status(400).json({ error: message });
  }
  if (error) {
    console.error(error);
    return response.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  return response.status(404).end();
});

if (isProduction) {
  app.use('/assets', express.static(path.join(dirname, 'dist/client')));
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);
}

app.get('*path', (_request, response) => {
  let assets = { js: '/src/main.jsx', css: [] };
  if (isProduction) {
    const manifestPath = path.join(dirname, 'dist/client/.vite/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const entry = manifest['src/main.jsx'];
    assets = {
      js: `/assets/${entry.file}`,
      css: (entry.css ?? []).map((file) => `/assets/${file}`),
    };
  }
  response.render('index', { isProduction, assets });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Mavuno Market is listening at http://localhost:${port}`);
});
