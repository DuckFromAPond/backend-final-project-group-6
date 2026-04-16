
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
    const { cat, q } = req.query

    let context = {
        categories: itemData.categories,
        items: itemData.items,
        statuses: itemData.statuses
    }

    if (itemData.categories.find(category => category.name === cat)) {
        context = {
            ...context,
            categories: itemData.categories,
            items: itemData.items.filter(item => item.category === cat)
        }
    }

    let searchedItem;
    if (q) {
        searchedItem = itemData.items.find(i => i.name.toLowerCase().includes(q.toLowerCase()));
    }

    if (searchedItem) {
        context = {
            ...context,
            items: [searchedItem],
        }
    }

    res.render('items/items', { ...context, activePage: "items" })
}

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