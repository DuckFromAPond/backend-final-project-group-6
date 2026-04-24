const SUPABASE_TABLES = Object.freeze({
	USERS: "users",
	ITEMS: "items",
	ITEM_HISTORIES: "item_histories",
	API_KEYS: "api_keys",
});

function toIdString(value) {
	return String(value);
}

function toDateValue(value) {
	if (!value) {
		return null;
	}

	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOnlyString(value) {
	const date = value instanceof Date ? value : new Date(value);
	return date.toISOString().split("T")[0];
}

function mapUserRowToModel(row) {
  return {
    id: toIdString(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    passwordHash: row.passwordHash,
	disabledAt: row.disabledAt,
  };
}

function mapItemRowToModel(row) {
	if (!row) return null;

	return {
		id: toIdString(row.id),
		name: row.name,
		serial: row.serial,
		model: row.model,
		brand: row.brand,
		category: row.category,
		subCategory: row.subCategory,
		status: row.status,
		dateAcquired: toDateValue(row.dateAcquired),
		currentOwner: row.currentOwner,
		description: row.description,
		imageName: row.imageName,
		imageAlt: row.imageAlt
	};
}

function mapItemHistoryRowToModel(row) {
  return {
		id: toIdString(row.id),
		itemId: toIdString(row.itemId),
		userId: toIdString(row.userId),
		duration: row.duration,
		referenceLink: row.referenceLink,
		createdAt: row.createdAt,
		returnedAt: row.returnedAt,
		action: row.action,
  };
}

function mapApiKeyRowToModel(row) {
  return {
    id: toIdString(row.id),
    hashKey: row.hashKey,
    name: row.name,
	userId: row.userId,
    createdAt: row.createdAt,
    revoked: row.revoked,
  };
}


// function mapCategoryRowToModel(row) {
//   return {
//     id: toIdString(row.id),
// 	hashKey: row.hashKey,
//     name: row.name,
// 	adminId: row.adminId,
//     createdAt: row.createdAt,
//     revoked: row.revoked,
//   };
// }

module.exports = {
	SUPABASE_TABLES,
	mapUserRowToModel,
	mapItemRowToModel,
	mapItemHistoryRowToModel,
	mapApiKeyRowToModel
};
