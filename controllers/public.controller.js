
const { verifyToken } = require("../middleware/authMiddleware");
const { items, itemHistories, users, dashboardData } = require('../data/data');

// temp temp data 
const itemData = {
  categories: [
    { name: "Computers", subCategories: [] },
    { name: "Peripherals", subCategories: [] },
  ],
  //Fields: Item ID (Unique), Serial Number, Model, Brand, Category, Status (Available, In-Use, Maintenance, Retired), and Date Acquired.
  items: items, // Use the imported items here
  itemHistories: itemHistories,
};


exports.home = (req, res) => {
  res.render("home", { dashboardData });
};

exports.showItems = (req, res) => {
  const { cat } = req.query;

  let context = itemData;

  if (itemData.categories.find((category) => category.name === cat)) {
    context = {
      categories: itemData.categories,
      items: itemData.items.filter((item) => item.category === cat),
    };
  }

  res.render("items/items", { ...context, activePage: "items" }); // idk; i think it helps with nav rendering
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

  console.log(currentlyOwnedItems);
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