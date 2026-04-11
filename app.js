const express = require('express')
const { engine } = require('express-handlebars')
require('dotenv').config()
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multiparty = require('multiparty');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 3000;

const app = express();

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
}))
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

const itemData = {
    categories: [
        { name: 'Computers', subCategories: []},
        { name: 'Peripherals', subCategories: []},
    ],
    //Fields: Item ID (Unique), Serial Number, Model, Brand, Category, Status (Available, In-Use, Maintenance, Retired), and Date Acquired.
    items: [
        { id: 1, name: 'item 1', serial: 'serial 1', model: 'model 1', brand: 'brand 1', category: 'Computers', status: 'Available', dateAcquired: '2022-01-01', description: 'item 1 description', imagePath: '/images/placeholder.jpg', imageAlt: 'item 1 image' },
        { id: 2, name: 'item 2', serial: 'serial 2', model: 'model 2', brand: 'brand 2', category: 'Computers', status: 'In-Use', dateAcquired: '2022-02-02', description: 'item 2 description', imagePath: '/images/placeholder.jpg', imageAlt: 'item 2 image' },
        { id: 3, name: 'item 3', serial: 'serial 3', model: 'model 3', brand: 'brand 3', category: 'Peripherals', status: 'Maintenance', dateAcquired: '2022-03-03', description: 'item 3 description', imagePath: '/images/placeholder.jpg', imageAlt: 'item 3 image' }
    ],
    itemHistories: [
        {
            id: 1,
            histories: [
                { assignee: 'assignee 1', duration: 'duration 1', referenceLink: 'reference link 1' }
            ]
        },
        {
            id: 2,
            histories: [
                { assignee: 'assignee 2', duration: 'duration 2', referenceLink: 'reference link 2' }
            ]
        },
        {
            id: 3,
            histories: [
                { assignee: 'assignee 3', duration: 'duration 3', referenceLink: 'reference link 3' }
            ]
        }
    ]
}

// routes
app.get('/items', (req, res) => {
    const { cat, q } = req.query

    let context = {
      categories: itemData.categories,
      items: itemData.items
    }

    if(itemData.categories.find(category => category.name === cat)) {
        context = {
            categories: itemData.categories,
            items: itemData.items.filter(item => item.category === cat)
        }
    }

    let searchedItem;
    if(q) {
      searchedItem = itemData.items.find(i => i.name.toLowerCase().includes(q.toLowerCase()));
    }

    if(searchedItem) {
      context = {
          ...context,
          items: [searchedItem],
      }
    }

    res.render('items', context)
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
          name,
          description,
          model,
          brand,
          category,
          imagePath: uploadedFilePath,
          imageAlt: `image of ${name}`,
          serial: randomUUID(),
          status: 'Available',
          dateAcquired: new Date(),
        };

        itemData.items.push(newItem);

        // Render result page with file information
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
  catch(error) {
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

    res.render('itemHistory', context)
})

app.get('/items/:id', (req, res) => {
    const { id } = req.params

    const context = itemData.items.find(item => String(item.id) === String(id))

    if (!context) {
        res.status(404)
        return res.render('404')
    }

    res.render('itemDetail', context)
})

app.get("/items/:id", (req, res) => {
  res.render("itemDetail");
});

app.get("/items/history", (req, res) => {
  res.render("itemHistory");
});

// ++++++++++ LOGIN, REGISTER & LOGOUT
app.get("/", (req, res) => {
  res.render("login", { layout: "no_nav_bar.handlebars" }); // landing page: login
});

app.get("/login", (req, res) => {
  res.render("login", { layout: "no_nav_bar.handlebars" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  console.log(email, password);

  // TODO: validate user (rn: anything is allowed)
  res.redirect("/home");
});

app.get("/register", (req, res) => {
  res.render("register", { layout: "no_nav_bar.handlebars" });
});

app.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  console.log(name, email, password);

  res.redirect("/login");
});

app.get("/logout", (req, res) => {
  res.render("login", { layout: "no_nav_bar.handlebars" });
});

// ++++++++++ List-user page
app.get("/users", (req, res) => {
  // MOCK DATA
  const users = [
    {
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      role: "Admin",
      status: "Active",
    },
    {
      id: 2,
      name: "Bob",
      email: "bob@example.com",
      role: "User",
      status: "Active",
    },
    {
      id: 3,
      name: "Charlie",
      email: "charlie@example.com",
      role: "User",
      status: "Disabled",
    },
    {
      id: 4,
      name: "Dave",
      email: "dave@example.com",
      role: "Admin",
      status: "Active",
    },
  ];

  res.render("users", { users, activePage: "users" });
});

// ++++++++++ Home (Dashboard for logged-in users)
app.get("/home", (req, res) => {
  // Mock data
  const dashboardData = {
    totalUsers: 12,
    totalItems: 34,
    pendingCheckouts: 5,
    recentTransactions: [
      {
        id: 1,
        user: "Alice",
        item: "Laptop",
        type: "Checkout",
        date: "2026-03-22",
      },
      {
        id: 2,
        user: "Bob",
        item: "Projector",
        type: "Checkout",
        date: "2026-03-21",
      },
      {
        id: 3,
        user: "Charlie",
        item: "Camera",
        type: "Check-in",
        date: "2026-03-21",
      },
      {
        id: 4,
        user: "Dave",
        item: "Tablet",
        type: "Checkout",
        date: "2026-03-20",
      },
    ],
  };

  res.render("home", { dashboardData, activePage: "home" });
});

// ++++++++++ Other routes
app.use((req, res, next) => {
  res.status(404);
  res.render("404");
});

app.use((error, req, res, next) => {
  res.status(500);
  res.render("500");
});

app.listen(PORT, () => {
  console.log(`Access via: http://localhost:${PORT}`);
});
