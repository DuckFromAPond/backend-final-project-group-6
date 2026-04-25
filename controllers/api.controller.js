"use strict";
const multiparty = require("multiparty");
const fs = require("fs");
const userService = require("../services/userService");
const itemService = require("../services/itemService");
const keyService = require("../services/keyService");
const { generateToken } = require("../middleware/authMiddleware");
const { getDbProvider } = require("../utils/dbProviderShared");

// static data
const categories = [
  {
    name: "Peripherals",
    subCategories: [
      { name: "Monitor" },
      { name: "Keyboard" },
      { name: "Mouse" },
      { name: "Scanner" },
      { name: "Printer" },
    ],
  },
  {
    name: "Computers",
    subCategories: [
      { name: "Laptop" },
      { name: "Desktop" },
      { name: "Server" },
    ],
  },
];

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
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --- User Management (The Admin Only API requirements) ---
// GET /api/users
exports.getAllUsers = async (req, res) => {
  try {
    // Calling the service as requested
    const users = await userService.getAllUsers();

    // Map the users to avoid sending sensitive data like hashed passwords
    const safeUsers = users.map((user) => ({
      id: user.id || user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    }));

    return res.status(200).json({
      success: true,
      count: safeUsers.length,
      users: safeUsers,
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
};

// POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Using the same service as register page
    // const { user } = await userService.registerNewUser(name, email, password);
    const user = await userService.registerNewUser(name, email, password);

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

// --- API Keys Management (The Admin Only API requirements) ---
// GET /api/keys
exports.getKeys = async (req, res) => {
  try {
    const keys = await keyService.getActiveKeys();
    const formattedKeys = keys.map((entry) => ({
      id: entry.id,
      name: entry.name,
      userId: entry.userId,
      createdAt: entry.createdAt,
      revoked: entry.revoked,
    }));
    console.log(formattedKeys);
    return res.status(200).json({
      success: true,
      keys: formattedKeys,
    });
  } catch (err) {
    console.error("Error fetching API keys:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve API keys",
    });
  }
};

// POST /api/keys
exports.createKey = async (req, res) => {
  try {
    const { name, userId } = req.body;
    // const userId = req.user.id;
    if (!name || !userId)
      return res.status(400).send("Name and User ID required");

    const keyRecord = await keyService.createKey(name, userId);

    return res.status(201).json({
      success: true,
      key: {
        raw: keyRecord.rawKey,
      },
    });
  } catch (err) {
    console.error("Error generating API key:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate API key",
    });
  }
};

// DELETE /api/keys/:id
exports.revokeKey = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await keyService.revokeKey(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (err) {
    console.error("Error revoking API key:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to revoke API key",
    });
  }
};

