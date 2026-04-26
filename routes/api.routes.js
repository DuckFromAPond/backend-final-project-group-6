const express = require("express");
const router = express.Router();

const { apiProtect, authOrApiKey } = require("../middleware/apiAuthMiddleware");
const { requireRoleAPI } = require("../middleware/roleCheck");
const { loginLimiter } = require("../middleware/rateLimiter");
const apiController = require("../controllers/api.controller");

// users
router.post("/login", loginLimiter, apiController.apiLogin);

router.get(
  "/users",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.getAllUsers,
);

router.post(
  "/users",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.createUser,
);
router.patch(
  "/users/:id/role",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.updateUserRole,
);
router.patch(
  "/users/:id/status",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.updateUserStatus,
);

// router.get('/keys', apiProtect, requireRoleAPI("Admin"), apiController.getKeys)

// router.post('/auth/login', loginLimiter, apiController.apiLogin);
// router.post('/keys', apiProtect, requireRoleAPI("Admin"), apiController.generateKey);

// router.post('/transactions/checkout', apiProtect, apiController.apiCheckout);
// router.post('/transactions/checkin', apiProtect, apiController.apiCheckin);

// router.delete('/keys/:id', apiProtect, requireRoleAPI("Admin"), apiController.deleteKey);

// API ROUTES FOR ITEMS
router.get("/items", authOrApiKey, apiController.showItems);
router.get("/items/:id", apiProtect, apiController.showItemDetail);
router.post("/items", authOrApiKey, apiController.createItem);
router.get('/items/:id/history', authOrApiKey, apiController.showItemHistory);
router.delete("/items/:id", apiProtect, apiController.deleteItem);
router.put("/items/:id", apiProtect, apiController.editItem);

router.get("/files/:bucket/:id", apiProtect, apiController.getFile);

// error 404
// router.use(apiController.notFound);

module.exports = router;
