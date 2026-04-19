const { generateToken } = require("../middleware/authMiddleware");
const { users } = require('../data/data');
const { getDbProvider } = require("../utils/dbProviderShared");

exports.showLogin = (req, res) => {
  const errorMsg = req.query.error;

  res.render("auth/login", {
    layout: "no_nav_bar",
    error: errorMsg,
    pageTitle: "Login"
  });
};

exports.login = async (req, res) => {
  try {
    const db = getDbProvider();

    const { email, password } = req.body;

    // 1. find user in DB
    const user = await db.findUserByEmail(email);


    if (!user) {
      return res.render("auth/login", {
        layout: "no_nav_bar",
        error: "Invalid email or password",
        pageTitle: "Login"
      });
    }

    // 2. verify password (bcrypt in provider)
    const isValid = await db.verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return res.render("auth/login", {
        layout: "no_nav_bar",
        error: "Invalid email or password",
        pageTitle: "Login"
      });
    }

    // 3. generate token
    const token = generateToken(user);

    // 4. set cookie
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    // 5. role-based redirect
    if (user.role === "Admin") {
      return res.redirect(
        `/`
      );
    }

    return res.redirect("/home");

  } catch (err) {
    console.error(err);
    res.status(500).render('extra_pages/500', {
    message: `Error message: ${err}`,
    pageTitle: "505"
  });
  }
};

exports.showRegister = (req, res) => {
  res.render("auth/register", { layout: "no_nav_bar" });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const db = getDbProvider();

    const user = await db.registerUser(email, password, name);

    // auto-login after register (recommended UX)
    const token = generateToken(user);
    res.cookie("accessToken", token, { httpOnly: true });

    return res.redirect("/login");

  } catch (error) {
    console.error("Register error:", error);

    return res.render("auth/register", {
      layout: "no_nav_bar",
      error: error.message || "Registration failed",
      pageTitle: "Register"
    });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("accessToken");
  return res.redirect('/login');
};