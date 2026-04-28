"use strict";

const keyService = require("../services/keyService");
const userService = require("../services/userService");

// renders the API Key management page
exports.renderKeyManagement = async (req, res) => {
  try {
    const activeKeys = await keyService.getActiveKeys();
    const allUsers = await userService.getAllUsers(); // To populate the "Assign to User" dropdown
    const newKey = req.cookies.newRawKey || null;
    const error = req.query.error  || null;
    const success = req.query.success  || null;

    const userMap = new Map(allUsers.map(u => [u.id?.toString(), u]));

    const formattedKeys = activeKeys.map(key => {
      const d = new Date(key.createdAt);

      const pad = (n) => String(n).padStart(2, "0");

      const formatted =
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      return {
        ...key,
        email: userMap.get(key.userId?.toString())?.email || "Unknown",
        createdAt: formatted
      };
    });

    // clear the key from cookie after one render so it disappears on refresh
    if (newKey) {
      res.clearCookie("newRawKey");
    }

    res.render("keys", {
      pageTitle: "API Keys", // changed from Manage API Key Management -> API Keys for consistency 
      keys: formattedKeys,
      users: allUsers,
      user: req.user, // Current logged-in admin
      // check if there's a freshly generated key in the session to show once
      newKey: newKey,
      error,
      success
    });
  } catch (error) {
    console.error("Error rendering API management:", error);
    res.status(500).render("extra_pages/500", { message: "Failed to load API keys" });
  }
};

// Handles the POST request to generate a key
exports.handleGenerateKey = async (req, res) => {
  try {
    const { name, userId } = req.body;
    if (!name || !userId)
      return res.redirect("/keys?error=Name+&+UserId+required");

    const result = await keyService.createKey(name, userId);

    res.cookie("newRawKey", result.rawKey, {
      maxAge: 10000, // 10s; may need to change if too short
      httpOnly: true,
    });

    res.redirect("/keys");
  } catch (error) {
    res.status(500).render("extra_pages/500", { message: "Internal Server Error" });
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
    res.status(500).render("extra_pages/500", { message: "Internal Server Error" });
  }
};
