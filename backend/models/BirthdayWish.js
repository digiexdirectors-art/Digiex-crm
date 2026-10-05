const mongoose = require('mongoose');

const birthdayWishSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, default: 'Happy Birthday! 🎂' },
  type: { type: String, enum: ['wish', 'thank_you'], default: 'wish' },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('BirthdayWish', birthdayWishSchema);
