const { verifyToken } = require("../lib/auth");

exports.protect = (req, res, next) => {
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
