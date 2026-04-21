const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "your-super-secret-key";
const { getDbProvider } = require("../utils/dbProviderShared");

// Generate a token for a user
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
    expiresIn: "6h",
  });
}

// Verify the token from the cookie
function verifyToken(token) {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}

// PROTECT (JWT TOKEN FOR UI ONLY)
async function protect(req, res, next) {
  const token = req.cookies?.accessToken;

  if (!token) {
    // Pass the message in the URL
    return res.redirect("/login?error=Please Login First");
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie("accessToken");
    return res.redirect("/login?error=Session expired. Please login again");
  }

  const dbProvider = getDbProvider();
  const user = await dbProvider.getUserById(decoded.id);

  if (!user || user.status === "Disabled") {
    res.clearCookie("accessToken");
    return res.redirect("/login?error=Account disabled");
  }

  req.user = user;
  res.locals.user = user;
  next();
}

function redirectIfAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  const user = token ? verifyToken(token) : null;

  if (user) return res.redirect("/home");

  next();
}

async function apiProtect(req, res, next) {
  // Check the Authorization Header: "Bearer [token]"
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "No token provided. Please use Bearer token." });
  }

  const decoded = jwt.verify(token, secret); // Using your secret variable
  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const dbProvider = getDbProvider();
  const user = await dbProvider.getUserById(decoded.id);

  if (!user || user.status === "Disabled") {
    return res.status(403).json({ message: "Account disabled or not found" });
  }

  req.user = user; // This allows requireRoleAPI("Admin") to work!
  next();
}

// Remember to update your module.exports!
module.exports = {
  generateToken,
  verifyToken,
  protect,
  redirectIfAuth,
  apiProtect,
};
