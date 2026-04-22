const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  serial: {
    type: String,
    required: true,
    unique: true
  },
  model: String,
  brand: String,

  category: {
    type: String,
    required: true
  },
  subCategory: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ["Available", "In-Use", "Maintenance", "Retired"],
    default: "Available"
  },

  currentOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  dateAcquired: Date,
  description: String,

  imageName: String,
  imageAlt: String
});

module.exports = mongoose.model("Item", ItemSchema);