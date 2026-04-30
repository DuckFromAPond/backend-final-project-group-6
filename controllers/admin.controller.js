const userService = require("../services/userService");
const itemService = require("../services/itemService");
const adminService = require("../services/adminService");
const multiparty = require("multiparty");
const fs = require("fs");
const path = require("path");

// POST /users/create
exports.adminCreateUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // Use your existing service 
    await userService.registerNewUser(name, email, password, role);
    return res.redirect("/users?success=User+created+successfully");
  } catch (error) {
    // If it fails, redirect back to the list with the error message
    return res.redirect(`/users?error=${encodeURIComponent(error.message)}`);
  }
};

// GET /users
exports.listUsers = async (req, res) => {
  const users = await userService.getAllUsers();
  const error = req.query.error || null;
  const success = req.query.success || null;
  res.render("users", {
    users,
    pageTitle: "Users",
    error: error || null,
    success: success || null,
  }); // changed from Manage Users -> Users for consistency
};

// POST /users/:id/status
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "Active" or "Disabled"

    const ownedItems = await itemService.getUserOwnedItems(id);

    await userService.updateUserStatus(id, status, ownedItems);

    res.redirect("/users?success=User+status+updated"); // Refresh the page to see changes
  } catch (err) {
    console.error(err);
    res.redirect(`/users?error=${encodeURIComponent(err.message)}`);
  }
};

// POST /users/:id/role
exports.changeRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    await userService.updateUserRole(id, role);
    res.redirect("/users?success=User+role+updated");
  } catch(err) { 
    console.error(err);
    res.redirect(`/users?error=${encodeURIComponent(err.message)}`);
  }
};

// POST CHECKOUT
exports.adminCheckout = async (req, res, next) => {
  try {
    // form 
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (error, fields, files) => {
        if (error) return reject(error);
        resolve({ fields, files });
      });
    });

    // get data
    const itemId = fields.itemId?.[0];
    const duration = fields.duration?.[0];
    const userEmail = fields.userEmail?.[0];
    const adminId = req.user.id;

    // validate checkout
    await itemService.validateCheckout(itemId);
    const userId = await adminService.adminValidateForCheck(
      userEmail,
      adminId,
    );

    let filePath = null;
    let fileName = null;

    const file = files?.document?.[0];

    if (!file || file.size === 0 || !file.originalFilename) {
      return res.redirect("/items?error=File+is+required");
    }

    if (files?.document?.length > 0) {
      const MAX_SIZE = 20 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return res.redirect("/items?error=File+too+large+(max+20MB)");
      }

      const fileBuffer = fs.readFileSync(file.path);
      fileName = `${Date.now()}_${file.originalFilename}`;

      const mimeType =
        file.headers?.["content-type"] || "application/octet-stream";
      const ext = path.extname(file.originalFilename).toLowerCase();

      const allowedMimeTypes = new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);

      const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);

      if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(mimeType)) {
        return res.redirect("/items?error=Only+PDF+or+Word+files+allowed");
      }

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
    }

    // checkout 
    await itemService.checkoutItem({
      itemId,
      userId,
      duration,
      referenceLink: filePath || fileName,
    });

    return res.redirect("/items?success=item+checked+out+sucessfully");
  } catch (err) {
    return res.redirect(`/items?error=${encodeURIComponent(err.message)}`);
  }
};

// POST CHECKIN
exports.adminCheckin = async (req, res, next) => {
  try {
    // form 
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (error, fields, files) => {
        if (error) return reject(error);
        resolve({ fields, files });
      });
    });

    // get data 
    const itemId = fields.itemId?.[0];
    const userEmail = fields.userEmail?.[0];
    const adminId = req.user.id;

    // validate checkin
    const userId = await adminService.adminValidateForCheck(
      userEmail,
      adminId,
    );
    await itemService.validateCheckin(itemId, userId);

    let filePath = null;
    let fileName = null;

    const file = files?.document?.[0];

    if (!file || file.size === 0 || !file.originalFilename) {
      return res.redirect("/report?error=File+is+required");
    }

    if (files?.document?.length > 0) {
      const MAX_SIZE = 20 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return res.redirect("/report?error=File+too+large+(max+20MB)");
      }

      const fileBuffer = fs.readFileSync(file.path);
      fileName = `${Date.now()}_${file.originalFilename}`;

      const mimeType =
        file.headers?.["content-type"] || "application/octet-stream";
      const ext = path.extname(file.originalFilename).toLowerCase();

      const allowedMimeTypes = new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);

      const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);

      if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(mimeType)) {
        return res.redirect("/report?error=Only+PDF+or+Word+files+allowed");
      }

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
    }

    // checkin
    await itemService.checkinItem({
      itemId,
      userId,
      referenceLink: filePath || fileName,
    });

    const redirectUrl = new URLSearchParams();

    if (userId) redirectUrl.set("userId", userId);

    redirectUrl.set("success", "Item checked in successfully");

    return res.redirect(`/report?${redirectUrl.toString()}`);
  } catch (err) {
    return res.redirect(`/report?error=${encodeURIComponent(err.message)}`);
  }
};
