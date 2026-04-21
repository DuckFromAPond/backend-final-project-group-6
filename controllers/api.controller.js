
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const { generateToken } = require("../middleware/authMiddleware");
const { getDbProvider } = require("../utils/dbProviderShared");


exports.apiLogin = async (req, res) => {
  try {
    const db = getDbProvider();
    const { email, password } = req.body;

    // 1. find user
    const user = await db.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    // 2. check status
    if (user.status === "Disabled") {
      return res.status(403).json({
        message: "Account disabled"
      });
    }

    // 3. verify password
    const isValid = await db.verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    // 4. generate token
    const token = generateToken(user);

    // 5. return JSON (NO redirect, NO render)
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

exports.generateKey = async (req, res) => {
};