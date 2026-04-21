/*
	defines the interface all providers must implement
 */
class DatabaseProvider {
	constructor() {
		this.providerKey = null;
		this.providerLabel = null;
	}

	// ===== USER AUTHENTICATION =====
	async registerUser(email, password, name) {throw new Error("missing implementation");}
	async findUserByEmail(email) {throw new Error("missing implementation");}
	async verifyPassword(password, hash) {throw new Error("missing implementation");}
	async getUserById(userId) {throw new Error("missing implementation");}
	async updateUser(userId, data) {throw new Error("missing implementation");}			// <--- use this to update user and disbale archive/"delete" user
	
	async getAllUsers() {throw new Error("missing implementation");}

	// ===== ITEMS =====
	async getItems() {throw new Error("missing implementation");}
	async getItemById(id) {throw new Error("missing implementation");}

	async createItem(data) {throw new Error("missing implementation");}			// admin
	async updateItem(id, data) {throw new Error("missing implementation");}		// admin for changing data and user for updating status 

	// async retireItem(id) {throw new Error("missing implementation");}	<--------- just use update to retire (no hard delete)

	// ===== HISTORY =====
	async getItemHistories() {throw new Error("missing implementation");}
	async getItemHistoryByItemId(itemId) {throw new Error("missing implementation");}
	async addItemHistory(itemId, data) {throw new Error("missing implementation");}

	// ===== FOR USER TO ITEMS RELATIONS : UPDATE HISTORY =====
	async getUserItems(userId) {throw new Error("missing implementation");}

	async updateUserItem(itemId, newUserId, adminId, options = {}) {throw new Error("missing implementation");} 			// for admin 

	// ===== API KEYS ===== (need to add to auth middleware/auth controller/admin controller later)
	async createApiKey(adminId, data) {throw new Error("missing implementation");}        			// for admin 
	async getApiKeys() {throw new Error("missing implementation");}              						// for admin
	async getApiKeyByKey(key) {throw new Error("missing implementation");}       						// for middleware
	async revokeApiKey(adminId, id) {throw new Error("missing implementation");}          			// for admin


	// add more database manip or func here if want 
	async uploadFile(path, buffer) {throw new Error("missing implementation");}
	async uploadItem(path, buffer) {throw new Error("missing implementation");}

	
	// ===== HELPER goes down here  (moved to conflictCheck)
	
}

module.exports = DatabaseProvider;
