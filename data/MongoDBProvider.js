const mongoose = require("mongoose");
const crypto = require("crypto");
const { GridFSBucket } = require("mongodb");
const bcryptjs = require("bcryptjs");
const DatabaseProvider = require("./databaseProvider");
const config = require("../config/app.config");

const User = require("./models/mongoUserModel");
const Item = require("./models/mongoItemsModel");
const ItemHistory = require("./models/mongoItemHistoriesModel");
const ApiKey = require("./models/mongoAPIkeysModel");

class MongoProvider extends DatabaseProvider {
  constructor() {
    super();
    this.providerKey = "mongodb";
    this.providerLabel = "MongoDB";
    this.bucket = null;
  }

  async connect() {
    const uri = process.env.MONGO_URI;

    if (!uri) {
      throw new Error("Missing MONGO_URI");
    }

    try {
      await mongoose.connect(uri, {
        dbName: "inventory_db",
      });

      // GridFS bucket
      this.itemsBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: "items",
      });

      this.docsBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: "docs",
      });

      await this.initializeDatabase();
      console.log("Connected to MongoDB:", mongoose.connection.name);
    } catch (error) {
      console.error("MongoDB connection error:", error);
      throw error;
    }
  }

  async initializeDatabase() {
    await Promise.all([
      User.init(),
      Item.init(),
      ItemHistory.init(),
      ApiKey.init(),
    ]);

    console.log("MongoDB initialized");
  }

  normalizeEmail(email) {
    return String(email).trim().toLowerCase();
  }

  mapUser(user) {
    if (!user) return null;

    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      passwordHash: user.passwordHash,
      disabledAt: user.disabledAt,
    };
  }

  mapItem(item) {
    if (!item) return null;

    return {
      id: String(item._id),
      name: item.name,
      serial: item.serial,
      model: item.model,
      brand: item.brand,
      category: item.category,
      subCategory: item.subCategory,
      status: item.status,
      description: item.description,
      dateAcquired: item.dateAcquired,
      currentOwner: item.currentOwner,
      imageName: item.imageName,
      imageAlt: item.imageAlt
    };
  }

  mapApiKey(key) {
    if (!key) return null;

    return {
      id: String(key._id),
      name: key.name,
      adminId: String(key.adminId),
      key: key.key, // remove this if showing in UI
      revoked: key.revoked,
      createdAt: key.createdAt,
    };
  }

  mapItemHistory(history) {
    if (!history) return null;

    return {
      id: String(history._id),
      itemId: String(history.itemId),
      userId: String(history.userId),
      action: history.action, // checkout / checkin
      duration: history.duration || null,
      referenceLink: history.referenceLink || null,
      createdAt: history.createdAt,
    };
  }

  getImageStream(fileId) {
    return this.itemsBucket.openDownloadStream(
      new mongoose.Types.ObjectId(fileId),
    );
  }

  getDocumentStream(fileId) {
    return this.docsBucket.openDownloadStream(
      new mongoose.Types.ObjectId(fileId),
    );
  }

  getLatestCheckoutRows(rows, getItemId) {
    const latestMap = new Map();

    for (const row of rows) {
      const itemId = getItemId(row);
      if (!itemId) continue;

      if (!latestMap.has(itemId)) {
        latestMap.set(itemId, row);
      }
    }

    return [...latestMap.values()].filter((r) => r.action === "checkout");
  }

  getImageUrl(fileId) {
    if (!fileId) return null;

    return `${config.BASE_URL}/files/items/${fileId}`;
  }

  getDocumentUrl(fileId) {
    if (!fileId) return null;

    return `${config.BASE_URL}/files/docs/${fileId}`;
  }
  

	// ===== USER =====
  async registerUser(email, password, name, role) {
    const existingAdmin = await User.findOne({
      role: "Admin",
      status: "Active",
    });
    let roleToAssign = existingAdmin ? "Technician" : "Admin";
    const normalizedEmail = this.normalizeEmail(email);

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) throw new Error("Email already exists");

    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash: passwordHash,
      name: name,
      role: roleToAssign,
      status: "Active",
      disabledAt: null,
    });

    return this.mapUser(user.toObject());
  }

  async findUserByEmail(email) {
    const user = await User.findOne({
      email: this.normalizeEmail(email),
    }).lean();

    return this.mapUser(user);
  }

  async verifyPassword(password, hash) {
    return bcryptjs.compare(password, hash);
  }

  async getUserById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null; // or throw new Error("Invalid user id");
    }

    const user = await User.findById(id).lean();
    return this.mapUser(user);
  }

  async updateUser(userId, updates) {
    const user = await User.findByIdAndUpdate(userId, updates, { new: true });

    // business rule: revoke API keys
    if (user.status === "Disabled") {
      await ApiKey.updateMany({ adminId: userId }, { revoked: true });
    }

    return this.mapUser(user.toObject());
  }

  async revokeOwnedApiKeys(userId) {    // for business rule to remove all owned by a disabled acc
    await ApiKey.updateMany({ admin_id: userId }, { revoked: true });
  }

  async getAllUsers() {
    const users = await User.find().lean();
    return users.map((u) => this.mapUser(u));
  }

  async hasActiveAdmin() {
    const admin = await User.findOne({
      role: "Admin",
      status: "Active"
    }).lean();

    return !!admin;
  }

  async findActiveCheckout(itemId) {
    return await ItemHistory.findOne({
      itemId:itemId,
      action: "checkout",
      returnedAt: null
    })
      .sort({ created_at: -1 })
      .lean();
  }


  
	// ===== ITEMS =====
  async getItems() {
    const items = await Item.find().lean();
    return items.map(i => ({...this.mapItem(i), imageUrl: this.getImageUrl(i.imageName)}));
  }

  async getItemById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const item = await Item.findById(id).lean();
    if (!item) return null;

    return {
      ...this.mapItem(item),
      imageUrl: this.getImageUrl(item.imageName),
    };
  }

  async getItemBySerial(serial) {
  const item = await Item.findOne({ serial }).lean();

  if (!item) return null;

  return {
    ...this.mapItem(item),
    imageUrl: this.getImageUrl(item.imageName),
  };
}

  async createItem(data) {
    const item = await Item.create(data);
    return this.mapItem(item.toObject());
  }

  async updateItem(id, data) {
    const item = await Item.findByIdAndUpdate(id, data, { new: true }).lean();
    return this.mapItem(item);
  }

  async setItemStatus(id, status) {
    const item = await Item.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    ).lean();

    return this.mapItem(item);
  }

  // ===== HISTORY =====
  async getItemHistories() {
    const histories = await ItemHistory.find().sort({ createdAt: -1 }).lean();

    return histories.map((h) => this.mapItemHistory(h));
  }

  async getItemHistoryByItemId(itemId) {
    const histories = await ItemHistory.find({ itemId: itemId })
      .sort({ createdAt: -1 })
      .lean();

    return histories.map((h) => this.mapItemHistory(h));
  }

  async addItemHistory(itemId, data) {
    const history = await ItemHistory.create({
      itemId: itemId,
      userId: data.userId,
      action: data.action,
      duration: data.duration ?? null,
      referenceLink: data.referenceLink ?? null,
      createdAt: new Date(),
    });

    return this.mapItemHistory(history.toObject());
  }

  async getUserItems(userId) {
    const items = await Item.find({ currentOwner: userId }).lean();

    const itemIds = items.map(i => i._id);

    const histories = await ItemHistory.find({
      itemId: { $in: itemIds }
    })
      .sort({ createdAt: -1 })
      .lean();

    const latest = this.getLatestCheckoutRows(histories, (r) =>
      r.itemId?._id?.toString(),
    );

    return latest.map((r) => ({
      id: r._id.toString(),
      userId: r.userId.toString(),
      itemId: r.itemId._id.toString(),
      action: r.action,
      duration: r.duration,
      createdAt: r.createdAt,

      referenceUrl: r.referenceLink ?? null,

      item: {
        id: r.itemId._id.toString(),
        name: r.itemId.name,
        serial: r.itemId.serial,
        model: r.itemId.model,
        brand: r.itemId.brand,
        category: r.itemId.category,
        sub_category: r.itemId.sub_category,
        status: r.itemId.status,
        description: r.itemId.description,
        dateAcquired: r.itemId.date_acquired,
        imageAlt: r.itemId.image_alt,
        imageUrl: this.getImageUrl(r.itemId.image_name),
      },
    }));
  }

  async updateUserItem(itemId, targetUserId, adminId, action, options = {}) {
    const item = await Item.findById(itemId);
    if (!item) throw new Error("Item not found");

    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "Admin") {
      throw new Error("Unauthorized");
    }

    if (!["checkout", "checkin"].includes(action)) {
      throw new Error("Invalid action");
    }

    // business rule check (same as normal flow)
    if (action === "checkout") {
      const existing = await ItemHistory.findOne({
        itemId,
        returnedAt: null,
      });

      if (existing) {
        if (existing.userId.toString() === targetUserId.toString()) {
          throw new Error("User already owns this item");
        }

        throw new Error("Item is already checked out");
      }
    }

    const history = await ItemHistory.create({
      itemId,
      userId: targetUserId,
      action,
      duration: options.duration ?? null,
      referenceLink: options.referenceLink ?? null,
      createdAt: new Date(),
      returnedAt: action === "checkin" ? new Date() : null,
    });

    // sync item status (same logic as normal flow)
    await this.setItemStatus(
      itemId,
      action === "checkout" ? "In-Use" : "Available",
    );

    return history;
  }

  // =========================
  // API KEYS
  // =========================

  async createApiKey(adminId, data) {
    const keyValue = crypto.randomBytes(32).toString("hex");

    const apiKey = await ApiKey.create({
      key: keyValue,
      name: data?.name ?? null,
      adminId: adminId,
      revoked: false,
      createdAt: new Date(),
    });

    return apiKey;
  }

  async getApiKeys() {
    return ApiKey.find().sort({ createdAt: -1 }).lean();
  }

  async getApiKeyByKey(key) {
    return ApiKey.findOne({ key, revoked: false }).lean();
  }

  async revokeApiKey(adminId, id) {
    const admin = await User.findById(adminId);

    // ----------------------------------------------------- move this check to service later
    if (!admin || admin.role !== "Admin") {
      throw new Error("Only admins can revoke keys");
    }

    return ApiKey.findByIdAndUpdate(id, { revoked: true }, { new: true });
  }

  // GRIDFS FILE UPLOAD
  async uploadItem(filename, buffer) {
    return new Promise((resolve, reject) => {
      const uploadStream = this.itemsBucket.openUploadStream(filename);

      uploadStream.end(buffer);

      uploadStream.on("finish", () => {
        resolve(uploadStream.id.toString()); // store this in DB
      });

      uploadStream.on("error", reject);
    });
  }

  async uploadFile(filename, buffer) {
    return new Promise((resolve, reject) => {
      const uploadStream = this.docsBucket.openUploadStream(filename);

      uploadStream.end(buffer);

      uploadStream.on("finish", () => {
        resolve(uploadStream.id.toString());
      });

      uploadStream.on("error", reject);
    });
  }
}

module.exports = MongoProvider;
