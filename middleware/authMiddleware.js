const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "your-super-secret-key";

// Generate a token for a user
function generateToken (user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
    expiresIn: "1h",
  });
};

// Verify the token from the cookie
function verifyToken (token) {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
};

function protect (req, res, next) {
  const token = req.cookies.accessToken;

  if (!token) {
    // Pass the message in the URL
    return res.redirect("/login?error=Please Login First");
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie("accessToken");
    return res.redirect("/login?error=Session expired. Please login again");
  }

  req.user = decoded;
  res.locals.user = decoded;
  next();
};

function redirectIfAuth (req, res, next) {
  const token = req.cookies?.accessToken;
  const user = token ? verifyToken(token) : null;

  if (user) return res.redirect("/home");

  next();
}

module.exports = { generateToken, verifyToken, protect, redirectIfAuth }