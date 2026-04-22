"use strict"; // for debugging

const multiparty = require("multiparty");
const fs = require("fs");
const path = require("path");
const { verifyToken } = require("../middleware/authMiddleware");
const { items, itemHistories, users, dashboardData } = require("../data/data");
const { getDbProvider } = require("../utils/dbProviderShared");
const itemService = require("../services/itemService"); 

// GET: /HOME ----------------
exports.home = async (req, res, next) => {
  try {
    const db = getDbProvider();

    const [users, items, histories] = await Promise.all([
      db.getAllUsers ? db.getAllUsers() : Promise.resolve([]),
      db.getItems(),
      db.getItemHistories(),
    ]);

    const totalUsers = users.length;
    const totalItems = items.length;

    // latest per item
    const latestMap = new Map();
    const sortedHistories = [...histories].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    for (const h of sortedHistories) {
      if (!latestMap.has(h.itemId)) {
        latestMap.set(h.itemId, h);
      }
    }

    const pendingCheckouts = [...latestMap.values()].filter(
      (h) => h.action === "checkout",
    ).length;

    // lookup maps
    const userMap = new Map(users.map((u) => [u.id, u]));
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const recentTransactions = sortedHistories.slice(0, 5).map((h) => {
      const user = userMap.get(h.userId);
      const item = itemMap.get(h.itemId);

      return {
        id: h.id,
        user: user?.name || "Unknown",
        item: item?.name || "Unknown",
        type: h.action === "checkout" ? "Checkout" : "Checkin",
        date: new Date(h.createdAt).toLocaleString(),
      };
    });

    res.render("home", {
      dashboardData: {
        totalUsers,
        totalItems,
        pendingCheckouts,
        recentTransactions,
      },
      pageTitle: "Home",
    });
  } catch (err) {
    next(err);
  }
};

// GET: /items ----------------
exports.showItems = async (req, res) => {
  const db = getDbProvider();
  const { cat, q, subcat, isRetired, error, success } = req.query;
  let page = req.query.page;
  const pageSize = 10; // items to show per page

  // manually add categories
  const categories = [
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

  // append query parameters to URL
  let url = "/items?";

  // get all items from DB
  let items = await db.getItems();

  // filter by subcategory
  if(subcat) {
    url += `subcat=${subcat}&`;
    items = items.filter((item) => item.subCategory === subcat);
  }

  // filter by category
  if (cat) {
    url += `cat=${cat}&`;
    items = items.filter((item) => item.category === cat);
  }

  // search by name (case-insensitive)
  if (q) {
    url += `q=${q}&`;
    items = items.filter((item) =>
      item.name?.toLowerCase().includes(q.toLowerCase()),
    );
  }

  if (isRetired) {
    url += `isRetired=${isRetired}&`;
    items = items.filter((item) => item.status === "Retired");
  } else {
    items = items.filter((item) => item.status !== "Retired");
  }

  if (error) {
    url += `error=${error}&`;
  }

  if (success) {
    url += `success=${success}&`;
  }

  // append page number to URL
  if (!page) {
    url += `page=1`;
    return res.redirect(url);
  }

  page = parseInt(page);

  // calculate total pages
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const totalPagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);

  // set page range
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  items = items.slice(start, end);

  // pagination
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const pagesToRender = totalPagesArray.slice(prevPage, nextPage);

  const statuses = [
    { name: "Available" },
    { name: "In-Use" },
    { name: "Maintenance" },
  ];

  res.render("items/items", {
    categories,
    items,
    statuses,
    prevPage,
    nextPage,
    totalPages: pagesToRender,
    user: req.user || null,
    error: error || null,
    success: success || null,
    pageTitle: "Items",
  });
};

exports.addItem = async (req, res, next) => {
  try {
    const db = getDbProvider();
    const form = new multiparty.Form();

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

        // extract fields
        const name = fields.name?.[0] ?? '';
        const description = fields.description?.[0] ?? '';
        const brand = fields.brand?.[0] ?? '';
        const model = fields.model?.[0] ?? '';
        const category = fields.category?.[0] ?? '';
        const subCategory = fields.subCategory?.[0] ?? '';
        const serial = fields.serial?.[0] ?? '';
        const status = fields.status?.[0] ?? '';
        const dateAcquired = fields.dateAcquired?.[0] ?? new Date();

        const existing = await db.getItemBySerial(serial);

        if (existing) {
          return res.redirect("/items?error=Serial+already+exists");
        }

        // upload file 
        let filePath = null;
        let fileName = null;
        let fileId = null;

    if (files?.image?.length > 0) {
      const file = files.image[0];
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB

      if (file.size > MAX_SIZE) {
        return res.redirect("/items?error=File+too+large+(max+50MB)");
      }

      const fileBuffer = fs.readFileSync(file.path);

      fileName = `${Date.now()}_${file.originalFilename}`;
      filePath = `${fileName}`;

          fileId = await db.uploadItem(filePath, fileBuffer);
        }

        const newItem = {
            name,
            description,
            brand,
            model,
            category,
            subCategory,
            serial,
            status,
            dateAcquired,
            imageName: fileId || fileName,
            imageAlt: `Image of ${name}`,       // add 'imageAlt ||' later if img alt given 
        };

        await db.createItem(newItem);

        return res.redirect("/items?success=Item+added+successfully");
    }
    catch (err) {
      next(err);
    }
}

