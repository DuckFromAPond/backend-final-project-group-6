// for (admin) role checking
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect("/login?error=Not+Authorized");
    }

    if (req.user.role !== role) {
      res.clearCookie("accessToken");

      // 403 Forbidden
      return res.status(403).render("extra_pages/403", {
        layout: "no_nav_bar",
        pageTitle: "403",
        message:
          "Access Denied. Your session has been terminated for security.",
      });
    }
    next();
  };
}

// for (admin) role checking
function requireRoleAPI(role) {
  return (req, res, next) => {
    // 1. Check if user is authenticated (handled by protect middleware usually)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token. Please authenticate again.",
      });
    }

    // 2. Check if user has the specific role
    if (req.user.role !== role) {
      // Clear the cookie to prevent further unauthorized probing
      res.clearCookie("accessToken");

      return res.status(403).json({
        success: false,
        message:
          "Access Denied: Your session has been terminated for security.",
        error: "Insufficient Permissions",
      });
    }

    // 3. Authorized - Proceed to the controller
    next();
  };
}

module.exports = { requireRole, requireRoleAPI };
