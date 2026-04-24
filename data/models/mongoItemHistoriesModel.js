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
  duration: {type:Number,default: null},
  referenceLink: String,
  action: {
    type: String,
    enum: ["checkout", "checkin"]
  },

  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },

  returnedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model("ItemHistory", ItemHistorySchema);