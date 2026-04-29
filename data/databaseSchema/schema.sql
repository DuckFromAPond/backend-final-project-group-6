-- Supabase/Postgres schema for the room booking app
-- Run this in the Supabase SQL Editor.

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Technician')),
    status TEXT NOT NULL CHECK (status IN ('Active', 'Disabled')),
    createdAt TIMESTAMP DEFAULT NOW(),
    disabledAt TIMESTAMP NULL
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
    subCategory TEXT NOT NULL,

    status TEXT NOT NULL CHECK (
        status IN ('Available', 'In-Use', 'Maintenance', 'Retired')
    ),
    
    dateAcquired DATE,
    description TEXT,
    currentOwner INTEGER REFERENCES users(id) ON DELETE SET NULL,
    imageName TEXT,
    imageAlt TEXT
);

-- =========================
-- ITEM HISTORIES
-- =========================
CREATE TABLE item_histories (
    id SERIAL PRIMARY KEY,
    itemId INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    userId INTEGER REFERENCES users(id) ON DELETE SET NULL,
    duration INTEGER DEFAULT NULL,
    referenceLink TEXT,
    action TEXT CHECK (action IN ('checkout', 'checkin')),
    createdAt TIMESTAMP DEFAULT NOW(),
    returnedAt TIMESTAMP DEFAULT NULL
);

-- =========================
-- API KEYS
-- =========================
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    hashKey TEXT UNIQUE NOT NULL,
    name TEXT,
    userId INTEGER NOT NULL REFERENCES users(id),
    createdAt TIMESTAMP DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE
);

CREATE TABLE category (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE,
    parentId INTEGER NOT NULL REFERENCES category(id),
);