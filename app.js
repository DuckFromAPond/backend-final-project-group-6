'use strict';   // for debugging

const express = require("express");
// const vhost    = require('vhost');
const { engine } = require("express-handlebars");
const cookieParser = require("cookie-parser");
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const fs = require('fs');
const multiparty = require('multiparty');
const { randomUUID } = require('crypto');

const { protect } = require("./middleware/authMiddleware");

const { setDbProvider } = require("./utils/dbProviderShared");

const config = require('./config/app.config');
const authRoutes = require("./routes/auth.routes");
const publicRoutes = require('./routes/public.routes');

const createDatabaseProvider = require("./utils/createDBProvider");


// fix for nodeJS v22.22 not being able to connect to mongoDB
const dns = require("node:dns/promises");   
dns.setServers(["1.1.1.1", "1.0.0.1"]);   


let dbProvider;


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
    eq: (a, b) => a === b
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
publicApp.use(express.json());

// CORS configuration
const whitelist = new Set([
  `http://localhost:${config.PORT}`,
  "https://websitename.com"                 // <--------------------------- change when host on cloudflare later btw 
]);

const corsOptions = {
  origin: (origin, callback) => {
    // allow Postman / server-to-server
    if (!origin) return callback(null, true);

    if (whitelist.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
};

publicApp.use(cors(corsOptions));
// Morgan logging
publicApp.use(morgan('dev'));

// replace this for db + bucket --------------------------------------------- remove later I assume 
const uploadsDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`✓ Created uploads directory at ${uploadsDir}`);
}

// temp (will change when nav is finalized)
publicApp.use((req, res, next) => {
    const pathName = req.path;

    res.locals.navHome = pathName === '/' || pathName.startsWith('/home');
    res.locals.navItems =
        pathName === '/items' ||
        pathName.startsWith('/items/');
    res.locals.navCheckin = pathName.startsWith('/checkin');
    res.locals.navReport = pathName.startsWith('/report');
    res.locals.navUsers = pathName.startsWith('/users');     // <---- temp will delete when admin part is implemented
    
    res.locals.config = config;
    next();
});

publicApp.use("/", authRoutes);
publicApp.use('/', publicRoutes);

// const app = express();
// app.use(publicApp);


// Other routes
publicApp.use((error, req, res, next) => {
    console.error(error);

    return res.status(500).render("extra_pages/500", {
        pageTitle: "500",
        message: error.message || "Internal Server Error"
    });
});



async function startServer() {
	try {
		dbProvider = await createDatabaseProvider();
    setDbProvider(dbProvider);  
		console.log(`Connected to ${dbProvider.providerLabel} database provider`);

		publicApp.listen(config.PORT, () => {
            console.log(`  Public : http://${config.DOMAIN}:${config.PORT}`);
            console.log(`  Admin  : http://admin.${config.DOMAIN}:${config.PORT}`);
			console.log(`Database provider: ${dbProvider.providerLabel}`);
		});
	} catch (error) {
		if (error && error.message) {
			console.error("Failed to initialize database provider:", error.message);
		} else {
			console.error("Failed to initialize database provider:", error);
		}
		process.exit(1);
	}
}

startServer();
