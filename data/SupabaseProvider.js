const bcryptjs = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
const { hasTimeConflict } = require("../utils/conflictCheck")
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

		// Check if email already exists
		const { data: existingUser, error: existingUserError } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.select("id")
			.eq("email", normalizedEmail)
			.single();

		if (existingUserError && existingUserError.code !== "PGRST116") {
			throw existingUserError;
		}

		if (existingUser) {
			throw new Error("Email already exists");
		}

		// Hash password
		const salt = await bcryptjs.genSalt(10);
		const passwordHash = await bcryptjs.hash(password, salt);

		// Insert new user
		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.insert([{ email: normalizedEmail, password_hash: passwordHash }])
			.select("id, email, created_at");

		if (error) {
			throw error;
		}

		return mapUserRowToModel(data[0]);
	}

	async findUserByEmail(email) {
		const normalizedEmail = this.normalizeEmail(email);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.select("id, email, password_hash")
			.eq("email", normalizedEmail)
			.single();

		if (error && error.code === "PGRST116") {
			return null; // No user found
		}

		if (error) {
			throw error;
		}

		return mapUserRowToModel(data);
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
			.select("*");

		if (error) {
			throw error;
		}

		return data.map(mapItemHistoryRowToModel);
	}
	
	async getItemHistoryByItemId(itemId) {
		const normalizedId = this.toSupabaseId(itemId);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.select("*")
			.eq("item_id", normalizedId)
			.order("created_at", { ascending: false });

		if (error) {
			throw error;
		}

		return data.map(mapItemHistoryRowToModel);
	}

	async addItemHistory(itemId, data) {
		const normalizedId = this.toSupabaseId(itemId);

		const payload = {
			item_id: normalizedId,
			...data,
			created_at: new Date()
		};

		const { data: inserted, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.insert([payload])
			.select()
			.single();

		if (error) {
			throw error;
		}

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
			start_time,
			duration,
			returned_at,
			created_at,
			items!inner(id, name, category, status, date_acquired)
			`)
			.eq("user_id", normalizedUserId)
			.is("returned_at", null); // only active items

		if (error) {
			throw error;
		}

		return data.map((row) => {
			return {
				id: row.id,
				userId: row.user_id,
				itemId: row.item_id,
				startTime: row.start_time,
				duration: row.duration,
				returnedAt: row.returned_at,
				createdAt: row.created_at,

				// joined item
				item: {
					...mapItemRowToModel(row.items),
					imageUrl: this.getImageUrl(row.items.image_name),
				}
			};
		});
	}

	async assignItemToUser(itemId, userId, startTime, duration) {
		const normalizedItemId = this.toSupabaseId(itemId);
		const normalizedUserId = this.toSupabaseId(userId);

		const { data: existing, error: checkError } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.select("id")
			.eq("item_id", normalizedItemId)
			.is("returned_at", null)
			.maybeSingle();

		if (checkError) {
			throw checkError;
		}

		if (existing) {
			throw new Error("Item is already assigned");
		}

		const payload = {
			item_id: normalizedItemId,
			user_id: normalizedUserId,
			start_time: startTime,
			duration: duration,
			returned_at: null
		};

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.insert([payload])
			.select()
			.single();

		if (error) {
			throw error;
		}

		return mapItemHistoryRowToModel(data);
	}

	async removeItemFromUser(itemId, userId) {
		const normalizedItemId = this.toSupabaseId(itemId);
		const normalizedUserId = this.toSupabaseId(userId);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.update({
			returned_at: new Date()
			})
			.eq("item_id", normalizedItemId)
			.eq("user_id", normalizedUserId)
			.is("returned_at", null) // only active assignment
			.select()
			.maybeSingle();

		if (error) throw error;
		if (!data) return null;

		return mapItemHistoryRowToModel(data);
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

	async revokeApiKey(admin_id, id) {
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
}

module.exports = SupabaseProvider;
