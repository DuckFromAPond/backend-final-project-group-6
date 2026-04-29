const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleCheck");
const adminController = require("../controllers/admin.controller");
const keyController = require("../controllers/key.controller");

// user
router.get("/users", protect, requireRole("Admin"), adminController.listUsers); // <------------ kinda weird... i think it's easier to just require "Admin role" instead of moving to Admin
router.post(
  "/users/:id/role",
  protect,
  requireRole("Admin"),
  adminController.changeRole,
); // <-- or post here if want since it don't matter
router.post(
  "/users/:id/status",
  protect,
  requireRole("Admin"),
  adminController.toggleStatus,
); // disable/enable user

router.post(
  "/users/create",
  protect,
  requireRole("Admin"),
  adminController.adminCreateUser,
); // for admin to create users

// == keys-management ==
router.get(
  "/keys",
  protect,
  requireRole("Admin"),
  keyController.renderKeyManagement,
);

// Actions
router.post(
  "/keys/generate",
  protect,
  requireRole("Admin"),
  keyController.handleGenerateKey,
);
router.post(
  "/keys/revoke/:id",
  protect,
  requireRole("Admin"),
  keyController.handleRevokeKey,
);

router.post(
  "/transactions/adminCheckout",
  protect,
  requireRole("Admin"),
  adminController.adminCheckout,
);
router.post(
  "/transactions/adminCheckin",
  protect,
  requireRole("Admin"),
  adminController.adminCheckin,
);

module.exports = router;
