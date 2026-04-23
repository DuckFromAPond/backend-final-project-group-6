require("dotenv").config();
const MongoProvider = require("../data/MongoDBProvider");

async function runTest() {
  const provider = new MongoProvider();

  try {
    console.log("--- Starting Provider Test ---");
    await provider.connect();

    // 1. Test User Creation (The logic that sets Admin vs Technician)
    console.log("\n1. Testing User Registration...");
    const testEmail = `test_${Date.now()}@example.com`;
    const newUser = await provider.registerUser(
      testEmail,
      "password123",
      "Test User",
    );
    console.log("- User Created:", { id: newUser.id, role: newUser.role });

    // 2. Test API Key Generation
    console.log("\n2. Testing API Key Generation...");
    const keyData = await provider.createApiKey(newUser.id, {
      name: "Test Integration Key",
    });
    console.log("- API Key Created!");
    console.log("- RAW KEY (Show this once):", keyData.rawKey);
    console.log("- HASHED KEY (In DB):", keyData.hashedKey);

    // 3. Test API Key Lookup (Middleware simulation)
    console.log("\n3. Testing API Key Validation...");
    const foundKey = await provider.getApiKeyByHash(keyData.hashedKey);
    if (foundKey && foundKey.name === "Test Integration Key") {
      console.log("- Key lookup successful.");
    } else {
      console.log("- Key lookup failed.");
    }

    // 4. Test Soft Delete (Revocation)
    console.log("\n4. Testing Key Revocation...");
    await provider.updateApiKey(keyData.id, { revoked: true });
    const revokedKeyCheck = await provider.getApiKeyByHash(keyData.hashedKey);
    if (!revokedKeyCheck) {
      console.log("- Key correctly ignored after revocation.");
    }

    // 5. Check List All Users
    console.log("\n5. Testing Get All Users...");
    const allUsers = await provider.getAllUsers();
    console.log(`- Total users found: ${allUsers.length}`);

    // 6. Cleanup (remove the test data so DB stays clean)
    console.log("\n6. Cleaning up test data...");
    const mongoose = require("mongoose");
    await mongoose.model("User").deleteOne({ _id: newUser.id });
    await mongoose.model("ApiKey").deleteOne({ _id: keyData.id });
    console.log("- Test data purged.");
  } catch (error) {
    console.error("- TEST FAILED:", error);
  } finally {
    // Clean up connection so script ends
    const mongoose = require("mongoose");
    await mongoose.connection.close();
    console.log("\n--- Test Finished & Connection Closed ---");
  }
}

runTest();
