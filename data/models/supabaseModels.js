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
    createdAt: row.created_at,
    passwordHash: row.password_hash,
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
		sub_category: row.sub_category,
		status: row.status,
		dateAcquired: toDateValue(row.date_acquired),
		description: row.description,
		imageName: row.image_name,
		imageAlt: row.image_alt
	};
}

function mapItemHistoryRowToModel(row) {
  return {
		id: toIdString(row.id),
		itemId: toIdString(row.item_id),
		userId: toIdString(row.user_id),
		duration: row.duration,
		referenceLink: row.reference_link,
		createdAt: row.created_at,
		action: row.action,
  };
}

function mapApiKeyRowToModel(row) {
  return {
    id: toIdString(row.id),
    key: row.key,
    name: row.name,
    createdAt: row.created_at,
    revoked: row.revoked,
  };
}

module.exports = {
	SUPABASE_TABLES,
	mapUserRowToModel,
	mapItemRowToModel,
	mapItemHistoryRowToModel,
	mapApiKeyRowToModel
};
