const { getDbProvider } = require("../utils/dbProviderShared");

exports.authenticateUser = async (email, password) => {
  const db = getDbProvider();
  const user = await db.findUserByEmail(email);

  if (!user) {
    return { success: false, message: "Invalid email or password" };
  }

  if (user.status === "Disabled") {
    return { success: false, message: "Account disabled" };
  }

  const isValid = await db.verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false, message: "Invalid email or password" };
  }

  return { success: true, user };
};

exports.checkAdminAvailability = async () => {
  const db = getDbProvider();
  const users = await db.getAllUsers();
  const hasActiveAdmin = users.some(
    (u) => u.role === "Admin" && u.status === "Active",
  );
  return hasActiveAdmin;
};

// register
exports.registerNewUser = async (name, email, password) => {
  const db = getDbProvider();
  return await db.registerUser(email, password, name);
};

// list
exports.getAllUsers = async () => {
  const db = getDbProvider();
  return await db.getAllUsers();
};

// update role and status
exports.updateUserRole = async (userId, newRole) => {
  const db = getDbProvider();
  return await db.updateUser(userId, { role: newRole });
};

exports.updateUserStatus = async (userId, newStatus) => {
  const db = getDbProvider();
  return await db.updateUser(userId, { status: newStatus });
};
