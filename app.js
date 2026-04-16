const express = require("express");
const { engine } = require("express-handlebars");
const cookieParser = require("cookie-parser");
const { generateToken } = require("./lib/auth");
const { protect } = require("./middleware/authMiddleware");
const { verifyToken } = require("./lib/auth");
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multiparty = require('multiparty');
const { randomUUID } = require('crypto');
require("dotenv").config();

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cookieParser());

// configurations for app
app.engine(
    "handlebars",
    engine({
        defaultLayout: "main",
        partialsDir: __dirname + "/views/partials",
        helpers: {
            section: function (name, options) {
                if (!this._sections) this._sections = {}
                this._sections[name] = options.fn(this)
                return null
            },
            ifContains: function (container, stringToFind, options) {
                if (container && container.includes(stringToFind)) {
                    return options.fn(this)
                }
                return options.inverse(this)
            },
            isActive: function (page, currentPage, options) {
                return page === currentPage
                    ? "text-blue-500 font-semibold"
                    : "text-gray-700 hover:text-blue-500";
            },
        }
    })
)
app.set('view engine', 'handlebars')
app.set('views', __dirname + '/views')

// middleware
app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true })); // for forms (login/register)

// Rate limiting configuration
option = {
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: 20, // limit each IP to 20 requests
    standardHeaders: false, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 1 minutes'
}
app.use(rateLimit(option));

// CORS configuration
const whitelist = [
    `http://localhost:${PORT}`,
];
const corsOptions = {
    origin: (origin, callback) => {
        // !origin allows server-to-server or tools like Postman/Curl
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};
app.use(cors(corsOptions));

// Morgan logging
app.use(morgan('dev'));

// replace this for db + bucket
const uploadsDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`✓ Created uploads directory at ${uploadsDir}`);
}

const { items, itemHistories } = require("./lib/data.js"); // import
const itemData = {
    categories: [
        { name: 'Computers', subCategories: [] },
        { name: 'Peripherals', subCategories: [] },
    ],
    statuses: [
        { name: 'Available' },
        { name: 'In-Use' },
        { name: 'Maintenance' },
        { name: 'Retired' },
    ],
    items: items,
    itemHistories: itemHistories
}

// ++++++++++ LOGIN, REGISTER & LOGOUT
app.get("/", (req, res) => {
    const token = req.cookies.accessToken;
    const user = verifyToken(token);

    if (user) {
        return res.redirect("/home"); // if logged in, redirect to home
    }

    res.render("auth/login", { layout: "no_nav_bar.handlebars" });
});

app.get("/login", (req, res) => {
    const token = req.cookies.accessToken;
    const user = verifyToken(token);

    if (user) {
        return res.redirect("/home");
    }

    const errorMsg = req.query.error;

    res.render("auth/login", {
        layout: "no_nav_bar.handlebars",
        error: errorMsg,
    });
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    const { users } = require("./lib/data.js");

    // 1. Find user
    const user = users.find((u) => u.email === email);

    // 2. Validate (In future, use bcrypt to compare hashed password)
    if (user && password === "12345678") {
        // Temporary hardcoded check
        const token = generateToken(user);

        // 3. Set cookie
        res.cookie("accessToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 1000 * 3600, // 1 hour
        });

        return res.redirect("/home");
    }

    res.render("auth/login", {
        layout: "no_nav_bar.handlebars",
        error: "Invalid email or password",
    });
});

app.get("/register", (req, res) => {
    res.render("auth/register", { layout: "no_nav_bar.handlebars" });
});

app.post("/register", (req, res) => {
    const { name, email, password } = req.body;
    console.log(name, email, password);

    res.redirect("/login");
});
// login-required pages
app.use(protect);

// items routes
app.get('/items', (req, res) => {
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

    res.render('items/items', context)
})

app.post('/items', (req, res) => {
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
})

app.get('/items/:id/history', (req, res) => {
    const { id } = req.params

    const context = {
        item: itemData.items.find(item => String(item.id) === String(id)),
        itemHistories: itemData.itemHistories.find(item => String(item.id) === String(id))
    }

    res.render('items/itemHistory', context)
})

app.get('/items/:id', (req, res) => {
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
})

app.put('/items/:id', (req, res) => {
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
})

app.delete('/items/:id', (req, res) => {
    const { id } = req.params;
    const indexOfOld = itemData.items.findIndex(item => String(item.id) === String(id));
    itemData.items.splice(indexOfOld, 1);
    return res.json({
        type: 'success',
        redirect: '/items'
    })
})
// end of items routes

app.get("/checkin", (req, res) => {
    res.render("checkin");
});

app.get("/checkout", (req, res) => {
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
        activePage: "checkout",
    });
});

// ++++++++++ LOGIN, REGISTER & LOGOUT
app.get("/logout", (req, res) => {
    res.clearCookie("accessToken");
    res.redirect("/");
});

// ++++++++++ List-user page
app.get("/users", (req, res) => {
    // MOCK DATA
    const { users } = require("./lib/data.js");
    res.render("users", { users, activePage: "users" });
});

// ++++++++++ Home (Dashboard for logged-in users)
app.get("/home", (req, res) => {
    // Mock data
    const { dashboardData } = require("./lib/data.js"); // import
    res.render("home", { dashboardData, activePage: "home" });
});

// middle-ware to render 404 (bad)
app.use((req, res, next) => {
    const publicRoutes = ["/", "/login", "/register"];
    // If it's a known public route, let it pass to the gate or routes
    if (publicRoutes.includes(req.path)) {
        return next();
    }
    // Otherwise, it's a dead end—render 404 now!
    res.status(404).render("extra_pages/404", { layout: "no_nav_bar" });
});

// ++++++++++ Other routes
app.use((error, req, res, next) => {
    res.status(500);
    res.render("extra_pages/500");
});

app.listen(PORT, () => {
    console.log(`Access via: http://localhost:${PORT}`);
});
