const mongoose = require("mongoose");

const ApiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  name: String,

  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  revoked: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("ApiKey", ApiKeySchema);