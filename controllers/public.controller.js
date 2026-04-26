"use strict"; // for debugging

const multiparty = require("multiparty");
const fs = require("fs");
const path = require("path");
const { verifyToken } = require("../middleware/authMiddleware");
const { items, itemHistories, users, dashboardData } = require("../data/data");
const { getDbProvider } = require("../utils/dbProviderShared");
const itemService = require("../services/itemService"); 
const userService = require("../services/userService");
const adminService = require("../services/adminService");  
const { db } = require("../data/models/mongoUserModel");

// static data
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

// GET: /HOME ---------------------------------------------- need to fix later
exports.home = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const db = getDbProvider();

    const [users, items, histories] = await Promise.all([
      userService.getAllUsers(),
      itemService.getDBItems(),
      itemService.getDBItemsHistory(),
    ]);

    // lookup maps
    const userMap = new Map(users.map((u) => [u.id, u]));
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const sortedHistories = [...histories].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const userHistories = sortedHistories.filter(
      (h) => h.userId?.toString() === currentUserId.toString()
    );

    const ownedItems = await itemService.getUserOwnedItems(currentUserId);

    // counts
    let overdueCount = 0;
    let activeCount = 0;

    for (const row of ownedItems) {
      const created = row.createdAt ? new Date(row.createdAt) : null;
      if (!created) continue;

      if (row.duration) {
        const due = new Date(created);
        due.setHours(due.getHours() + row.duration);

        if (new Date() > due) overdueCount++;
        else activeCount++;
      } else {
        activeCount++;
      }
    }

    const totalOwned = ownedItems.length;

    // recent transactions
    const recentTransactions = userHistories.map((h) => {
      const created = h.createdAt ? new Date(h.createdAt) : null;

      let status = "unknown";

      if (h.action === "checkin" || h.returnedAt) {
        status = "returned";
      } else if (h.duration && h.createdAt) {
        const due = new Date(h.createdAt);
        due.setHours(due.getHours() + h.duration);
        status = new Date() > due ? "overdue" : "active";
      } else {
        status = "active";
      }

      return {
        id: h.id,
        user: req.user.name,
        item: itemMap.get(h.itemId?.toString())?.name || "Unknown",

        date: created
          ? created.toISOString().split("T")[0]
          : null,

        type: h.action === "checkout" ? "Checkout" : "Checkin",
        status,
      };
    });

    // RENDER
    res.render("home", {
      dashboardData: {
        totalOwned,
        activeCount,
        overdueCount,
        recentTransactions,
      },
      pageTitle: "Home",
    });

  } catch (err) {
    next(err);
  }
};

// GET: /items ----------------
exports.showItems = async (req, res, next) => {
  try {
    const db = getDbProvider();
    const { cat, q, subcat, isRetired, error, success } = req.query;
    let page = req.query.page;
    const pageSize = 10; // items to show per page

    // manually add categories
    // const categories = [
    //   { name: "Peripherals", subCategories: [
    //     { name: "Monitor" },
    //     { name: "Keyboard" },
    //     { name: "Mouse" },
    //     { name: "Scanner" },
    //     { name: "Printer" },
    //   ] },
    //   { name: "Computers", subCategories: [
    //     { name: "Laptop" },
    //     { name: "Desktop" },
    //     { name: "Server" },
    //   ] },
    // ];

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
  } catch (err) { 
    next(err)
  }
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

    if (
      !name ||
      !description ||
      !brand ||
      !model ||
      !category ||
      !serial ||
      !status
    ) {
      return res.redirect("/items?error=Missing+required+fields");
    }

    // upload file 
    let filePath = null;
    let fileName = null;
    let fileId = null;

    if (!files?.document?.length) {
      return res.redirect("/items?error=Image+file+required");
    }

    if (files?.image?.length > 0) {
      const file = files.image[0];
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB

      if (file.size > MAX_SIZE) {
        return res.redirect("/items?error=File+too+large+(max+50MB)");
      }

      const fileBuffer = fs.readFileSync(file.path);

      fileName = `${Date.now()}_${file.originalFilename}`;
      filePath = `${fileName}`;
      
      const mimeType =file.headers?.["content-type"] || "application/octet-stream";

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
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

exports.showItemDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { edit, del, error, success } = req.query;
    const db = getDbProvider();

    let item = await db.getItemById(id);

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
  } catch (err) { 
    next(err); 
  }
};


