
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const publicController = require("../controllers/public.controller");

// Home (need design with frontend)
router.get('/', protect, publicController.home);
router.get("/home", protect, publicController.home);

// CRUD (missing integration)
router.get("/items", protect, publicController.showItems);   // setting up apikey early
router.get("/items/:id", protect, publicController.showItemDetail);        
router.get("/items/:id/history", protect, publicController.showItemHistory);

router.post("/items", protect, publicController.addItem);
router.put("/items/:id", protect, publicController.editItem);
router.delete("/items/:id", protect, publicController.deleteItem);

// Owned (should done but a little empty)  
router.get("/owned", protect, publicController.showOwned);

// Report (missing implementation with frontend)    ------------------------- finish later
router.get("/report", protect, publicController.report);

// Check in/out (shoud be working) 
router.post("/transactions/checkin", protect, publicController.checkIn);
router.post("/transactions/checkout", protect, publicController.checkOut);



router.get("/users", protect, publicController.users);                          // <------------ move to admin later

// autorender can go down here if want to add later 

// error 404
router.use(publicController.notFound);


module.exports = router;