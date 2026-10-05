const Attendance = require('../models/Attendance');
const User = require('../models/User');
const CompanySetting = require('../models/CompanySetting');
const axios = require('axios');

const getAddressFromCoords = async (lat, lng) => {
  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: {
        'User-Agent': 'DIGIEX-HRMS-Attendance-Tracker'
      },
      timeout: 5000
    });
    
    let address = response.data?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    let postcode = response.data?.address?.postcode || '';

    // Apply PIN code correction for Dum Dum / Nagerbazar area
    // Latitude roughly 22.610 to 22.630, Longitude roughly 88.410 to 88.420
    const inDumDumNagerbazar = lat >= 22.610 && lat <= 22.630 && lng >= 88.410 && lng <= 88.420;
    const isNagerbazarAddress = address.toLowerCase().includes('nagerbazar') || address.toLowerCase().includes('south dumdum');
    
    if (inDumDumNagerbazar && (postcode === '700080' || postcode === '700074' || isNagerbazarAddress)) {
      postcode = '700028';
      // Replace the wrong postcode in display_name string if it is present
      if (address.includes('700080')) {
        address = address.replace('700080', '700028');
      } else if (address.includes('700074')) {
        address = address.replace('700074', '700028');
      }
    }

    return { address, pincode: postcode };
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, pincode: '' };
  }
};

// Helper to calculate distance in meters
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

// Helper to auto-close any open attendance record past 9:00 PM for that day
const autoClosePendingClockOuts = async () => {
  try {
    const now = new Date();
    const openRecords = await Attendance.find({
      $or: [
        { clockOut: null },
        { 'workSessions.clockOut': null }
      ]
    });

    for (let record of openRecords) {
      if (!record.clockIn) {
        if (record.status === 'P' || record.status === 'Present') {
          record.status = 'Absent';
          await record.save();
        }
        continue;
      }

      const baseDate = new Date(record.clockIn);
      const cutoff9PM = new Date(baseDate);
      cutoff9PM.setHours(21, 0, 0, 0);

      if (now > cutoff9PM) {
        record.clockOut = cutoff9PM;

        if (record.workSessions && record.workSessions.length > 0) {
          record.workSessions.forEach(s => {
            if (!s.clockOut) {
              const sClockIn = new Date(s.clockIn);
              s.clockOut = sClockIn < cutoff9PM ? cutoff9PM : sClockIn;
            }
          });
        } else if (record.clockIn) {
          const sClockIn = new Date(record.clockIn);
          record.workSessions = [{
            clockIn: sClockIn,
            clockOut: sClockIn < cutoff9PM ? cutoff9PM : sClockIn
          }];
        }

        if (record.breaks && record.breaks.length > 0) {
          record.breaks.forEach(b => {
            if (!b.end) {
              const bStart = new Date(b.start);
              b.end = bStart < cutoff9PM ? cutoff9PM : bStart;
            }
          });
        }

        let totalMs = 0;
        if (record.workSessions) {
          record.workSessions.forEach(s => {
            if (s.clockIn && s.clockOut) {
              const sMs = new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime();
              if (sMs > 0) totalMs += sMs;
            }
          });
        }

        if (record.breaks) {
          record.breaks.forEach(b => {
            if (b.start && b.end) {
              const bMs = new Date(b.end).getTime() - new Date(b.start).getTime();
              if (bMs > 0) totalMs -= bMs;
            }
          });
        }
        if (totalMs < 0) totalMs = 0;

        const hoursWorked = totalMs / 3600000;
        record.totalHours = parseFloat(hoursWorked.toFixed(2));

        if (hoursWorked >= 9) {
          record.status = record.isLate ? 'LP' : 'P';
          record.isEarlyLeave = false;
        } else if (hoursWorked >= 5) {
          record.status = 'HD';
          record.isEarlyLeave = true;
        } else {
          record.status = 'Absent';
          record.isEarlyLeave = true;
        }

        await record.save();
      }
    }

    // Also update any records with no clockIn and no clockOut that were saved as Present/P
    const emptyRecordsWithP = await Attendance.find({
      clockIn: null,
      clockOut: null,
      status: { $in: ['P', 'Present'] }
    });
    for (let rec of emptyRecordsWithP) {
      rec.status = 'Absent';
      await rec.save();
    }
  } catch (error) {
    console.error('Error auto-closing pending clock outs:', error.message);
  }
};

