const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const publicController = require("../controllers/public.controller");

router.get('/', protect, publicController.home);


// error 404
// router.use(adminController.notFound);


module.exports = router;