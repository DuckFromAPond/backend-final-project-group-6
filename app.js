"use strict"; // for debugging
const mongoose = require("mongoose");
const express = require("express");

const vhost = require("vhost");

const { engine } = require("express-handlebars");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const morgan = require("morgan");
const cors = require("cors");
const fs = require("fs");
const multiparty = require("multiparty");
const { randomUUID } = require("crypto");

const { protect,attachUser } = require("./middleware/authMiddleware");

const { setDbProvider } = require("./utils/dbProviderShared");

const config = require("./config/app.config");
const authRoutes = require("./routes/auth.routes");
const publicRoutes = require("./routes/public.routes");
const adminRoutes = require("./routes/admin.routes");
const apiRoutes = require("./routes/api.routes");

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
  eq: (a, b) => a === b,
  formatDate: (date) => new Date(date).toISOString().split("T")[0], // return YYYY-MM-DD
  json: (context) => JSON.stringify(context),
};

// CORS configuration
const whitelist = new Set([
  `http://localhost:${config.PORT}`,
  `http://admin.localhost:${config.PORT}`,
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "https://websitename.com", // <--------------------------- change when host on cloudflare later btw
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
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// configurations for public app ───────────────────────────────────
const publicApp = express();
publicApp.engine(
  "handlebars",
  engine({
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: hbsHelpers,
  }),
);
publicApp.set("view engine", "handlebars");
publicApp.set("views", path.join(__dirname, "views"));

// middleware ───────────────────────────────────
publicApp.use(cors(corsOptions));
publicApp.use(cookieParser());
publicApp.use(express.static(path.join(__dirname, "public")));
publicApp.use(express.urlencoded({ extended: true })); // for forms (login/register)
publicApp.use(express.json());

publicApp.use(attachUser);

// Morgan logging
// publicApp.use(morgan('dev'));

// temp (will change when nav is finalized)
publicApp.use((req, res, next) => {
  const pathName = req.path;

  res.locals.navHome = pathName === "/" || pathName.startsWith("/home");
  res.locals.navItems = pathName === "/items" || pathName.startsWith("/items/");
  res.locals.navCheckin = pathName.startsWith("/owned");
  res.locals.navReport = pathName.startsWith("/report");
  res.locals.navLogs = pathName.startsWith("/logs"); //
  res.locals.navUsers = pathName.startsWith("/users"); //
  res.locals.navKeys = pathName.startsWith("/keys"); //

  res.locals.config = config;
  next();
});

publicApp.use("/", authRoutes);
publicApp.use("/", publicRoutes);

// ------ adminApp ------
// const adminApp = express();

// adminApp.engine(
//   "handlebars",
//   engine({
//     defaultLayout: "main",
//     extname: ".handlebars",
//     layoutsDir: path.join(__dirname, "views/layouts"),
//     partialsDir: path.join(__dirname, "views/partials"),
//     helpers: hbsHelpers,
//   }),
// );

// adminApp.set("view engine", "handlebars");
// adminApp.set("views", path.join(__dirname, "views"));

// // adminApp middleware
// adminApp.use(cors(corsOptions));
// adminApp.use(express.urlencoded({ extended: false }));
// adminApp.use(express.static(path.join(__dirname, "public")));
// adminApp.use(cookieParser());

// // temp (will change when nav is finalized)
// adminApp.use((req, res, next) => {
//   const pathName = req.path;

//   res.locals.navHome = pathName === "/" || pathName.startsWith("/home");
//   res.locals.navItems = pathName === "/items" || pathName.startsWith("/items/");
//   res.locals.navCheckin = pathName.startsWith("/owned");
//   res.locals.navReport = pathName.startsWith("/report");
//   res.locals.navUsers = pathName.startsWith("/users"); // <---- temp will delete when admin part is implemented
//   res.locals.navKeys = pathName.startsWith("/keys"); //

//   res.locals.config = config;
//   next();
// });

// adminApp.use("/", authRoutes);
// adminApp.use("/", adminRoutes);

// ---------- API -----------------
const apiApp = express();
apiApp.use(cors(corsOptions));
apiApp.use(express.json());
apiApp.use(express.urlencoded({ extended: false }));
apiApp.use(cookieParser());
apiApp.use(apiRoutes);

// ------ Main app ------
const app = express();
app.engine(
  "handlebars",
  engine({
    extname: ".handlebars",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: hbsHelpers,
  }),
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "SESSION_SECRET",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS/Production
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  }),
);

app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));
// safety
app.disable("x-powered-by");

// Morgan logging
if (config.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

app.use("/api", apiApp);
app.use(publicApp); // fallback → public app

// Other routes
app.use((error, req, res, next) => {
  console.error(error);

  return res.status(500).render("extra_pages/500", {
    layout: "no_nav_bar",
    pageTitle: "500",
    message: error.message || "Internal Server Error",
  });
});

async function startServer() {
  try {
    dbProvider = await createDatabaseProvider();
    setDbProvider(dbProvider);
    console.log(`Connected to ${dbProvider.providerKey} database provider`);

    app.listen(config.PORT, () => {
      if (config.NODE_ENV === "development") {
        console.log(`Using ${config.NODE_ENV} environment`);
        console.log(`  Public : http://${config.DOMAIN}:${config.PORT}`);
        console.log(`  Admin  : http://admin.${config.DOMAIN}:${config.PORT}`);
        console.log(`Database provider: ${dbProvider.providerLabel}`);
      } else {
        console.log(`Using ${config.NODE_ENV} environment`);
        console.log(`  Public : http://${config.BASE_URL}`);
        console.log(`  Admin  : http://admin.${config.BASE_URL}`);
        console.log(`Database provider: ${dbProvider.providerLabel}`);
      }
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
