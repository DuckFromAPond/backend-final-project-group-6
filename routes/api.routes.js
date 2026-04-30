const express = require("express");
const router = express.Router();

const { apiProtect, authOrApiKey } = require("../middleware/apiAuthMiddleware");
const { requireRoleAPI } = require("../middleware/roleCheck");
const { loginLimiter } = require("../middleware/rateLimiter");
const apiController = require("../controllers/api.controller");

// users
router.post(
  "/login", 
  loginLimiter, 
  apiController.apiLogin
);

// get users
router.get(
  "/users",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.getAllUsers,
);

// create user
router.post(
  "/users",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.createUser,
);

// update user role 
router.patch(
  "/users/:id/role",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.updateUserRole,
);

// update user status 
router.patch(
  "/users/:id/status",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.updateUserStatus,
);


// keys
// get keys 
router.get(
  "/keys", 
  apiProtect, 
  requireRoleAPI("Admin"), 
  apiController.getKeys
);

// create key 
router.post(
  "/keys",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.createKey,
);

// delete key
router.delete(
  "/keys/:id",
  apiProtect,
  requireRoleAPI("Admin"),
  apiController.revokeKey,
);


// CHECKIN / CHECKOUT
router.post('/transactions/checkout', apiProtect, apiController.apiCheckout);       // checkout
router.post('/transactions/checkin', apiProtect, apiController.apiCheckin);         // checkin



// API ROUTES FOR ITEMS
router.get("/items", authOrApiKey, apiController.showItems);                        // get items
router.get("/items/:id", authOrApiKey, apiController.showItemDetail);               // get item detail
router.post("/items", authOrApiKey, apiController.createItem);                      // create new item
router.get("/items/:id/history", authOrApiKey, apiController.showItemHistory);      // get item history
router.delete("/items/:id", authOrApiKey, apiController.deleteItem);                // soft-delete item 
router.put("/items/:id", authOrApiKey, apiController.editItem);                     // edit item

router.get("/files/:bucket/:id", authOrApiKey, apiController.getFile);              // for getting image and document files

// error 404
router.use(apiController.notFound);

module.exports = router;
