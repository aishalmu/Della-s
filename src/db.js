const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// [category, name, description, price, price note, duration (mins), bookable]
// Add-ons ("£4 extra", "£2 per nail") show on the price list but are requested
// alongside a main treatment rather than booked on their own.
// Durations are best guesses - adjust them from the admin page.
const DEFAULT_SERVICES = [
  ['BIAB Treatments', 'Gel Polish', '', 15, '', 45, 1],
  ['BIAB Treatments', 'Plain BIAB', '', 18, '', 60, 1],
  ['BIAB Treatments', 'Plain BIAB Extensions', 'Price applies to long natural nails', 25, '', 75, 1],
  ['BIAB Treatments', 'Gel Overlay / Nail Art', '', 4, 'extra', 15, 0],
  ['Acrylic Treatments', 'Plain Acrylic', '', 25, '', 75, 1],
  ['Acrylic Treatments', 'Acrylic Extensions', 'Price applies to long natural nails', 29, '', 90, 1],
  ['Acrylic Treatments', 'Gel Overlay / Nail Art', '', 4, 'extra', 15, 0],
  ['Acrylic Treatments', 'Acrylic Infill', '', 22, '', 60, 1],
  ['Toes', 'Plain BIAB Toes', '', 18, '', 45, 1],
  ['Toes', 'Plain Acrylic Toes', '', 22, '', 60, 1],
  ['Toes', 'Gel Overlay / Nail Art', '', 2, 'extra', 10, 0],
  ['Extra Services', 'Nail Repair / Extension', '', 2, 'per nail', 5, 0],
  ['Extra Services', 'Soak Off', '', 10, '', 20, 1],
];

const DEFAULT_HOURS = {
  0: null,
  1: null,
  2: { open: '08:00', close: '15:00' },
  3: { open: '08:00', close: '20:00' },
  4: { open: '08:00', close: '20:00' },
  5: { open: '08:00', close: '17:00' },
  6: { open: '08:00', close: '13:00' },
};

function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY,
      category TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL,
      price_note TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL,
      bookable INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY,
      ref TEXT NOT NULL UNIQUE,
      service_id INTEGER NOT NULL REFERENCES services(id),
      service_name TEXT NOT NULL,
      price REAL NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS bookings_date ON bookings(date);

    CREATE TABLE IF NOT EXISTS booking_items (
      id INTEGER PRIMARY KEY,
      booking_id INTEGER NOT NULL REFERENCES bookings(id),
      service_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS booking_items_booking ON booking_items(booking_id);

    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      start TEXT,
      end TEXT,
      reason TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS blocks_date ON blocks(date);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const serviceCount = db.prepare('SELECT COUNT(*) AS n FROM services').get().n;
  if (serviceCount === 0) {
    const insert = db.prepare(
      `INSERT INTO services (category, name, description, price, price_note, duration, bookable, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    DEFAULT_SERVICES.forEach((s, i) => insert.run(...s, i));
  }
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(
    'hours',
    JSON.stringify(DEFAULT_HOURS),
  );
  return db;
}

module.exports = { openDatabase };
