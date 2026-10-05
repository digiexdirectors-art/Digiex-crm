const BirthdayWish = require('../models/BirthdayWish');

exports.sendWish = async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;
    const wish = new BirthdayWish({ sender: senderId, receiver: receiverId, message });
    await wish.save();
    res.status(201).json({ success: true, data: wish });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getWishes = async (req, res) => {
  try {
    const { userId } = req.params;
    const wishes = await BirthdayWish.find({ receiver: userId, isRead: false })
      .populate('sender', 'name profilePhoto');
    res.status(200).json({ success: true, data: wishes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    // Find all unread wishes first
    const wishes = await BirthdayWish.find({ receiver: userId, isRead: false, type: 'wish' });
    
    // Create thank you responses for each wisher
    for (const wish of wishes) {
      const response = new BirthdayWish({
        sender: userId,
        receiver: wish.sender,
        message: `Thank you so much for the birthday wish! ❤️`,
        type: 'thank_you'
      });
      await response.save();
    }

    // Mark current wishes as read
    await BirthdayWish.updateMany({ receiver: userId, isRead: false }, { isRead: true });
    
    res.status(200).json({ success: true, message: 'Wishes marked as read and thank you notes sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
