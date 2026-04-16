const { generateToken } = require("../middleware/authMiddleware");
const { users } = require('../data/data');

exports.showLogin = (req, res) => {
  const errorMsg = req.query.error;

  res.render("auth/login", {
    layout: "no_nav_bar",
    error: errorMsg,
  });
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  // 1. Find user
  const user = users.find((u) => u.email === email);

  // 2. Validate (In future, use bcrypt to compare hashed password)
  if (user && password === "12345678") {
    // Temporary hardcoded check
    const token = generateToken(user);

    // 3. Set cookie
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 3600, // 1 hour
    });

    if (user.role === "Admin") {
      return res.redirect(`http://admin.${process.env.DOMAIN}:${process.env.PORT}/home`);
    }

    return res.redirect("/home");
  }

  res.render("auth/login", {
    layout: "no_nav_bar",
    error: "Invalid email or password",
  });
};

exports.showRegister = (req, res) => {
  res.render("auth/register", { layout: "no_nav_bar" });
};

exports.register = (req, res) => {
  const { name, email, password } = req.body;
  console.log(name, email, password);

  res.redirect("/login");
};

exports.logout = (req, res) => {
  res.clearCookie("accessToken");
  return res.redirect('/login');
};