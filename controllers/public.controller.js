'use strict';   // for debugging

const multiparty = require("multiparty");
const fs = require("fs");
const path = require("path");
const { verifyToken } = require("../middleware/authMiddleware");
const { items, itemHistories, users, dashboardData } = require('../data/data');
const { getDbProvider } = require("../utils/dbProviderShared");

// this data might be important 
const itemData = {
    categories: [
        { name: "Computers", subCategories: [] },
        { name: "Peripherals", subCategories: [] },
    ],
    //Fields: Item ID (Unique), Serial Number, Model, Brand, Category, Status (Available, In-Use, Maintenance, Retired), and Date Acquired.
    items: items, // Use the imported items here
    itemHistories: itemHistories,
};

// replace this for db + bucket
const uploadsDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`✓ Created uploads directory at ${uploadsDir}`);
}

// GET: /HOME ----------------
exports.home = async (req, res) => {
  const db = getDbProvider();

  // get data at the same time to speed up loading
  const [users, items, histories] = await Promise.all([
    db.getAllUsers?.() || [],
    db.getItems(),
    db.getItemHistories()
  ]);

  const totalUsers = users.length;
  const totalItems = items.length;

  const pendingCheckouts = histories.filter(h => !h.returnedAt).length;

  // lookup maps
  const userMap = new Map(users.map(u => [u.id, u]));
  const itemMap = new Map(items.map(i => [i.id, i]));

  const recentTransactions = histories
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map(h => {
      const user = userMap.get(h.userId);
      const item = itemMap.get(h.itemId);

      return {
        id: h.id,
        user: user?.name || "Unknown",
        item: item?.name || "Unknown",
        type: h.returnedAt ? "Check-in" : "Checkout",
        date: h.createdAt
      };
    });

  res.render("home", {
    dashboardData: {
      totalUsers,
      totalItems,
      pendingCheckouts,
      recentTransactions
    }, 
    pageTitle: "Home"
  });
};