// -------------------------------------------------------------- to change: only admin can change status while in-use -> also have update for user history too 
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

    if (
      !name ||
      !description ||
      !brand ||
      !model ||
      !category ||
      !serial ||
      !status
    ) {
      return res.redirect("/items?error=Missing+required+fields");
    }

    if(!["Available", "Maintenance"].includes(status)) {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Status+must+be+available+or+maintenance`,
      });
    }

    if (!files?.document?.length) {
      return res.redirect("/items?error=Image+file+required");
    }

    // upload file
    let filePath = null;
    let fileName = null;

    if (files?.image?.length > 0 && files?.image[0]?.size > 0) {
      const file = files.image[0];
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB

      if (file.size > MAX_SIZE) {
        return res.redirect(`/items/${id}?error=File+too+large+(max+50MB)`);
      }

      const fileBuffer = fs.readFileSync(file.path);

      fileName = `${Date.now()}_${file.originalFilename}`;
      filePath = `${fileName}`;

      const mimeType =file.headers?.["content-type"] || "application/octet-stream";

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
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

    await db.updateItem(id, newItem);

    return res.json({
      type: "success",
      redirect: `/items/${id}?success=Item+updated+successfully`,
    });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------------------- ADMIN ONLY ROUTE PLEASE MAKE ADMIN ONLY 
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

    if(item.status === "In-Use") {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Item+in-use+cannot+be+retired`,
      });
    }

    await db.updateItem(id, newItem);
    
    return res.json({
      type: "success",
      redirect: `/items/${id}?success=Item+retired+successfully`,
    });
  } catch (err) {
    next(err);
  }
};

exports.showItemHistory = async (req, res, next) => {
  try {
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

    res.render("items/itemHistory", context);
  } catch (err) { 
    next(err); 
  }
};




// POST CHECKIN
exports.checkIn = async (req, res, next) => {
  try {
    // get form data 
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

    // validate checkout 
    await itemService.validateCheckin(itemId);

    // upload file
    let filePath = null;
    let fileName = null;

    if (!files?.document?.length) {
      return res.redirect("/items?error=Reference+file+is+required");
    }

    if (files?.document?.length > 0) {
      const file = files.document[0];
      
      const DBlabel = itemService.getDBlabel(); 

      if (DBlabel === "Supabase") {
        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          return res.redirect("/items?error=File+too+large+(max+50MB)");
        }
      }

      const fileBuffer = fs.readFileSync(file.path);
      fileName = `${Date.now()}_${file.originalFilename}`;

      const mimeType =file.headers?.["content-type"] || "application/octet-stream";

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
    }

    await itemService.checkinItem({
      itemId,
      userId,
      duration,
      referenceLink: filePath || fileName
    });

    return res.redirect("/owned");
  } catch (err) {
    return res.redirect(
      `/items?error=${encodeURIComponent(err.message)}`
    );
  }
};


// POST CHECKOUT
exports.checkOut = async (req, res, next) => {
  try {
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

    // validate checkout 
    await itemService.validateCheckout(itemId);

    let filePath = null;
    let fileName = null;

    if (!files?.document?.length) {
      return res.redirect("/items?error=Image+file+required");
    }

    if (files?.document?.length > 0) {
      const file = files.document[0];
      
      const DBlabel = itemService.getDBlabel(); 

      if (DBlabel === "Supabase") {
        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          return res.redirect("/items?error=File+too+large+(max+50MB)");
        }
      }

      const fileBuffer = fs.readFileSync(file.path);
      fileName = `${Date.now()}_${file.originalFilename}`;

      const mimeType =file.headers?.["content-type"] || "application/octet-stream";

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
    }

    await itemService.checkoutItem({
      itemId,
      userId,
      duration,
      referenceLink: filePath || fileName
    });

    return res.redirect("/items?success=item+checked+out+sucessfully");
  } catch (err) {
    return res.redirect(
      `/items?error=${encodeURIComponent(err.message)}`
    );
  }
};


