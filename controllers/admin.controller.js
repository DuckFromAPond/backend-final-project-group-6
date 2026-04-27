const userService = require("../services/userService");
const itemService = require("../services/itemService");

exports.listUsers = async (req, res) => {
  const users = await userService.getAllUsers();
  const error = req.query.error  || null;
  const success = req.query.success  || null;
  res.render("users", { users, pageTitle: "Users", error: error || null, success: success || null, });    // changed from Manage Users -> Users for consistency
};

exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "Active" or "Disabled"

    const ownedItems = await itemService.getUserOwnedItems(id);

    await userService.updateUserStatus(id, status, ownedItems);
    
    res.redirect("/users"); // Refresh the page to see changes
  } catch (err) {
    console.error(err);
    res.redirect(`/users?error=${encodeURIComponent(err.message)}`);
  }
};

exports.changeRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  await userService.updateUserRole(id, role);
  res.redirect("/users");
};
