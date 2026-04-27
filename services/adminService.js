const { getDbProvider } = require("../utils/dbProviderShared");


exports.adminValidateForCheckout = async (userEmail,adminId) =>{
  const db = getDbProvider();
  const user = await db.findUserByEmail(userEmail);

  const admin = await db.getUserById(adminId);
  if (!admin || admin.role !== "Admin") {
    throw new Error("Unauthorized");
  }

  if (!user) {
    throw new Error("User not found");
  }

  return user.id;
}


exports.adminValidateForCheckin = async (userEmail,adminId) =>{
  const db = getDbProvider();
  const user = await db.findUserByEmail(userEmail);

  const admin = await db.getUserById(adminId);

  if (!admin || admin.role !== "Admin") {
    throw new Error("Unauthorized");
  }

  if (!user) {
    throw new Error("User not found");
  }
  
  return user.id;
}
