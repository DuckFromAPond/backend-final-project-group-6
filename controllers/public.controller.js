
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
      const user = userMap.find(u => u.id === h.userId);
      const item = itemMap.find(i => i.id === h.itemId);

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
    }
  });
};

exports.showItems = async (req, res) => {
  const db = getDbProvider();

  const { cat } = req.query;

  const items = await db.getItems();

  // derive categories from items
  const categories = [
    ...new Set(items.map(item => item.category))
  ].map(name => ({ name }));

  let filteredItems = items;

  if (cat) {
    filteredItems = items.filter(item => item.category === cat);
  }

  // console.log("FINAL ITEMS:", filteredItems);

  res.render("items/items", {
    categories,
    items: filteredItems 
  });
};

exports.showHistory = (req, res) => {
  res.render("items/itemHistory");
};

exports.showItemDetail = (req, res) => {
  const { id } = req.params;

  const context = itemData.items.find((item) => String(item.id) === String(id));

  if (!context) {
    res.status(404);
    return res.render("404");
  }

  res.render("items/itemDetail", context);
};

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

exports.checkout = (req, res) => {
  // GONNA START BY ASSUMING YOU ARE ID 1
  const currentUserId = 1; // replace with actual logged-in user

  const currentlyOwnedItems = itemData.items
    .map((item) => {
      const history = itemData.itemHistories.find((h) => h.id === item.id);
      const lastAssignment =
        history?.histories[history.histories.length - 1] || null;

      return {
        id: item.id,
        name: item.name,
        // serial: item.serial,
        // model: item.model,
        // brand: item.brand,
        // category: item.category,
        status: item.status,
        dateAcquired: item.dateAcquired,
        // description: item.description,
        // imagePath: item.imagePath,
        // imageAlt: item.imageAlt,
        currentAssignee: lastAssignment?.assignee || null,
        currentAssigneeID: lastAssignment?.user_id || null,
        currentDuration: lastAssignment?.duration || null,
        currentReference: lastAssignment?.referenceLink || null,
      };
    })
    .filter((item) => item.currentAssigneeID === currentUserId); // only keep items assigned to current user

  // console.log(currentlyOwnedItems);
  res.render("checkout", {
    items: currentlyOwnedItems,
  });
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