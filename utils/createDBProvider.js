// Note: if you're wondering the utils folder is for files idk where to put 

const mockData = require('../data/data');
const SupabaseProvider = require("../data/SupabaseProvider");

async function createDatabaseProvider() {
	const rawProvider = (process.env.DB_PROVIDER || "supabase").trim().toLowerCase();
	const providerKey = rawProvider === "mongo" ? "mongodb" : rawProvider;

	let provider;

	if (providerKey === "supabase" || providerKey === "postgres") {
		provider = new SupabaseProvider();
	} else {
		throw new Error(
			`Unknown database provider: "${rawProvider}". Expected "supabase" or set up your own DB`
		);
	}

	// Connect and initialize the provider
	await provider.connect();

	return provider;
}

module.exports = createDatabaseProvider;
