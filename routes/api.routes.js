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


// keys
router.get("/keys", apiProtect, requireRoleAPI("Admin"), apiController.getKeys);
router.post(
  "/keys",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.createKey,
);
router.delete(
  "/keys/:id",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.revokeKey,
);


// CHECKIN / CHECKOUT
router.post('/transactions/checkout', apiProtect, apiController.apiCheckout);
router.post('/transactions/checkin', apiProtect, apiController.apiCheckin);



// API ROUTES FOR ITEMS
router.get("/items", authOrApiKey, apiController.showItems);
router.get("/items/:id", authOrApiKey, apiController.showItemDetail);
router.post("/items", authOrApiKey, apiController.createItem);
router.get("/items/:id/history", authOrApiKey, apiController.showItemHistory);
router.delete("/items/:id", authOrApiKey, apiController.deleteItem);
router.put("/items/:id", authOrApiKey, apiController.editItem);

router.get("/files/:bucket/:id", authOrApiKey, apiController.getFile);

// error 404
router.use(apiController.notFound);

module.exports = router;
