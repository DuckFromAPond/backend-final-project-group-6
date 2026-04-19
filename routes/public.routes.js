
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const publicController = require("../controllers/public.controller");

router.get('/', protect, publicController.home);
router.get("/home", protect, publicController.home);
router.get("/items", protect, publicController.showItems);   // setting up apikey early
// router.get("/items/history", authOrApiKey, publicController.showHistory);   <- might show full log on admin side instead
router.get("/items/:id", protect, publicController.showItemDetail);        
router.get("/items/:id/history", protect, publicController.showItemHistory);
router.get("/checkin", protect, publicController.ShowCheckin);
router.get("/report", protect, publicController.report);
router.get("/users", protect, publicController.users);

// move these routes later 
router.post("/items", protect, publicController.addItem);
router.put("/items/:id", protect, publicController.editItem);
router.delete("/items/:id", protect, publicController.deleteItem);

router.post("/transactions/checkin", protect, publicController.checkIn);
router.post("/transactions/checkout", protect, publicController.checkOut);

// autorender can go down here if want to add later 

// error 404
router.use(publicController.notFound);


module.exports = router;