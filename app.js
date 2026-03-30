const express = require("express");
const { engine } = require("express-handlebars");
require("dotenv").config();

const PORT = process.env.PORT || 3000;

const app = express();

// configurations for app
app.engine(
  "handlebars",
  engine({
    defaultLayout: "main",
    partialsDir: __dirname + "/views/partials",
    helpers: {
      section: function (name, options) {
        if (!this._sections) this._sections = {};
        this._sections[name] = options.fn(this);
        return null;
      },
      ifContains: function (container, stringToFind, options) {
        if (container && container.includes(stringToFind)) {
          return options.fn(this);
        }
        return options.inverse(this);
      },

      // DON'T REMOVE ME :)
      isActive: function (page, currentPage, options) {
        return page === currentPage
          ? "text-blue-500 font-semibold"
          : "text-gray-700 hover:text-blue-500";
      },
    },
  }),
);
app.set("view engine", "handlebars");
app.set("views", __dirname + "/views");

// middleware
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true })); // for forms (login/register)

const { items, itemHistories } = require("./utils/data.js"); // import
const itemData = {
  categories: [
    { name: "Computers", subCategories: [] },
    { name: "Peripherals", subCategories: [] },
  ],
  //Fields: Item ID (Unique), Serial Number, Model, Brand, Category, Status (Available, In-Use, Maintenance, Retired), and Date Acquired.
  items: items, // Use the imported items here
  itemHistories: itemHistories,
};

// routes
app.get("/items", (req, res) => {
  const { cat } = req.query;

  let context = itemData;

  if (itemData.categories.find((category) => category.name === cat)) {
    context = {
      categories: itemData.categories,
      items: itemData.items.filter((item) => item.category === cat),
    };
  }

  res.render("items/items", { ...context, activePage: "items" }); // idk; i think it helps with nav rendering
});

app.get("/items/:id/history", (req, res) => {
  const { id } = req.params;

  const context = {
    item: itemData.items.find((item) => String(item.id) === String(id)),
    itemHistories: itemData.itemHistories.find(
      (item) => String(item.id) === String(id),
    ),
  };

  res.render("items/itemHistory", context);
});

app.get("/items/:id", (req, res) => {
  const { id } = req.params;

  const context = itemData.items.find((item) => String(item.id) === String(id));

  if (!context) {
    res.status(404);
    return res.render("404");
  }

  res.render("items/itemDetail", context);
});

app.get("/items/:id", (req, res) => {
  res.render("items/itemDetail");
});

app.get("/items/history", (req, res) => {
  res.render("items/itemHistory");
});

// ++++++++++ LOGIN, REGISTER & LOGOUT
app.get("/", (req, res) => {
  res.render("auth/login", { layout: "no_nav_bar.handlebars" }); // landing page: login
});

app.get("/login", (req, res) => {
  res.render("auth/login", { layout: "no_nav_bar.handlebars" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  console.log(email, password);

  // TODO: validate user (rn: anything is allowed)
  res.redirect("/home");
});

app.get("/register", (req, res) => {
  res.render("auth/register", { layout: "no_nav_bar.handlebars" });
});

app.post("auth/register", (req, res) => {
  const { name, email, password } = req.body;
  console.log(name, email, password);

  res.redirect("/login");
});

app.get("/logout", (req, res) => {
  res.render("auth/login", { layout: "no_nav_bar.handlebars" });
});

// ++++++++++ List-user page
app.get("/users", (req, res) => {
  // MOCK DATA
  const { users } = require("./utils/data.js");
  res.render("users", { users, activePage: "users" });
});

// ++++++++++ Home (Dashboard for logged-in users)
app.get("/home", (req, res) => {
  // Mock data
  const { dashboardData } = require("./utils/data.js"); // import

  res.render("home", { dashboardData, activePage: "home" });
});

// ++++++++++ Other routes
app.use((req, res, next) => {
  res.status(404);
  res.render("extra_pages/404");
});

app.use((error, req, res, next) => {
  res.status(500);
  res.render("extra_pages/500");
});

app.listen(PORT, () => {
  console.log(`Access via: http://localhost:${PORT}`);
});
