// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { redirectIfAuth } = require("../middleware/authMiddleware");
const {loginLimiter} = require("../middleware/rateLimiter")

// login
router.get("/login", loginLimiter, redirectIfAuth, authController.showLogin);
router.post("/login", authController.login);

// register 
router.get("/register", redirectIfAuth, authController.showRegister);
router.post("/register", authController.register);

// logout
router.get("/logout", authController.logout);

module.exports = router;