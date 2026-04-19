const express = require("express");
// const vhost    = require('vhost');
const { engine } = require("express-handlebars");
const cookieParser = require("cookie-parser");
const path = require('path');
const { items, itemHistories, users, dashboardData } = require("./data/data.js"); // import
const { protect } = require("./middleware/authMiddleware");
const { verifyToken } = require("./lib/auth");
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const fs = require('fs');
const multiparty = require('multiparty');
const { randomUUID } = require('crypto');
require("dotenv").config();
const config = require('./config/app.config');
const authRoutes = require("./routes/auth.routes");
const publicRoutes = require('./routes/public.routes');

// HELPERS ───────────────────────────────────
const hbsHelpers = {
    // section set up (prob not needed)
    section: function (name, options) {
        if (!this._sections) this._sections = {};
        this._sections[name] = options.fn(this);
        return null;
    },
    // if contain string
    ifContains: function (container, stringToFind, options) {
        if (container && container.includes(stringToFind)) {
            return options.fn(this);
        }
        return options.inverse(this);
    },
    // for active nav 
    isActive: function (page, currentPage, options) {
        return page === currentPage
            ? "text-blue-500 font-semibold"
            : "text-gray-700 hover:text-blue-500";
    },
}

// configurations for public app ───────────────────────────────────
const publicApp = express();
publicApp.engine(
    "handlebars",
    engine({
        defaultLayout: "main",
        layoutsDir: path.join(__dirname, 'views/layouts'),
        partialsDir: path.join(__dirname, 'views/partials'),
        helpers: hbsHelpers,
    }),
);
publicApp.set("view engine", "handlebars");
publicApp.set("views", path.join(__dirname, 'views'));

// middleware ───────────────────────────────────
publicApp.use(cookieParser());
publicApp.use(express.static(path.join(__dirname, 'public')));
publicApp.use(express.urlencoded({ extended: true })); // for forms (login/register)
// Rate limiting configuration
option = {
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: 20, // limit each IP to 20 requests
    standardHeaders: false, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 1 minutes'
}
publicApp.use(rateLimit(option));
// CORS configuration
const whitelist = [
    `http://localhost:3000`,
];
const corsOptions = {
    origin: (origin, callback) => {
        // !origin allows server-to-server or tools like Postman/Curl
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};
publicApp.use(cors(corsOptions));
// Morgan logging
publicApp.use(morgan('dev'));

// temp (will change when nav is finalized)
publicApp.use((req, res, next) => {
    const pathName = req.path;

    res.locals.navHome = pathName === '/' || pathName.startsWith('/home');
    res.locals.navItems =
        pathName === '/items' ||
        pathName.startsWith('/items/');
    res.locals.navCheckout = pathName.startsWith('/checkout');
    res.locals.navReport = pathName.startsWith('/report');
    res.locals.navUsers = pathName.startsWith('/users');     // <---- temp will delete when admin part is implemented

    next();
});

publicApp.use("/", authRoutes);
publicApp.use('/', publicRoutes);
publicApp.use(protect);

// const app = express();
// app.use(publicApp);

// Other routes
publicApp.use((error, req, res, next) => {
    console.log(error)
    res.status(500);
    res.render("extra_pages/500");
});

publicApp.listen(config.PORT, () => {
    console.log(`Access via: http://localhost:${config.PORT}`);
});
