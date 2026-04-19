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
  const { cat, q } = req.query;

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


exports.addItem = (req, res) => {
    try {
        const form = new multiparty.Form();

        let uploadedFilePath = null;

        form.parse(req, (error, fields, files) => {
            if (error) {
                console.error('❌ Form parsing error:', err);
                return res.status(400).json({
                    type: 'error',
                    message: 'Error parsing the form. Please try again.',
                });
            }

            // extract fields
            const name = fields.name?.[0] ?? '';
            const description = fields.description?.[0] ?? '';
            const brand = fields.brand?.[0] ?? '';
            const model = fields.model?.[0] ?? '';
            const category = fields.category?.[0] ?? '';
            const serial = fields.serial?.[0] ?? '';
            const status = fields.status?.[0] ?? '';
            const dateAcquired = fields.dateAcquired?.[0] ?? new Date();

            // extract file
            const uploadedFile = files.image ? files.image : null;

            if (!uploadedFile || uploadedFile.length === 0) {
                console.warn('⚠️  No file was selected for upload');
                console.debug('📊 Debug - files object:', Object.keys(files));
                return res.status(400).json({
                    type: 'error',
                    message: 'No file was selected. Please choose an image file.',
                });
            }

            const file = uploadedFile[0];
            const originalFileName = file.originalFilename;
            const tempFilePath = file.path;

            const allowedExtensions = ['.jpg', '.jpeg', '.png'];
            const fileExtension = path.extname(originalFileName).toLowerCase();

            if (!allowedExtensions.includes(fileExtension)) {
                console.warn(`⚠️  Invalid file type: ${fileExtension}`);
                // Clean up the temporary file
                fs.unlinkSync(tempFilePath);
                return res.status(400).json({
                    type: 'error',
                    message: `Invalid file type. Only ${allowedExtensions.join(', ')} are allowed.`,
                });
            }

            const timestamp = Date.now();
            const fileName = `${timestamp}_${originalFileName}`;
            const uploadsDir = path.join(__dirname, "../public/images");

            try {
                fs.copyFileSync(tempFilePath, finalFilePath);
                // Delete the temporary file
                fs.unlinkSync(tempFilePath);

                // Store the relative path for the view template
                // This will be used to display the image in the result page
                uploadedFilePath = `/images/${fileName}`;

                console.log('✓ File Upload Successful:');
                console.log(`   Original Filename: ${originalFileName}`);
                console.log(`   Saved As: ${fileName}`);
                console.log(`   Path: ${finalFilePath}`);

                // add new item (replace with db)
                const newItem = {
                    id: itemData.items.length + 1,
                    name,
                    description,
                    model,
                    brand,
                    category,
                    imagePath: uploadedFilePath,
                    imageAlt: `image of ${name}`,
                    serial,
                    status,
                    dateAcquired,
                };

                itemData.items.push(newItem);

                res.redirect('/items');
            } catch (fsError) {
                console.error('❌ File system error:', fsError);
                // Clean up temp file if copy failed
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
                res.status(500).json({
                    type: 'error',
                    message: 'Error saving the file. Please try again.',
                });
            }
        })
    }
    catch (error) {
        console.error('❌ Error in /items:', error);
        res.status(500).json({
            type: 'error',
            message: 'An error occurred while processing your file upload.',
        });
    }
}

exports.showItemDetail = (req, res) => {
    const { id } = req.params;
    const { edit, del } = req.query;

    let context = itemData.items.find(item => String(item.id) === String(id))
    context = {
        ...context,
        categories: itemData.categories,
        statuses: itemData.statuses,
        isEdit: false,
        isDelete: false
    }

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

    res.render('items/itemDetail', context)
};

exports.editItem = (req, res) => {
    const { id } = req.params;

    try {
        const form = new multiparty.Form();

        let uploadedFilePath = null;

        form.parse(req, (error, fields, files) => {
            if (error) {
                console.error('❌ Form parsing error:', error);
                return res.status(400).json({
                    type: 'error',
                    message: 'Error parsing the form. Please try again.',
                });
            }

            // extract fields
            const name = fields.name?.[0] ?? '';
            const description = fields.description?.[0] ?? '';
            const brand = fields.brand?.[0] ?? '';
            const model = fields.model?.[0] ?? '';
            const category = fields.category?.[0] ?? '';
            const serial = fields.serial?.[0] ?? '';
            const status = fields.status?.[0] ?? '';
            const dateAcquired = fields.dateAcquired?.[0] ?? '';

            // extract file
            const uploadedFile = files.image ? files.image : null;

            if (!uploadedFile || uploadedFile.length === 0) {
                console.warn('⚠️  No file was selected for upload');
                console.debug('📊 Debug - files object:', Object.keys(files));
                return res.status(400).json({
                    type: 'error',
                    message: 'No file was selected. Please choose an image file.',
                });
            }

            const file = uploadedFile[0];
            const originalFileName = file.originalFilename;
            const tempFilePath = file.path;

            const allowedExtensions = ['.jpg', '.jpeg', '.png'];
            const fileExtension = path.extname(originalFileName).toLowerCase();

            if (!allowedExtensions.includes(fileExtension)) {
                console.warn(`⚠️  Invalid file type: ${fileExtension}`);
                // Clean up the temporary file
                fs.unlinkSync(tempFilePath);
                return res.status(400).json({
                    type: 'error',
                    message: `Invalid file type. Only ${allowedExtensions.join(', ')} are allowed.`,
                });
            }

            const timestamp = Date.now();
            const fileName = `${timestamp}_${originalFileName}`;
            const finalFilePath = path.join(uploadsDir, fileName);

            try {
                fs.copyFileSync(tempFilePath, finalFilePath);
                // Delete the temporary file
                fs.unlinkSync(tempFilePath);

                // Store the relative path for the view template
                // This will be used to display the image in the result page
                uploadedFilePath = `/images/${fileName}`;

                console.log('✓ File Upload Successful:');
                console.log(`   Original Filename: ${originalFileName}`);
                console.log(`   Saved As: ${fileName}`);
                console.log(`   Path: ${finalFilePath}`);

                const indexOfOld = itemData.items.findIndex(item => String(item.id) === String(id));
                // replace with new item (replace with db)
                itemData.items[indexOfOld] = {
                    ...itemData.items[indexOfOld],
                    name,
                    description,
                    model,
                    brand,
                    category,
                    imagePath: uploadedFilePath,
                    imageAlt: `image of ${name}`,
                    serial,
                    status,
                    dateAcquired,
                };

                // Render result page with file information
                return res.json({
                    success: true,
                    redirect: `/items/${id}`
                });
            } catch (fsError) {
                console.error('❌ File system error:', fsError);
                // Clean up temp file if copy failed
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
                res.status(500).json({
                    type: 'error',
                    message: 'Error saving the file. Please try again.',
                });
            }
        })
    }
    catch (error) {
        console.error('❌ Error in /items:', error);
        res.status(500).json({
            type: 'error',
            message: 'An error occurred while processing your file upload.',
        });
    }
}

exports.deleteItem = (req, res) => {
    const { id } = req.params;
    const indexOfOld = itemData.items.findIndex(item => String(item.id) === String(id));
    itemData.items.splice(indexOfOld, 1);
    return res.json({
        type: 'success',
        redirect: '/items'
    })
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

      await db.uploadFile(filePath, fileBuffer);

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

      await db.uploadFile(filePath, fileBuffer);

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