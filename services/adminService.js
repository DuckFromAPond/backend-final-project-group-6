const { getDbProvider } = require("../utils/dbProviderShared");


exports.adminValidateForCheck = async (userEmail,adminId) =>{
  const db = getDbProvider();
  const user = await db.findUserByEmail(userEmail);

  const admin = await db.getUserById(adminId);

  if (!admin || admin.role !== "Admin") {
    const err = new Error("Unauthorized");
    err.statusCode = 403;
    throw err;
  }

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  if (user.status === "Disabled") {
    const err = new Error("User is disabled");
    err.statusCode = 403;
    throw err;
  }
  
  return user.id;
}
