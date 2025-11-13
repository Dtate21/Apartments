const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();

/* ------------------------------------------
   DATABASE CONNECTION
------------------------------------------- */

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@db:5432/apartments',

  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

/* ------------------------------------------
   AUTO DB INIT (SCHEMA + SEED)
------------------------------------------- */

async function ensureDb() {
  // load schema
  const schema = fs.readFileSync(
    path.join(__dirname, 'db', 'init', '01_schema.sql'),
    'utf8'
  );
  await pool.query(schema);

  // count rows
  let count = 0;
  try {
    const result = await pool.query('SELECT COUNT(*) FROM apartments');
    count = Number(result.rows[0].count);
  } catch (err) {
    console.log("Couldn't count rows, seeding anyway…");
  }

  // if empty → seed
  if (count === 0) {
    const seed = fs.readFileSync(
      path.join(__dirname, 'db', 'init', '02_seed.sql'),
      'utf8'
    );
    await pool.query(seed);
    console.log('🌱 Seeded database!');
  } else {
    console.log(`DB already has ${count} apartments. Skipping seed.`);
  }
}

/* ------------------------------------------
   MIDDLEWARE
------------------------------------------- */

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
  })
);

/* ------------------------------------------
   ROUTES
------------------------------------------- */

// home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// front-end fetcher → apartments.js fetches from here
app.get('/apartments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM apartments ORDER BY id'
    );

    res.json({
      rows: result.rows,
      isDev: !!req.session.isDev,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load apartments' });
  }
});

// login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const r = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (r.rowCount === 1) {
      req.session.userId = r.rows[0].id;
      req.session.isDev = r.rows[0].is_dev;
      return res.redirect('/apartments.html');
    }

    res.status(401).send('Invalid username or password');
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
});

// logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

/* ------------------------------------------
   DEV ROUTES (admin)
------------------------------------------- */

// add apartment
app.post('/admin/apartments', async (req, res) => {
  if (!req.session.isDev) return res.status(403).send('Forbidden');

  const {
    name,
    price,
    square_footage,
    bedrooms,
    bathrooms,
    distance1,
    distance2,
    url,
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO apartments
       (name, price, square_footage, bedrooms, bathrooms, distance1, distance2, url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        name,
        price || null,
        square_footage || 0,
        bedrooms || 0,
        bathrooms || 1,
        distance1 || null,
        distance2 || null,
        url || null,
      ]
    );

    res.redirect('/admin.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to add apartment');
  }
});

// delete apartment
app.post('/admin/apartments/delete', async (req, res) => {
  if (!req.session.isDev) return res.status(403).send('Forbidden');

  try {
    await pool.query('DELETE FROM apartments WHERE id = $1', [
      req.body.id,
    ]);
    res.redirect('/admin.html');
  } catch (e) {
    console.error(e);
    res.status(500).send('Failed to delete apartment');
  }
});

/* ------------------------------------------
   START SERVER AFTER DB INIT
------------------------------------------- */

const PORT = process.env.PORT || 3000;

ensureDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ DB init failed:', err);
    process.exit(1);
  });
