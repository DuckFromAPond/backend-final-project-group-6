const { getDbProvider } = require("../utils/dbProviderShared");

// CHECKIN / CHECKOUT 
exports.getDBlabel = () => { 
  const db = getDbProvider();
  return db.providerLabel;
}

exports.uploadDBFile = async (fileName, fileBuffer, mimeType) => { 
  const db = getDbProvider();
  return await db.uploadFile(fileName, fileBuffer, mimeType);
}

exports.validateCheckout = async (itemId) => {
  const db = getDbProvider();

  const item = await db.getItemById(itemId);

  if (!item) {
    throw new Error("Item not found");
  }

  if (item.status !== "Available") {
    throw new Error("Item not available");
  }

  const active = await db.findActiveAction(itemId, "checkout");

  if (active) {
    throw new Error("Item already checked out");
  }
};

exports.checkoutItem = async ({ itemId, userId, duration, referenceLink }) => { 
  const db = getDbProvider();
  await db.updateItem(itemId, {
    currentOwner: userId,
    status: "In-Use"
  });

  return await db.addItemHistory(itemId, {
    userId,
    action: "checkout",
    duration: duration ?? null,
    referenceLink: referenceLink ?? null,
  });
};

exports.validateCheckin = async (itemId) => {
  const db = getDbProvider();

  const item = await db.getItemById(itemId);

  if (!item) {
    throw new Error("Item not found");
  }

  if (item.status !== "In-Use") {
    throw new Error("Item is not in-use.");
  }

  const active = await db.findActiveAction(itemId, "checkin");

  if (active) {
    throw new Error("Item already checked in");
  }
};

exports.checkinItem = async ({ itemId, userId, duration, referenceLink }) => { 
  const db = getDbProvider();
  await db.updateItem(itemId, {
    currentOwner: null,
    status: "Available"
  });

  return await db.addItemHistory(itemId, {
    userId,
    action: "checkin",
    referenceLink: referenceLink ?? null,
    returnedAt:  Date.now(),
  });
};

// SHOW OWNED 
exports.formatDuration = (hours) => {
  if (hours == null) return null;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    if (remainingHours === 0) {
      return `${days} day${days > 1 ? "s" : ""}`;
    }
    return `${days} day${days > 1 ? "s" : ""} ${remainingHours} hour${remainingHours > 1 ? "s" : ""}`;
  }

  return `${hours} hour${hours > 1 ? "s" : ""}`;
}

exports.getUserOwnedItems = async (currentUserId) => {
  const db = getDbProvider();

  const histories = await db.getUserHistory(currentUserId);

  const latestMap = new Map();

  for (const h of histories) {
    const itemId = h.itemId.toString();

    // keep latest record per item
    if (!latestMap.has(itemId)) {
      latestMap.set(itemId, h);
    }
  }

  // only active ownership
  return Array.from(latestMap.values()).filter(
    (h) => h.action === "checkout" && !h.returnedAt
  );
};

exports.getDBItemsHistory = async () => {
  const db = getDbProvider();
  return await db.getItemHistories();
};

exports.getUserById = async (selectedUserId) => {
  const db = getDbProvider();
  return await db.getUserById(selectedUserId);
};

exports.getDBItems = async () => {
  const db = getDbProvider();
  return await db.getItems();
};


// move this back to controller later 
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