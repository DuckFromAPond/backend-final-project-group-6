const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleCheck");
const adminController = require("../controllers/admin.controller");
const keyController = require("../controllers/key.controller");

// user
router.get("/users", 
  protect, 
  requireRole("Admin"), 
  adminController.listUsers
);

// change user role
router.post(
  "/users/:id/role",
  protect,
  requireRole("Admin"),
  adminController.changeRole,
); 

// disable/enable user
router.post(
  "/users/:id/status",
  protect,
  requireRole("Admin"),
  adminController.toggleStatus,
); 

// for admin to create users
router.post(
  "/users/create",
  protect,
  requireRole("Admin"),
  adminController.adminCreateUser,
); 


// == keys-management ==
router.get(
  "/keys",
  protect,
  requireRole("Admin"),
  keyController.renderKeyManagement,
);

// Actions
// generate keys
router.post(
  "/keys/generate",
  protect,
  requireRole("Admin"),
  keyController.handleGenerateKey,
);

// revoke key
router.post(
  "/keys/revoke/:id",
  protect,
  requireRole("Admin"),
  keyController.handleRevokeKey,
);

// admin checkout
router.post(
  "/transactions/adminCheckout",
  protect,
  requireRole("Admin"),
  adminController.adminCheckout,
);

// admin checkin
router.post(
  "/transactions/adminCheckin",
  protect,
  requireRole("Admin"),
  adminController.adminCheckin,
);

module.exports = router;
