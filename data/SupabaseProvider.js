const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const DatabaseProvider = require("./databaseProvider");
const {
  SUPABASE_TABLES,
  mapUserRowToModel,
  mapItemRowToModel,
  mapItemHistoryRowToModel,
  mapApiKeyRowToModel,
} = require("./models/supabaseModels");

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

	// ===== USER =====
	async registerUser(email, password, name, role) {
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
			passwordHash: passwordHash,
			name: name,
			role: role,
			status: "Active", 
			disabledAt: null,
			}])
			.select("id, email, name, role, status, createdAt, disabledAt")
			.single();

		if (error) throw error;

		return mapUserRowToModel(data);
	}

	async findUserByEmail(email) {
		const normalizedEmail = this.normalizeEmail(email);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.select("*")
			.eq("email", normalizedEmail)
			.maybeSingle();

		if (error) throw error;
		if (!data) return null;

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
			.select("*")
			.single();

		if (error) throw error;

		return mapUserRowToModel(data);
	}

	async revokeOwnedApiKeys(userId) {
		const normalizedUserId = this.toSupabaseId(userId);

		const { error } = await this.supabase
			.from(SUPABASE_TABLES.API_KEYS)
			.update({ revoked: true })
			.eq("adminId", normalizedUserId);

		if (error) throw error;
	}

	async getAllUsers () {		
		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.USERS)
			.select("*");

		if (error) throw error;

		return data.map(mapUserRowToModel);
	}

  async hasActiveAdmin() {
    const { data, error } = await this.supabase
      .from("users")
      .select("id")
      .eq("role", "Admin")
      .eq("status", "Active")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return !!data;
  }

  async findActiveCheckout(itemId) {
	const normalizedId = this.toSupabaseId(itemId);

	const { data, error } = await this.supabase
		.from(SUPABASE_TABLES.ITEM_HISTORIES)
		.select("*")
		.eq("itemId", normalizedId)
		.eq("action", "checkout")
		.order("createdAt", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) throw error;

	return data ? mapItemHistoryRowToModel(data) : null;
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
				imageUrl: this.getImageUrl(item.imageName),
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
			imageUrl: this.getImageUrl(data.imageName),
		};
	}

	async getItemBySerial(serial) {
		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEMS)
			.select("*")
			.eq("serial", serial)
			.maybeSingle();

		if (error) throw error;

		if (!data) return null;

		const mapped = mapItemRowToModel(data);

		return {
			...mapped,
			imageUrl: this.getImageUrl(data.imageName),
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
			imageUrl: this.getImageUrl(inserted.imageName),
		};
	}

	async updateItem(id, updates) {
		const normalizedId = this.toSupabaseId(id);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEMS)
			.update(updates)
			.eq("id", normalizedId)
			.select()
			.single();

		if (error) throw error;

		return mapItemRowToModel(data);
	}


	// ===== HISTORY =====
	async getItemHistories() {
		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.select("*")
			.order("createdAt", { ascending: false });

		if (error) throw error;

		return data.map(row => ({
			...mapItemHistoryRowToModel(row),
			referenceUrl: this.getReferenceUrl(row.referenceLink)
		}));
	}
	
	async getItemHistoryByItemId(itemId) {
		const normalizedId = this.toSupabaseId(itemId);

		const { data, error } = await this.supabase
			.from(SUPABASE_TABLES.ITEM_HISTORIES)
			.select("*")
			.eq("itemId", normalizedId)
			.order("createdAt", { ascending: false });

		if (error) throw error;

		return data.map(row => ({
			...mapItemHistoryRowToModel(row),
			referenceUrl: this.getReferenceUrl(row.referenceLink)
		}));
	}

	async addItemHistory(itemId, data) {
		const payload = {
			itemId: this.toSupabaseId(itemId),
			userId: this.toSupabaseId(data.userId),
			action: data.action,
			duration: data.duration,
			referenceLink: data.referenceLink ?? null,
			createdAt: new Date()
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
			.from(SUPABASE_TABLES.ITEMS)
			.select(`
			id,
			name,
			serial,
			model,
			brand,
			category,
			subCategory,
			status,
			description,
			dateAcquired,
			imageAlt,
			imageName,
			currentOwner,
			item_histories (
				id,
				userId,
				itemId,
				action,
				duration,
				createdAt,
				referenceLink
			)
			`)
			.eq("currentOwner", normalizedUserId)
			.order("createdAt", {
			foreignTable: "item_histories",
			ascending: false,
			});

		if (error) throw error;

		return data.map(item => {
			// item_histories is already sorted desc (latest first)
			const latestHistory = item.item_histories?.[0] || null;

			return {
			id: item.id,

			item: {
				...mapItemRowToModel(item),
				imageUrl: this.getImageUrl(item.imageName),
			},

			lastHistory: latestHistory
				? mapItemHistoryRowToModel(latestHistory)
				: null,
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

  async updateItem(id, updates) {
    const normalizedId = this.toSupabaseId(id);

    const { data, error } = await this.supabase
      .from(SUPABASE_TABLES.ITEMS)
      .update(updates)
      .eq("id", normalizedId)
      .select()
      .single();

    if (error) throw error;

    return mapItemRowToModel(data);
  }

  // ===== HISTORY =====
  async getItemHistories() {
    const { data, error } = await this.supabase
      .from(SUPABASE_TABLES.ITEM_HISTORIES)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data.map((row) => ({
      ...mapItemHistoryRowToModel(row),
      referenceUrl: this.getReferenceUrl(row.reference_link),
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

    return data.map((row) => ({
      ...mapItemHistoryRowToModel(row),
      referenceUrl: this.getReferenceUrl(row.reference_link),
    }));
  }

  async addItemHistory(itemId, data) {
    const payload = {
      item_id: this.toSupabaseId(itemId),
      user_id: this.toSupabaseId(data.userId),
      action: data.action,
      duration: data.duration,
      reference_link: data.referenceLink ?? null,
      created_at: new Date(),
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
      .select(
        `
			id,
			user_id,
			item_id,
			duration,
			action,
			created_at,
			reference_link,
			items!inner(id, name, serial, model, brand, category, sub_category, status, description, date_acquired, image_alt, image_name)
			`,
      )
      .eq("user_id", normalizedUserId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // get latest per item
    const latest = this.getLatestCheckoutRows(data, (r) => r.item_id);

    return latest.map((r) => ({
      id: r.id,
      userId: r.user_id,
      itemId: r.item_id,
      action: r.action,
      duration: r.duration,
      createdAt: r.created_at,

      referenceUrl: this.getReferenceUrl(r.reference_link),

      item: {
        id: r.items.id,
        name: r.items.name,
        serial: r.items.serial,
        model: r.items.model,
        brand: r.items.brand,
        category: r.items.category,
        sub_category: r.items.sub_category,
        status: r.items.status,
        description: r.items.description,
        dateAcquired: r.items.date_acquired,
        imageAlt: r.items.image_alt,
        imageUrl: this.getImageUrl(r.items.image_name),
      },
    }));
  }

  async updateUserItem(itemId, newUserId, adminId, options = {}) {
    const normalizedItemId = this.toSupabaseId(itemId);
    const normalizedNewUserId = this.toSupabaseId(newUserId);
    const normalizedAdminId = this.toSupabaseId(adminId);

    // 1. check admin
    const admin = await this.getUserById(normalizedAdminId);

    if (!admin || admin.role !== "Admin") {
      throw new Error("Unauthorized");
    }

    // 2. check item exists
    const item = await this.getItemById(normalizedItemId);

    if (!item) {
      throw new Error("Item not found");
    }

    // 3. get current owner (latest active checkout)
    const { data: existing, error: fetchError } = await this.supabase
      .from(SUPABASE_TABLES.ITEM_HISTORIES)
      .select("*")
      .eq("item_id", normalizedItemId)
      .is("returned_at", null)
      .maybeSingle();

    if (fetchError) throw fetchError;

    // 4. RULE: already owned by same user
    if (
      existing &&
      existing.user_id === normalizedNewUserId &&
      existing.action === "checkout"
    ) {
      throw new Error("User already owns this item");
    }

    // 5. RULE: prevent double ownership
    if (existing && existing.user_id !== normalizedNewUserId) {
      throw new Error("Item is already owned by another user");
    }

    // 6. optional: close previous ownership (if you want forced transfer)
    if (existing) {
      await this.supabase
        .from(SUPABASE_TABLES.ITEM_HISTORIES)
        .update({
          returned_at: new Date(),
        })
        .eq("id", existing.id);
    }

    // 7. create new ownership record
    const { data, error } = await this.supabase
      .from(SUPABASE_TABLES.ITEM_HISTORIES)
      .insert([
        {
          item_id: normalizedItemId,
          user_id: normalizedNewUserId,
          action: "checkout",
          reference_link: options.referenceLink ?? null,
          created_at: new Date(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return this.mapItemHistoryRowToModel(data);
  }

  // ===== APIKEYS =====
  async createApiKey(adminId, data) {
    const keyValue = crypto.randomBytes(32).toString("hex");

    const { data: inserted, error } = await this.supabase
      .from("api_keys")
      .insert([
        {
          key: keyValue,
          name: data?.name ?? null,
          adminId: adminId,
          revoked: false,
          createdAt: new Date(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return mapApiKeyRowToModel(inserted);
  }

  async getApiKeys() {
    const { data, error } = await this.supabase
      .from("api_keys")
      .select("*")
      .order("createdAt", { ascending: false });

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

    const { data, error } = await this.supabase
      .from("api_keys")
      .update({ revoked: true })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return mapApiKeyRowToModel(data);
  }

  async uploadFile(path, buffer) {
  	const { error } = await this.supabase.storage
  		.from("docs-bucket")
  		.upload(path, buffer);

  	if (error) {
  		throw new Error(`Upload failed: ${error.message}`);
  	}

  	return path;
  }

  async uploadItem(path, buffer) {
    const { error } = await this.supabase.storage
      .from("items-bucket")
      .upload(path, buffer);

    if (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }

    return path;
  }
}

module.exports = SupabaseProvider;