// GET: /items ----------------
exports.showItems = async (req, res) => {
  const db = getDbProvider();
  const { cat, q, error } = req.query;

  // get all items from DB
  let items = await db.getItems();

  // derive categories dynamically
  const categories = [
    ...new Set(items.map(item => item.category))
  ].map(name => ({ name }));

  // filter by category
  if (cat) {
    items = items.filter(item => item.category === cat);
  }

  // search by name (case-insensitive)
  if (q) {
    items = items.filter(item =>
      item.name?.toLowerCase().includes(q.toLowerCase())
    );
  }
  
  const statuses = [
    { name: "Available" },
    { name: "In-Use" },
    { name: "Maintenance" },
    { name: "Retired" }
  ];

  res.render("items/items", {
    categories,
    items,
    statuses,
    user: req.user || null,
    error: req.query.error || null,
    success: req.query.success || null, 
    pageTitle: "Items"
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
        const sub_category = fields.subcategory?.[0] ?? '';
        const serial = fields.serial?.[0] ?? '';
        const status = fields.status?.[0] ?? '';
        const date_acquired = fields.dateAcquired?.[0] ?? new Date();

        // upload file 
        let filePath = null;
        let fileName = null;

        // console.log(files)

        if (files?.image?.length > 0) {
          const file = files.image[0];
          const MAX_SIZE = 50 * 1024 * 1024; // 50MB

          if (file.size > MAX_SIZE) {
              return res.redirect("/items?error=File+too+large+(max+50MB)");
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
            sub_category: '',
            serial,
            status,
            date_acquired,
            image_name: fileName,
            image_alt: `Image of ${name}`
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
    const { edit, del } = req.query;
    const db = getDbProvider();

    let item = await db.getItemById(id);

    const statuses = [
      { name: "Available" },
      { name: "In-Use" },
      { name: "Maintenance" },
      { name: "Retired" }
    ];

    let context = {
        ...items ? item : null,
        statuses,
        isEdit: false,
        isDelete: false,
    };

    if (!context) {
        res.status(404)
        return res.render('404')
    }

    if (edit || edit?.length !== 0 && edit === 'true') {
        context = {
            ...context,
            isEdit: true
        }
    }

    if (del || del?.length !== 0 && del === 'true') {
        context = {
            ...context,
            isDelete: true
        }
    }

    console.log(context)

    res.render('items/itemDetail', context)
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

        // extract fields
        const name = fields.name?.[0] ?? '';
        const description = fields.description?.[0] ?? '';
        const brand = fields.brand?.[0] ?? '';
        const model = fields.model?.[0] ?? '';
        const category = fields.category?.[0] ?? '';
        const sub_category = fields.subcategory?.[0] ?? '';
        const serial = fields.serial?.[0] ?? '';
        const status = fields.status?.[0] ?? '';
        const date_acquired = fields.dateAcquired?.[0] ?? new Date();

        // upload file 
        let filePath = null;
        let fileName = null;

        // console.log(files)

        if (files?.image?.length > 0 && files?.image[0]?.size > 0) {
          const file = files.image[0];
          const MAX_SIZE = 50 * 1024 * 1024; // 50MB

          if (file.size > MAX_SIZE) {
              return res.redirect("/items?error=File+too+large+(max+50MB)");
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
            sub_category: '',
            serial,
            status,
            date_acquired,
            image_name: fileName ?? item.image_name,
            image_alt: `Image of ${name}`
        };

        await db.updateItem(id, newItem);

        return res.json({
          type: "success",
          redirect: "/items?success=Item+updated+successfully"
        });
    }
    catch (err) {
      next(err);
    }
}

exports.deleteItem = async (req, res, next) => {
    const { id } = req.params;

    try {
      const db = getDbProvider();
      await db.deleteItem(id);
      
      return res.json({
          type: 'success',
          redirect: '/items'
      })
    }
    catch(err) {
      next(err);
    }
}

exports.showItemHistory = (req, res) => {
    const { id } = req.params;

    const context = {
        item: itemData.items.find((item) => String(item.id) === String(id)),
        itemHistories: itemData.itemHistories.find(
            (item) => String(item.id) === String(id),
        ),
    };

    const history = context.itemHistories;

    if (history) {
        history.histories = history.histories.map(h => {
            // find username using id 
            const user = users.find(u => u.id === h.user_id);

            return {
                ...h,
                assignee: user ? user.name : "No name given"
            };
        });
    }

    res.render("items/itemHistory", context);
};


// POST: /CHECKIN 
exports.checkIn = async (req, res, next) => {
  try {
    const db = getDbProvider();
    const form = new multiparty.Form();

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const itemId = fields.itemId?.[0];   
    const userId = req.user.id;

    if (!itemId) {
      return res.redirect("/items?error=Missing+itemId");
    }

    const item = await db.getItemById(itemId);

    if (!item) {
      return res.redirect("/items?error=Item+not+found");
    }

    if (item.status !== "In-Use") {
      return res.redirect("/items?error=Item+not+checked+out");
    }

    // 1. upload file 
    let filePath = null;

    if (files?.document?.length > 0) {
      const file = files.document[0];
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB

      if (file.size > MAX_SIZE) {
          return res.redirect("/items?error=File+too+large+(max+5MB)");
      }

      const fileBuffer = fs.readFileSync(file.path);

      const fileName = `${Date.now()}_${file.originalFilename}`;
      filePath = `checkin/${fileName}`;

      await db.uploadFile(filePath, fileBuffer, false);

      if (uploadError) throw uploadError;
    }

    // 2. update state
    await db.updateItem(itemId, { status: "Available" });

    // 3. log history ONCE
    await db.addItemHistory(itemId, {
      userId,
      action: "checkin",
      referenceLink: filePath
    });

    return res.redirect("/items?success=Checked+in+successfully");
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
    const userId = req.user.id;

    const item = await db.getItemById(itemId);

    if (!item) {
      return res.redirect("/items?error=Item+not+found");
    }


    if (item.status !== "Available") {
      return res.redirect("/items?error=Item+not+available");
    }

    let filePath = null;

    if (files?.document?.length > 0) {
      const file = files.document[0];
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB

      if (file.size > MAX_SIZE) {
          return res.redirect("/items?error=File+too+large+(max+5MB)");
      }

      const fileBuffer = fs.readFileSync(file.path);
      const fileName = `${Date.now()}_${file.originalFilename}`;
      filePath = `checkout/${fileName}`;

      await db.uploadFile(filePath, fileBuffer, false);

      if (error) {
        console.error("Upload error:", error);
        return res.redirect("/items?error=Upload+failed");
      }
    }

    await db.updateItem(itemId, { status: "In-Use" });

    await db.addItemHistory(itemId, {
      userId,
      action: "checkout",
      duration: fields.duration?.[0] ?? null,
      referenceLink: filePath,
    });

    return res.redirect("/items?success=CHECKED+OUT+SUCCESSFULLY!");

  } catch (err) {
    next(err);
  }
};

exports.ShowCheckin = async (req, res, next) => {
  try {
    const db = getDbProvider();
    const currentUserId = req.user.id;

    const items = await db.getUserItems(currentUserId);

    res.render("checkout", {
      items
    });

  } catch (err) {
    next(err);
  }
};

exports.report = (req, res) => {
    res.render("report");
};

// ++++++++++ List-user page
exports.users = (req, res) => {
    // MOCK DATA
    res.render("users", { users });
};

// 404 handler 
exports.notFound = (req, res) => {
  res.status(404).render('extra_pages/404', {
    message: 'The page you are looking for does not exist.',
    pageTitle: "404"
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