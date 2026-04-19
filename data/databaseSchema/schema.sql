-- Supabase/Postgres schema for the room booking app
-- Run this in the Supabase SQL Editor.

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Technician')),
    status TEXT NOT NULL CHECK (status IN ('Active', 'Disabled')),
    created_at TIMESTAMP DEFAULT NOW(),
    disabled_at TIMESTAMP NULL
);

-- =========================
-- ITEMS
-- =========================
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    serial TEXT UNIQUE NOT NULL,
    model TEXT,
    brand TEXT,
    category TEXT NOT NULL,
    sub_category TEXT NOT NULL,

    status TEXT NOT NULL CHECK (
        status IN ('Available', 'In-Use', 'Maintenance', 'Retired')
    ),
    date_acquired DATE,
    description TEXT,
    image_name TEXT,
    image_alt TEXT
);

-- =========================
-- ITEM HISTORIES
-- =========================
CREATE TABLE item_histories (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    duration INTEGER,
    reference_link TEXT,
    action TEXT CHECK (action IN ('checkout', 'checkin')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- API KEYS
-- =========================
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE
);