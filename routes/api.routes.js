
const express = require("express");
const router = express.Router();

const { apiProtect, authOrApiKey } = require("../middleware/apiAuthMiddleware");
const { requireRole } = require("../middleware/roleCheck")
const { loginLimiter } = require("../middleware/rateLimiter");
const apiController = require("../controllers/api.controller");

router.get('/api/auth/login', loginLimiter, apiController.apiLogin);
router.get('/api/keys', apiProtect, requireRole("Admin"), apiController.generateKeys)

// error 404
// router.use(apiController.notFound);


module.exports = router;