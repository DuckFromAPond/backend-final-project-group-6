"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getDbProvider } = require("../utils/dbProviderShared");

exports.createKey = async (name, userId) => {
  const db = getDbProvider();
  // pass the name and userId.
  const keyRecord = await db.createApiKey(userId, { name });

  // return { ...mappedKey, rawKey };
  return keyRecord;
};

exports.getActiveKeys = async () => {
  const db = getDbProvider();
  const keys = await db.getApiKeys();

  return keys.filter((key) => !key.revoked);
};

exports.revokeKey = async (keyId) => {
  const db = getDbProvider();
  return await db.updateApiKey(keyId, { revoked: true });
};

exports.validateKey = async (rawKey) => {
  const db = getDbProvider();
  const allKeys = await db.getApiKeys();

  for (const keyRecord of allKeys) {
    if (!keyRecord.revoked) {
      // use bcrypt.compare here because rawKey is what the user sends
      const match = await bcrypt.compare(rawKey, keyRecord.hashedKey);
      if (match) {
        // double check if the user is active
        const user = await db.getUserById(keyRecord.userId);
        if (user && user.status === "Active") {
          return user;
        }
      }
    }
  }
  return null;
};
