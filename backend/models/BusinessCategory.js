const mongoose = require('mongoose');

const businessCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  subcategories: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('BusinessCategory', businessCategorySchema);
