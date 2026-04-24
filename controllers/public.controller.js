"use strict"; // for debugging

const multiparty = require("multiparty");
const fs = require("fs");
const path = require("path");
const { verifyToken } = require("../middleware/authMiddleware");
const { items, itemHistories, users, dashboardData } = require("../data/data");
const { getDbProvider } = require("../utils/dbProviderShared");
const itemService = require("../services/itemService"); 
const userService = require("../services/userService"); 
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
exports.showItems = async (req, res, next) => {
  const { cat, q, subcat, isRetired, error, success } = req.query;
  let page = req.query.page;
  const pageSize = 10; // items to show per page

  try {
    let items = await itemService.getDBItems();

    // append query parameters to URL
    let url = "/items?";

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
  }
  catch(err) {
    next(err);
  }
};

exports.addItem = async (req, res, next) => {
  try {
    const {
      filePath,
      fileBuffer, 
      fileName, 
      mimeType,
      name, 
      description, 
      brand, 
      model, 
      category, 
      subCategory, 
      serial, 
      status, 
      dateAcquired,
      type,
      redirect,
    } = await itemService.processItemForm(req);

    // an error in form processing must've occured
    if (type?.toLowerCase() === "error") {
      return res.redirect(redirect);
    }

    const existing = await itemService.getItemBySerial(serial);

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
      imageName: filePath,
      imageAlt: `Image of ${name}`,       // add 'imageAlt ||' later if img alt given 
    };

    await itemService.createDBItem(newItem);

    return res.redirect("/items?success=Item+added+successfully");
  }
  catch (err) {
    next(err);
  }
}

exports.showItemDetail = async (req, res, next) => {
  const { id } = req.params;
  const { edit, del, error, success } = req.query;

  try {
    let item = await itemService.getDBItemById(id);

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
  }
  catch(err) {
    next(err);
  }
};

exports.editItem = async (req, res, next) => {
  const { id } = req.params;

  try {
    const item = await itemService.getDBItemById(id);
    const {
      filePath,
      fileBuffer, 
      fileName, 
      mimeType,
      name, 
      description, 
      brand, 
      model, 
      category, 
      subCategory, 
      serial, 
      status, 
      dateAcquired,
      type,
      redirect,
    } = await itemService.processItemForm(req);

    if (type?.toLowerCase() === "error") {
      return res.json({
        type,
        redirect,
      });
    }

    if (item.status === "In-Use") {
      return res.json({
        type: "error",
        redirect: `/items/${id}?error=Item+in-use+cannot+be+edited`,
      });
    }

    if (
      !name ||
      !description ||
      !brand ||
      !model ||
      !serial
    ) {
      return res.json({
        type: "error",
        redirect: `/items/${id}?error=Missing+required+fields`,
      })
    }

    if(!["Available", "Maintenance"].includes(status)) {
      return res.json({
        type: "error",
        redirect: `/api/items/${id}?error=Status+must+be+available+or+maintenance`,
      });
    }

    const newItem = {
      name,
      description,
      brand,
      model,
      category: category || item.category,
      subCategory: subCategory || item.subCategory,
      serial,
      status: status || item.status,
      dateAcquired,
      imageName: filePath || item.imageName,
      imageAlt: `Image of ${name}`,
      imageUrl: filePath || item.imageUrl,
    };

    await itemService.updateDBItem(id, newItem);

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
    const response = await itemService.deleteDBItem(id);
    return res.json(response);
  } catch (err) {
    next(err);
  }
};

exports.showItemHistory = async (req, res, next) => {
  const { id } = req.params;

  try {
    const itemHistories = await itemService.getDBItemHistoriesById(id);

    let context = {
      ...itemHistories,
      isEmpty: false,
      pageTitle: "Item History",
    };

    if(itemHistories.length === 0) {
      context = {
        ...context,
        isEmpty: true
      }
    }

    res.render("items/itemHistory", context);
  }
  catch(err) {
    next(err)
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
        referenceUrl: row.referenceUrl,
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
      item.current_owner &&
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
        referenceUrl: row.referenceUrl,

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

    // console.log(oldAssets)
    // console.log(userAudit)
    
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

// 404 handler
exports.notFound = (req, res) => {
  res.status(404).render("extra_pages/404", {
    message: "The page you are looking for does not exist.",
    pageTitle: "404",
  });
};