const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { requireRole } = require("../middleware/roleCheck");
const adminController = require("../controllers/admin.controller");

router.use(protect);
// router.use(requireRole("Admin")); <-- bugged for now (endless re-routing)

// dashboard
// router.get('/', protect, requireRole("Admin"), adminController.home);
// router.get('/dashboard', protect, requireRole("Admin"), adminController.home);

// user
router.get("/users", adminController.listUsers);
router.post("/users/:id/role", adminController.changeRole); // <-- or post here if want since it don't matter
router.post("/users/:id/status", adminController.toggleStatus); // disable/enable user

// items
// router.get('/items', protect, requireRole("Admin"), adminController.createItem);                               // preferably should show all items including who owns it
// router.delete('/items/:id', protect, requireRole("Admin"), adminController.archiveItem);             // don't hard delete items
// router.post('/update', protect, requireRole("Admin"), adminController.updateOwnership);            // use provider method to get item

// logs
// router.get('/hisory', protect, requireRole("Admin"), adminController.createItem);                         // use provider method to get history

// API
// router.get('/keys', protect, requireRole("Admin"), adminController.getKeys)
// router.post('/keys', protect, requireRole("Admin"), adminController.generateKeys)
// router.delete('/keys/:id', protect, requireRole("Admin"), adminController.deleteKey);

// error 404
// router.use(adminController.notFound);

module.exports = router;