// --- File Management...? ---
exports.getFile = async (req, res) => {
  try {
    const db = getDbProvider();

    const { bucket, id } = req.params;

    const ALLOWED_BUCKETS = ["items", "docs"];

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return res.status(400).send("Invalid bucket");
    }

    const result = await db.getFile(bucket, id);
    // console.log(result);
    if (!result) {
      return res.status(404).send("File not found");
    }

    if (result.type === "stream") {
      const stream = result.data;

      res.setHeader("Content-Type", result.contentType);

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

// --- API Key Management ---
exports.generateKey = async (req, res) => {
  // Logic for generating API keys for external systems
  return res.status(501).json({ message: "Not implemented yet" });
};

// --- API Item Management
// COPIED FROM PUBLIC CONTROLLERS FOR NOW
// GET /api/items
exports.showItems = async (req, res, next) => {
  const { cat, q, subcat, isRetired, error, success } = req.query;

  try {
    let items = await itemService.getDBItems();

    // filter by subcategory
    if (subcat) {
      items = items.filter((item) => item.subCategory === subcat);
    }

    // filter by category
    if (cat) {
      items = items.filter(
        (item) =>
          item.category.toLowerCase().trim() === cat.toLowerCase().trim(),
      );
    }

    // search by name (case-insensitive)
    if (q) {
      items = items.filter((item) =>
        item.name?.toLowerCase().includes(q.toLowerCase()),
      );
    }

    if (isRetired) {
      items = items.filter((item) => item.status === "Retired");
    } else {
      items = items.filter((item) => item.status !== "Retired");
    }

    const statuses = [
      { name: "Available" },
      { name: "In-Use" },
      { name: "Maintenance" },
    ];

    return res.json({
      categories,
      items,
      statuses,
      user: req.user || null,
      error,
      success,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/items
exports.createItem = async (req, res, next) => {
  try {
    const {
      filePath,
      fileBuffer,
      fileName,
      mimeType,
      name,
      description,
      brand,
      model,
      category,
      subCategory,
      serial,
      status,
      dateAcquired,
      type,
      apiRedirect,
    } = await itemService.processItemForm(req);

    // an error in form processing must've occured
    if (type?.toLowerCase() === "error") {
      return res.redirect(apiRedirect);
    }

    const newItem = {
      name,
      description,
      brand,
      model,
      category,
      subCategory,
      serial,
      status,
      dateAcquired,
      imageName: filePath,
      imageAlt: `Image of ${name}`,
    };

    await itemService.createDBItem(newItem);

    return res.redirect("/api/items?success=Item+added+successfully");
  } catch (err) {
    next(err);
  }
};

// GET /api/items/:id
exports.showItemDetail = async (req, res) => {
  const { id, success, error } = req.params;

  try {
    let item = await itemService.getDBItemById(id);

    const statuses = [{ name: "Available" }, { name: "Maintenance" }];

    let context = {
      item,
      statuses,
      error,
      success,
      isRetired: item.status === "Retired",
    };

    if (!context) {
      return res.status(404).json({
        type: "error",
        message: "Item not found",
      });
    }

    return res.json(context);
  } catch (err) {
    next(err);
  }
};

// PUT /api/items/:id
exports.editItem = async (req, res, next) => {
  const { id } = req.params;

  try {
    const item = await itemService.getDBItemById(id);
    const {
      filePath,
      fileBuffer,
      fileName,
      mimeType,
      name,
      description,
      brand,
      model,
      category,
      subCategory,
      serial,
      status,
      dateAcquired,
      type,
      redirect,
    } = await itemService.processItemForm(req);

    if (type?.toLowerCase() === "error") {
      return res.redirect(`/api${redirect}`);
    }

    if (item.status === "In-Use") {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Item+in-use+cannot+be+edited`,
      });
    }

    if (!["Available", "Maintenance"].includes(status)) {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Status+must+be+available+or+maintenance`,
      });
    }

    const newItem = {
      name,
      description,
      brand,
      model,
      category: category || item.category,
      subCategory: subCategory || item.subCategory,
      serial,
      status: status || item.status,
      dateAcquired,
      imageName: filePath || item.image_name,
      imageAlt: `Image of ${name}`,
    };

    await itemService.updateDBItem(id, newItem);

    return res.redirect(`/api/items/${id}?success=Item+updated+successfully`);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/items/:id
exports.deleteItem = async (req, res, next) => {
  const { id } = req.params;

  try {
    const response = await itemService.getDBItemById(id);
    response.redirect = `/api/${response.redirect}`;

    return res.json(response);
  } catch (err) {
    next(err);
  }
};

// GET /api/items/:id/history
exports.showItemHistory = async (req, res, next) => {
  const { id } = req.params;

  try {
    const itemHistories = await itemService.getDBItemHistoriesById(id);

    let context = {
      ...itemHistories,
      isEmpty: false,
      pageTitle: "Item History",
    };

    if (itemHistories.length === 0) {
      context = {
        ...context,
        isEmpty: true,
      };
    }

    return res.json(context);
  } catch (err) {
    next(err);
  }
};
