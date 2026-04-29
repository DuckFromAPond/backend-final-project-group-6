"use strict";
const multiparty = require("multiparty");
const fs = require("fs");
const path = require("path");
const userService = require("../services/userService");
const itemService = require("../services/itemService");
const keyService = require("../services/keyService");
const { generateToken } = require("../middleware/authMiddleware");
const config = require('../config/app.config')

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
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
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

    const isBrowser = req.headers.accept?.includes("text/html");

    if (isBrowser) {
      return res.status(200).json({
        success: true,
        message: "Browser detected. This endpoint is intended for API use (Postman/curl)",
        count: safeUsers.length,
        users: safeUsers,
      });
    }

    return res.status(200).json({
      success: true,
      count: users.length,
      users: users,
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

    const allowedRoles = ["Admin", "Technician"];

    const user = await userService.registerNewUser(name, email, password);

    let finalRole = user.role;
    let warning = null;

    if (role) {
      if (allowedRoles.includes(role)) {
        await userService.updateUserRole(user.id, role);
        finalRole = role;
      } else {
        warning = "Invalid role provided (role can only be Admin or Technician). Default role (Technician) applied.";
      }
    }

    return res.status(201).json({
      message: "User created successfully",
      warning,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: finalRole
      }
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

    await userService.updateUserRole(id, role);
    return res.status(200).json({ message: `User ${id} role updated to ${role}` });
  } catch (err) {
    return res.status(err.status || 500).json({
      message: err.message || "INTERNAL SERVER ERROR",
    });
  }
};

// PATCH /api/users/:id/status
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "Active" or "Disabled"
    const ownedItems = await itemService.getUserOwnedItems(id);
    await userService.updateUserStatus(id, status, ownedItems);
    return res
      .status(200)
      .json({ message: `User ${id} status updated to ${status}` });
  } catch (err) {
    return res.status(err.status || 500).json({
      message: err.message || "INTERNAL SERVER ERROR",
    });
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
    
    const isBrowser = req.headers.accept?.includes("text/html");

    if (isBrowser) {
      return res.status(200).json({
        success: true,
        message: "Browser detected. This endpoint is intended for API use (Postman/curl)",
        keys: formattedKeys,
      });
    }

    return res.status(200).json({
      success: true,
      keys: formattedKeys,
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Failed to retrieve API keys",
    });
  }
};

// POST /api/keys
exports.createKey = async (req, res) => {
  try {
    const { name, userId } = req.body;
    // const userId = req.user.id;
    if (!name || !userId)
      return res.status(400).send("name and userId required (for API name and user to assign to)");

    const user = await userService.getDBUserById(userId);

    if (!user)
      return res.status(400).send("User is does not exist");

    if (user.status === "Disabled")
      return res.status(403).send("User is disabled");

    const keyRecord = await keyService.createKey(name, userId);

    return res.status(201).json({
      success: true,
      key: {
        raw: keyRecord.rawKey,
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Failed to generate API keys",
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
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Failed to revoke API keys",
    });
  }
};

// --- File Management...? ---
exports.getFile = async (req, res) => {
  try {

    const { bucket, id } = req.params;

    const ALLOWED_BUCKETS = ["items", "docs"];

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return res.status(400).send("Invalid bucket");
    }

    const result = await itemService.getDBFile(bucket, id);

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
    return res.status(500).send("Error fetching file");
  }
};

// --- API Item Management
// GET /api/items
exports.showItems = async (req, res, next) => {
  const { cat, q, subcat, isRetired, error, success } = req.query;

  try {
    let { items, categories } = await itemService.getDBFilteredItems({
      cat,
      subcat,
      q,
      isRetired,
    });

    const statuses = [{ name: "Available" }, { name: "Maintenance" }];

    const exclude = ["email", "passwordHash"];
    let keyFilteredUser = null;
    if (req.user) {
      keyFilteredUser = Object.fromEntries(
        Object.entries(req.user).filter(([key]) => !exclude.includes(key)),
      );
    }

    const isBrowser = req.headers.accept?.includes("text/html");

    if (isBrowser) {
      return res.status(200).json({
        success,
        message: "Browser detected. This endpoint is intended for API use (Postman/curl)",
        newItem,
        categories,
        statuses,
        // user: keyFilteredUser || null,
        error,
      });
    }

    return res.json({
      items,
      categories,
      statuses,
      // user: keyFilteredUser || null,
      error,
      success,
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};

// POST /api/items
exports.createItem = async (req, res, next) => {
  try {
    const {
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
      dateAcquired
    } = await itemService.processItemForm(req, false);
    let filePath = null;
    
    const existing = await itemService.getDBItemBySerial(serial);

    if (existing) {
      return res.status(409).json({
        type: "error",
        message: "SERIAL ALREADY EXISTS"
      });
    }
    
    filePath = await itemService.uploadDBItem(fileName, fileBuffer, mimeType);

    const newItem = {
      name,
      description,
      brand,
      model,
      category,
      subCategory,
      serial,
      status,
      dateAcquired: dateAcquired || new Date(),
      imageName: filePath,
      imageAlt: `Image of ${name}`,
    };

    await itemService.createDBItem(newItem);

    return res.json({
      ...newItem,
      imageURL: newItem.imageName
        ? `${config.BASE_URL}/api/files/items/${newItem.imageName}`
        : null,
      type: "success",
      message: "ITEM ADDED SUCCESSFULLY"
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      type: "error",
      message: err.message || "INTERNAL SERVER ERROR",
      redirect: err.redirect || "/items?error=Something+went+wrong"
    });
  }
};

// GET /api/items/:id
exports.showItemDetail = async (req, res) => {
  const { id } = req.params;
  const { error, success } = req.query;

  try {
    let item = await itemService.getDBItemById(id);
    const categories = await itemService.getCategoryFromDB();

    if (!item) {
      return res.status(404).json({
        type: "error",
        message: "ITEM NOT FOUND"
      });
    }

    const statuses = [{ name: "Available" }, { name: "Maintenance" }];

    let context = {
      ...item,
      statuses,
      error,
      success,
      isRetired: item.status === "Retired",
    };
    
    const isBrowser = req.headers.accept?.includes("text/html");

    if (isBrowser) {
      return res.status(200).json({
        message: "Browser detected. This endpoint is intended for API use (Postman/curl)",
        ...context
      });
    }

    return res.json(context);
  } catch (err) {
    return res.status(err.status || 500).json({
      type: "error",
      message: err.message || "Internal Server Error"
    });
  }
};

// PUT /api/items/:id
exports.editItem = async (req, res, next) => {
  const { id } = req.params;

  try {
    const item = await itemService.getDBItemById(id);
    if (!item) {
      return res.status(404).json({
        type: "error",
        message: "ITEM NOT FOUND"
      });
    }
    const {
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
      dateAcquired
    } = await itemService.processItemForm(req, true);

    let filePath = null;
    
    const existing = await itemService.getDBItemBySerial(serial);

    if (existing && existing.id.toString() !== id.toString()) {
      return res.status(400).json({
        type: "error",
        message: "SERIAL ALREADY EXISTS"
      });
    }

    if (status === "In-Use" || item.status === "In-Use") {
      return res.status(403).json({
        type: "error",
        message: "ITEM IN USE CANNOT BE EDITED"
      });
    }

    if (fileBuffer) {
      filePath = await itemService.uploadDBItem(fileName, fileBuffer, mimeType);
    }

    const newItem = {
      name: name || item.name,
      description: description || item.description,
      brand: brand || item.brand,
      model: model || item.model,
      category: category || item.category,
      subCategory: subCategory || item.subCategory,
      serial: serial || item.serial,
      status: status || item.status,
      dateAcquired: dateAcquired || item.dateAcquired,
      imageName: filePath || item.imageName,
      imageAlt: `Image of ${name || item.name}`,
    };

    await itemService.updateDBItem(id, newItem);

    return res.status(200).json({
      ...newItem,
      imageURL: newItem.imageName
        ? `${config.BASE_URL}/api/files/items/${newItem.imageName}`
        : null,
      type: "success",
      message: "ITEM UPDATED SUCCESSFULLY"
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      type: "error",
      message: err.message || "Internal Server Error"
    });
  }
};

// DELETE /api/items/:id
exports.deleteItem = async (req, res, next) => {
  const { id } = req.params;

  try {
    const response = await itemService.deleteDBItem(id);
    response.redirect = `/api/${response.redirect}`;

    return res.json(response);
  } catch (err) {
    return res.status(err.status || 500).json({
      type: "error",
      message: err.message || "Internal Server Error"
    });
  }
};

// GET /api/items/:id/history
exports.showItemHistory = async (req, res, next) => {
  const { id } = req.params;

  try {
    const itemHistories = await itemService.getDBItemHistoriesById(id);
    const sessionsByItem = await itemService.buildSessions(
      itemHistories.itemHistories,
    );

    const newItemHist = [...itemHistories.itemHistories].map((log) => {
      const itemId = log.itemId?.toString();
      const sessions = sessionsByItem.get(itemId) || [];
      const created = new Date(log.createdAt);

      const session = sessions.find(
        (s) =>
          s.checkout.id === log.id || (s.checkin && s.checkin.id === log.id),
      );

      let status = "unknown";
      let duration = "———";

      if (!session) {
        status = "old";
        return { ...log, status, duration };
      }

      const checkoutTime = new Date(session.checkout.createdAt);
      const checkinTime = session.checkin
        ? new Date(session.checkin.createdAt)
        : null;

      if (session.checkin) {
        status = "returned";

        const hours = (checkinTime - checkoutTime) / (1000 * 60 * 60);
        duration = itemService.formatDuration(hours);
      } else {
        status = "active";

        const hours = (Date.now() - checkoutTime) / (1000 * 60 * 60);
        if (session.checkout?.duration != null) {
          const dueDate = new Date(checkoutTime);
          dueDate.setHours(dueDate.getHours() + session.checkout.duration);

          status = new Date() > dueDate ? "overdue" : "active";
        }
        duration =
          hours < 1
            ? "<1 min"
            : `${itemService.formatDuration(hours)} (ongoing)`;
      }

      return {
        ...log,
        status,
        duration,
      };
    });

    let context = {
      ...itemHistories,
      itemHistories: newItemHist,
      isEmpty: false,
      pageTitle: "Item History",
    };

    if (itemHistories.itemHistories.length === 0) {
      context = {
        ...context,
        isEmpty: true,
      };
    }
    
    const isBrowser = req.headers.accept?.includes("text/html");

    if (isBrowser) {
      return res.status(200).json({
        message: "Browser detected. This endpoint is intended for API use (Postman/curl)",
        ...context
      });
    }
    

    return res.json(context);
  } catch (err) {
    return res.status(400).json({
      error: err.message,
    });
  }
};

exports.apiCheckin = async (req, res) => {
  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (error, fields, files) => {
        if (error) return reject(error);
        resolve({ fields, files });
      });
    });
    
    const itemId = fields.itemId?.[0];
    const userId = req.user.id;

    await itemService.validateCheckin(itemId,userId);

    let filePath = null;
    let fileName = null;
    
    const file = files?.document?.[0];

    if (!file || file.size === 0 || !file.originalFilename) {
      return res.status(400).json({
        success: false,
        error: "File is required",
        message: "need to pass reference file through document field using form-data"
      });
    }

    if (files?.document?.length > 0) {

      if (file.size > 20 * 1024 * 1024) {
        return res.status(413).json({ error: "File too large (max 20MB)" });
      }

      const fileBuffer = fs.readFileSync(file.path);
      fileName = `${Date.now()}_${file.originalFilename}`;

      const mimeType =file.headers?.["content-type"] || "application/octet-stream";
      const ext = path.extname(file.originalFilename).toLowerCase();

      const allowedMimeTypes = new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);

      const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);

      if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(mimeType)) {
        return res.status(415).json({
          success: false,
          error: "Invalid file type",
          message: "Only PDF or Word files are allowed"
        });
      }

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
    }

    const result = await itemService.checkinItem({
      itemId,
      userId,
      referenceLink: filePath || fileName,
    });
    
    const resWithLink = {
      ...result,
      fileURL: result.referenceLink
        ? `${config.BASE_URL}/api/files/docs/${result.referenceLink}`
        : null
    };

    return res.status(200).json({
      message: "Item checked in successfully",
      data: resWithLink,
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      type: "error",
      message: err.message || "INTERNAL SERVER ERROR"
    });
  }
};

exports.apiCheckout = async (req, res) => {
  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (error, fields, files) => {
        if (error) return reject(error);
        resolve({ fields, files });
      });
    });

    const itemId = fields.itemId?.[0];
    const duration = fields.duration?.[0];
    const userId = req.user.id;

    await itemService.validateCheckout(itemId);

    let filePath = null;
    let fileName = null;

    const file = files?.document?.[0];

    if (!file || file.size === 0) {
      return res.status(400).json({
        success: false,
        message: "File is required",
        message: "need to pass reference file through document field using form-data"
      });
    }

    if (files?.document?.length > 0) {

      if (file.size > 20 * 1024 * 1024) {
        return res.status(413).json({ error: "File too large (max 20MB)" });
      }

      const fileBuffer = fs.readFileSync(file.path);
      fileName = `${Date.now()}_${file.originalFilename}`;

      const mimeType =file.headers?.["content-type"] || "application/octet-stream";
      const ext = path.extname(file.originalFilename).toLowerCase();

      const allowedMimeTypes = new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);

      const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);

      if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(mimeType)) {
        return res.status(400).json({
          success: false,
          error: "Invalid file type",
          message: "Only PDF or Word files are allowed"
        });
      }

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
    }

    const result = await itemService.checkoutItem({
      itemId,
      userId,
      duration,
      referenceLink: filePath || fileName,
    });

    const resWithLink = {
      ...result,
      fileURL: result.referenceLink
        ? `${config.BASE_URL}/api/files/docs/${result.referenceLink}`
        : null
    };

    return res.status(200).json({
      message: "Item checked out successfully",
      data: resWithLink,
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      type: "error",
      message: err.message || "INTERNAL SERVER ERROR",
    });
  }
};

exports.notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: "404: Not Found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
};
