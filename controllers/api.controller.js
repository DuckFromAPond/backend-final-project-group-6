"use strict";
const multiparty = require("multiparty");
const fs = require("fs");
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

// --- API Item Management
// COPIED FROM PUBLIC CONTROLLERS FOR NOW
// GET /api/items
exports.showItems = async (req, res) => {
  const db = getDbProvider();
  const { cat, q, isRetired, error, success } = req.query;

  // get all items from DB
  let items = await db.getItems();

  // derive categories dynamically
  const categories = [...new Set(items.map((item) => item.category))].map(
    (name) => ({ name }),
  );

  // filter by category
  if (cat) {
    items = items.filter((item) => item.category === cat);
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
    error: error || null,
    success: success || null,
    pageTitle: "Items",
  });
};

// POST /api/items
exports.createItem = async (req, res, next) => {
  try {
    const db = getDbProvider();
    const form = new multiparty.Form();

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    // extract fields
    const name = fields.name?.[0] ?? "";
    const description = fields.description?.[0] ?? "";
    const brand = fields.brand?.[0] ?? "";
    const model = fields.model?.[0] ?? "";
    const category = fields.category?.[0] ?? "";
    const sub_category = fields.subcategory?.[0] ?? "";
    const serial = fields.serial?.[0] ?? "";
    const status = fields.status?.[0] ?? "";
    const date_acquired = fields.dateAcquired?.[0] ?? new Date();

    // upload file
    let filePath = null;
    let fileName = null;

    if (files?.image?.length > 0) {
      const file = files.image[0];
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB

      if (file.size > MAX_SIZE) {
        return res.redirect("/api/items?error=File+too+large+(max+50MB)");
      }

      const fileBuffer = fs.readFileSync(file.path);

      fileName = `${Date.now()}_${file.originalFilename}`;
      filePath = `${fileName}`;

      await db.uploadItem(filePath, fileBuffer);
    }

    const newItem = {
      name,
      description,
      brand,
      model,
      category,
      sub_category,
      serial,
      status,
      date_acquired,
      image_name: fileName,
      image_alt: `Image of ${name}`,
    };

    await db.createItem(newItem);

    return res.redirect("/api/items?success=Item+added+successfully");
  } catch (err) {
    next(err);
  }
};

// GET /api/items/:id
exports.showItemDetail = async (req, res) => {
  const { id } = req.params;
  const { edit, del, error, success } = req.query;
  const db = getDbProvider();

  let item = await db.getItemById(id);

  const statuses = [
    { name: "Available" },
    { name: "In-Use" },
    { name: "Maintenance" },
    { name: "Retired" },
  ];

  let context = {
    item,
    statuses,
    isEdit: false,
    isDelete: false,
    isRetired: item.status === "Retired",
  };

  if (!context) {
    res.status(404);
    return res.render("404");
  }

  if (edit || (edit?.length !== 0 && edit === "true")) {
    context = {
      ...context,
      isEdit: true,
    };
  }

  if (del || (del?.length !== 0 && del === "true")) {
    context = {
      ...context,
      isDelete: true,
    };
  }

  if (error) {
    context = {
      ...context,
      error,
    };
  }

  if (success) {
    context = {
      ...context,
      success,
    };
  }

  return res.json(context);
};

// PUT /api/items/:id
exports.editItem = async (req, res) => {
  const { id } = req.params;

  try {
    const db = getDbProvider();
    const item = await db.getItemById(id);
    const form = new multiparty.Form();

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    if (item.status === "In-Use") {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Item+in-use+cannot+be+edited`,
      });
    }

    // extract fields
    const name = fields.name?.[0] ?? "";
    const description = fields.description?.[0] ?? "";
    const brand = fields.brand?.[0] ?? "";
    const model = fields.model?.[0] ?? "";
    const category = fields.category?.[0] ?? "";
    const sub_category = fields.subcategory?.[0] ?? "";
    const serial = fields.serial?.[0] ?? "";
    const status = fields.status?.[0] ?? "";
    const date_acquired = fields.dateAcquired?.[0] ?? new Date();

    // upload file
    let filePath = null;
    let fileName = null;

    if (files?.image?.length > 0 && files?.image[0]?.size > 0) {
      const file = files.image[0];
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB

      if (file.size > MAX_SIZE) {
        return res.redirect("/api/items?error=File+too+large+(max+50MB)");
      }

      const fileBuffer = fs.readFileSync(file.path);

      fileName = `${Date.now()}_${file.originalFilename}`;
      filePath = `${fileName}`;

      await db.uploadItem(filePath, fileBuffer);
    }

    const newItem = {
      name,
      description,
      brand,
      model,
      category,
      sub_category: "",
      serial,
      status,
      date_acquired,
      image_name: fileName ?? item.image_name,
      image_alt: `Image of ${name}`,
    };

    await db.updateItem(id, newItem);

    return res.redirect(`/api/items/${id}?success=Item+updated+successfully`);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/items/:id
exports.deleteItem = async (req, res) => {
  const { id } = req.params;

  try {
    const db = getDbProvider();
    const item = await db.getItemById(id);
    item["date_acquired"] = item["dateAcquired"];
    item["image_alt"] = item["imageAlt"];
    item["image_name"] = item["imageName"];
    delete item["dateAcquired"];
    delete item["imageAlt"];
    delete item["imageName"];
    delete item["imageUrl"];
    const newItem = {
      ...item,
      status: "Retired",
    };

    await db.updateItem(id, newItem);

    // uncomment this for hard delete
    // await db.deleteItem(id);

    return res.redirect(`/api/items/${id}?success=Item+retired+successfully`);
  } catch (err) {
    next(err);
  }
};
