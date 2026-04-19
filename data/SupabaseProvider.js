const bcryptjs = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
const DatabaseProvider = require("./databaseProvider");
const {
	SUPABASE_TABLES,
	mapUserRowToModel,
	mapItemRowToModel,
	mapItemHistoryRowToModel,
	mapApiKeyRowToModel,
} = require("./models/supabaseModels");

console.log("TABLES LOADED:", SUPABASE_TABLES);

class SupabaseProvider extends DatabaseProvider {
	constructor() {
		super();
		this.providerKey = "supabase";
		this.providerLabel = "Supabase";
		this.supabase = null;
	}
	
	async connect() {
		const url = process.env.SUPABASE_URL;
		const key =
			process.env.SUPABASE_SERVICE_ROLE_KEY ||
			process.env.SUPABASE_KEY ||
			process.env.SUPABASE_ANON_KEY;

		if (!url || !key) {
			throw new Error(
				"Missing required environment variables: SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY, SUPABASE_KEY, SUPABASE_ANON_KEY"
			);
		}

		try {
			this.supabase = createClient(url, key);

			// Test connection and initialize database
			await this.initializeDatabase();
			console.log("Connected to Supabase");
		} catch (error) {
			console.error("Supabase connection error:", error);
			throw error;
		}
	}

	normalizeEmail(email) {
		return String(email).trim().toLowerCase();
	}

	toSupabaseId(value) {
		if (typeof value === "number") {
			return value;
		}

		const asString = String(value).trim();
		if (/^\d+$/.test(asString)) {
			return Number(asString);
		}

		return asString;
	}

	getImageUrl(filePath) {
		if (!filePath) return null;

		const { data } = this.supabase.storage
			.from("items-bucket") 
			.getPublicUrl(filePath);

		return data.publicUrl;
	}

	getReferenceUrl(filePath) {
		if (!filePath) return null;

		const { data } = this.supabase.storage
			.from("docs-bucket") 
			.getPublicUrl(filePath);

		return data.publicUrl;
	}

	async initializeDatabase() {
		// USERS
		const { error: userError } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.select("id")
			.limit(1);

		if (userError) throw new Error("Users table missing or not accessible");

		// ITEMS
		const { error: itemError } = await this.supabase
			.from(SUPABASE_TABLES.ITEMS)
			.select("id")
			.limit(1);

		if (itemError) throw new Error("Items table missing or not accessible");

		// ITEM HISTORY
		const { error: historyError } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.select("id")
			.limit(1);

		if (historyError) throw new Error("Item histories table missing");

		// API KEYS
		const { error: apiError } = await this.supabase
			.from(SUPABASE_TABLES.API_KEYS)
			.select("id")
			.limit(1);

		if (apiError) throw new Error("API keys table missing");
	}

	// ===== USER AUTHENTICATION =====
	async registerUser(email, password) {
		const normalizedEmail = this.normalizeEmail(email);

		const { data: existingUser } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.select("id")
			.eq("email", normalizedEmail)
			.maybeSingle();

		if (existingUser) {
			throw new Error("Email already exists");
		}

		const salt = await bcryptjs.genSalt(10);
		const passwordHash = await bcryptjs.hash(password, salt);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.insert([{
			email: normalizedEmail,
			password_hash: passwordHash,
			name: email.split("@")[0],
			role: "Admin",
			status: "Active"
			}])
			.select("id, email, name, role, status, created_at")
			.single();

		if (error) throw error;

		return mapUserRowToModel(data);
	}

	async findUserByEmail(email) {
		const normalizedEmail = this.normalizeEmail(email);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.select("id, email, role, password_hash, name, status, created_at")
			.eq("email", normalizedEmail)
			.maybeSingle();

		if (error) throw error;
		if (!data) return null;

		return {
			...mapUserRowToModel(data),
			passwordHash: data.password_hash
		};
	}

	async verifyPassword(password, hash) {
		return await bcryptjs.compare(password, hash);
	}
	