// POST CHECKOUT
exports.adminCheckout = async (req, res, next) => {
  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new multiparty.Form();

      form.parse(req, (error, fields, files) => {
        if (error) return reject(error);
        resolve({ fields, files });
      });
    });

    const itemId = fields.itemId?.[0];
    const duration = fields.duration?.[0];
    const userEmail = fields.userEmail?.[0];
    const adminId = req.user.id;

    // validate checkout 
    await itemService.validateCheckout(itemId);
    const userId = await adminService.adminValidateForCheckout(userEmail, adminId);

    let filePath = null;
    let fileName = null;

    if (!files?.document?.length) {
      return res.redirect("/items?error=Image+file+required");
    }

    if (files?.document?.length > 0) {
      const file = files.document[0];
      
      const DBlabel = itemService.getDBlabel(); 

      if (DBlabel === "Supabase") {
        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
          return res.redirect("/items?error=File+too+large+(max+50MB)");
        }
      }

      const fileBuffer = fs.readFileSync(file.path);
      fileName = `${Date.now()}_${file.originalFilename}`;

      const mimeType =file.headers?.["content-type"] || "application/octet-stream";

      filePath = await itemService.uploadDBFile(fileName, fileBuffer, mimeType);
    }

    await itemService.checkoutItem({
      itemId,
      userId,
      duration,
      referenceLink: filePath || fileName
    });

    return res.redirect("/items?success=item+checked+out+sucessfully");
  } catch (err) {
    return res.redirect(
      `/items?error=${encodeURIComponent(err.message)}`
    );
  }
};


