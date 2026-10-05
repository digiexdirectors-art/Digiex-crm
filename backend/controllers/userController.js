const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.createUser = async (req, res) => {
  try {
    const { email, password, ...otherData } = req.body;
    
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if the current user is a Super Admin
    const roleName = req.user?.role?.name;
    const userTypeName = req.user?.role?.userType?.name;
    const isSuperAdmin = (roleName || '').toLowerCase().trim() === 'super admin' ||
                         (userTypeName || '').toLowerCase().trim() === 'super admin';

    let finalEmployeeId;
    if (isSuperAdmin && req.body.employeeId && req.body.employeeId.trim() !== '') {
      finalEmployeeId = req.body.employeeId.trim();
      const existingUser = await User.findOne({ employeeId: finalEmployeeId });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Employee ID already exists' });
      }
    } else {
      // Auto-generate employeeId
      const lastUser = await User.findOne({ employeeId: { $regex: /^DX/ } }).sort({ createdAt: -1 });
      let nextIdNumber = 1;
      if (lastUser && lastUser.employeeId) {
        const numPart = lastUser.employeeId.replace('DX', '');
        if (!isNaN(numPart)) {
          nextIdNumber = parseInt(numPart, 10) + 1;
        }
      }
      finalEmployeeId = `DX${nextIdNumber.toString().padStart(4, '0')}`;
    }

    if (otherData.reportingManager === '') {
      otherData.reportingManager = null;
    }

    // Prevent client-submitted employeeId from overriding finalEmployeeId via spreadsheet
    delete otherData.employeeId;

    if (Array.isArray(otherData.roles) && otherData.roles.length > 0) {
      otherData.role = otherData.roles[0];
    } else if (otherData.role) {
      otherData.roles = [otherData.role];
    }

    user = new User({
      email,
      password: hashedPassword,
      employeeId: finalEmployeeId,
      ...otherData
    });

    await user.save();
    
    user.password = undefined;
    
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().populate([
      {
        path: 'role',
        select: 'name userType department',
        populate: { path: 'userType department' }
      },
      {
        path: 'roles',
        select: 'name userType department',
        populate: { path: 'userType department' }
      }
    ]).select('-password');
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate([
      {
        path: 'role',
        select: 'name userType department',
        populate: { path: 'userType department' }
      },
      {
        path: 'roles',
        select: 'name userType department',
        populate: { path: 'userType department' }
      }
    ]).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    if (updateData.employeeId && updateData.employeeId !== targetUser.employeeId) {
      // Check if logged-in user is Super Admin
      const roleName = req.user?.role?.name;
      const userTypeName = req.user?.role?.userType?.name;
      const isSuperAdmin = (roleName || '').toLowerCase().trim() === 'super admin' ||
                           (userTypeName || '').toLowerCase().trim() === 'super admin';
      
      if (!isSuperAdmin) {
        return res.status(403).json({ success: false, message: 'Only Super Admin can edit Employee ID' });
      }

      // Check if the new employeeId already exists on another user
      const existingUser = await User.findOne({ employeeId: updateData.employeeId, _id: { $ne: req.params.id } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Employee ID already exists' });
      }
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    if (updateData.reportingManager === '') {
      updateData.reportingManager = null;
    }

    if (Array.isArray(updateData.roles) && updateData.roles.length > 0) {
      updateData.role = updateData.roles[0];
    } else if (updateData.role) {
      updateData.roles = [updateData.role];
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
    
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBirthdays = async (req, res) => {
  try {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    const users = await User.find({ dob: { $exists: true } }).select('name dob profilePhoto');

    const todayBirthdays = [];
    const upcomingBirthdays = [];

    // Calculate days until next birthday for each user
    const userBirthdays = users.map(user => {
      const dob = new Date(user.dob);
      const birthdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      let nextBirthday = birthdayThisYear;
      let passedThisYear = false;
      
      if (birthdayThisYear < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        nextBirthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        passedThisYear = true;
      }

      const diffTime = nextBirthday.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        _id: user._id,
        name: user.name,
        profilePhoto: user.profilePhoto,
        dob: user.dob,
        daysUntil: diffDays,
        isToday: dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay,
        passedThisYear
      };
    });

    const todayList = userBirthdays.filter(u => u.isToday);
    const upcomingList = userBirthdays
      .filter(u => {
        const dob = new Date(u.dob);
        return dob.getMonth() + 1 === todayMonth && !u.isToday && !u.passedThisYear;
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    res.status(200).json({
      success: true,
      data: {
        today: todayList,
        upcoming: upcomingList
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
