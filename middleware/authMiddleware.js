const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "your-super-secret-key";
const { getDbProvider } = require("../utils/dbProviderShared");

// Generate a token for a user
function generateToken (user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
    expiresIn: "6h",
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

// PROTECT (JWT TOKEN FOR UI ONLY)
async function protect (req, res, next) {
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
  
  if (!user) {
    res.clearCookie("accessToken");
    return res.redirect("/login?error=Account not found");
  }

  if (user.status === "Disabled") {
    res.clearCookie("accessToken");
    return res.redirect("/login?error=Account disabled");
  }

  if (user.disabledAt && decoded.iat * 1000 < new Date(user.disabledAt).getTime()) {
    res.clearCookie("accessToken");
    return res.redirect("/login?error=Session expired");
  }

  req.user = user;
  res.locals.user = user;
  next();
};

function redirectIfAuth (req, res, next) {
  const token = req.cookies?.accessToken;
  const user = token ? verifyToken(token) : null;

  if (user) return res.redirect("/home");

  next();
}


module.exports = { generateToken, verifyToken, protect, redirectIfAuth }