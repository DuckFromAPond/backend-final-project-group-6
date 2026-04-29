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
  const users = await db.getAllUsers();
  return users.map(
    ({ passwordHash, ...userWithoutPassword }) => userWithoutPassword, // manually remove the property from each object
  );
};

// update role and status
exports.updateUserRole = async (userId, newRole) => {
  const db = getDbProvider();
  
  if (!userId) {
    const err = new Error("User id is required");
    err.status = 400;
    throw err;
  }

  if (!newRole) {
    const err = new Error("Role required (Admin or Technician)");
    err.status = 400;
    throw err;
  }

  const allowedRoles = ["Admin", "Technician"];

  if (!allowedRoles.includes(newRole)) {
    const err = new Error("Invalid role (must be Admin or Technician)");
    err.status = 400;
    throw err;
  }

  const user = await exports.getDBUserById(userId);

  if (!user) {
    const err = new Error("User does not exist");
    err.status = 404;
    throw err;
  }

  return await db.updateUser(userId, { role: newRole });
};

exports.updateUserStatus = async (userId, newStatus, ownedItems) => {
  const db = getDbProvider();

  if (!userId) {
    const err = new Error("User id is required");
    err.status = 400;
    throw err;
  }

  if (!newStatus) {
    const err = new Error("Status required (Active or Disabled)");
    err.status = 400;
    throw err;
  }

  const allowedStatus = ["Active", "Disabled"];

  if (!allowedStatus.includes(newStatus)) {
    const err = new Error("Invalid status (must be Active or Disabled)");
    err.status = 400;
    throw err;
  }

  const searchUser = await exports.getDBUserById(userId);

  if (!searchUser) {
    const err = new Error("User does not exist");
    err.status = 404;
    throw err;
  }

  if (newStatus === "Disabled" && ownedItems?.length > 0) {
    const err = new Error(
      "User must return all items before being disabled"
    );
    err.status = 409; // conflict (business rule prevents action)
    throw err;
  }

  return user;
};

exports.getDBUserById = async (selectedUserId) => {
  const db = getDbProvider();
  return await db.getUserById(selectedUserId);
};
