"use strict";

const userService = require("../services/userService");
const { generateToken } = require("../middleware/authMiddleware");
const { getDbProvider } = require("../utils/dbProviderShared");

// --- Auth ---
exports.apiLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const authResult = await userService.authenticateUser(email, password);

    if (!authResult.success) {
      // 401 for bad creds, 403 if account is disabled
      const status = authResult.message === "Account disabled" ? 403 : 401;
      return res.status(status).json({ message: authResult.message });
    }

    const token = generateToken(authResult.user);
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --- User Management (The Admin Only API requirements) ---
// POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Using the same service as your register page!
    const { user } = await userService.registerNewUser(name, email, password);

    // If a specific role was requested and service allows it
    if (role) {
      await userService.updateUserRole(user.id, role);
    }

    return res.status(201).json({
      message: "User created successfully",
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// PATCH /api/users/:id/role
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) return res.status(400).json({ message: "Role is required" });

    await userService.updateUserRole(id, role);
    return res.status(200).json({ message: `User role updated to ${role}` });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// PATCH /api/users/:id/status
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "Active" or "Disabled"

    if (!status) return res.status(400).json({ message: "Status is required" });

    await userService.updateUserStatus(id, status);
    return res
      .status(200)
      .json({ message: `User status updated to ${status}` });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// --- API Key Management ---
exports.generateKey = async (req, res) => {
  // Logic for generating API keys for external systems
  return res.status(501).json({ message: "Not implemented yet" });
};

exports.getFile = async (req, res) => {
  try {
    const db = getDbProvider();

    const { bucket, id } = req.params;

    const ALLOWED_BUCKETS = ["items", "docs"];

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return res.status(400).send("Invalid bucket");
    }

    const result = await db.getFile(bucket, id);

    if (!result) {
      return res.status(404).send("File not found");
    }

    if (result.type === "stream") {
      const stream = result.data;

      res.set("Content-Type", result.contentType || "image/jpeg");

      return stream.pipe(res);
    }

    if (result.type === "url") {
      return res.json({ url: result.data });
    }

    return res.status(500).send("Invalid file response");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error fetching file");
  }
};