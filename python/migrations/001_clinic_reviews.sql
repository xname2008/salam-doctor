-- Optional reviews table for real AggregateRating data (SQLite leads.db).
-- Run once: sqlite3 leads.db < python/migrations/001_clinic_reviews.sql

CREATE TABLE IF NOT EXISTS clinic_reviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  clinic_id     INTEGER NOT NULL,
  author_name   TEXT,
  rating        REAL NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body          TEXT,
  published     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (clinic_id) REFERENCES clinic_profiles(clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_reviews_clinic
  ON clinic_reviews (clinic_id, published);
