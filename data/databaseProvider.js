/*
	defines the interface all providers must implement
 */
class DatabaseProvider {
	constructor() {
		this.providerKey = null;
		this.providerLabel = null;
	}

	// ===== USER AUTHENTICATION =====
	async registerUser(email, password) {}
	async findUserByEmail(email) {}
	async verifyPassword(password, hash) {}
	async getUserById(userId) {}
	async updateUser(userId, data) {}
	
	async getAllUsers() {}

	// ===== ITEMS =====
	async getItems() {}
	async getItemById(id) {}
	async createItem(data) {}			// admin
	async updateItem(id, data) {}		// admin for changing data and user for updating status 
	async deleteItem(id) {}				// admin
	async setItemStatus(itemId, status) {}
	async getItemStatus(itemId) {}

	// ===== HISTORY =====
	async getItemHistories() {}
	async getItemHistoryByItemId(itemId) {}
	async addItemHistory(itemId, data) {}

	// ===== FOR USER TO ITEMS RELATIONS : UPDATE HISTORY =====
	async getUserItems(userId) {}
	async assignItemToUser(itemId, userId, startTime, duration, db) {}
	async removeItemFromUser(itemId, userId) {}

	// ===== API KEYS ===== (need to add to auth middleware/auth controller/admin controller later)
	async createApiKey(adminId, data) {}        // for admin 
	async getApiKeys() {}              // for admin
	async getApiKeyByKey(key) {}       // for middleware
	async revokeApiKey(adminId, id) {}          


	// add more database manip or func here if want 

	// ===== HELPER goes down here  (moved to conflictCheck)
	
}

module.exports = DatabaseProvider;
