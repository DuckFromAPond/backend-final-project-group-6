// NOTE: RATE LIMITER SHOULD ONLY APPLY TO LOGIN 

const rateLimit = require("express-rate-limit");

// Rate limiting configuration
const option = {
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: 20, // limit each IP to 20 requests
    standardHeaders: false, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 1 minutes'
}

const loginLimiter = rateLimit(option);

module.exports = {
    loginLimiter
};