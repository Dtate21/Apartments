require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// --- Database pool ---
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: true,
  })
);

// --- Helpers ---
function requireDev(req, res, next) {
  const user = req.session.user;
  if (!user || !user.isDev) {
    return res.status(403).json({ error: 'Developer access required' });
  }
  next();
}

// --- Page routes ---
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/apartments-page', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'apartments.html'));
});

app.get('/admin-page', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- Auth routes ---
app.get('/me', (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.json({});
  }
  res.json({
    username: user.username,
    isDev: user.isDev,
  });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password, is_dev FROM users WHERE username=$1',
      [username]
    );

    if (result.rowCount === 0) {
      return res.json({ success: false, error: 'Invalid username or password' });
    }

    const row = result.rows[0];

    // Plaintext password for this simple project (DO NOT do this in real production)
    if (row.password !== password) {
      return res.json({ success: false, error: 'Invalid username or password' });
    }

    req.session.user = {
      id: row.id,
      username: row.username,
      isDev: row.is_dev,
    };

    res.json({ success: true });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// --- Apartments API ---

// Get list of apartments (for the browse page)
app.get('/apartments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, price, square_footage, bedrooms, bathrooms, distance1, distance2, url FROM apartments ORDER BY price ASC'
    );

    const user = req.session.user;
    const isDev = !!(user && user.isDev);

    res.json({
      rows: result.rows,
      isDev,
    });
  } catch (e) {
    console.error('DB select error:', e);
    res.status(500).json({ error: 'DB select error' });
  }
});

// Add an apartment (dev-only)
app.post('/apartments', requireDev, async (req, res) => {
  const {
    name,
    price,
    square_footage,
    bedrooms,
    bathrooms,
    distance1,
    distance2,
    url,
  } = req.body || {};

  if (
    !name ||
    price == null ||
    square_footage == null ||
    bedrooms == null ||
    bathrooms == null ||
    distance1 == null ||
    distance2 == null
  ) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO apartments
        (name, price, square_footage, bedrooms, bathrooms, distance1, distance2, url)
      VALUES
        ($1,   $2,    $3,             $4,       $5,        $6,        $7,        $8)
      RETURNING id, name, price, square_footage, bedrooms, bathrooms, distance1, distance2, url
      `,
      [
        name,
        Number(price),
        Number(square_footage),
        Number(bedrooms),
        Number(bathrooms),
        Number(distance1),
        Number(distance2),
        url || null,
      ]
    );

    res.json({ success: true, apartment: result.rows[0] });
  } catch (e) {
    console.error('DB insert error:', e);
    res.status(500).json({ error: 'DB insert error' });
  }
});

// Delete an apartment (dev-only)
app.delete('/apartments/:id', requireDev, async (req, res) => {
  try {
    await pool.query('DELETE FROM apartments WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('DB delete error:', e);
    res.status(500).json({ error: 'DB delete error' });
  }
});

// --- Start server ---
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
});
