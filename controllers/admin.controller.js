const userService = require("../services/userService");
const itemService = require("../services/itemService");
const adminService = require("../services/adminService");
const multiparty = require("multiparty");
const fs = require("fs");
const path = require("path");


exports.listUsers = async (req, res) => {
  const users = await userService.getAllUsers();
  const error = req.query.error  || null;
  const success = req.query.success  || null;
  res.render("users", { users, pageTitle: "Users", error: error || null, success: success || null, });    // changed from Manage Users -> Users for consistency
};

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

exports.changeRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  await userService.updateUserRole(id, role);
  res.redirect("/users?success=User+role+updated");
};


// POST CHECKOUT
exports.adminCheckout = async (req, res, next) => {
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
    const userEmail = fields.userEmail?.[0];
    const adminId = req.user.id;

    // validate checkout 
    await itemService.validateCheckout(itemId);
    const userId = await adminService.adminValidateForCheckin(userEmail, adminId);

    let filePath = null;
    let fileName = null;

    const file = files?.document?.[0];

    if (!file || file.size === 0 || !file.originalFilename) {
      return res.redirect("/items?error=File+is+required");
    }

    if (files?.document?.length > 0) {
      
      const DBlabel = itemService.getDBlabel(); 

      if (DBlabel === "Supabase") {
        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          return res.redirect("/items?error=File+too+large+(max+50MB)");
        }
      }

      const fileBuffer = fs.readFileSync(file.path);
      fileName = `${Date.now()}_${file.originalFilename}`;

      const mimeType =file.headers?.["content-type"] || "application/octet-stream";
      const ext = path.extname(file.originalFilename).toLowerCase();

      const allowedMimeTypes = new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ]);

      const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);

      if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(mimeType)) {
        return res.redirect("/items?error=Only+PDF+or+Word+files+allowed");
      }

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
    }

    await itemService.checkoutItem({
      itemId,
      userId,
      duration,
      referenceLink: filePath || fileName
    });

    return res.redirect("/items?success=item+checked+out+sucessfully");
  } catch (err) {
    return res.redirect(
      `/items?error=${encodeURIComponent(err.message)}`
    );
  }
};


// POST CHECKOUT
exports.adminCheckin = async (req, res, next) => {
  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (error, fields, files) => {
        if (error) return reject(error);
        resolve({ fields, files });
      });
    });

    const itemId = fields.itemId?.[0];
    const userEmail = fields.userEmail?.[0];
    const adminId = req.user.id;

    // validate checkout 
    const userId = await adminService.adminValidateForCheckin(userEmail, adminId);
    await itemService.validateCheckin(itemId, userId);

    let filePath = null;
    let fileName = null;

    const file = files?.document?.[0];

    if (!file || file.size === 0 || !file.originalFilename) {
      return res.redirect("/report?error=File+is+required");
    }

    if (files?.document?.length > 0) {
      
      const DBlabel = itemService.getDBlabel(); 

      if (DBlabel === "Supabase") {
        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          return res.redirect("/report?error=File+too+large+(max+50MB)");
        }
      }

      const fileBuffer = fs.readFileSync(file.path);
      fileName = `${Date.now()}_${file.originalFilename}`;

      const mimeType =file.headers?.["content-type"] || "application/octet-stream";
      const ext = path.extname(file.originalFilename).toLowerCase();

      const allowedMimeTypes = new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ]);

      const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);

      if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(mimeType)) {
        return res.redirect("/items?error=Only+PDF+or+Word+files+allowed");
      }

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
    }

    await itemService.checkinItem({
      itemId,
      userId,
      referenceLink: filePath || fileName
    });

    const redirectUrl = new URLSearchParams();

    if (userId) redirectUrl.set("userId", userId);

    redirectUrl.set("success", "Item checked in successfully");

    return res.redirect(`/report?${redirectUrl.toString()}`);
  } catch (err) {
    return res.redirect(
      `/report?error=${encodeURIComponent(err.message)}`
    );
  }
};