exports.showItemDetail = async (req, res) => {
  const { id } = req.params;
  const { edit, del, error, success } = req.query;
  const db = getDbProvider();

  let item = await db.getItemById(id);

  // manually add categories
  const categories = [
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

  const statuses = [
    { name: "Available" },
    { name: "Maintenance" },
  ];

  let context = {
    ...item,
    categories,
    statuses,
    isEdit: false,
    isDelete: false,
    isRetired: item.status === "Retired",
    pageTitle: "ItemDetail",
  };

  if (!context) {
    res.status(404);
    return res.render("404");
  }

  if (edit || (edit?.length !== 0 && edit === "true")) {
    context = {
      ...context,
      isEdit: true,
    };
  }

  if (del || (del?.length !== 0 && del === "true")) {
    context = {
      ...context,
      isDelete: true,
    };
  }

  if (error) {
    context = {
      ...context,
      error,
    };
  }

  if (success) {
    context = {
      ...context,
      success,
    };
  }

  res.render("items/itemDetail", context);
};

exports.editItem = async (req, res, next) => {
  const { id } = req.params;

  try {
    const db = getDbProvider();
    const item = await db.getItemById(id);
    const form = new multiparty.Form();

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    if (item.status === "In-Use") {
      return res.json({
        type: "error",
        redirect: `/items/${id}?error=Item+in-use+cannot+be+edited`,
      });
    }

    // extract fields
    const name = fields.name?.[0] ?? "";
    const description = fields.description?.[0] ?? "";
    const brand = fields.brand?.[0] ?? "";
    const model = fields.model?.[0] ?? "";
    const category = fields.category?.[0] ?? "";
    const subCategory = fields.subCategory?.[0] ?? "";
    const serial = fields.serial?.[0] ?? "";
    const status = fields.status?.[0] ?? "";
    const dateAcquired = fields.dateAcquired?.[0] ?? new Date();

    // upload file
    let filePath = null;
    let fileName = null;

    // console.log(files)

    if (files?.image?.length > 0 && files?.image[0]?.size > 0) {
      const file = files.image[0];
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB

      if (file.size > MAX_SIZE) {
        return res.redirect(`/items/${id}?error=File+too+large+(max+50MB)`);
      }

      const fileBuffer = fs.readFileSync(file.path);

      fileName = `${Date.now()}_${file.originalFilename}`;
      filePath = `${fileName}`;

      await db.uploadFile(filePath, fileBuffer, true);
    }

    const newItem = {
      name,
      description,
      brand,
      model,
      category,
      subCategory,
      serial,
      status,
      dateAcquired,
      imageName: fileName ?? item.image_name,
      imageAlt: `Image of ${name}`,
    };

    console.log(newItem);

    await db.updateItem(id, newItem);

    return res.json({
      type: "success",
      redirect: `/items/${id}?success=Item+updated+successfully`,
    });
  } catch (err) {
    next(err);
  }
};

// soft deletes only
exports.deleteItem = async (req, res, next) => {
  const { id } = req.params;

  try {
    const db = getDbProvider();
    const item = await db.getItemById(id);
    const newItem = {
      ...item,
      status: "Retired",
    };

    await db.updateItem(id, newItem);
    
    return res.json({
      type: "success",
      redirect: `/items/${id}?success=Item+retired+successfully`,
    });
  } catch (err) {
    next(err);
  }
};

exports.showItemHistory = async (req, res) => {
  const { id } = req.params;
  const db = getDbProvider();
  const itemHistory = await db.getItemHistoryByItemId(id);
  const item = await db.getItemById(id);
  const userPromises = itemHistory.map(async h => {return await db.getUserById(h.userId)});
  
  const users = await Promise.all(userPromises);

  let context = {
    item,
    itemHistories: itemHistory,
    isEmpty: false,
    pageTitle: "Item History",
  };

  if(itemHistory.length === 0) {
    context = {
      ...context,
      isEmpty: true
    }
  }

  let history = context.itemHistories;

  if (history) {
      history = history.map(h => {
        // find username using id 
        const user = users.find(u => u.id === h.userId);

        return {
            ...h,
            assignee: user ? user.name : "No name given"
        };
      });

      context = {
        ...context,
        itemHistories: history
      }
  }

  console.log(context);

  res.render("items/itemHistory", context);
};

// POST: /CHECKIN
exports.checkIn = async (req, res, next) => {
  try {
    const db = getDbProvider();

    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (error, fields, files) => {
        if (error) return reject(error);
        resolve({ fields, files });
      });
    });

    const itemId = fields.itemId?.[0];
    const duration = fields.duration?.[0];
    const userId = req.user.id;

    const item = await db.getItemById(itemId);

    if (!itemId) {
      return res.redirect("/items?error=Missing+itemId");
    }

    if (!item) {
      return res.redirect("/items?error=Item+not+found");
    }

    if (item.status !== "In-Use") {
      return res.redirect("/items?error=Item+not+checked+out");
    }

    // 1. upload file
    let filePath = null;

    if (files?.document?.length > 0 && db.providerLabel === "Supabase") {
      const file = files.document[0];
      const MAX_SIZE = 50 * 1024 * 1024;

      if (file.size > MAX_SIZE) {
        return res.redirect("/items?error=File+too+large+(max+50MB)");
      }

      const fileBuffer = fs.readFileSync(file.path);
      const fileName = `${Date.now()}_${file.originalFilename}`;

      filePath = await db.uploadFile(fileName, fileBuffer);
    } else {
      const file = files.document[0];

      const fileBuffer = fs.readFileSync(file.path);
      const fileName = `${Date.now()}_${file.originalFilename}`;

      filePath = await db.uploadFile(fileName, fileBuffer);
    }

    // 2. update state
    await db.updateItem(itemId, { status: "Available" });

    // 3. log history ONCE
    await db.addItemHistory(itemId, {
      userId,
      action: "checkin",
      referenceLink: filePath,
    });

    return res.redirect("/items?success=Checked+in+successfully!");
  } catch (err) {
    next(err);
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const db = getDbProvider();
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (error, fields, files) => {
        if (error) return reject(error);
        resolve({ fields, files });
      });
    });

    const itemId = fields.itemId?.[0];
    const duration = fields.duration?.[0];
    const userId = req.user.id;

    const item = await db.getItemById(itemId);

    if (!item) {
      return res.redirect("/items?error=Item+not+found");
    }

    if (
      item.status !== "Available" ||
      ["Maintenance", "Retired"].includes(item.status)
    ) {
      return res.redirect("/items?error=Item+not+available");
    }

    let filePath = null;

    if (files?.document?.length > 0) {
      const file = files.document[0];

      if (db.providerLabel === "Supabase") {
        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          return res.redirect("/items?error=File+too+large+(max+50MB)");
        }
      }

      const fileBuffer = fs.readFileSync(file.path);
      const fileName = `${Date.now()}_${file.originalFilename}`;

      filePath = await db.uploadFile(fileName, fileBuffer);
    }

    await itemService.checkoutItem({
      itemId,
      userId,
      duration,
      referenceLink: filePath
    });

    return res.redirect("/owned");
  } catch (err) {
    next(err);
  }
};

