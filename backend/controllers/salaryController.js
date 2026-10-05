const SalarySlip = require('../models/SalarySlip');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');
const Role = require('../models/Role');
const Department = require('../models/Department');
const UserType = require('../models/UserType');
const LeaveType = require('../models/LeaveType');

// Helper to compute payroll calculation for a single user for the 21st - 20th timeline cycle
const calculatePayrollForUser = async (user, month, year, arrears = 0) => {
  const parsedMonth = parseInt(month, 10);
  const parsedYear = parseInt(year, 10);

  // 21st of previous month to 20th of target month
  const prevMonth = parsedMonth === 1 ? 12 : parsedMonth - 1;
  const prevYear = parsedMonth === 1 ? parsedYear - 1 : parsedYear;

  const startOfPeriod = new Date(prevYear, prevMonth - 1, 21, 0, 0, 0, 0);
  const endOfPeriod = new Date(parsedYear, parsedMonth - 1, 20, 23, 59, 59, 999);

  // Calculate total days in period
  const totalDays = Math.round((endOfPeriod.getTime() - startOfPeriod.getTime()) / (1000 * 3600 * 24));

  // 1. Fetch Holidays & Attendance in 21st-20th range
  const [holidays, attendances] = await Promise.all([
    Holiday.find({ date: { $gte: startOfPeriod, $lte: endOfPeriod } }),
    Attendance.find({ user: user._id, date: { $gte: startOfPeriod, $lte: endOfPeriod } })
  ]);

  // 2. Identify Non-Working Days (Sundays, Holidays, Off Saturdays)
  let nonWorkingDays = 0;
  const currentDate = new Date(startOfPeriod);

  while (currentDate <= endOfPeriod) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    let isNonWorking = false;

    if (dayOfWeek === 0) {
      isNonWorking = true; // Sunday
    } else if (holidays.some(h => new Date(h.date).toDateString() === currentDate.toDateString())) {
      isNonWorking = true; // Holiday
    } else if (dayOfWeek === 6) {
      const dayOfMonth = currentDate.getDate();
      const weekOfMonth = Math.ceil(dayOfMonth / 7);
      if (user.offSaturdays?.includes(weekOfMonth)) {
        isNonWorking = true; // Off Saturday
      }
    }

    if (isNonWorking) {
      nonWorkingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 3. Attendance Stats
  const presentDays = attendances.filter(a => a.status === 'Full-Day' || a.status === 'Present').length;
  const halfDays = attendances.filter(a => a.status === 'Half-Day').length;
  const totalPresentEquivalent = presentDays + (halfDays * 0.5);

  const lateCount = attendances.filter(a => a.isLate).length;
  const penaltyDays = Math.floor(lateCount / 3);

  // 4. Calculate Approved Leaves in 21st-20th period with CL, SL, ML breakdowns
  const approvedRequests = await LeaveRequest.find({
    employee: user._id,
    status: 'Approved',
    fromDate: { $lte: endOfPeriod },
    toDate: { $gte: startOfPeriod }
  }).populate('leaveType');

  // Helper to count working days in leave date range
  const getWorkingDaysInRange = (sDate, eDate) => {
    let count = 0;
    const loopDate = new Date(sDate);
    while (loopDate <= eDate) {
      const dayOfWeek = loopDate.getDay();
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

      if (!isNonWorking) count++;
      loopDate.setDate(loopDate.getDate() + 1);
    }
    return count;
  };

  let clDays = 0;
  let slDays = 0;
  let mlDays = 0;
  let otherPaidLeaves = 0;
  let unpaidLeaves = 0;

  for (const req of approvedRequests) {
    const overlapStart = new Date(Math.max(new Date(req.fromDate).getTime(), startOfPeriod.getTime()));
    const overlapEnd = new Date(Math.min(new Date(req.toDate).getTime(), endOfPeriod.getTime()));
    const overlapDays = getWorkingDaysInRange(overlapStart, overlapEnd);

    const code = (req.leaveType?.code || '').toUpperCase();
    if (code === 'CL') {
      clDays += overlapDays;
    } else if (code === 'SL') {
      slDays += overlapDays;
    } else if (code === 'ML') {
      mlDays += overlapDays;
    } else if (req.leaveType?.paid) {
      otherPaidLeaves += overlapDays;
    } else {
      unpaidLeaves += overlapDays;
    }
  }

  const paidLeavesUsed = clDays + slDays + mlDays + otherPaidLeaves;
  const workingDaysInMonth = Math.max(0, totalDays - nonWorkingDays);

  // Unpaid days = approved LWP + unapproved absent days
  const unapprovedAbsent = Math.max(0, workingDaysInMonth - totalPresentEquivalent - paidLeavesUsed - unpaidLeaves);
  const totalUnpaidDays = unpaidLeaves + unapprovedAbsent;

  // Total Deduction & Payable Days
  const totalDeductionDays = totalUnpaidDays + penaltyDays;
  const netDaysPayable = Math.max(0, totalDays - totalDeductionDays);

  // 4b. Annual Leaves & Remaining Leaves Calculation (Year 2026 Quota)
  const startOfYear = new Date(parsedYear, 0, 1, 0, 0, 0, 0);
  const endOfYear = new Date(parsedYear, 11, 31, 23, 59, 59, 999);

  const approvedYearRequests = await LeaveRequest.find({
    employee: user._id,
    status: 'Approved',
    fromDate: { $lte: endOfYear },
    toDate: { $gte: startOfYear }
  }).populate('leaveType');

  let totalLeavesUsedYear = 0;
  for (const req of approvedYearRequests) {
    if (req.leaveType?.paid) {
      totalLeavesUsedYear += Number(req.totalDays) || 0;
    }
  }

  const totalLeavesYear = 22; // Standard annual leave quota
  const remainingLeaves = Math.max(0, totalLeavesYear - totalLeavesUsedYear);

  // 5. Salary Breakdown (Prorated based on 21st-20th timeline)
  let rawBasic = Number(user.basic) || 0;
  let rawHra = Number(user.hra) || 0;
  let rawIncentives = Number(user.incentives) || 0;

  const salaryAmount = Number(user.salaryAmount) || 0;

  // Check if PF and ESI are checked/enabled for this employee
  // If user.pfAmount / esiAmount is explicitly 0, PF/ESI was unchecked in UserManagement
  const isPFEnabled = user.pfAmount !== undefined && user.pfAmount !== null ? (Number(user.pfAmount) > 0) : true;
  const isESIEnabled = user.esiAmount !== undefined && user.esiAmount !== null ? (Number(user.esiAmount) > 0) : true;

  // Fallback calculation if basic is 0 but salaryAmount is configured
  if (!rawBasic && salaryAmount > 0) {
    let multiplier = 1.0;
    if (isPFEnabled) multiplier += 0.048;
    if (isESIEnabled) multiplier += 0.0325;

    const gross = salaryAmount / multiplier;
    rawBasic = Math.round(gross * 0.4);
    rawHra = Math.round(rawBasic * 0.2);
    rawIncentives = Math.round(gross - rawBasic - rawHra);
  }

  // PTAX fallback calculation
  let ptax = Number(user.ptax) || 0;
  if (!ptax && salaryAmount > 0) {
    if (salaryAmount > 40000) ptax = 200;
    else if (salaryAmount > 25000) ptax = 150;
    else if (salaryAmount > 15000) ptax = 130;
    else if (salaryAmount > 10000) ptax = 110;
  }

  // Employee PF and ESI Deductions strictly obeying checkbox settings
  let pf = 0;
  if (isPFEnabled) {
    pf = Number(user.pfAmount) > 0 ? Number(user.pfAmount) : Math.round(rawBasic * 0.12);
  }

  let esi = 0;
  if (isESIEnabled) {
    const grossMaster = rawBasic + rawHra + rawIncentives;
    esi = Number(user.esiAmount) > 0 ? Number(user.esiAmount) : Math.round(grossMaster * 0.0075);
  }

  const prorateFactor = totalDays > 0 ? (netDaysPayable / totalDays) : 1;

  const earnedBasic = Math.round(rawBasic * prorateFactor);
  const earnedHra = Math.round(rawHra * prorateFactor);
  const earnedIncentives = Math.round(rawIncentives * prorateFactor);

  // Split Conveyance Allowance and Other Allowance for clean display structure
  const masterConveyance = Math.round(rawIncentives / 2);
  const masterOtherAllowance = rawIncentives - masterConveyance;

  const earnedConveyance = Math.round(earnedIncentives / 2);
  const earnedOtherAllowance = earnedIncentives - earnedConveyance;

  const totalAdditions = earnedBasic + earnedHra + earnedConveyance + earnedOtherAllowance + Number(arrears);
  const totalDeductions = ptax + pf + esi;
  const netSalary = Math.max(0, totalAdditions - totalDeductions);

  // Employer Contributions strictly obeying checkbox settings
  const grossEarnedSalary = earnedBasic + earnedHra + earnedIncentives;
  const employerPF = isPFEnabled ? Math.round(earnedBasic * 0.12) : 0;
  const employerESI = isESIEnabled ? Math.round(grossEarnedSalary * 0.0325) : 0;
  const totalEmployerContribution = employerPF + employerESI;

  return {
    user: {
      _id: user._id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      joiningDate: user.joiningDate,
      role: user.role,
      roles: user.roles,
      bankAccountNo: user.bankAccountNo,
      bankIfsc: user.bankIfsc,
      bankName: user.bankName,
      workLocation: user.workLocation,
      salaryStructure: user.salaryStructure || 'Fixed',
      salaryAmount: user.salaryAmount || 0,
      variableSalary: user.variableSalary || 0
    },
    month: parsedMonth,
    year: parsedYear,
    periodStart: startOfPeriod,
    periodEnd: endOfPeriod,
    totalDays,
    workingDaysInMonth,
    nonWorkingDays,
    presentDays: totalPresentEquivalent,
    halfDays,
    lateCount,
    penaltyDays,
    clDays,
    slDays,
    mlDays,
    paidLeavesUsed,
    unpaidLeaveDays: totalUnpaidDays,
    netDaysPayable,

    // Leave Summary
    totalLeavesYear,
    totalLeavesUsedYear,
    remainingLeaves,
    
    // Master structure
    masterBasic: rawBasic,
    masterHra: rawHra,
    masterIncentives: rawIncentives,
    masterConveyance,
    masterOtherAllowance,

    // Earned structure
    earnedBasic,
    earnedHra,
    earnedIncentives,
    earnedConveyance,
    earnedOtherAllowance,
    arrears: Number(arrears),

    // Deductions
    ptax,
    pf,
    esi,

    // Employer
    employerPF,
    employerESI,
    totalEmployerContribution,

    // Totals
    totalAdditions,
    totalDeductions,
    netSalary
  };
};

exports.getPayrollSummary = async (req, res) => {
  try {
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear(), userId, arrears = 0 } = req.query;

    if (userId && userId !== 'all') {
      const user = await User.findById(userId).populate({ path: 'role', populate: { path: 'department' } });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      const calculation = await calculatePayrollForUser(user, month, year, arrears);
      return res.status(200).json({ success: true, data: [calculation] });
    }

    const users = await User.find({ employmentStatus: { $ne: 'Inactive' } }).populate({ path: 'role', populate: { path: 'department' } });
    const calculations = await Promise.all(users.map(u => calculatePayrollForUser(u, month, year, arrears)));

    res.status(200).json({ success: true, data: calculations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateSlip = async (req, res) => {
  try {
    const { userId, month, year, arrears = 0 } = req.body;
    const user = await User.findById(userId).populate({ path: 'role', populate: { path: 'department' } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const calc = await calculatePayrollForUser(user, month, year, arrears);

    let slip = await SalarySlip.findOne({ user: userId, month: calc.month, year: calc.year });
    if (!slip) slip = new SalarySlip({ user: userId, month: calc.month, year: calc.year });

    slip.startDate = calc.periodStart;
    slip.endDate = calc.periodEnd;
    slip.presentDays = calc.presentDays;
    slip.leaveDays = calc.paidLeavesUsed + calc.unpaidLeaveDays;
    slip.lateCount = calc.lateCount;
    slip.absentDaysDueToLate = calc.penaltyDays;
    slip.clDays = calc.clDays;
    slip.slDays = calc.slDays;
    slip.mlDays = calc.mlDays;
    slip.paidLeavesUsed = calc.paidLeavesUsed;
    slip.unpaidLeaveDays = calc.unpaidLeaveDays;

    slip.basic = calc.earnedBasic;
    slip.hra = calc.earnedHra;
    slip.incentives = calc.earnedIncentives;
    slip.arrears = calc.arrears;
    slip.ptax = calc.ptax;
    slip.pf = calc.pf;
    slip.esi = calc.esi;
    slip.leaveDeduction = 0;

    slip.totalAdditions = calc.totalAdditions;
    slip.totalDeductions = calc.totalDeductions;
    slip.netSalary = calc.netSalary;

    await slip.save();
    res.status(200).json({ success: true, data: slip, calculation: calc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSlips = async (req, res) => {
  try {
    const { userId } = req.params;
    const slips = await SalarySlip.find({ user: userId }).sort({ year: -1, month: -1 });
    res.status(200).json({ success: true, data: slips });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const nodemailer = require('nodemailer');
exports.sendEmail = async (req, res) => {
  try {
    const { slipId } = req.body;
    const slip = await SalarySlip.findById(slipId).populate('user');
    if (!slip) return res.status(404).json({ success: false, message: 'Slip not found' });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-password'
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: slip.user.email,
      subject: `Salary Slip - ${slip.month}/${slip.year}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
          <h2 style="color: #1e3a8a; text-align: center;">Salary Slip</h2>
          <p>Dear ${slip.user.name},</p>
          <p>Please find the summary of your salary for Month ${slip.month}/${slip.year} (Timeline Cycle: 21st Prev Month to 20th Current Month):</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr style="background: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Monthly CTC (Fixed Base)</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: #1e3a8a;"><strong>₹${(slip.user?.salaryAmount || 0).toFixed(2)}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Earned Basic</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${slip.basic.toFixed(2)}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Earned HRA</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${slip.hra.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Conveyance & Allowances</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${slip.incentives.toFixed(2)}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Deductions</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${slip.totalDeductions.toFixed(2)}</td>
            </tr>
            <tr style="background: #e9ecef; font-weight: bold;">
              <td style="padding: 10px; border: 1px solid #ddd;">Net Salary Payable</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: #28a745;">₹${slip.netSalary.toFixed(2)}</td>
            </tr>
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">This is an automated email. Please do not reply.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
