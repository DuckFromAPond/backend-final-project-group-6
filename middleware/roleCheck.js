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



module.exports = { requireRole }