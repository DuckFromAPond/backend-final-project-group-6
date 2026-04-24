const { getDbProvider } = require("../utils/dbProviderShared");


exports.adminCheckout = async (itemId, targetUserId, adminId, options = {}) => {
  const db = getDbProvider();

  const admin = await db.getUserById(adminId);
  if (!admin || admin.role !== "Admin") {
    throw new Error("Unauthorized");
  }

  return checkoutItem({
    itemId,
    userId: targetUserId,
    duration: options.duration,
    referenceLink: options.referenceLink
  });
};