const { getDbProvider } = require("../utils/dbProviderShared");
const { checkoutItem } = require("./itemService")

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
// exports.adminCheckout = async (itemId, targetUserId, duration, referenceLink) => {
//   const db = getDbProvider();

//   return checkoutItem({
//     itemId,
//     userId: targetUserId,
//     duration: duration,
//     referenceLink: referenceLink
//   });
// };