const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email }).populate([
      { path: 'role', populate: { path: 'userType department' } },
      { path: 'roles', populate: { path: 'userType department' } }
    ]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const primaryRole = user.role || (user.roles && user.roles[0]);
    const primaryRoleName = primaryRole?.name || '';
    const primaryUserTypeName = typeof primaryRole?.userType === 'object' ? primaryRole?.userType?.name : (primaryRole?.userType || '');

    const token = jwt.sign(
      { id: user._id, role: primaryRoleName, userType: primaryUserTypeName }, 
      process.env.JWT_SECRET || 'digiex_hrms_fallback_secret_key', 
      { expiresIn: '1d' }
    );

    res.status(200).json({ 
      success: true, 
      token, 
      user: { 
        id: user._id, 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        role: primaryRole,
        roles: (user.roles && user.roles.length > 0) ? user.roles : (primaryRole ? [primaryRole] : []),
        employeeId: user.employeeId,
        profilePhoto: user.profilePhoto,
        gender: user.gender,
        joiningDate: user.joiningDate
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
