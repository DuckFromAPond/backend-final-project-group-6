const { getDbProvider } = require("../utils/dbProviderShared");
const { checkoutItem, checkinItem } = require("./itemService"); // <-- don't mind this... 

exports.checkoutItem = async ({itemId, userId, duration, referenceLink}) => {
  const db = getDbProvider();

  const item = await db.getItemById(itemId);

  if (!item) {
    throw new Error("Item not found");
  }

  const active = await db.findActiveCheckout(itemId);

  if (active) {
    throw new Error("Item already checked out");
  }
  
  if (
    item.status !== "Available" ||
    ["Maintenance", "Retired"].includes(item.status)
  ) {
    throw new Error("Item not available");
  }

  await db.updateItem(itemId, {current_owner: userId, status: "In-Use" });

  return await db.addItemHistory(itemId, {
    userId,
    action: "checkout",
    duration: duration ?? null,
    referenceLink: referenceLink ?? null,
  });
};


exports.checkinItem = async ({itemId, userId, duration, referenceLink}) => {
  const db = getDbProvider();

  const item = await db.getItemById(itemId);

  if (!item) {
    throw new Error("Item not found");
  }

  if (
    item.status !== "In-Use" ||
    ["Maintenance", "Retired"].includes(item.status)
  ) {
    throw new Error("Item not available");
  }

  await db.updateItem(itemId, {current_owner: userId, status: "Available" });

  return await db.addItemHistory(itemId, {
    userId,
    action: "checkout",
    duration: duration ?? null,
    referenceLink: referenceLink ?? null,
  });
};

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