const userService = require("../services/userService");

exports.listUsers = async (req, res) => {
  const users = await userService.getAllUsers();
  console.log(users);
  res.render("users", { users, pageTitle: "Manage Users" });
};

exports.toggleStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // "Active" or "Disabled"
  await userService.updateUserStatus(id, status);
  res.redirect("/users"); // Refresh the page to see changes
};

exports.changeRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  await userService.updateUserRole(id, role);
  res.redirect("/users");
};
