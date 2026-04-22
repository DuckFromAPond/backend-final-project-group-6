"use strict";

const keyService = require("../services/keyService");
const userService = require("../services/userService");

// renders the API Key management page
exports.renderKeyManagement = async (req, res) => {
  try {
    const activeKeys = await keyService.getActiveKeys();
    const allUsers = await userService.getAllUsers(); // To populate the "Assign to User" dropdown

    res.render("keys", {
      title: "API Key Management",
      keys: activeKeys,
      users: allUsers,
      user: req.user, // Current logged-in admin
      // Check if there's a freshly generated key in the session to show once
      newKey: req.session.newRawKey || null,
    });

    // Clear the key from session after one render so it disappears on refresh
    req.session.newRawKey = null;
  } catch (error) {
    console.error("Error rendering API management:", error);
    res.status(500).render("error", { message: "Failed to load API keys" });
  }
};

// Handles the POST request to generate a key
exports.handleGenerateKey = async (req, res) => {
  try {
    const { name, userId } = req.body;
    if (!name || !userId)
      return res.status(400).send("Name and User ID required");

    const result = await keyService.generateNewKey(name, userId);
    req.session.newRawKey = result.rawKey;

    // Use absolute path
    res.redirect("/keys");
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

// handles the Revoke request
exports.handleRevokeKey = async (req, res) => {
  try {
    const { id } = req.params;
    await keyService.revokeKey(id);
    res.redirect("/keys");
  } catch (error) {
    console.error("Error revoking key:", error);
    res.status(500).send("Internal Server Error");
  }
};
