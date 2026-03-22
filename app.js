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

// routes
app.get("/items", (req, res) => {
  const context = {
    categories: [
      { id: 1, name: "category1" },
      { id: 2, name: "category2" },
      { id: 3, name: "category3" },
    ],
    items: [
      {
        id: 1,
        name: "item 1",
        description: "item 1 description",
        imagePath: "/images/placeholder.jpg",
        imageAlt: "item 1 image",
      },
      {
        id: 2,
        name: "item 2",
        description: "item 2 description",
        imagePath: "/images/placeholder.jpg",
        imageAlt: "item 2 image",
      },
      {
        id: 3,
        name: "item 3",
        description: "item 3 description",
        imagePath: "/images/placeholder.jpg",
        imageAlt: "item 3 image",
      },
    ],
  };
  res.render("items", { ...context, activePage: "items" });
});

app.get("/items/:id", (req, res) => {
  res.render("itemDetail");
});

app.get("/items/history", (req, res) => {
  res.render("itemHistory");
});

// ++++++++++ LOGIN, REGISTER & LOGOUT
app.get("/", (req, res) => {
  res.render("login", { layout: "no_nav_bar.handlebars" }); // landing page: login
});

app.get("/login", (req, res) => {
  res.render("login", { layout: "no_nav_bar.handlebars" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  console.log(email, password);

  // TODO: validate user (rn: anything is allowed)
  res.redirect("/home");
});

app.get("/register", (req, res) => {
  res.render("register", { layout: "no_nav_bar.handlebars" });
});

app.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  console.log(name, email, password);

  res.redirect("/login");
});

app.get("/logout", (req, res) => {
  res.render("login", { layout: "no_nav_bar.handlebars" });
});

// ++++++++++ List-user page
app.get("/users", (req, res) => {
  // MOCK DATA
  const users = [
    {
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      role: "Admin",
      status: "Active",
    },
    {
      id: 2,
      name: "Bob",
      email: "bob@example.com",
      role: "User",
      status: "Active",
    },
    {
      id: 3,
      name: "Charlie",
      email: "charlie@example.com",
      role: "User",
      status: "Disabled",
    },
    {
      id: 4,
      name: "Dave",
      email: "dave@example.com",
      role: "Admin",
      status: "Active",
    },
  ];

  res.render("users", { users, activePage: "users" });
});

// ++++++++++ Home (Dashboard for logged-in users)
app.get("/home", (req, res) => {
  // Mock data
  const dashboardData = {
    totalUsers: 12,
    totalItems: 34,
    pendingCheckouts: 5,
    recentTransactions: [
      {
        id: 1,
        user: "Alice",
        item: "Laptop",
        type: "Checkout",
        date: "2026-03-22",
      },
      {
        id: 2,
        user: "Bob",
        item: "Projector",
        type: "Checkout",
        date: "2026-03-21",
      },
      {
        id: 3,
        user: "Charlie",
        item: "Camera",
        type: "Check-in",
        date: "2026-03-21",
      },
      {
        id: 4,
        user: "Dave",
        item: "Tablet",
        type: "Checkout",
        date: "2026-03-20",
      },
    ],
  };

  res.render("home", { dashboardData, activePage: "home" });
});

// ++++++++++ Other routes
app.use((req, res, next) => {
  res.status(404);
  res.render("404");
});

app.use((error, req, res, next) => {
  res.status(500);
  res.render("500");
});

app.listen(PORT, () => {
  console.log(`Access via: http://localhost:${PORT}`);
});
