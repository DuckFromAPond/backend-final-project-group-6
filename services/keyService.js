"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getDbProvider } = require("../utils/dbProviderShared");

// generate a new API key, hash it, and save it
exports.generateNewKey = async (name, userId) => {
  const db = getDbProvider();

  // 1. Create a secure 64-character hex string
  const rawKey = crypto.randomBytes(32).toString("hex");

  // 2. Hash the key for secure storage
  const salt = await bcrypt.genSalt(10);
  const hashedKey = await bcrypt.hash(rawKey, salt);

  // 3. Save to database via the provider
  const keyRecord = await db.createApiKey({
    hashedKey,
    name,
    userId,
    revoked: false,
  });

  // return both so that we can show the rawKey once
  return {
    rawKey,
    keyRecord,
  };
};

// retrieve all keys that haven't been revoked.
exports.getActiveKeys = async () => {
  const db = getDbProvider();
  const keys = await db.getAllApiKeys();

  // filter for active keys only (Business Rule 4.3/7) i think
  return keys.filter((key) => !key.revoked);
};

// soft-delete (revoke) a key by its ID.
exports.revokeKey = async (keyId) => {
  const db = getDbProvider();

  // requirement 7.3: Use status flags (revoked: true) instead of hard delete
  return await db.updateApiKey(keyId, { revoked: true });
};

// validate a raw key string against its stored hash (middleware may use tis)
exports.validateKey = async (rawKey) => {
  const db = getDbProvider();
  const allKeys = await db.getAllApiKeys();

  for (const keyRecord of allKeys) {
    if (!keyRecord.revoked) {
      const match = await bcrypt.compare(rawKey, keyRecord.hashedKey);
      if (match) {
        // Fetch the user to ensure they are still "Active" (Business Rule 7)
        const user = await db.findUserById(keyRecord.userId);
        if (user && user.status === "Active") {
          return user;
        }
      }
    }
  }
  return null;
};
