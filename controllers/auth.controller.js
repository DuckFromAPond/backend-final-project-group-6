const { generateToken } = require("../middleware/authMiddleware");
const userService = require("../services/userService"); // Import the service

exports.showLogin = (req, res) => {
  res.render("auth/login", {
    layout: "no_nav_bar",
    error: req.query.error,
    pageTitle: "Login",
  });
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const authResult = await userService.authenticateUser(email, password);

    if (!authResult.success) {
      return res.render("auth/login", {
        layout: "no_nav_bar",
        error: authResult.message,
        pageTitle: "Login",
      });
    }

    // Controller handles the HTTP specific stuff: Token and Cookie
    const token = generateToken(authResult.user);
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60,
    });

    return res.redirect("/home");
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .render("extra_pages/500", { message: err, pageTitle: "505" });
  }
};

exports.showRegister = async (req, res) => {
  const hasAdmin = await userService.checkAdminAvailability();

  res.render("auth/register", {
    layout: "no_nav_bar",
    pageTitle: "Register",
    warning: !hasAdmin
      ? "No active admin found. The newest account will be admin"
      : null,
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { user } = await userService.registerNewUser(name, email, password);

    // After registration, redirect to login
    return res.redirect("/login");
  } catch (error) {
    return res.render("auth/register", {
      layout: "no_nav_bar",
      error: error.message || "Registration failed",
      pageTitle: "Register",
    });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("accessToken");
  return res.redirect("/login");
};
