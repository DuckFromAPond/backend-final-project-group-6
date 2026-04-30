const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const publicController = require("../controllers/public.controller");
const adminController = require("../controllers/admin.controller"); // it's weird ik... but its the easiest way around it
const keyController = require("../controllers/key.controller");
const { requireRole } = require("../middleware/roleCheck");


// Home 
router.get("/", protect, publicController.home);
router.get("/home", protect, publicController.home);

// CRUD 
router.get("/items", protect, publicController.showItems);
router.get("/items/:id", protect, publicController.showItemDetail);
router.get("/items/:id/history", protect, publicController.showItemHistory);

router.post("/items", protect, publicController.addItem);
router.put("/items/:id", protect, publicController.editItem);
router.delete("/items/:id", protect, requireRole("Admin"), publicController.deleteItem);            // soft-deletes item

// Owned 
router.get("/owned", protect, publicController.showOwned);

// Report 
router.get("/report", protect, publicController.report);

// Check in/out 
router.post("/transactions/checkin", protect, publicController.checkIn);
router.post("/transactions/checkout", protect, publicController.checkOut);

// Logs
router.get('/logs', protect, publicController.logs);

// error 404
router.use(publicController.notFound);

module.exports = router;
