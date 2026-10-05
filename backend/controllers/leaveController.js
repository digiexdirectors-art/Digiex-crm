const User = require('../models/User');
const LeaveType = require('../models/LeaveType');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalance = require('../models/LeaveBalance');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const SalarySlip = require('../models/SalarySlip');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const sendEmailNotification = async (toEmails, subject, htmlBody) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-password'
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: Array.isArray(toEmails) ? toEmails.join(',') : toEmails,
      subject,
      html: htmlBody
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email notification sent to: ${toEmails}`);
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
};


// Helper to calculate working days (excludes Sundays, Holidays, and User off-Saturdays)
const calculateWorkingDays = async (userId, fromDate, toDate) => {
  const user = await User.findById(userId);
  if (!user) return 0;
  
  const start = new Date(fromDate);
  const end = new Date(toDate);
  
  // Get holidays in range
  const holidays = await Holiday.find({
    date: { $gte: start, $lte: end }
  });
  
  let workingDays = 0;
  const loopDate = new Date(start);
  while (loopDate <= end) {
    const dayOfWeek = loopDate.getDay(); // 0 = Sunday, 6 = Saturday
    let isNonWorking = false;
    
    if (dayOfWeek === 0) {
      isNonWorking = true;
    } else if (holidays.some(h => new Date(h.date).toDateString() === loopDate.toDateString())) {
      isNonWorking = true;
    } else if (dayOfWeek === 6) {
      const dayOfMonth = loopDate.getDate();
      const weekOfMonth = Math.ceil(dayOfMonth / 7);
      if (user.offSaturdays?.includes(weekOfMonth)) {
        isNonWorking = true;
      }
    }
    
    if (!isNonWorking) {
      workingDays++;
    }
    loopDate.setDate(loopDate.getDate() + 1);
  }
  return workingDays;
};

// 1. Calculate & Get Leave Balances for User (Initializes if not present)
exports.calculateLeaveBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const currentYear = new Date().getFullYear();
    
    // Find all active leave types
    const activeTypes = await LeaveType.find({ isActive: true });
    
    // Filter active types based on eligibility
    const joiningDate = new Date(user.joiningDate);
    const serviceDays = !isNaN(joiningDate.getTime()) ? (Date.now() - joiningDate.getTime()) / (1000 * 60 * 60 * 24) : 0;
    const isFemale = (user.gender || '').toLowerCase() === 'female';
    const isEligibleForML = isFemale;

    let eligibleActiveTypes = activeTypes;
    if (!isEligibleForML) {
      eligibleActiveTypes = activeTypes.filter(t => t.code !== 'ML');
      // If they had an existing ML balance, remove it
      const mlType = activeTypes.find(t => t.code === 'ML');
      if (mlType) {
        await LeaveBalance.deleteMany({ employee: userId, leaveType: mlType._id });
      }
    }

    // Find existing balances
    let balances = await LeaveBalance.find({ employee: userId, year: currentYear }).populate('leaveType');
    
    // If any active type doesn't have a balance record, initialize it
    const missingTypes = eligibleActiveTypes.filter(t => !balances.some(b => b.leaveType._id.toString() === t._id.toString()));
    
    if (missingTypes.length > 0) {
      const isJoinedThisYear = !isNaN(joiningDate.getTime()) && joiningDate.getFullYear() === currentYear;
      
      const newBalances = [];
      for (const type of missingTypes) {
        let allocated = type.annualAllocation;
        
        // Pro-rate if joined this year
        if (isJoinedThisYear && allocated > 0 && type.code !== 'ML') {
          const monthsRemaining = 12 - joiningDate.getMonth();
          allocated = Math.round((allocated / 12) * monthsRemaining * 2) / 2; // round to nearest 0.5
        }
        
        newBalances.push({
          employee: userId,
          leaveType: type._id,
          allocated,
          used: 0,
          remaining: allocated,
          year: currentYear
        });
      }
      
      if (newBalances.length > 0) {
        await LeaveBalance.insertMany(newBalances);
      }
    }

    // Re-fetch the final balance list (only returning what is in the eligible active types)
    const finalBalances = await LeaveBalance.find({ 
      employee: userId, 
      year: currentYear,
      leaveType: { $in: eligibleActiveTypes.map(t => t._id) }
    }).populate('leaveType');

    res.status(200).json({ success: true, data: finalBalances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get Leave Types (CRUD policies)
exports.getLeaveTypes = async (req, res) => {
  try {
    const types = await LeaveType.find();
    res.status(200).json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLeaveType = async (req, res) => {
  try {
    const { name, code, paid, annualAllocation, carryForward, encashable, maxConsecutiveDays, isActive } = req.body;
    
    let type = await LeaveType.findOne({ code: code.toUpperCase() });
    if (type) {
      type.name = name;
      type.paid = paid;
      type.annualAllocation = annualAllocation;
      type.carryForward = carryForward;
      type.encashable = encashable;
      type.maxConsecutiveDays = maxConsecutiveDays;
      type.isActive = isActive;
      await type.save();
    } else {
      type = new LeaveType({
        name,
        code: code.toUpperCase(),
        paid,
        annualAllocation,
        carryForward,
        encashable,
        maxConsecutiveDays,
        isActive
      });
      await type.save();
    }

    // Write to audit log
    await AuditLog.create({
      action: 'CREATE/UPDATE',
      module: 'LEAVE_TYPE',
      documentId: type._id,
      details: type,
      performedBy: req.body.performedBy || null
    });

    res.status(200).json({ success: true, data: type });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Apply Leave (Employee Action with Validations)
exports.applyLeave = async (req, res) => {
  try {
    const { 
      employeeId, 
      leaveTypeId, 
      fromDate, 
      toDate, 
      halfDay, 
      halfDaySession, 
      reason, 
      attachment,
      maternityScenario = 'None',
      expectedDeliveryDate
    } = req.body;
    
    const employee = await User.findById(employeeId).populate('role');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    
    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) return res.status(404).json({ success: false, message: 'Leave type not found' });

    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    if (start > end) return res.status(400).json({ success: false, message: 'From Date cannot be after To Date' });
    
    const currentYear = start.getFullYear();

    // 1. Calculate leave days
    let totalDays = 0;
    if (halfDay) {
      totalDays = 0.5;
    } else {
      totalDays = await calculateWorkingDays(employeeId, fromDate, toDate);
      if (totalDays === 0) {
        return res.status(400).json({ success: false, message: 'Cannot apply leave on holidays or weekly off days' });
      }
    }

    // 2. Validate max consecutive days policy
    if (leaveType.maxConsecutiveDays > 0 && totalDays > leaveType.maxConsecutiveDays) {
      return res.status(400).json({ success: false, message: `Maximum consecutive days allowed for ${leaveType.name} is ${leaveType.maxConsecutiveDays} days` });
    }

    // 3. Custom validations for CL & SL (Shared pool of 22 days, monthly accrual after 3 months probation)
    if (['CL', 'SL'].includes(leaveType.code)) {
      const joiningDate = new Date(employee.joiningDate);
      if (!isNaN(joiningDate.getTime())) {
        const yearOfLeave = start.getFullYear();
        const monthOfLeave = start.getMonth() + 1; // 1-12
        const yearOfJoining = joiningDate.getFullYear();
        const monthOfJoining = joiningDate.getMonth() + 1;
        
        let monthsSinceJoining = 0;
        if (yearOfLeave === yearOfJoining) {
          monthsSinceJoining = monthOfLeave - monthOfJoining;
        } else {
          monthsSinceJoining = (yearOfLeave - yearOfJoining) * 12 + (monthOfLeave - monthOfJoining);
        }

        // Rule: no leaves allowed in first 3 months
        if (monthsSinceJoining < 3) {
          return res.status(400).json({ success: false, message: 'Leaves are not allowed during the first 3 months of employment (probation period).' });
        }

        // Rule: accrues 2 leaves per month after 3 months, storing up to Dec
        let confirmedMonths = 0;
        if (yearOfLeave === yearOfJoining) {
          confirmedMonths = monthOfLeave - (monthOfJoining + 3) + 1;
        } else {
          // If joined in a previous year, they start with Jan as month 1 of the current year (fully confirmed from Jan)
          confirmedMonths = monthOfLeave;
        }
        
        const accruedLeaves = Math.min(22, 2 * confirmedMonths);

        // Fetch all approved/pending CL and SL leaves taken by employee in the current year
        const clSlTypes = await LeaveType.find({ code: { $in: ['CL', 'SL'] } });
        const clSlIds = clSlTypes.map(t => t._id);
        
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

        const leavesThisYear = await LeaveRequest.find({
          employee: employeeId,
          status: { $in: ['Approved', 'Pending Manager', 'Pending HR'] },
          leaveType: { $in: clSlIds },
          fromDate: { $gte: startOfYear, $lte: endOfYear }
        });

        const totalUsed = leavesThisYear.reduce((acc, r) => acc + r.totalDays, 0);

        if (totalUsed + totalDays > 22) {
          return res.status(400).json({ success: false, message: `Annual paid leave quota exceeded. You have a maximum of 22 days per year. Already used/pending: ${totalUsed} day(s).` });
        }

        if (totalUsed + totalDays > accruedLeaves) {
          return res.status(400).json({ success: false, message: `Accrual limit exceeded. You accrue 2 leaves per month after 3 months probation. Accrued up to this month: ${accruedLeaves} days. Already used/pending: ${totalUsed} day(s).` });
        }
      }
    }

    // 4. Custom validations for Maternity Leave (ML)
    if (leaveType.code === 'ML') {
      if (employee.gender !== 'Female') {
        return res.status(400).json({ success: false, message: 'Maternity Leave is only applicable to female employees.' });
      }

      if (!attachment) {
        return res.status(400).json({ success: false, message: 'Medical certificate upload is required for Maternity Leave.' });
      }

      const joiningDate = new Date(employee.joiningDate);
      if (isNaN(joiningDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Employee joining date is missing. Eligibility cannot be checked.' });
      }

      const serviceDays = (start.getTime() - joiningDate.getTime()) / (1000 * 60 * 60 * 24);
      if (serviceDays < 80) {
        return res.status(400).json({ success: false, message: 'Female employees must complete at least 80 days of active service to be eligible for Maternity Leave.' });
      }

      let maxAllowedDays = 0;
      if (maternityScenario === 'First two surviving children') {
        maxAllowedDays = 26 * 7; // 182 days
        
        // Up to 8 weeks (56 days) can be taken before delivery
        if (expectedDeliveryDate && start < new Date(expectedDeliveryDate)) {
          const preDeliveryDays = (new Date(expectedDeliveryDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
          if (preDeliveryDays > 56) {
            return res.status(400).json({ success: false, message: 'Up to 8 weeks (56 days) of Maternity Leave can be taken before the expected delivery date.' });
          }
        }
      } else if (['Third or subsequent child', 'Adoption', 'Surrogacy'].includes(maternityScenario)) {
        maxAllowedDays = 12 * 7; // 84 days
      } else {
        return res.status(400).json({ success: false, message: 'Please select a valid Maternity Leave scenario.' });
      }

      if (totalDays > maxAllowedDays) {
        return res.status(400).json({ success: false, message: `Requested duration exceeds the maximum entitlement for this scenario: ${maxAllowedDays} days (${maxAllowedDays / 7} weeks).` });
      }
    }

    // 5. Validate duplicate/overlapping leave requests
    const overlappingRequest = await LeaveRequest.findOne({
      employee: employeeId,
      status: { $in: ['Pending Manager', 'Pending HR', 'Approved'] },
      $or: [
        { fromDate: { $lte: end }, toDate: { $gte: start } }
      ]
    });
    if (overlappingRequest) {
      return res.status(400).json({ success: false, message: 'You have already applied for leave during these dates' });
    }

    // 6. Validate payroll locked period
    const month = start.getMonth() + 1;
    const year = start.getFullYear();
    const slipExists = await SalarySlip.findOne({ user: employeeId, month, year });
    if (slipExists) {
      return res.status(400).json({ success: false, message: `Payroll is locked for ${month}/${year}. Leave application blocked.` });
    }

    // 7. Validate attendance already marked
    const markedAttendance = await Attendance.findOne({
      user: employeeId,
      date: { $gte: start, $lte: end },
      status: { $in: ['Present', 'P', 'LP', 'Full-Day'] }
    });
    if (markedAttendance && !halfDay) {
      return res.status(400).json({ success: false, message: `Attendance is already marked as Present on ${new Date(markedAttendance.date).toLocaleDateString()}. Cannot apply leave.` });
    }

    // 8. Validate SL medical document upload requirement (for SL exceeding 2 days)
    if (leaveType.code === 'SL' && totalDays > 2 && !attachment) {
      return res.status(400).json({ success: false, message: 'Medical certificate upload is required for Sick Leave exceeding 2 days' });
    }

    // Create the leave request
    const managerId = employee.reportingManager || null;
    const leaveRequest = new LeaveRequest({
      employee: employeeId,
      leaveType: leaveTypeId,
      fromDate: start,
      toDate: end,
      totalDays,
      halfDay,
      halfDaySession: halfDay ? halfDaySession : 'None',
      reason,
      attachment,
      maternityScenario: leaveType.code === 'ML' ? maternityScenario : 'None',
      expectedDeliveryDate: leaveType.code === 'ML' ? expectedDeliveryDate : null,
      status: managerId ? 'Pending Manager' : 'Pending HR',
      reportingManager: managerId
    });
    await leaveRequest.save();

    // Trigger Notifications to reporting manager, HR, and Admin
    const recipientIds = [];
    const recipientEmails = [];

    if (managerId) {
      recipientIds.push(managerId.toString());
      const mgr = await User.findById(managerId);
      if (mgr && mgr.email) {
        recipientEmails.push(mgr.email);
      }
    }

    const allUsersForNotifications = await User.find().populate({
      path: 'role',
      populate: {
        path: 'department'
      }
    });
    allUsersForNotifications.forEach(u => {
      const rName = (u.role?.name || '').toLowerCase();
      const dName = (u.role?.department?.name || u.role?.department || '').toLowerCase();
      const isHRUser = rName.includes('hr') || rName.includes('human resource') || dName.includes('hr') || dName.includes('human resource');
      const isAdminUser = rName.includes('admin') || rName.includes('super admin');
      if (isHRUser || isAdminUser) {
        recipientIds.push(u._id.toString());
        if (u.email) {
          recipientEmails.push(u.email);
        }
      }
    });

    const uniqueRecipients = [...new Set(recipientIds)];
    const uniqueEmails = [...new Set(recipientEmails)];

    if (uniqueRecipients.length > 0) {
      await Notification.create({
        title: `New Leave Request: ${employee.name}`,
        message: `${employee.name} has requested ${totalDays} day(s) of ${leaveType.name} from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}. Reason: ${reason}`,
        recipients: uniqueRecipients,
        roles: ['sales manager', 'service manager', 'team lead', 'hr', 'admin', 'super admin'],
        leaveId: leaveRequest._id
      });
    }

    if (uniqueEmails.length > 0) {
      const emailSubject = `New Leave Request: ${employee.name}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
          <h2 style="color: #1e3a8a;">New Leave Request</h2>
          <p>Dear Sir/Madam,</p>
          <p><strong>${employee.name}</strong> has submitted a new leave request details:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Leave Type</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${leaveType.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Duration</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${start.toLocaleDateString()} to ${end.toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Days</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${totalDays} day(s)</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${reason}</td>
            </tr>
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">This is an automated email notification.</p>
        </div>
      `;
      sendEmailNotification(uniqueEmails, emailSubject, emailHtml);
    }

    // Write audit log
    await AuditLog.create({
      action: 'APPLY',
      module: 'LEAVE',
      documentId: leaveRequest._id,
      details: leaveRequest,
      performedBy: employeeId
    });

    res.status(200).json({ success: true, data: leaveRequest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get Leave Requests
exports.getLeaveRequests = async (req, res) => {
  try {
    const { userId, role, department } = req.query;
    
    let query = {};
    const roleLower = (role || '').toLowerCase();
    
    // Permission filters
    const deptLower = (department || '').toLowerCase().trim();
    const isHRUser = roleLower.includes('hr') || roleLower.includes('human resource') || deptLower.includes('hr') || deptLower.includes('human resource');
    const isAdminUser = roleLower.includes('super admin') || roleLower === 'admin';

    if (isAdminUser || isHRUser) {
      query = {};
    } else if (roleLower.includes('manager') || roleLower.includes('lead') || roleLower.includes('head')) {
      let deptRoleIds = [];
      if (department) {
        try {
          const Department = require('../models/Department');
          const Role = require('../models/Role');
          const deptDoc = await Department.findOne({ name: { $regex: new RegExp('^' + department.trim() + '$', 'i') } });
          if (deptDoc) {
            const deptRoles = await Role.find({ department: deptDoc._id });
            deptRoleIds = deptRoles.map(r => r._id);
          }
        } catch (err) {
          console.error('Error fetching department roles in getLeaveRequests:', err);
        }
      }

      const deptEmployees = await User.find({ 
        $or: [
          { reportingManager: userId },
          { role: { $in: deptRoleIds } }
        ]
      }).select('_id');
      const empIds = deptEmployees.map(e => e._id);
      
      query = { 
        $or: [
          { employee: userId },
          { employee: { $in: empIds } },
          { reportingManager: userId }
        ] 
      };
    } else {
      query = { employee: userId };
    }

    const requests = await LeaveRequest.find(query)
      .populate({
        path: 'employee',
        select: 'name employeeId role email',
        populate: {
          path: 'role',
          select: 'name department',
          populate: {
            path: 'department',
            select: 'name'
          }
        }
      })
      .populate('leaveType')
      .populate('reportingManager', 'name')
      .sort({ createdAt: -1 });

    // Format employee.department to match what the frontend expects
    const requestsWithDept = requests.map(req => {
      const reqObj = req.toObject();
      if (reqObj.employee && reqObj.employee.role && reqObj.employee.role.department) {
        reqObj.employee.department = reqObj.employee.role.department;
      }
      return reqObj;
    });

    res.status(200).json({ success: true, data: requestsWithDept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Approve Leave Request (Workflow Action)
exports.approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { actorId, role, remarks } = req.body;
    
    const request = await LeaveRequest.findById(id).populate('employee').populate('leaveType');
    if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
    
    const roleLower = (role || '').toLowerCase();
    const currentYear = new Date(request.fromDate).getFullYear();

    if (request.status === 'Pending Manager') {
      if (request.reportingManager && request.reportingManager.toString() !== actorId) {
        return res.status(403).json({ success: false, message: 'You are not authorized to approve this request (Manager approval required)' });
      }
      
      request.status = 'Pending HR';
      request.approvalTimeline.push({
        role: 'Manager',
        user: actorId,
        action: 'Approved',
        remarks,
        date: new Date()
      });
      await request.save();

      // Clean up previous pending notifications
      await Notification.deleteMany({ leaveId: request._id });

      // Notify HR
      const hrs = await User.find().populate({
        path: 'role',
        populate: {
          path: 'department'
        }
      });
      const hrUsers = hrs.filter(h => {
        const rName = (h.role?.name || '').toLowerCase();
        const dName = (h.role?.department?.name || h.role?.department || '').toLowerCase();
        return rName.includes('hr') || rName.includes('human resource') || dName.includes('hr') || dName.includes('human resource') || rName.includes('admin') || rName.includes('super admin');
      });
      const hrIds = hrUsers.filter(h => {
        const rName = (h.role?.name || '').toLowerCase();
        const dName = (h.role?.department?.name || h.role?.department || '').toLowerCase();
        return rName.includes('hr') || rName.includes('human resource') || dName.includes('hr') || dName.includes('human resource');
      }).map(h => h._id.toString());
      const hrEmails = hrUsers.map(h => h.email).filter(Boolean);
      
      await Notification.create({
        title: `Leave Pending HR Approval: ${request.employee.name}`,
        message: `${request.employee.name}'s leave request for ${request.totalDays} day(s) was approved by Manager and is pending HR approval.`,
        recipients: hrIds,
        roles: ['hr'],
        leaveId: request._id
      });

      if (hrEmails.length > 0) {
        const emailSubject = `Leave Pending HR Approval: ${request.employee.name}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
            <h2 style="color: #c2410c;">Pending HR Approval</h2>
            <p><strong>${request.employee.name}</strong>'s leave request for ${request.totalDays} day(s) was approved by Manager and is pending HR approval.</p>
            <p>Remarks: ${remarks || 'None'}</p>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">This is an automated email notification.</p>
          </div>
        `;
        sendEmailNotification(hrEmails, emailSubject, emailHtml);
      }

    } else if (request.status === 'Pending HR') {
      const isHR = roleLower.includes('hr') || roleLower.includes('human resource');
      const isAdmin = roleLower.includes('admin') || roleLower.includes('super admin');
      
      if (!isHR && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Only HR or Admin can perform final approval' });
      }

      request.status = 'Approved';
      request.approvalTimeline.push({
        role: 'HR',
        user: actorId,
        action: 'Approved',
        remarks,
        date: new Date()
      });
      await request.save();

      // Clean up previous pending notifications
      await Notification.deleteMany({ leaveId: request._id });

      // 1. Decrement Balance (only if paid leave)
      if (request.leaveType.paid) {
        if (['CL', 'SL'].includes(request.leaveType.code)) {
          // Sync all CL and SL balance records for this year
          const clSlTypes = await LeaveType.find({ code: { $in: ['CL', 'SL'] } });
          const clSlIds = clSlTypes.map(t => t._id);
          
          const balancesToUpdate = await LeaveBalance.find({
            employee: request.employee._id,
            leaveType: { $in: clSlIds },
            year: currentYear
          });
          
          for (const bal of balancesToUpdate) {
            bal.used += request.totalDays;
            bal.remaining = Math.max(0, bal.allocated - bal.used);
            await bal.save();
          }
        } else {
          // Standard update for ML
          const balance = await LeaveBalance.findOne({ employee: request.employee._id, leaveType: request.leaveType._id, year: currentYear });
          if (balance) {
            balance.used += request.totalDays;
            balance.remaining = Math.max(0, balance.allocated - balance.used);
            await balance.save();
          }
        }
      }

      // 2. Automatically mark Attendance records as Leave/LWP
      const attendanceStatus = request.leaveType.paid ? 'Leave' : 'LWP';
      const start = new Date(request.fromDate);
      const end = new Date(request.toDate);
      
      const holidays = await Holiday.find({ date: { $gte: start, $lte: end } });
      
      const loopDate = new Date(start);
      while (loopDate <= end) {
        const dayOfWeek = loopDate.getDay();
        let isNonWorking = false;
        
        if (dayOfWeek === 0) {
          isNonWorking = true;
        } else if (holidays.some(h => new Date(h.date).toDateString() === loopDate.toDateString())) {
          isNonWorking = true;
        } else if (dayOfWeek === 6) {
          const dayOfMonth = loopDate.getDate();
          const weekOfMonth = Math.ceil(dayOfMonth / 7);
          if (request.employee.offSaturdays?.includes(weekOfMonth)) {
            isNonWorking = true;
          }
        }

        if (!isNonWorking) {
          let attendance = await Attendance.findOne({ user: request.employee._id, date: new Date(loopDate) });
          if (!attendance) {
            attendance = new Attendance({
              user: request.employee._id,
              date: new Date(loopDate),
            });
          }
          
          if (request.halfDay) {
            attendance.status = 'Half-Day';
          } else {
            attendance.status = attendanceStatus;
          }
          await attendance.save();
        }
        loopDate.setDate(loopDate.getDate() + 1);
      }

      // Notify Employee
      await Notification.create({
        title: `Leave Request APPROVED`,
        message: `Your request for ${request.totalDays} day(s) of ${request.leaveType.name} starting ${new Date(request.fromDate).toLocaleDateString()} has been APPROVED.`,
        recipients: [request.employee._id.toString()]
      });

      if (request.employee.email) {
        const subject = `Leave Request APPROVED`;
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
            <h2 style="color: #166534;">Leave Request Approved</h2>
            <p>Dear ${request.employee.name},</p>
            <p>Your leave request for <strong>${request.totalDays} day(s)</strong> of <strong>${request.leaveType.name}</strong> starting <strong>${new Date(request.fromDate).toLocaleDateString()}</strong> has been <strong>APPROVED</strong>.</p>
            <p>Remarks: ${remarks || 'None'}</p>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">This is an automated email notification.</p>
          </div>
        `;
        sendEmailNotification(request.employee.email, subject, htmlBody);
      }
    }

    // Write audit log
    await AuditLog.create({
      action: 'APPROVE',
      module: 'LEAVE',
      documentId: request._id,
      details: { status: request.status, remarks },
      performedBy: actorId
    });

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Reject Leave Request
exports.rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { actorId, role, remarks } = req.body;
    
    const request = await LeaveRequest.findById(id).populate('employee').populate('leaveType');
    if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });

    request.status = 'Rejected';
    request.comments = remarks;
    request.approvalTimeline.push({
      role: (role.toLowerCase().includes('hr') || role.toLowerCase().includes('human resource')) ? 'HR' : 'Manager',
      user: actorId,
      action: 'Rejected',
      remarks,
      date: new Date()
    });
    await request.save();

    // Clean up previous pending notifications
    await Notification.deleteMany({ leaveId: request._id });

    // Notify Employee
    await Notification.create({
      title: `Leave Request REJECTED`,
      message: `Your request for ${request.totalDays} day(s) of ${request.leaveType.name} starting ${new Date(request.fromDate).toLocaleDateString()} has been REJECTED. Remarks: ${remarks}`,
      recipients: [request.employee._id.toString()]
    });

    if (request.employee.email) {
      const subject = `Leave Request REJECTED`;
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
          <h2 style="color: #991b1b;">Leave Request Rejected</h2>
          <p>Dear ${request.employee.name},</p>
          <p>Your leave request for <strong>${request.totalDays} day(s)</strong> of <strong>${request.leaveType.name}</strong> starting <strong>${new Date(request.fromDate).toLocaleDateString()}</strong> has been <strong>REJECTED</strong>.</p>
          <p>Remarks/Reason: ${remarks || 'None'}</p>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">This is an automated email notification.</p>
        </div>
      `;
      sendEmailNotification(request.employee.email, subject, htmlBody);
    }

    // Write audit log
    await AuditLog.create({
      action: 'REJECT',
      module: 'LEAVE',
      documentId: request._id,
      details: { status: 'Rejected', remarks },
      performedBy: actorId
    });

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Cancel Leave Request (Employee Action)
exports.cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { actorId } = req.body;
    
    const request = await LeaveRequest.findById(id).populate('employee').populate('leaveType');
    if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
    
    if (request.status === 'Approved') {
      const currentYear = new Date(request.fromDate).getFullYear();
      if (request.leaveType.paid) {
        if (['CL', 'SL'].includes(request.leaveType.code)) {
          const clSlTypes = await LeaveType.find({ code: { $in: ['CL', 'SL'] } });
          const clSlIds = clSlTypes.map(t => t._id);
          const balancesToUpdate = await LeaveBalance.find({
            employee: request.employee._id,
            leaveType: { $in: clSlIds },
            year: currentYear
          });
          for (const bal of balancesToUpdate) {
            bal.used = Math.max(0, bal.used - request.totalDays);
            bal.remaining = Math.max(0, bal.allocated - bal.used);
            await bal.save();
          }
        } else {
          const balance = await LeaveBalance.findOne({ employee: request.employee._id, leaveType: request.leaveType._id, year: currentYear });
          if (balance) {
            balance.used = Math.max(0, balance.used - request.totalDays);
            balance.remaining = Math.max(0, balance.allocated - balance.used);
            await balance.save();
          }
        }
      }

      // Revert Attendance records
      const start = new Date(request.fromDate);
      const end = new Date(request.toDate);
      await Attendance.deleteMany({
        user: request.employee._id,
        date: { $gte: start, $lte: end },
        status: { $in: ['Leave', 'LWP'] }
      });
    }

    request.status = 'Cancelled';
    await request.save();

    if (request.employee.email) {
      const subject = `Leave Request Cancelled`;
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
          <h2 style="color: #475569;">Leave Request Cancelled</h2>
          <p>Dear ${request.employee.name},</p>
          <p>Your leave request for <strong>${request.totalDays} day(s)</strong> of <strong>${request.leaveType.name}</strong> starting <strong>${new Date(request.fromDate).toLocaleDateString()}</strong> has been cancelled.</p>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">This is an automated email notification.</p>
        </div>
      `;
      sendEmailNotification(request.employee.email, subject, htmlBody);
      
      const cancellationRecipients = [];
      if (request.reportingManager) {
        const mgr = await User.findById(request.reportingManager);
        if (mgr && mgr.email) cancellationRecipients.push(mgr.email);
      }
      const allUsersCancel = await User.find().populate('role');
      allUsersCancel.forEach(u => {
        const rName = (u.role?.name || '').toLowerCase();
        if (rName.includes('hr') || rName.includes('human resource') || rName.includes('admin') || rName.includes('super admin')) {
          if (u.email) cancellationRecipients.push(u.email);
        }
      });
      const uniqueCancelEmails = [...new Set(cancellationRecipients)];
      if (uniqueCancelEmails.length > 0) {
        const adminSubject = `Leave Request Cancelled: ${request.employee.name}`;
        const adminHtmlBody = `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
            <h2 style="color: #475569;">Leave Request Cancelled</h2>
            <p>Hello,</p>
            <p><strong>${request.employee.name}</strong> has cancelled their leave request for <strong>${request.totalDays} day(s)</strong> of <strong>${request.leaveType.name}</strong> starting <strong>${new Date(request.fromDate).toLocaleDateString()}</strong>.</p>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">This is an automated email notification.</p>
          </div>
        `;
        sendEmailNotification(uniqueCancelEmails, adminSubject, adminHtmlBody);
      }
    }

    // Write audit log
    await AuditLog.create({
      action: 'CANCEL',
      module: 'LEAVE',
      documentId: request._id,
      details: { status: 'Cancelled' },
      performedBy: actorId
    });

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Adjust Employee Leave Balance (HR Action)
exports.adjustBalance = async (req, res) => {
  try {
    const { employeeId, leaveTypeId, allocated, used, remaining, remarks, performedBy } = req.body;
    const currentYear = new Date().getFullYear();

    const selectedType = await LeaveType.findById(leaveTypeId);
    if (!selectedType) return res.status(404).json({ success: false, message: 'Leave type not found' });

    let balancesToUpdate = [];
    if (['CL', 'SL'].includes(selectedType.code)) {
      // Find both CL and SL to keep in sync
      const clSlTypes = await LeaveType.find({ code: { $in: ['CL', 'SL'] } });
      for (const t of clSlTypes) {
        let bal = await LeaveBalance.findOne({ employee: employeeId, leaveType: t._id, year: currentYear });
        if (!bal) {
          bal = new LeaveBalance({
            employee: employeeId,
            leaveType: t._id,
            allocated,
            used,
            remaining,
            year: currentYear
          });
        } else {
          bal.allocated = allocated;
          bal.used = used;
          bal.remaining = remaining;
        }
        await bal.save();
        balancesToUpdate.push(bal);
      }
    } else {
      let balance = await LeaveBalance.findOne({ employee: employeeId, leaveType: leaveTypeId, year: currentYear });
      if (!balance) {
        balance = new LeaveBalance({
          employee: employeeId,
          leaveType: leaveTypeId,
          allocated,
          used,
          remaining,
          year: currentYear
        });
      } else {
        balance.allocated = allocated;
        balance.used = used;
        balance.remaining = remaining;
      }
      await balance.save();
      balancesToUpdate.push(balance);
    }

    // Trigger Notification
    await Notification.create({
      title: `Leave Balance Adjusted`,
      message: `Your leave balance has been updated by HR. New remaining balance: ${remaining} day(s).`,
      recipients: [employeeId]
    });

    // Log action
    await AuditLog.create({
      action: 'ADJUST_BALANCE',
      module: 'LEAVE',
      details: { allocated, used, remaining, remarks, employeeId, leaveTypeId },
      performedBy
    });

    res.status(200).json({ success: true, data: balancesToUpdate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Bulk Leave Allocation (HR Action)
exports.bulkAllocate = async (req, res) => {
  try {
    const { employeeIds, leaveTypeId, allocated, remarks, performedBy } = req.body;
    const currentYear = new Date().getFullYear();

    const selectedType = await LeaveType.findById(leaveTypeId);
    if (!selectedType) return res.status(404).json({ success: false, message: 'Leave type not found' });

    const results = [];
    const clSlTypes = ['CL', 'SL'].includes(selectedType.code) 
      ? await LeaveType.find({ code: { $in: ['CL', 'SL'] } })
      : [selectedType];

    for (const employeeId of employeeIds) {
      for (const t of clSlTypes) {
        let balance = await LeaveBalance.findOne({ employee: employeeId, leaveType: t._id, year: currentYear });
        if (!balance) {
          balance = new LeaveBalance({
            employee: employeeId,
            leaveType: t._id,
            allocated,
            used: 0,
            remaining: allocated,
            year: currentYear
          });
        } else {
          balance.allocated = allocated;
          balance.remaining = Math.max(0, allocated - balance.used);
        }
        await balance.save();
        results.push(balance);
      }
      
      // Notification
      await Notification.create({
        title: `Leave Balance Allocated`,
        message: `Your allocated quota has been bulk-updated by HR. Allocated: ${allocated} day(s).`,
        recipients: [employeeId]
      });
    }

    // Log action
    await AuditLog.create({
      action: 'BULK_ALLOCATE',
      module: 'LEAVE',
      details: { count: employeeIds.length, leaveTypeId, allocated, remarks },
      performedBy
    });

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Daily Workflow Inaction Escalation Engine
exports.checkManagerEscalations = async () => {
  try {
    console.log('Running Leave Manager escalation checks...');
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    // Find requests still pending manager approval after 48h
    const pendingRequests = await LeaveRequest.find({
      status: 'Pending Manager',
      createdAt: { $lte: fortyEightHoursAgo }
    }).populate('employee');

    for (const req of pendingRequests) {
      if (req.reportingManager) {
        await Notification.create({
          title: `URGENT: Leave Request Pending Approval`,
          message: `The leave request from ${req.employee.name} is pending your approval for over 48 hours. Please review immediately.`,
          recipients: [req.reportingManager.toString()],
          roles: ['sales manager', 'service manager', 'team lead']
        });
      }

      const fourDaysAgo = new Date(Date.now() - 96 * 60 * 60 * 1000);
      if (req.createdAt <= fourDaysAgo) {
        req.status = 'Pending HR';
        req.approvalTimeline.push({
          role: 'System',
          action: 'Approved',
          remarks: 'Escalated automatically to HR due to manager inaction for 96 hours.',
          date: new Date()
        });
        await req.save();

        const hrs = await User.find().populate('role');
        const hrIds = hrs.filter(h => {
          const rName = (h.role?.name || '').toLowerCase();
          return rName.includes('hr') || rName.includes('human resource');
        }).map(h => h._id.toString());
        
        await Notification.create({
          title: `ESCALATION: Leave Request Escalated to HR`,
          message: `${req.employee.name}'s leave request was automatically escalated to HR due to manager inaction for 4 days.`,
          recipients: hrIds,
          roles: ['hr']
        });
        console.log(`Leave request ${req._id} escalated to HR.`);
      }
    }
  } catch (error) {
    console.error('Error running leave escalation engine:', error);
  }
};
