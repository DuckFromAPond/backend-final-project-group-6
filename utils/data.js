// ============= ITEM ===========

//Fields: Item ID (Unique), Serial Number, Model, Brand, Category, Status (Available, In-Use, Maintenance, Retired), and Date Acquired.
const items = [
  {
    id: 1,
    name: "item 1",
    serial: "serial 1",
    model: "model 1",
    brand: "brand 1",
    category: "Computers",
    status: "Available",
    dateAcquired: "2022-01-01",
    description: "item 1 description",
    imagePath: "/images/placeholder.jpg",
    imageAlt: "item 1 image",
  },
  {
    id: 2,
    name: "item 2",
    serial: "serial 2",
    model: "model 2",
    brand: "brand 2",
    category: "Computers",
    status: "In-Use",
    dateAcquired: "2022-02-02",
    description: "item 2 description",
    imagePath: "/images/placeholder.jpg",
    imageAlt: "item 2 image",
  },
  {
    id: 3,
    name: "item 3",
    serial: "serial 3",
    model: "model 3",
    brand: "brand 3",
    category: "Peripherals",
    status: "Maintenance",
    dateAcquired: "2022-03-03",
    description: "item 3 description",
    imagePath: "/images/placeholder.jpg",
    imageAlt: "item 3 image",
  },
];

const itemHistories = [
  {
    id: 1,
    histories: [
      {
        assignee: "assignee 1",
        duration: "duration 1",
        referenceLink: "reference link 1",
      },
    ],
  },
  {
    id: 2,
    histories: [
      {
        assignee: "assignee 2",
        duration: "duration 2",
        referenceLink: "reference link 2",
      },
    ],
  },
  {
    id: 3,
    histories: [
      {
        assignee: "assignee 3",
        duration: "duration 3",
        referenceLink: "reference link 3",
      },
    ],
  },
];

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

// ============== EXPORT

module.exports = {
  users, // Now exporting users
  items, // Now exporting items
  itemHistories, // Now exporting histories
  dashboardData,
};