exports.showOwned = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    const items = await itemService.getUserOwnedItems(currentUserId);

    const allOwned = items.map((row) => {
      const created = row.createdAt ? new Date(row.createdAt) : null;

      let status = "unknown";
      let dueDate = null;
      let hoursSince = null;

      if (created && row.duration) {
        dueDate = new Date(created);
        dueDate.setHours(dueDate.getHours() + row.duration);

        const now = new Date();
        status = now > dueDate ? "overdue" : "active";
      } 
      else if (created) {
        const now = new Date();
        hoursSince = Math.floor((now - created) / (1000 * 60 * 60));

        status = "active";
      }

      
      return {
        id: row.itemId || row.item?.id,
        referenceUrl: row.referenceLink,
        name: row.item?.name,

        createdAt: created
          ? created.toISOString().split("T")[0]
          : null,

        duration: row.duration 
          ? `${itemService.formatDuration(row.duration)}`
          : `${itemService.formatDuration(hoursSince)} (ongoing)`,

        dueDate: dueDate
          ? dueDate.toISOString().split("T")[0]
          : "Until returned",

        status,
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

exports.report = async (req, res, next) => {
  try {
    // get history for the last 7 days 
    const AllHistories = await itemService.getDBItemsHistory();
    const AllItems = await itemService.getDBItems();
    const users = await userService.getAllUsers();

    const totalUsers = users.length;
    const totalItems = AllItems.length;

    const deployedItems = AllItems.filter(item =>
      item.currentOwner &&
      item.status === "In-Use"
    ).length;


    // 3. OLD ASSETS (3+ years)
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const oldAssets = AllItems
      .filter(i =>
        i.dateAcquired &&
        new Date(i.dateAcquired) <= threeYearsAgo
      )
      .map(i => ({
        ...i,
        formatted: new Date(i.dateAcquired).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        })
      }));


    // 4. USER AUDIT 
    const selectedUserId = req.query.userId || null;

    let selectedUserName = "";

    if (selectedUserId) {
      const user = await itemService.getUserById(selectedUserId);
      selectedUserName = `${user.name} (${user.email})`;
    }

    const items = await itemService.getUserOwnedItems(selectedUserId);

    const userAudit = items.map((row) => {
      const created = row.createdAt ? new Date(row.createdAt) : null;

      let status = "unknown";
      let dueDate = null;
      let hoursSince = null;

      if (created && row.duration) {
        dueDate = new Date(created);
        dueDate.setHours(dueDate.getHours() + row.duration);

        const now = new Date();
        status = now > dueDate ? "overdue" : "active";
      } else if (created) {
        const now = new Date();
        hoursSince = Math.floor((now - created) / (1000 * 60 * 60));
        status = "active";
      }

      return {
        id: row.itemId || row.item?.id,
        referenceUrl: row.referenceLink,

        name: row.item?.name,

        createdAt: created
          ? created.toISOString().split("T")[0]
          : null,

        duration: row.duration
          ? itemService.formatDuration(row.duration)
          : itemService.formatDuration(hoursSince) + " (ongoing)",

        dueDate: dueDate
          ? dueDate.toISOString().split("T")[0]
          : "Until returned",

        status
      };
    });
    
    res.render("report", {
        totalUsers,
        totalItems,
        deployedItems,
        userAudit,
        users,
        selectedUserName,
        selectedUserId,
        oldAssets,
        pageTitle: "Report"
    });
  } catch (err) {
    next(err);
  }
};

exports.logs = async (req, res, next) => {
  try {
    const selectedUserId = req.query.userId || null;
    const userId = req.user?.id;

    const pageSize = 8;
    const page = parseInt(req.query.page) || 1;

    // DATA FETCH FIRST
    const [allHistories, items, users] = await Promise.all([
      itemService.getDBItemsHistory(),
      itemService.getDBItems(),
      userService.getAllUsers(),
    ]);
    
    // SORT FIRST
    const sorted = [...allHistories].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Build latest record per itemId
    const latestByItem = new Map();

    for (const h of sorted) {
      const key = h.itemId?.toString();
      if (!latestByItem.has(key)) {
        latestByItem.set(key, h); // first seen = latest because sorted DESC
      }
    }

    // FILTER
    let logs = sorted;

    let selectedUserName = "";

    if (selectedUserId) { 
      logs = logs.filter(h => h.userId?.toString() === selectedUserId.toString() ); 
    } 
    
    if (selectedUserId) { 
      const user = await itemService.getUserById(selectedUserId); 
      
      if (user) { 
        selectedUserName = `${user.name} (${user.email})`; 
      } 
    }

    // MAPS
    const itemMap = new Map(items.map(i => [i.id?.toString(), i]));
    const userMap = new Map(users.map(u => [u.id?.toString(), u]));

    // TRANSFORM
    const newLogs = logs.map((h) => {
      const itemId = h.itemId?.toString();
      const latest = latestByItem.get(itemId);

      const created = h.createdAt ? new Date(h.createdAt) : null;

      let status = "unknown";

      if (latest?.id?.toString() !== h.id?.toString()) {
        // older history rows should NOT be "active/returned logic"
        status = "old";
      } else {
        // ONLY latest record determines real status
        if (latest.action === "checkin") {
          status = "returned";
        } else if (latest.action === "checkout") {
          if (created && h.duration) {
            const dueDate = new Date(created);
            dueDate.setHours(dueDate.getHours() + h.duration);

            status = new Date() > dueDate ? "overdue" : "active";
          } else {
            status = "active";
          }
        }
      }

      return {
        ...h,
        item: itemMap.get(h.itemId?.toString())?.name || "Unknown",
        user: userMap.get(h.userId?.toString())?.name || "Unknown",
        date: created ? created.toISOString().split("T")[0] : "No date",
        status,
      };
    });

    // PAGINATION
    const total = newLogs.length;
    const totalPages = Math.ceil(total / pageSize);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const paginatedHistories = newLogs.slice(start, end);

    const prevPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    const totalPagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);

    const pagesToRender = totalPagesArray.slice(
      Math.max(0, page - 2),
      Math.min(totalPages, page + 1)
    );

    console.log(paginatedHistories)
    res.render("logs", {
      allHistories: paginatedHistories,
      users,
      selectedUserName,
      prevPage,
      nextPage,
      currentPage: page,
      totalPages: pagesToRender,
      pageLink: "logs",
      query: selectedUserId ? `&userId=${selectedUserId}` : "",
      pageTitle: "Logs",
    });

  } catch (err) {
    next(err);
  }
};

// 404 handler
exports.notFound = (req, res) => {
  res.status(404).render("extra_pages/404", {
    message: "The page you are looking for does not exist.",
    pageTitle: "404",
  });
};