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
  return await db.hasActiveAdmin();
};

// register
exports.registerNewUser = async (name, email, password) => {
  const db = getDbProvider();

  const hasAdmin = await db.hasActiveAdmin();
  const role = hasAdmin ? "Technician" : "Admin";

  return await db.registerUser(email, password, name, role);
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

exports.updateUserStatus = async (userId, newStatus, ownedItems) => {
  const db = getDbProvider();

  if (newStatus === "Disabled" && ownedItems.length > 0) {
    throw new Error(
      "User must return all items before being disabled - Admins can force check-in selected user on the report page",
    );
  }

  const user = await db.updateUser(userId, { status: newStatus });

  if (newStatus === "Disabled") {
    await db.revokeOwnedApiKeys(userId);
  }

  return user;
};

exports.getDBUserById = async (selectedUserId) => {
  const db = getDbProvider();
  return await db.getUserById(selectedUserId);
};
