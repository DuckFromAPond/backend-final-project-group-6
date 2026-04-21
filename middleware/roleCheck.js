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

// for (admin) role checking 
function requireRoleAPI(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Invalid or expired token. Please authenticate again." })
    }

    if (req.user.role !== role) {
      return res.status(403).json({ message: "No permission to access." })
    }

    next();
  };
}


module.exports = { requireRole, requireRoleAPI }