const express = require("express");
// const vhost    = require('vhost');
const { engine } = require("express-handlebars");
const cookieParser = require("cookie-parser");
const path = require('path');

const { items, itemHistories, users, dashboardData } = require("./data/data.js"); // import
const { protect } = require("./middleware/authMiddleware");

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

// middleware
publicApp.use(cookieParser());
publicApp.use(express.static(path.join(__dirname, 'public')));
publicApp.use(express.urlencoded({ extended: true })); // for forms (login/register)

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
