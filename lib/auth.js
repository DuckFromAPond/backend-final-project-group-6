const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "your-super-secret-key";

// Generate a token for a user
exports.generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
    expiresIn: "1h",
  });
};

// Verify the token from the cookie
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
};
