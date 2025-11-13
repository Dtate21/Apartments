CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_dev BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS apartments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  square_footage NUMERIC NOT NULL,
  bedrooms INT NOT NULL,
  bathrooms NUMERIC NOT NULL,
  distance1 NUMERIC,
  distance2 NUMERIC,
  url TEXT
);
