const mongoose = require("mongoose");

const ItemHistorySchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  duration: Number,
  referenceLink: String,

  action: {
    type: String,
    enum: ["checkout", "checkin"]
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("ItemHistory", ItemHistorySchema);