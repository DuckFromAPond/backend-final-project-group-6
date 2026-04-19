const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const publicController = require("../controllers/public.controller");

router.use(protect);  

router.get('/', publicController.home);
router.get("/home", publicController.home);
router.get("/items", publicController.showItems);
router.post("/items", publicController.addItem);
router.get("/items/:id", publicController.showItemDetail);
router.put("/items/:id", publicController.editItem);
router.delete("/items/:id", publicController.deleteItem);
router.get("/items/:id/history", publicController.showItemHistory);
router.get("/checkout", publicController.checkout);
router.get("/report", publicController.report);
router.get("/users", publicController.users);

// autorender can go down here if want to add later 

// error 404
router.use(publicController.notFound);


module.exports = router;