exports.showOwned = async (req, res, next) => {
  try {
    const db = getDbProvider();
    const currentUserId = req.user.id;

    const items = await db.getUserItems(currentUserId);

    const allOwned = items.map((row) => {
      let status = "unknown";
      let dueDate = null;

      if (row.createdAt && row.duration) {
        const created = new Date(row.createdAt);

        dueDate = new Date(created);
        dueDate.setHours(dueDate.getHours() + row.duration);

        const now = new Date();

        status = now > dueDate ? "overdue" : "active";
      }

      const created = row.createdAt ? new Date(row.createdAt) : null;
      console.log(row.referenceUrl)
      return {
        id: row.item_id, 
        referenceUrl: row.referenceUrl,
        name: row.item.name,
        createdAt: created.toISOString().split("T")[0],
        dueDate: dueDate ? dueDate.toISOString().split("T")[0] : null,
        status: status,
      };
    });

    res.render("owned", {
      items: allOwned,
      pageTitle: "Owned",
    });
  } catch (err) {
    next(err);
  }
};

exports.report = (req, res) => {
  res.render("report");
};

// 404 handler
exports.notFound = (req, res) => {
  res.status(404).render("extra_pages/404", {
    message: "The page you are looking for does not exist.",
    pageTitle: "404",
  });
};

// LEAVING THIS MIDDLEWARE DOWN HERE UNTIL I CAN THINK OF A REPLACEMENT

// middle-ware to render 404 (bad)
// app.use((req, res, next) => {
//   const publicRoutes = ["/", "/login", "/register"];
//   // If it's a known public route, let it pass to the gate or routes
//   if (publicRoutes.includes(req.path)) {
//     return next();
//   }
//   // Otherwise, it's a dead end—render 404 now!
//   // res.status(404).render("extra_pages/404", { layout: "no_nav_bar" });
// });
