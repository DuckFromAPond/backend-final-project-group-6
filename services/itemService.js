const { getDbProvider } = require("../utils/dbProviderShared");
const multiparty = require("multiparty");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

// CHECKIN / CHECKOUT 
exports.getDBlabel = () => { 
  const db = getDbProvider();
  return db.providerLabel;
}

exports.uploadDBFile = async (fileName, fileBuffer, mimeType) => { 
  const db = getDbProvider();
  return await db.uploadFile(fileName, fileBuffer, mimeType);
}

exports.uploadDBItem = async (fileName, fileBuffer, mimeType) => { 
  const db = getDbProvider();
  return await db.uploadItem(fileName, fileBuffer, mimeType);
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

exports.getDBFile = async (bucket, id) => { 
  const db = getDbProvider();
  return await db.getFile(bucket, id);
}

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

exports.validateCheckin = async (itemId, userId) => {
  const db = getDbProvider();

  const item = await db.getItemById(itemId);

  if (!item) {
    throw new Error("Item not found");
  }

  if (item.status !== "In-Use") {
    throw new Error("Item is not in-use.");
  }
  
  if (String(item.currentOwner) !== String(userId)) {
    throw new Error("You don't own this item.");
  }

  const active = await db.findActiveAction(itemId, "checkin");

  if (active) {
    throw new Error("Item already checked in");
  }
};

exports.checkinItem = async ({ itemId, userId, referenceLink }) => { 
  const db = getDbProvider();
  await db.updateItem(itemId, {
    currentOwner: null,
    status: "Available"
  });

  return await db.addItemHistory(itemId, {
    userId,
    action: "checkin",
    duration: null,
    referenceLink: referenceLink ?? null,
    returnedAt:  Date.now(),
  });
};

// SHOW OWNED 
exports.formatDuration = (hours) => {
  if (hours == null) return null;

  const totalMinutes = Math.floor(hours * 60);

  if (totalMinutes === 0) return "<1 min";

  // less than 1 hour → show minutes
  if (totalMinutes < 60) {
    return `${totalMinutes} min${totalMinutes !== 1 ? "s" : ""}`;
  }

  const days = Math.floor(totalMinutes / (60 * 24));
  const remainingMinutesAfterDays = totalMinutes % (60 * 24);

  const h = Math.floor(remainingMinutesAfterDays / 60);
  const m = remainingMinutesAfterDays % 60;

  // days
  if (days > 0) {
    if (h === 0) {
      return `${days} day${days > 1 ? "s" : ""}`;
    }
    return `${days} day${days > 1 ? "s" : ""} ${h} hour${h > 1 ? "s" : ""}`;
  }

  // hours + minutes (optional nice UX)
  if (m > 0) {
    return `${h} hour${h > 1 ? "s" : ""} ${m} min${m > 1 ? "s" : ""}`;
  }

  return `${h} hour${h > 1 ? "s" : ""}`;
};

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


exports.getUserHistory = async (currentUserId) => {
  const db = getDbProvider();

  const userHistories = await db.getUserHistory(currentUserId);

  return userHistories
};

// GET ALL HISTORY
// Description: gets all history from database
// Precondition: none
// Postcondition: object (all history)
exports.getDBItemsHistory = async () => {
  const db = getDbProvider();
  return await db.getItemHistories();
};

// GET ALL HISTORY OF AN ITEM
// Description: gets all history of an item by item id from database
// Precondition: id of item
// Postcondition: object (all history of an item + searched item)
exports.getDBItemHistoriesById = async (id) => {
  const db = getDbProvider();
  const itemHistory = await db.getItemHistoryByItemId(id);
  const item = await db.getItemById(id);
  const userPromises = itemHistory.map(async h => {return await db.getUserById(h.userId)});
  const users = await Promise.all(userPromises);

  let itemHistories = {
    item,
    itemHistories: itemHistory,
  };

  let history = itemHistories.itemHistories;

  if (history) {
      history = history.map(h => {
        // find username using id 
        const user = users.find(u => u.id === h.userId);

        return {
            ...h,
            assignee: user ? user.name : "No name given"
        };
      });

      itemHistories = {
        ...itemHistories,
        itemHistories: history
      }
  }

  return itemHistories;
};

// GET ITEMS
// Description: gets all items from database
// Precondition: none
// Postcondition: array of items
exports.getDBItems = async () => {
  const db = getDbProvider();
  return await db.getItems();
};

// GET CATEGORIES
// Description: gets all categories from database
// Precondition: none
// Postcondition: array of categories
exports.getCategoryFromDB = async () => {
  const db = getDbProvider();
  const categories = await db.getAllCategories(); 

  const map = new Map();
  const result = [];

  // 1. build lookup map
  categories.forEach(cat => {
    map.set(cat.id.toString(), {
      id: cat.id.toString(),
      name: cat.name,
      subCategories: []
    });
  });

  // 2. build tree
  categories.forEach(cat => {
    const id = cat.id.toString();
    const parentId = cat.parentId?.toString();

    if (parentId) {
      const parent = map.get(parentId);

      if (parent) {
        parent.subCategories.push(map.get(id));
      }
    } else {
      result.push(map.get(id));
    }
  });
  return result;
};

// GET FILTERED ITEMS
// Description: gets filtered items from database
// Precondition: none
// Postcondition: array of items
exports.getDBFilteredItems = async ({cat, subcat, q, isRetired}) => {
  let items = await exports.getDBItems();
  let categories = await exports.getCategoryFromDB();

  if(!categories || categories.length === 0) {
    // use static data
    categories = [
      { name: "Peripherals", subCategories: [
        { name: "Monitor" },
        { name: "Keyboard" },
        { name: "Mouse" },
        { name: "Scanner" },
        { name: "Printer" },
      ] },
      { name: "Computers", subCategories: [
        { name: "Laptop" },
        { name: "Desktop" },
        { name: "Server" },
      ] },
    ];
  }

  if (subcat) items = items.filter(item => item.subCategory === subcat);
  if (cat) items = items.filter(item => item.category.toLowerCase().trim() === cat.toLowerCase().trim());
  if (q) items = items.filter(item => item.name?.toLowerCase().includes(q.toLowerCase()));

  items = isRetired
      ? items.filter(item => item.status === 'Retired')
      : items.filter(item => item.status !== 'Retired');

  return { items, categories }
}

// GET ITEM BY ITEM ID
// Description: gets item by id from database
// Precondition: id of item
// Postcondition: object (item)
exports.getDBItemById = async (id) => {
  const db = getDbProvider();
  return await db.getItemById(id);
};

exports.getDBItemBySerial = async (id) => {
  const db = getDbProvider();
  return await db.getItemBySerial(id);
}

// CREATE ITEM
// Description: creates item in database
// Precondition: payload of new item
// Postcondition: object (item)
exports.createDBItem = async (data) => {
  const db = getDbProvider();
  return await db.createItem(data);
};

// UPDATE ITEM
// Description: updates item in database
// Precondition: id of item to update, payload of new item that will replace old item
// Postcondition: object (item)
exports.updateDBItem = async (id, data) => {
  const db = getDbProvider();
  return await db.updateItem(id, data);
};

// DELETE ITEM
// Description: deletes item from database
// Precondition: id of item to delete
// Postcondition: object {type, redirect}
exports.deleteDBItem = async (id) => {
  const db = getDbProvider();
  const item = await db.getItemById(id);
  const newItem = {
    ...item,
    status: "Retired",
  };

  if(item.status === "In-Use") {
    return {
      type: "error",
      redirect: `/items/${id}?error=Item+in-use+cannot+be+retired`,
    };
  }

  await db.updateItem(id, newItem);

  return {
    ...newItem,
    type: "success",
    redirect: `/items/${id}?success=Item+retired+successfully`,
  };
}

// PROCESS ITEM FORMS
// description: process item form
// precondition: request object, fs, multiparty, path
// postcondition: object {type, redirect, name, description, brand, model, category, subCategory, serial, status, dateAcquired, filePath, fileBuffer, fileName, mimeType}
exports.processItemForm = async (req) => {
  const db = getDbProvider();
  const id = req.params.id; // for returning to itemDetail if the form is submitted from /itemDetail
  const form = new multiparty.Form();
  
  let type = null;
  let redirect = null;
  let errCode = null;
  let message = null

  if (!req.headers["content-type"]?.includes("multipart/form-data")) {
    return {
      type: "error",
      redirect: `/items/?error=Invalid+content+type`,
      message: "INVALID CONTENT TYPE",
      errCode: 415
    };
  }

  const { fields, files } = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });

  // extract fields
  const name = fields.name?.[0] ?? null;
  const description = fields.description?.[0] ?? null;
  const brand = fields.brand?.[0] ?? null;
  const model = fields.model?.[0] ?? null;
  const category = fields.category?.[0] ?? null;
  const subCategory = fields.subCategory?.[0] ?? null;
  const serial = fields.serial?.[0] ?? null;
  const status = fields.status?.[0] ?? null;
  const dateAcquired = fields.dateAcquired?.[0] ?? new Date();

  if (
    !name ||
    !description ||
    !brand ||
    !model ||
    !serial || 
    !category || 
    !subCategory || 
    !status
  ) {
    return {
      type: "error",
      errCode: 400,
      message: "MISSING REQUIRED FIELDS",
      redirect: `/items/${id}?error=Missing+required+fields`,
    }
  }

  // upload file
  let fileName = null;
  let fileBuffer = null;
  let mimeType = null;

  // check whether file is uploaded
  if (files?.image?.length > 0 && files?.image[0]?.originalFilename.length !== 0) {
    const file = files.image[0];
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB

    if (file.size > MAX_SIZE) {
      if(id) {
        return {
          type: "error",
          errCode: 413,
          message: "FILE TOO LARGE",
          redirect : `/items/${id}?error=File+too+large+(max+50MB)`,
        }
      }
      else {
        return {
          type : "error",
          errCode: 413,
          message: "FILE TOO LARGE",
          redirect :`/items?error=File+too+large+(max+50MB)`,
        }
      }
    }

    mimeType = file.headers?.["content-type"] || "application/octet-stream";
    const ext = path.extname(file.originalFilename).toLowerCase();

    const allowedImageExtensions = new Set([
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif"
    ]);

    const isImage = mimeType.startsWith("image/");

    if (!allowedImageExtensions.has(ext) || !isImage) {
      if(id) {
        return {
        type : "error",
        errCode: 415,
        message: "INVALID FILE TYPE",
        redirect : `/items/${id}?error=Only+image+files+are+allowed`,
        }
      }
      else {
        return {
        type : "error",
        errCode: 415,
        message: "INVALID FILE TYPE",
        redirect : `/items?error=Only+image+files+are+allowed`,
        }
      }
    }
    const rawBuffer = fs.readFileSync(file.path);

    const webpBuffer = await sharp(rawBuffer)
      .webp({ quality: 80 })
      .toBuffer();

    fileBuffer = webpBuffer;
    mimeType = "image/webp";
    fileName = `${Date.now()}_${file.originalFilename}.webp`;
  }
  else {
    if(id) {
      // for editing, no image defaults to original image instead of error or instead of replacing original with empty.
      return {
      type : "warning",
      redirect : `/items/${id}?warning=Image+file+missing`,
       }
    }
    else {
       return {
        type: "error",
        redirect : `/items?error=Image+file+required`,
        message: "IMAGE REQUIRED",
        errCode: 400
        }
    }
  }

  return {fileBuffer, fileName, mimeType, name, description, brand, model, category, subCategory, serial, status, dateAcquired, type, redirect, message, errCode};
}


exports.buildSessions= async(logs) => {
  // sort oldest → newest (important for pairing)
  const sorted = [...logs].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  const sessionsByItem = new Map();

  for (const log of sorted) {
    const itemId = log.itemId?.toString();

    if (!sessionsByItem.has(itemId)) {
      sessionsByItem.set(itemId, []);
    }

    const sessions = sessionsByItem.get(itemId);

    if (log.action === "checkout") {
      // start new session
      sessions.push({
        checkout: log,
        checkin: null
      });
    }

    if (log.action === "checkin") {
      // attach to latest open session
      const openSession = [...sessions].reverse().find(s => !s.checkin);

      if (openSession) {
        openSession.checkin = log;
      }
    }
  }

  return sessionsByItem;
}