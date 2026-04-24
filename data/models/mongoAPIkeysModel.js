const mongoose = require("mongoose");

const ApiKeySchema = new mongoose.Schema({
  hashedKey: {
    type: String,
    required: true,
    unique: true,
  },
  name: String,

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  revoked: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("ApiKey", ApiKeySchema);
