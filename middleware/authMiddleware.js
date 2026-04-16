const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "your-super-secret-key";
const { getDbProvider } = require("../utils/dbProviderShared");

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
  let token;

  // Cookie (for web app)
  if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  // Bearer token (for API) <-- use JWT as bearer token (need to log in first to get JWT token)
  const authHeader = req.get('Authorization');
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

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

// for (admin) role checking 
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect("/login?error=Not Authorized");
    }

    if (req.user.role !== role) {
      return  res.redirect("/home");
    }

    next();
  };
}

// const VALID_API_KEYS = new Set([     // testing will del later
//   "dev-key-123",
//   "service-key-456"
// ]);

async function authOrApiKey(req, res, next) {
  try {
    const dbProvider = getDbProvider();

    const apiKey = req.get("x-api-key");

    if (apiKey) {
      const keyRecord = await dbProvider.getApiKeyByKey(apiKey);

      if (keyRecord && !keyRecord.revoked) {
        req.authType = "apiKey";
        req.apiKey = keyRecord;
        return next();
      }
    }

    // if (apiKey && VALID_API_KEYS.has(apiKey)) {
    //   req.authType = "apiKey";
    //   return next();
    // }
    
    const authHeader = req.get("Authorization");
    let token;

    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = decoded;
    req.authType = "jwt";

    next();
  } catch (err) {
    next(err);
  }
}


module.exports = { generateToken, verifyToken, protect, redirectIfAuth, requireRole, authOrApiKey }