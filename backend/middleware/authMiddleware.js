const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'digiex_hrms_fallback_secret_key');
    
    // Fetch user from DB with populated role, department, and userType
    const user = await User.findById(decoded.id).populate({
      path: 'role',
      populate: { path: 'userType department' }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
