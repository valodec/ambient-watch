import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// Opened lazily (on first actual query) rather than at module load. `next build`
// imports every route module — including this one — from several parallel
// worker processes just to collect page metadata. Opening the file eagerly at
// import time meant those workers raced to open the same SQLite file at once
// and the build failed with "database is locked".
let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;

  const dbPath = process.env.DB_PATH ?? "./data/ambient-watch.db";
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS library_entries (
      profile_id INTEGER NOT NULL REFERENCES profiles(id),
      tmdb_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      first_air_year INTEGER,
      source TEXT NOT NULL CHECK (source IN ('seed', 'recommendation')),
      watched INTEGER NOT NULL DEFAULT 0,
      rating TEXT CHECK (rating IN ('liked', 'disliked')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (profile_id, tmdb_id)
    );
  `);
  return db;
}

export interface Profile {
  id: number;
  name: string;
}

export interface LibraryEntry {
  profileId: number;
  tmdbId: number;
  name: string;
  firstAirYear: number | null;
  source: "seed" | "recommendation";
  watched: boolean;
  rating: "liked" | "disliked" | null;
}

export function getProfiles(): Profile[] {
  const rows = getDb().prepare("SELECT id, name FROM profiles ORDER BY name COLLATE NOCASE").all();
  return rows.map((r) => ({ id: r.id as number, name: r.name as string }));
}

export function getProfile(id: number): Profile | null {
  const row = getDb().prepare("SELECT id, name FROM profiles WHERE id = ?").get(id);
  return row ? { id: row.id as number, name: row.name as string } : null;
}

export function createProfile(name: string): Profile {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Profile name cannot be empty");
  }
  const existing = getDb()
    .prepare("SELECT id, name FROM profiles WHERE name = ? COLLATE NOCASE")
    .get(trimmed);
  if (existing) {
    const err = new Error("A profile with that name already exists");
    (err as Error & { code: string }).code = "DUPLICATE_PROFILE";
    throw err;
  }
  const result = getDb().prepare("INSERT INTO profiles (name) VALUES (?)").run(trimmed);
  return { id: Number(result.lastInsertRowid), name: trimmed };
}

function rowToEntry(row: Record<string, unknown>): LibraryEntry {
  return {
    profileId: row.profile_id as number,
    tmdbId: row.tmdb_id as number,
    name: row.name as string,
    firstAirYear: (row.first_air_year as number | null) ?? null,
    source: row.source as "seed" | "recommendation",
    watched: Boolean(row.watched),
    rating: (row.rating as "liked" | "disliked" | null) ?? null,
  };
}

export function getLibrary(profileId: number): LibraryEntry[] {
  const rows = getDb()
    .prepare(
      "SELECT profile_id, tmdb_id, name, first_air_year, source, watched, rating FROM library_entries WHERE profile_id = ? ORDER BY updated_at DESC",
    )
    .all(profileId);
  return rows.map(rowToEntry);
}

export interface UpsertLibraryEntryInput {
  profileId: number;
  tmdbId: number;
  name: string;
  firstAirYear: number | null;
  source: "seed" | "recommendation";
  watched?: boolean;
  rating?: "liked" | "disliked" | null;
}

export function upsertLibraryEntry(input: UpsertLibraryEntryInput): LibraryEntry {
  const watched = input.watched ? 1 : 0;
  const rating = input.rating ?? null;

  getDb().prepare(
    `INSERT INTO library_entries (profile_id, tmdb_id, name, first_air_year, source, watched, rating, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (profile_id, tmdb_id) DO UPDATE SET
       name = excluded.name,
       first_air_year = excluded.first_air_year,
       watched = MAX(library_entries.watched, excluded.watched),
       rating = COALESCE(excluded.rating, library_entries.rating),
       updated_at = datetime('now')`,
  ).run(
    input.profileId,
    input.tmdbId,
    input.name,
    input.firstAirYear,
    input.source,
    watched,
    rating,
  );

  const row = getDb()
    .prepare(
      "SELECT profile_id, tmdb_id, name, first_air_year, source, watched, rating FROM library_entries WHERE profile_id = ? AND tmdb_id = ?",
    )
    .get(input.profileId, input.tmdbId)!;
  return rowToEntry(row);
}

/** Shows to feed Claude as positive taste examples: seeds + anything explicitly liked. */
export function getTasteShows(profileId: number): LibraryEntry[] {
  return getLibrary(profileId).filter((e) => e.source === "seed" || e.rating === "liked");
}

/** Shows to never recommend again: everything already in the library. */
export function getExclusionSet(profileId: number): Set<number> {
  return new Set(getLibrary(profileId).map((e) => e.tmdbId));
}

export function getDislikedShows(profileId: number): LibraryEntry[] {
  return getLibrary(profileId).filter((e) => e.rating === "disliked");
}
