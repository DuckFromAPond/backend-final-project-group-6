/*
	defines the interface all providers must implement
 */
class DatabaseProvider {
	constructor() {
		this.providerKey = null;
		this.providerLabel = null;
	}

	async getFile(bucket, id) {}

	// ===== USER =====
	async registerUser(email, password, name, role) {throw new Error("missing implementation");}	// create user (I am not renaming this function)
	async findUserByEmail(email) {throw new Error("missing implementation");}
	async verifyPassword(password, hash) {throw new Error("missing implementation");}
	async getUserById(id) {throw new Error("missing implementation");}
	async updateUser(userId, data) {throw new Error("missing implementation");}			// <--- use this to update user and disbale archive/"delete" user
	async revokeOwnedApiKeys(userId) {throw new Error("missing implementation");}		// <--- work 
	async getAllUsers() {throw new Error("missing implementation");}
	async hasActiveAdmin() {throw new Error("missing implementation");}
	async findActiveAction(itemId, action) {}
	
	// ===== ITEMS =====
	async getItems() {throw new Error("missing implementation");}
	async getItemById(id) {throw new Error("missing implementation");}

	async createItem(data) {throw new Error("missing implementation");}			// admin
	async updateItem(id, data) {throw new Error("missing implementation");}		// admin for changing data and user for updating status 

	// ===== HISTORY =====
	async getItemHistories() {throw new Error("missing implementation");}
	async getItemHistoryByItemId(itemId) {throw new Error("missing implementation");}
	async addItemHistory(itemId, data) {throw new Error("missing implementation");}

	// ===== FOR USER TO ITEMS RELATIONS : UPDATE HISTORY =====
	async getUserHistory(userId) {throw new Error("missing implementation");}
	// async updateUserItem(itemId, targetUserId, adminId, action, options = {}) {}

	// ===== API KEYS ===== (need to add to auth middleware/auth controller/admin controller later)
	async createApiKey(userId, data) {throw new Error("missing implementation");}        			// for admin 
	async getApiKeys() {throw new Error("missing implementation");}              						// for admin
	async getApiKeyByKey(hashedKey) {throw new Error("missing implementation");}       						// for middleware
	async updateApiKey(id, updateData) {throw new Error("missing implementation");}          			// for admin

	// add more database manip or func here if want 
	async uploadFile(filename, buffer, mimeType) {throw new Error("missing implementation");}
	async uploadItem(filename, buffer, mimeType) {throw new Error("missing implementation");}

	// async getAllCategories() {}
	// async addCategory(name) {}
	// async addSubCategory(categoryId, name) {}
	// async updateSubCategory(subCategoryId, data) {}
	// async deleteCategory(categoryId) {}
	// ===== HELPER goes down here  (moved to conflictCheck)
	
}

module.exports = DatabaseProvider;