	async getUserById(userId) {
		const normalizedUserId = this.toSupabaseId(userId);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.select("id, email")
			.eq("id", normalizedUserId)
			.single();

		if (error && error.code === "PGRST116") {
			return null;
		}

		if (error) {
			throw error;
		}

		return mapUserRowToModel(data);
	}

	async updateUser(userId, updates) {
		const normalizedUserId = this.toSupabaseId(userId);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.update(updates)
			.eq("id", normalizedUserId)
			.select("id, email")
			.single();

		if (error) {
			throw error;
		}

		return mapUserRowToModel(data);
	}

	async getAllUsers () {		
		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.select("*");

		if (error) throw error;

		return data.map(mapUserRowToModel);
	}



	// ===== ITEMS =====
	async getItems() {
		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEMS)
			.select("*");

		if (error) {
			throw error;
		}

		return data.map((item) => {
			const mapped = mapItemRowToModel(item);

			return {
				...mapped,
				imageUrl: this.getImageUrl(item.image_name),
			};
		});
	}

	async getItemById(id) {
		const normalizedId = this.toSupabaseId(id);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEMS)
			.select("*")
			.eq("id", normalizedId)
			.single();

		if (error && error.code === "PGRST116") {
			return null;
		}

		if (error) {
			throw error;
		}

		const mapped = mapItemRowToModel(data);

		return {
			...mapped,
			imageUrl: this.getImageUrl(data.image_name),
		};
	}

	async createItem(data) {
		const { data: inserted, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEMS)
			.insert([data])
			.select()
			.single();

		if (error) {
			throw error;
		}

		return {
			...mapItemRowToModel(inserted),
			imageUrl: this.getImageUrl(inserted.image_name),
		};
	}

	async updateItem(id, data) {
		const normalizedId = this.toSupabaseId(id);

		const { data: updated, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEMS)
			.update(data)
			.eq("id", normalizedId)
			.select()
			.single();

		if (error && error.code === "PGRST116") {
			return null;
		}

		if (error) {
			throw error;
		}

		return {
			...mapItemRowToModel(updated),
			imageUrl: this.getImageUrl(updated.image_name),
		};
	}

	async deleteItem(id) {
		const normalizedId = this.toSupabaseId(id);

		const { error } = await this.supabase
			.from(SUPABASE_TABLES.ITEMS)
			.delete()
			.eq("id", normalizedId);

		if (error) {
			throw error;
		}

		return true;
	}

	// ===== HISTORY =====
	async getItemHistories() {
		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.select("*")
			.order("created_at", { ascending: false });

		if (error) throw error;

		return data.map(row => ({
			...mapItemHistoryRowToModel(row),
			referenceUrl: this.getReferenceUrl(row.reference_link)
		}));
	}
	
	async getItemHistoryByItemId(itemId) {
		const normalizedId = this.toSupabaseId(itemId);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.select("*")
			.eq("item_id", normalizedId)
			.order("created_at", { ascending: false });

		if (error) throw error;

		return data.map(row => ({
			...mapItemHistoryRowToModel(row),
			referenceUrl: this.getReferenceUrl(row.reference_link)
		}));
	}

	async addItemHistory(itemId, data) {
		const payload = {
			item_id: this.toSupabaseId(itemId),
			user_id: this.toSupabaseId(data.userId),
			action: data.action,
			reference_link: data.referenceLink ?? null,
			created_at: new Date()
		};

		const { data: inserted, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.insert([payload])
			.select()
			.single();

		if (error) throw error;

		return mapItemHistoryRowToModel(inserted);
	}



	async getUserItems(userId) {
		const normalizedUserId = this.toSupabaseId(userId);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.select(`
			id,
			user_id,
			item_id,
			duration,
			action,
			created_at,
			reference_link,
			items!inner(id, name, serial, model, brand, category, status, date_acquired, image_name)
			`)
			.eq("user_id", normalizedUserId)
			.order("created_at", { ascending: false });

		if (error) throw error;

		// get latest per item
		const latestMap = new Map();

		for (const row of data) {
			if (!latestMap.has(row.item_id)) {
			latestMap.set(row.item_id, row);
			}
		}

		// only keep items still checked out
		const activeItems = [...latestMap.values()].filter(
			row => row.action === "checkout"
		);

		return activeItems.map(row => ({
			id: row.id,
			userId: row.user_id,
			itemId: row.item_id,
			duration: row.duration,
			createdAt: row.created_at,
			referenceUrl: this.getReferenceUrl(row.reference_link),

			item: {
			...mapItemRowToModel(row.items),
			imageUrl: this.getImageUrl(row.items.image_name),
			}
		}));
	}

	async UpdateItemHistory(itemId, userId, action, options = {}) {				// admin
		const normalizedItemId = this.toSupabaseId(itemId);
		const normalizedUserId = this.toSupabaseId(userId);

		// validate action
		if (!["checkout", "checkin"].includes(action)) {
			throw new Error("Invalid action type");
		}

		// enforce rules
		if (action === "checkout") {
			const { data: existing, error: checkError } = await this.supabase
				.from(SUPABASE_TABLES.ITEM_HISTORIES)
				.select("id")
				.eq("item_id", normalizedItemId)
				.is("returned_at", null)
				.maybeSingle();

			if (checkError) throw checkError;

			if (existing) {
				throw new Error("Item is already checked out");
			}
		}

		const payload = {
			item_id: normalizedItemId,
			user_id: normalizedUserId,
			action,
			duration: options.duration ?? null,
			reference_link: options.referenceLink ?? null,
			start_time: options.startTime ?? new Date(),
			returned_at: action === "checkin" ? new Date() : null,
		};

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.insert([payload])
			.select()
			.single();

		if (error) throw error;

		// optionally sync item status
		if (action === "checkout") {
			await this.setItemStatus(itemId, "In-Use");
		} else if (action === "checkin") {
			await this.setItemStatus(itemId, "Available");
		}

		return {
			...mapItemHistoryRowToModel(data),
			referenceUrl: this.getReferenceUrl(data.reference_link),
		};
	}



	async createApiKey(adminId, data) {
		const crypto = require("crypto");
		const keyValue = crypto.randomBytes(32).toString("hex");

		const admin = await this.getUserById(adminId);

		if (!admin || admin.role !== "Admin") {
			throw new Error("Only admins can create API keys");
		}

		const payload = {
			key: keyValue,
			name: data?.name || null,
			admin_id: adminId,
			revoked: false,
		};

		const { data: inserted, error } = await this.supabase
			.from(SUPABASE_TABLES.API_KEYS)
			.insert([payload])
			.select()
			.single();

		if (error) throw error;

		return mapApiKeyRowToModel(inserted);
	}

	async getApiKeys() {
		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.API_KEYS)
			.select("*")
			.order("created_at", { ascending: false });

		if (error) throw error;

		return data.map(mapApiKeyRowToModel);
	}

	async getApiKeyByKey(key) {
		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.API_KEYS)
			.select("*")
			.eq("key", key)
			.eq("revoked", false)
			.maybeSingle();

		if (error) throw error;

		return data ? mapApiKeyRowToModel(data) : null;
	}

	async revokeApiKey(adminId, id) {
		const admin = await this.getUserById(adminId);

		if (!admin || admin.role !== "Admin") {
			throw new Error("Only admins can revoke keys");
		}

		const normalizedId = this.toSupabaseId(id);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.API_KEYS)
			.update({ revoked: true })
			.eq("id", normalizedId)
			.select()
			.maybeSingle();

		if (error) throw error;

		return data ? mapApiKeyRowToModel(data) : null;
	}

	// async uploadFile(path, buffer) {
	// 	const { error } = await this.supabase.storage
	// 		.from("docs-bucket")
	// 		.upload(path, buffer);

	// 	if (error) {
	// 		throw new Error(`Upload failed: ${error.message}`);
	// 	}

	// 	return path;
	// }

	// a revised version of the uploadFile method (Should keep only 1)
	async uploadFile(path, buffer, isItem) {
		const { error } = await this.supabase.storage
			.from(isItem ? "items-bucket" : "docs-bucket")
			.upload(path, buffer);

		if (error) {
			throw new Error(`Upload failed: ${error.message}`);
		}

		return path;
	}
}

module.exports = SupabaseProvider;
