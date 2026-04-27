"use strict";

const keyService = require("../services/keyService");
const userService = require("../services/userService");

// renders the API Key management page
exports.renderKeyManagement = async (req, res) => {
  try {
    const activeKeys = await keyService.getActiveKeys();
    const allUsers = await userService.getAllUsers(); // To populate the "Assign to User" dropdown
    const newKey = req.cookies.newRawKey || null;

    // clear the key from cookie after one render so it disappears on refresh
    if (newKey) {
      res.clearCookie("newRawKey");
    }

    res.render("keys", {
      pageTitle: "API Keys", // changed from Manage API Key Management -> API Keys for consistency 
      keys: activeKeys,
      users: allUsers,
      user: req.user, // Current logged-in admin
      // check if there's a freshly generated key in the session to show once
      newKey: newKey,
    });
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

    const result = await keyService.createKey(name, userId);

    res.cookie("newRawKey", result.rawKey, {
      maxAge: 10000, // 10s; may need to change if too short
      httpOnly: true,
    });

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
