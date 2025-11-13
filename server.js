const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();

/* ------------------------------------------
   DATABASE CONNECTION (Render + local)
------------------------------------------- */

// On Render: DATABASE_URL is set in Environment tab
// In Docker/local: you can also set DATABASE_URL in your .env or compose.
// We do NOT fall back to 'db' host anymore.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render’s Postgres requires SSL; local Docker ignores this if not needed.
  ssl: { rejectUnauthorized: false },
});

/* ------------------------------------------
   AUTO DB INIT (SCHEMA + SEED)
------------------------------------------- */

async function ensureDb() {
  // 1. Run schema
  const schemaSql = fs.readFileSync(
    path.join(__dirname, 'db', 'init', '01_schema.sql'),
    'utf8'
  );
  await pool.query(schemaSql);

  // 2. Check how many apartments exist
  let count = 0;
  try {
    const result = await pool.query('SELECT COUNT(*) FROM apartments');
    count = Number(result.rows[0].count);
  } catch (err) {
    console.warn(
      'Could not count apartments yet, will run seed anyway:',
      err.message
    );
  }

  // 3. If none, run seed
  if (count === 0) {
    const seedSql = fs.readFileSync(
      path.join(__dirname, 'db', 'init', '02_seed.sql'),
      'utf8'
    );
    await pool.query(seedSql);
    console.log('🌱 Database seeded with initial data');
  } else {
    console.log(
      `Database already has ${count} apartments, skipping seed`
    );
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
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
  })
);

/* ------------------------------------------
   ROUTES
------------------------------------------- */

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Apartments JSON (used by front-end JS)
app.get('/apartments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM apartments ORDER BY id'
    );
    res.json({
      rows: result.rows,
      isDev: !!req.session.isDev, // front end uses this to show Distance 2
    });
  } catch (err) {
    console.error('Error fetching apartments:', err);
    res.status(500).json({ error: 'Failed to load apartments' });
  }
});

// Login (simple dev login)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (result.rowCount === 1) {
      const user = result.rows[0];
      req.session.userId = user.id;
      req.session.isDev = user.is_dev;
      console.log(
        `User ${username} logged in. is_dev=${user.is_dev}`
      );
      return res.redirect('/apartments.html');
    } else {
      return res.status(401).send('Invalid username or password');
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Server error');
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

/* ------------------------------------------
   DEV / ADMIN ROUTES
------------------------------------------- */

// Add a new apartment (from admin.html form)
app.post('/admin/apartments', async (req, res) => {
  if (!req.session.isDev) {
    return res.status(403).send('Forbidden');
  }

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
    console.error('Error adding apartment:', err);
    res.status(500).send('Failed to add apartment');
  }
});

// Delete an apartment (by id)
app.post('/admin/apartments/delete', async (req, res) => {
  if (!req.session.isDev) {
    return res.status(403).send('Forbidden');
  }

  const { id } = req.body;

  try {
    await pool.query('DELETE FROM apartments WHERE id = $1', [id]);
    res.redirect('/admin.html');
  } catch (err) {
    console.error('Error deleting apartment:', err);
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
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });
