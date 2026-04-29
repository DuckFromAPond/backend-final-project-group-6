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
    console.error(err);
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

    if (!status) return res.status(400).json({ message: "Status is required (either Active or Disabled)" });

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
    next(err);
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
      dateAcquired,
      type,
      redirect,
      message,
      errCode
    } = await itemService.processItemForm(req);
    let filePath = null;

    const { categories } = await itemService.getDBFilteredItems({cat: '', subcat: '', q: '', isRetired: ''});
    
    const statuses = [{ name: "Available" }, { name: "Maintenance" }];
    
    // an error in form processing must've occured
    if (type?.toLowerCase() === "error") {
      return res.status(errCode).json({
        type: type,
        message: message,
      });
    }

    if (!statuses.map((s) => s.name).includes(status)) {
      return res.status(400).json({
        type: "error",
        redirect: `/api/items?error=Status+must+be+available+or+maintenance`,
      });
    }

    if(!categories.map(c => c.name).includes(category)) {
      return res.json({
        type: "error",
        redirect: `/api/items?error=Status+must+be+available+or+maintenance`,
      });
    }

    if(!categories.map(c => c.name).includes(category)) {
      return res.json({
        type: "error",
        redirect: `/api/items?error=Invalid+category`
      })
    }

    const subcat = subCategory;
    const isValidSubcat = categories.some(c =>
      c.subCategories?.some(sc => sc.name === subcat)
    )

    if (!isValidSubcat) {
      return res.json({
          type: "error",
          redirect: `/api/items?error=Invalid+subcategory`
      })
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
      dateAcquired,
      imageName: filePath,
      imageAlt: `Image of ${name}`,
    };

    await itemService.createDBItem(newItem);

    return res.json({
      ...newItem,
      type: "success",
      redirect: "/api/items?success=Item+added+successfully",
    });
  } catch (err) {
    next(err);
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
        redirect: `/items/${id}?error=Item+not+found`,
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
    next(err);
  }
};

// PUT /api/items/:id
exports.editItem = async (req, res, next) => {
  const { id } = req.params;

  try {
    const item = await itemService.getDBItemById(id);
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
      dateAcquired,
      type,
      redirect,
      message,
      errCode
    } = await itemService.processItemForm(req);

    const {categories} = await itemService.getDBFilteredItems({cat: '', subcat: '', q: '', isRetired: ''})
    let filePath = null;

    const statuses = [{ name: "Available" }, { name: "Maintenance" }];

    const existing = await itemService.getDBItemBySerial(serial);

    if (existing) {
      return res.json({
        type: "error",
        redirect: "/items?error=Serial+already+exists",
      });
    }

    if (type?.toLowerCase() === "error") {
      return res.json({
        type: error,
        redirect: `/api${redirect}`,
      });
    }

    if (!item) {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Item+not+found`,
      });
    }

    if (item.status === "In-Use") {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Item+in-use+cannot+be+edited`,
      });
    }

    if (!statuses.map((s) => s.name).includes(status)) {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Status+must+be+available+or+maintenance`,
      });
    }

    if(!categories.map(c => c.name).includes(category)) {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Invalid+category`
      })
    }

    const subcat = subCategory;
    const isValidSubcat = categories.some(c =>
      c.subCategories?.some(sc => sc.name === subcat)
    )

    if (!isValidSubcat) {
      return res.json({
          type: "error",
          redirect: `/api/items/${id}?error=Invalid+subcategory`
      })
    }

    filePath = await itemService.uploadDBItem(fileName, fileBuffer, mimeType);

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
      imageName: filePath || item.image_name,
      imageAlt: `Image of ${name || item.name}`,
    };

    await itemService.updateDBItem(id, newItem);

    return res.json({
      ...newItem,
      type: "success",
      redirect: `/items/${id}?success=Item+updated+successfully`,
    });
  } catch (err) {
    next(err);
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
    next(err);
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
    next(err);
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
        message: "File is required",
      });
    }

    if (files?.document?.length > 0) {
      const DBlabel = itemService.getDBlabel();

      if (DBlabel === "Supabase" && file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large (max 50MB)" });
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
    return res.status(400).json({
      error: err.message,
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
      });
    }

    if (files?.document?.length > 0) {
      const DBlabel = itemService.getDBlabel();

      if (DBlabel === "Supabase" && file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large (max 50MB)" });
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
    return res.status(400).json({
      error: err.message,
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