exports.autoClosePendingClockOuts = autoClosePendingClockOuts;

exports.clockIn = async (req, res) => {
  try {
    const { userId, location, ip } = req.body;
    const user = await User.findById(userId).populate({
      path: 'role',
      populate: { path: 'userType department' }
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({ user: userId, date: today });
    
    // Check if WFH or WFA is already marked
    const isWFH = attendance ? attendance.isWFH : false;
    const isWFA = attendance ? attendance.isWFA : false;
    const isBDM = user.role && (user.role.name === 'BDM' || user.role.name === 'Business Development Manager');

    // Role, UserType, and Department checks for Admin, Super Admin, and HR
    const roleName = (user.role?.name || '').toLowerCase().trim();
    const userTypeName = (typeof user.role?.userType === 'object' ? user.role?.userType?.name : user.role?.userType || '').toLowerCase().trim();
    const deptName = (typeof user.role?.department === 'object' ? user.role?.department?.name : user.role?.department || '').toLowerCase().trim();

    const isAdminOrSuperAdmin = roleName.includes('admin') || userTypeName.includes('admin') || user.email === 'admin@digiexweb.com';
    const isHR = roleName.includes('hr') || roleName.includes('human resource') || deptName.includes('hr') || deptName.includes('human resource');

    const bypassLocationCheck = isWFH || isWFA || isBDM || isAdminOrSuperAdmin || isHR;

    if (!bypassLocationCheck) {
      const settings = await CompanySetting.find();
      const officeLat = Number(settings.find(s => s.key === 'office_location_lat')?.value || 22.6288);
      const officeLng = Number(settings.find(s => s.key === 'office_location_lng')?.value || 88.4357);
      const radius = Number(settings.find(s => s.key === 'office_location_radius')?.value || 10);
      const allowedIp = settings.find(s => s.key === 'allowed_office_ip')?.value;

      // Location Check
      if (location) {
        const dist = getDistance(location.lat, location.lng, officeLat, officeLng);
        if (dist > radius) {
          return res.status(403).json({ 
            success: false, 
            message: `Out of office location (${Math.round(dist)}m away). Detected: ${location.lat}, ${location.lng}` 
          });
        }
      } else {
        // If location is mandatory and not provided
        // return res.status(400).json({ success: false, message: 'Location access required' });
      }

      // IP Check
      if (allowedIp && ip && allowedIp !== ip) {
        // return res.status(403).json({ success: false, message: 'Invalid IP address' });
      }
    }

    // Calculate Late
    const settings = await CompanySetting.find();
    const gracePeriod = Number(settings.find(s => s.key === 'attendance_grace_period')?.value || 15);
    const [expH, expM] = (user.expectedEntryTime || '10:00').split(':').map(Number);
    
    const now = new Date();
    const entryTime = new Date(now);
    entryTime.setHours(expH, expM, 0, 0);
    
    const graceTime = new Date(entryTime.getTime() + gracePeriod * 60000);
    const isLate = now > graceTime;

    if (!attendance) {
      attendance = new Attendance({
        user: userId,
        date: today,
        clockIn: now,
        clockInIP: ip,
        clockInLocation: location,
        isLate,
        isWFH,
        isWFA,
        workSessions: [{ clockIn: now, clockOut: null }]
      });
    } else {
      if (!attendance.clockIn) {
        attendance.clockIn = now;
        attendance.isLate = isLate;
      }
      attendance.clockOut = null;
      attendance.clockInIP = ip || attendance.clockInIP;
      attendance.clockInLocation = location || attendance.clockInLocation;
      
      if (!attendance.workSessions || attendance.workSessions.length === 0) {
        attendance.workSessions = [{ clockIn: attendance.clockIn || now, clockOut: now }];
      } else {
        attendance.workSessions.forEach(s => {
          if (!s.clockOut) s.clockOut = now;
        });
      }
      attendance.workSessions.push({ clockIn: now, clockOut: null });
    }

    // If it is a Marketing Manager or Marketing Executive and a location is provided, log the first tracked point.
    const isMarketingUser = roleName.includes('marketing manager') || roleName.includes('marketing executive');
    if (isMarketingUser && location) {
      const { address, pincode } = await getAddressFromCoords(location.lat, location.lng);
      if (!attendance.locationLogs) attendance.locationLogs = [];
      attendance.locationLogs.push({
        time: now,
        lat: location.lat,
        lng: location.lng,
        address,
        pincode
      });
    }

    await attendance.save();
    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.clockOut = async (req, res) => {
  try {
    const { userId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({ user: userId, date: today });
    if (attendance && attendance.clockIn) {
      const now = new Date();
      attendance.clockOut = now;

      // Close current active work session
      if (!attendance.workSessions || attendance.workSessions.length === 0) {
        attendance.workSessions = [{ clockIn: attendance.clockIn, clockOut: now }];
      } else {
        const lastSession = attendance.workSessions[attendance.workSessions.length - 1];
        if (lastSession && !lastSession.clockOut) {
          lastSession.clockOut = now;
        }
      }

      // Close any open break if user clocked out while on break
      if (attendance.breaks && attendance.breaks.length > 0) {
        const lastBreak = attendance.breaks[attendance.breaks.length - 1];
        if (lastBreak && !lastBreak.end) {
          lastBreak.end = now;
        }
      }

      // Calculate Total Hours (summing all completed work sessions minus breaks)
      let totalMs = 0;
      attendance.workSessions.forEach(s => {
        if (s.clockIn && s.clockOut) {
          const sMs = new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime();
          if (sMs > 0) totalMs += sMs;
        }
      });

      if (attendance.breaks) {
        attendance.breaks.forEach(b => {
          if (b.start && b.end) {
            const bMs = new Date(b.end).getTime() - new Date(b.start).getTime();
            if (bMs > 0) totalMs -= bMs;
          }
        });
      }
      if (totalMs < 0) totalMs = 0;

      const hoursWorked = totalMs / 3600000;
      attendance.totalHours = parseFloat(hoursWorked.toFixed(2));

      // Status Calculation
      if (hoursWorked >= 9) {
        attendance.status = attendance.isLate ? 'LP' : 'P';
        attendance.isEarlyLeave = false;
      } else if (hoursWorked >= 5) {
        attendance.status = 'HD';
        attendance.isEarlyLeave = true;
      } else {
        attendance.status = 'Absent';
        attendance.isEarlyLeave = true;
      }

      await attendance.save();
    }

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markWFH = async (req, res) => {
  try {
    const { userId, dates } = req.body; // Expecting an array of dates
    if (!Array.isArray(dates)) return res.status(400).json({ success: false, message: 'Dates must be an array' });

    for (const d of dates) {
      const targetDate = new Date(d);
      targetDate.setHours(0, 0, 0, 0);

      let attendance = await Attendance.findOne({ user: userId, date: targetDate });
      if (!attendance) {
        attendance = new Attendance({ user: userId, date: targetDate, isWFH: true });
      } else {
        attendance.isWFH = true;
      }
      await attendance.save();
    }
    res.status(200).json({ success: true, message: 'WFH dates marked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getWFHDates = async (req, res) => {
  try {
    const { userId } = req.params;
    const records = await Attendance.find({ user: userId, isWFH: true }).sort({ date: 1 });
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeWFH = async (req, res) => {
  try {
    const { userId, date } = req.body;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({ user: userId, date: targetDate });
    if (attendance) {
      if (attendance.clockIn) {
        attendance.isWFH = false; // Only unmark WFH if they haven't used it to clock in? 
        // Actually, let's just unmark it.
        attendance.isWFH = false;
        await attendance.save();
      } else {
        await Attendance.findByIdAndDelete(attendance._id);
      }
    }
    res.status(200).json({ success: true, message: 'WFH removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.startBreak = async (req, res) => {
  try {
    const { userId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({ user: userId, date: today });
    if (attendance) {
      attendance.breaks.push({ start: new Date(), end: null });
      await attendance.save();
    }

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.endBreak = async (req, res) => {
  try {
    const { userId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({ user: userId, date: today });
    if (attendance && attendance.breaks.length > 0) {
      const lastBreak = attendance.breaks[attendance.breaks.length - 1];
      if (!lastBreak.end) {
        lastBreak.end = new Date();
        await attendance.save();
      }
    }

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTodayAttendance = async (req, res) => {
  try {
    await autoClosePendingClockOuts();
    const { userId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({ user: userId, date: today });
    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllAttendance = async (req, res) => {
  try {
    await autoClosePendingClockOuts();
    const { date, month, user } = req.query;
    let query = {};
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (month) {
      const [year, m] = month.split('-');
      const startOfMonth = new Date(year, parseInt(m) - 1, 1);
      const endOfMonth = new Date(year, parseInt(m), 0, 23, 59, 59);
      const endLimit = endOfMonth < today ? endOfMonth : today;
      query.date = { $gte: startOfMonth, $lte: endLimit };
    } else if (date) {
      const baseDate = new Date(date);
      const startRange = new Date(baseDate.getTime() - 6 * 3600000);
      const endRange = new Date(baseDate.getTime() + 18 * 3600000);
      const endLimit = endRange < today ? endRange : today;
      query.date = { $gte: startRange, $lte: endLimit };
    }
    if (user) {
      query.user = user;
    }
    const attendance = await Attendance.find(query).populate({
      path: 'user',
      select: 'name employeeId role lastActive',
      populate: {
        path: 'role',
        select: 'name'
      }
    }).sort({ date: -1 });
    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMonthlyStats = async (req, res) => {
  try {
    await autoClosePendingClockOuts();
    const { userId } = req.params;
    const { month, year } = req.query;
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const endLimit = endOfMonth < today ? endOfMonth : today;

    const attendances = await Attendance.find({
      user: userId,
      date: { $gte: startOfMonth, $lte: endLimit }
    });

    const stats = {
      present: attendances.filter(a => a.status === 'Full-Day' || a.status === 'Present' || a.status === 'P' || a.status === 'LP').length,
      halfDay: attendances.filter(a => a.status === 'Half-Day' || a.status === 'HD').length,
      absent: attendances.filter(a => a.status === 'Absent').length,
      late: attendances.filter(a => a.isLate).length,
      total: attendances.length
    };

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addLocationLog = async (req, res) => {
  try {
    const { userId, location } = req.body;
    if (!userId || !location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({ user: userId, date: today });
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found for today' });
    }

    if (attendance.clockOut) {
      return res.status(400).json({ success: false, message: 'Already clocked out' });
    }

    const { address, pincode } = await getAddressFromCoords(location.lat, location.lng);
    attendance.locationLogs.push({
      time: new Date(),
      lat: location.lat,
      lng: location.lng,
      address,
      pincode
    });

    await attendance.save();
    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMarketingTracking = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Find roles corresponding to Marketing Manager and Marketing Executive
    const Role = require('../models/Role');
    const marketingRoles = await Role.find({
      name: { $in: ['Marketing Manager', 'Marketing Executive', 'BDM'] }
    });
    const roleIds = marketingRoles.map(r => r._id);

    const marketingUsers = await User.find({ role: { $in: roleIds } }).populate('role');
    const userIds = marketingUsers.map(u => u._id);

    const attendances = await Attendance.find({
      user: { $in: userIds },
      date: targetDate
    }).populate({
      path: 'user',
      select: 'name employeeId role lastActive',
      populate: {
        path: 'role',
        select: 'name'
      }
    });

    res.status(200).json({ success: true, data: attendances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

