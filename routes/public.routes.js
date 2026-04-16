
const express = require("express");
const router = express.Router();
const { protect, authOrApiKey } = require("../middleware/authMiddleware");

const publicController = require("../controllers/public.controller");


router.get('/', protect, publicController.home);
router.get("/home", protect, publicController.home);
router.get("/items", authOrApiKey, publicController.showItems);   // setting up apikey early
router.get("/items/history", authOrApiKey, publicController.showHistory);   
router.get("/items/:id", authOrApiKey, publicController.showItemDetail);        
router.get("/items/:id/history", authOrApiKey, publicController.showItemHistory);
router.get("/checkout", protect, publicController.checkout);
router.get("/report", protect, publicController.report);
router.get("/users", protect, publicController.users);

// autorender can go down here if want to add later 


// error 404
router.use(publicController.notFound);


module.exports = router;