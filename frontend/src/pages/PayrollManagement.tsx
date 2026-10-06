import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calculator, Download, Mail, RefreshCw, Calendar, CheckCircle, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function PayrollManagement() {
  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
  const roleName = (loggedInUser?.role?.name || '').toLowerCase().trim();
  const userTypeName = (typeof loggedInUser?.role?.userType === 'object' ? loggedInUser?.role?.userType?.name : loggedInUser?.role?.userType || '').toLowerCase().trim();
  const loggedInUserDept = (typeof loggedInUser?.role?.department === 'object' ? loggedInUser?.role?.department?.name : loggedInUser?.role?.department || '').toLowerCase().trim();
  
  const isHR = roleName.includes('hr') || roleName.includes('human resource') || loggedInUserDept.includes('hr');
  const isAdmin = ['admin', 'super admin'].includes(roleName) || ['admin', 'super admin'].includes(userTypeName);
  const isAdminOrHR = isAdmin || isHR;

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [month, setMonth] = useState<number>(currentMonth);
  const [year, setYear] = useState<number>(currentYear);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [arrearsInput, setArrearsInput] = useState<number>(0);

  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Fetch Users and Settings
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [uRes, sRes] = await Promise.all([
          axios.get('/api/users'),
          axios.get('/api/settings')
        ]);
        if (uRes.data.success) {
          const active = (uRes.data.data || []).filter((u: any) => u.employmentStatus !== 'Inactive');
          if (isAdminOrHR) {
            setUsersList(active);
          } else {
            const selfUser = active.filter((u: any) => String(u._id || u.id) === String(loggedInUser._id || loggedInUser.id));
            setUsersList(selfUser.length > 0 ? selfUser : [loggedInUser]);
            setSelectedUserId(loggedInUser._id || loggedInUser.id || '');
          }
        }
        if (sRes.data.success) {
          const settingsMap: any = {};
          (sRes.data.data || []).forEach((s: any) => {
            settingsMap[s.key] = s.value;
          });
          setCompanySettings(settingsMap);
        }
      } catch (err) {
        console.error('Error loading initial payroll metadata:', err);
      }
    };
    fetchInitial();
  }, [isAdminOrHR]);

  // Fetch Payroll Summary automatically on filter/param changes
  useEffect(() => {
    fetchPayrollSummary();
  }, [month, year, selectedUserId, arrearsInput]);

  const fetchPayrollSummary = async () => {
    if (!selectedUserId) {
      setPayrollData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get('/api/salary/summary', {
        params: {
          month,
          year,
          userId: selectedUserId,
          arrears: arrearsInput
        }
      });
      if (res.data.success) {
        setPayrollData(res.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching payroll calculation:', err);
      alert(err.response?.data?.message || 'Error fetching payroll calculation');
    } finally {
      setLoading(false);
    }
  };

  // Helper number to words
  const numberToWords = (num: number) => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const numStr = Math.round(num).toString();
    if (numStr.length > 9) return 'overflow';
    const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'crore ' : '';
    str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'lakh ' : '';
    str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'thousand ' : '';
    str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'hundred ' : '';
    str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'only ' : '';
    return str.toUpperCase();
  };

  // Generate & Save Payslip
  const handleSaveSlip = async (item: any) => {
    const uId = item.user?._id;
    if (!uId) return;
    setActionLoading(prev => ({ ...prev, [`save_${uId}`]: true }));
    try {
      await axios.post('/api/salary/generate', {
        userId: uId,
        month,
        year,
        arrears: item.arrears || 0
      });
      alert(`Salary Slip for ${item.user.name} generated & saved successfully!`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate salary slip');
    } finally {
      setActionLoading(prev => ({ ...prev, [`save_${uId}`]: false }));
    }
  };

  // Send Email
  const handleSendEmail = async (item: any) => {
    const uId = item.user?._id;
    if (!uId) return;
    setActionLoading(prev => ({ ...prev, [`email_${uId}`]: true }));
    try {
      const genRes = await axios.post('/api/salary/generate', {
        userId: uId,
        month,
        year,
        arrears: item.arrears || 0
      });
      const slipId = genRes.data.data?._id;
      if (slipId) {
        await axios.post('/api/salary/send-email', { slipId });
        alert(`Salary slip emailed successfully to ${item.user.email}!`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send email');
    } finally {
      setActionLoading(prev => ({ ...prev, [`email_${uId}`]: false }));
    }
  };

  // Download PDF Slip
  const handleDownloadPDF = async (item: any) => {
    const doc = new jsPDF();
    const logoUrl = companySettings.company_logo ? `${companySettings.company_logo}` : 'https://digiexweb.com/assets/img/logo.png';
    const companyName = companySettings.company_name || 'DIGIEX WEB SERVICES';

    const loadImageAsPng = async (url: string): Promise<string | null> => {
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error("Network error");
        const blob = await response.blob();
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        
        return new Promise((resolve) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              URL.revokeObjectURL(objectUrl);
              resolve(dataUrl);
            } else {
              URL.revokeObjectURL(objectUrl);
              resolve(null);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          };
          img.src = objectUrl;
        });
      } catch (err) {
        return null;
      }
    };

    try {
      const logoPng = await loadImageAsPng(logoUrl);
      if (logoPng) {
        doc.addImage(logoPng, 'PNG', 15, 8, 25, 10);
      }
      
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName.toUpperCase(), 45, 14);
      
      doc.setFontSize(8);
      doc.setTextColor(80);
      doc.setFont('helvetica', 'normal');
      const addressLines = [
        "Office:- Fifth Floor, Santosh Enclave, 14, Biswa Bangla Sarani, Near Chinar Park Crossing, Rajarhat Kolkata-700028.",
        "Contact: - +918240431136 / +919831146486. Email: - hr@digiexweb.com, Visit Us: - https://digiexweb.com"
      ];
      doc.text(addressLines[0], 45, 18);
      doc.text(addressLines[1], 45, 22);

      // Period dates
      const startStr = new Date(item.periodStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const endStr = new Date(item.periodEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      // Pay Slip Month Header
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(245, 245, 245);
      doc.rect(15, 28, 180, 8, 'F');
      doc.text(`Salary Slip - ${monthNames[month - 1]} ${year}`, 105, 33.5, { align: 'center' });

      // Employee Info Grid with CTC
      const userRole = item.user?.role?.name || item.user?.role || 'N/A';
      const userDept = item.user?.role?.department?.name || 'N/A';
      const masterCTC = Number(item.user?.salaryAmount || (item.masterBasic + item.masterHra + item.masterIncentives) || 0);
      const ctcText = masterCTC > 0 ? `INR ${masterCTC.toLocaleString('en-IN')}` : 'N/A';

      autoTable(doc, {
        startY: 38,
        body: [
          ['Month', `${monthNames[month - 1]} ${year}`, 'Total Leaves (2026)', String(item.totalLeavesYear || 22)],
          ['Employee ID', String(item.user?.employeeId || 'N/A'), 'Leave Taken (This Month)', `${item.paidLeavesUsed} Days`],
          ['Employee Name', String(item.user?.name || 'N/A'), 'Remaining Leaves', `${item.remainingLeaves || 0} Days`],
          ['DOJ', item.user?.joiningDate ? new Date(item.user.joiningDate).toLocaleDateString('en-GB') : 'N/A', 'Days Present', `${item.presentDays} Days`],
          ['Bank Name', String(item.user?.bankName || 'N/A'), 'Total Payable Days', `${item.netDaysPayable} / ${item.totalDays} Days`],
          ['Bank A/C No.', String(item.user?.bankAccountNo || 'N/A'), 'Monthly CTC', ctcText],
          ['Department', userDept, 'Designation', userRole],
          ['Location', String(item.user?.workLocation || 'Office'), '', '']
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [250, 250, 250] }, 2: { fontStyle: 'bold', fillColor: [250, 250, 250] } }
      });

      // Earnings vs Deductions Table
      const finalY = (doc as any).lastAutoTable?.finalY || 45;
      autoTable(doc, {
        startY: finalY + 4,
        head: [['Earnings', 'Amt. (INR)', 'Deductions', 'Amt. (INR)']],
        body: [
          ['Basic Salary', Number(item.earnedBasic || 0).toLocaleString('en-IN'), 'PF Employee Contribution', item.pf > 0 ? Number(item.pf || 0).toLocaleString('en-IN') : '0 (Exempt)'],
          ['House Rent Allowance', Number(item.earnedHra || 0).toLocaleString('en-IN'), 'ESIC Employee Contribution', item.esi > 0 ? Number(item.esi || 0).toLocaleString('en-IN') : '0 (Exempt)'],
          ['Conveyance Allowance', Number(item.earnedConveyance || 0).toLocaleString('en-IN'), 'Professional Tax (PTax)', Number(item.ptax || 0).toLocaleString('en-IN')],
          ['Other Allowance', Number(item.earnedOtherAllowance || 0).toLocaleString('en-IN'), 'LOP / Unpaid Days', `${item.unpaidLeaveDays} Days`],
          ['Arrears', Number(item.arrears || 0).toLocaleString('en-IN'), 'Income Tax', '0'],
          ['Total Earnings (A)', Number(item.totalAdditions || 0).toLocaleString('en-IN'), 'Total Deductions (B)', Number(item.totalDeductions || 0).toLocaleString('en-IN')]
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } }
      });

      // Net Payable Bar using autoTable for pixel-perfect rendering & correct alignment
      const netY = (doc as any).lastAutoTable?.finalY + 4;
      autoTable(doc, {
        startY: netY,
        body: [
          ['Total Net Payable (A - B)', `INR ${Number(item.netSalary || 0).toLocaleString('en-IN')}`]
        ],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3.5, fillColor: [240, 243, 246] },
        columnStyles: { 
          0: { fontStyle: 'bold', textColor: [15, 23, 42] }, 
          1: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] } 
        }
      });

      // Employer Contribution Section
      const emrY = (doc as any).lastAutoTable?.finalY + 4;
      autoTable(doc, {
        startY: emrY,
        head: [['Employer Contributions (Not Deducted from Net Salary)', 'Amt. (INR)']],
        body: [
          ['Employer PF Contribution (12% of Basic)', Number(item.employerPF || 0).toLocaleString('en-IN')],
          ['Employer ESIC Contribution (3.25% of Gross)', Number(item.employerESI || 0).toLocaleString('en-IN')],
          ['Total Employer Contribution', Number(item.totalEmployerContribution || 0).toLocaleString('en-IN')]
        ],
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 1: { halign: 'right' } }
      });

      const nextY = (doc as any).lastAutoTable?.finalY + 4;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Amount in Words: ${numberToWords(Number(item.netSalary || 0))}`, 15, nextY + 3);

      // Legal Disclaimer
      const disclaimer = `This is a system-generated payslip computed based on the 21st to 20th timeline cycle attendance records and approved leaves (Casual, Sick/Medical, Maternity). It does not require a signature. Confidentially issued by Digiex Web Services.`;
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'normal');
      const splitDisclaimer = doc.splitTextToSize(disclaimer, 180);
      doc.text(splitDisclaimer, 15, nextY + 9);

      doc.save(`SalarySlip_${String(item.user?.name || 'Employee').replace(/[^a-z0-9]/gi, '_')}_${monthNames[month - 1]}_${year}.pdf`);
    } catch (err: any) {
      alert("Error generating PDF: " + err.message);
    }
  };

  // Calculations for summary stats
  const totalNetPayroll = payrollData.reduce((acc, curr) => acc + (curr.netSalary || 0), 0);
  const totalGrossEarnings = payrollData.reduce((acc, curr) => acc + (curr.totalAdditions || 0), 0);
  const totalDeductions = payrollData.reduce((acc, curr) => acc + (curr.totalDeductions || 0), 0);

  // Period label for current month/year selection
  const prevMonthIndex = month === 1 ? 11 : month - 2;
  const prevYearNum = month === 1 ? year - 1 : year;
  const timelineLabel = `21 ${monthNames[prevMonthIndex].slice(0, 3)} ${prevYearNum} — 20 ${monthNames[month - 1].slice(0, 3)} ${year}`;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calculator size={28} color="#2563eb" /> Payroll Management
          </h1>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: '4px 0 0 0' }}>
            Calculate employee salary structures based on 21st to 20th monthly attendance, casual leave (CL), sick/medical leave (SL), and maternity leave (ML).
          </p>
        </div>
        <button 
          onClick={fetchPayrollSummary} 
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', fontWeight: 600 }}
        >
          <RefreshCw size={18} className={loading ? 'spin' : ''} /> Refresh Calculations
        </button>
      </div>

      {/* Timeline Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', 
        color: '#ffffff', 
        borderRadius: '14px', 
        padding: '20px 24px', 
        marginBottom: '24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '12px', borderRadius: '12px' }}>
            <Calendar size={28} color="#ffffff" />
          </div>
          <div>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 600 }}>
              Payroll Cycle Timeline (21st — 20th Standard)
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '2px 0 0 0' }}>
              {timelineLabel}
            </h2>
          </div>
        </div>
        <div style={{ background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(4px)', padding: '10px 20px', borderRadius: '10px', textAlign: 'right' }}>
          <span style={{ fontSize: '12px', opacity: 0.85, display: 'block' }}>Selected Payroll Month</span>
          <span style={{ fontSize: '16px', fontWeight: 700 }}>{monthNames[month - 1]} {year}</span>
        </div>
      </div>

      {/* Control Filters Bar */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0', 
        padding: '18px 24px', 
        marginBottom: '24px', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px',
        alignItems: 'end'
      }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>
            Select Month
          </label>
          <select 
            className="input-field" 
            value={month} 
            onChange={e => setMonth(Number(e.target.value))}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          >
            {monthNames.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>
            Select Year
          </label>
          <select 
            className="input-field" 
            value={year} 
            onChange={e => setYear(Number(e.target.value))}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>
            Employee Selection
          </label>
          <select 
            className="input-field" 
            value={selectedUserId} 
            disabled={!isAdminOrHR}
            onChange={e => setSelectedUserId(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: isAdminOrHR ? '#ffffff' : '#f1f5f9', cursor: isAdminOrHR ? 'pointer' : 'not-allowed' }}
          >
            {isAdminOrHR && <option value="">Select Employee...</option>}
            {usersList.map(u => (
              <option key={u._id || u.id} value={u._id || u.id}>{u.name} ({u.employeeId || 'Emp'})</option>
            ))}
            {isAdminOrHR && <option value="all">👥 All Employees ({usersList.length})</option>}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>
            Arrears / Bonus (₹)
          </label>
          <input 
            type="number" 
            className="input-field" 
            value={arrearsInput} 
            disabled={!isAdminOrHR}
            onChange={e => setArrearsInput(Number(e.target.value))}
            placeholder="0"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: isAdminOrHR ? '#ffffff' : '#f1f5f9', cursor: isAdminOrHR ? 'text' : 'not-allowed' }}
          />
        </div>

        <div style={{ margin: 0, display: 'flex', alignItems: 'flex-end' }}>
          <button 
            type="button" 
            onClick={fetchPayrollSummary}
            disabled={loading}
            style={{ 
              width: '100%',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              padding: '10px 20px', 
              borderRadius: '8px', 
              fontWeight: 700, 
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={18} className={loading ? "spin" : ""} /> {loading ? 'Recalculating...' : 'Refresh Payroll'}
          </button>
        </div>
      </div>

      {/* Main Employee Payroll Breakdown List */}
      {!selectedUserId ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>👤</div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>Select an Employee</h3>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
            Please select an employee from the dropdown above to view their monthly salary calculation statement.
          </p>
        </div>
      ) : loading ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <RefreshCw size={32} color="#2563eb" className="spin" style={{ margin: '0 auto 12px auto', display: 'block' }} />
          <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Computing 21st-20th timeline payroll & attendance records...</span>
        </div>
      ) : (
        <>
          {/* KPI Cards Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Net Payroll</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '6px' }}>
                ₹{totalNetPayroll.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Net payable across employees</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Employees Processed</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e3a8a', marginTop: '6px' }}>
                {payrollData.length}
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Active staff in payroll</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Gross Earnings</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7', marginTop: '6px' }}>
                ₹{totalGrossEarnings.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Prorated gross + arrears</span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Deductions</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: '6px' }}>
                ₹{totalDeductions.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>PF + ESI + PTax</span>
            </div>
          </div>

          {payrollData.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No active employees found for the selected month/year filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {payrollData.map((item, idx) => {
                const uId = item.user?._id;
                const isSaving = actionLoading[`save_${uId}`];
                const isEmailing = actionLoading[`email_${uId}`];

                return (
                  <div 
                    key={uId || idx} 
                    style={{ 
                      background: '#ffffff', 
                      borderRadius: '16px', 
                      border: '1px solid #cbd5e1', 
                      padding: '24px', 
                      boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
                    }}
                  >
                    {/* Header & Net Salary Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ 
                          width: '48px', 
                          height: '48px', 
                          borderRadius: '12px', 
                          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', 
                          color: '#ffffff', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontSize: '20px', 
                          fontWeight: 700 
                        }}>
                          {item.user?.name?.charAt(0) || 'E'}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{item.user?.name}</h3>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>
                            {monthNames[month - 1]} {year} Salary Statement • {timelineLabel}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 20px', borderRadius: '12px', textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Net Salary</span>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                          ₹{Number(item.netSalary || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {item.totalAdditions === 0 && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>
                        ⚠️ <strong>Salary Structure Missing:</strong> Fixed salary amount & basic structure have not been set for {item.user?.name} in User Management. Please update this employee's salary under Employees page to enable full prorated calculation.
                      </div>
                    )}

                    {/* SECTION 1: EMPLOYEE INFORMATION GRID */}
                    <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '18px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        👤 Employee Information
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 500 }}>Month:</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700 }}>{monthNames[month - 1]} {year}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 500 }}>Employee ID:</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700 }}>{item.user?.employeeId || 'N/A'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 500 }}>Employee Name:</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700 }}>{item.user?.name || 'N/A'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 500 }}>DOJ:</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700 }}>
                            {item.user?.joiningDate ? new Date(item.user.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 500 }}>Bank Name:</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700 }}>{item.user?.bankName || 'N/A'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 500 }}>Bank A/C No.:</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700 }}>{item.user?.bankAccountNo || 'N/A'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 500 }}>Department:</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700 }}>{item.user?.role?.department?.name || 'N/A'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 500 }}>Designation:</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700 }}>{item.user?.role?.name || item.user?.role || 'N/A'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 500 }}>Monthly CTC:</span>
                          <strong style={{ color: '#1e3a8a', fontWeight: 700 }}>
                            ₹{Number(item.user?.salaryAmount || (item.masterBasic + item.masterHra + item.masterIncentives) || 0).toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: ATTENDANCE & LEAVES SUMMARY */}
                    <div style={{ background: '#ffffff', borderRadius: '12px', padding: '18px', border: '1px solid #cbd5e1', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🗓️ Attendance & Leave Summary (21st - 20th Timeline)
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', textAlign: 'center' }}>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'block' }}>Total Leaves ({year})</span>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: '#1e3a8a', marginTop: '4px', display: 'block' }}>
                            {item.totalLeavesYear || 22} Days
                          </span>
                        </div>

                        <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                          <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600, display: 'block' }}>Leave Taken (This Month)</span>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px', display: 'block' }}>
                            {item.paidLeavesUsed} Days
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>(CL: {item.clDays}, SL: {item.slDays}, ML: {item.mlDays})</span>
                        </div>

                        <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                          <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, display: 'block' }}>Remaining Leaves</span>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: '#15803d', marginTop: '4px', display: 'block' }}>
                            {item.remainingLeaves || 0} Days
                          </span>
                        </div>

                        <div style={{ background: '#fcf2e8', padding: '12px', borderRadius: '10px', border: '1px solid #ffedd5' }}>
                          <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600, display: 'block' }}>Days Present</span>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: '#c2410c', marginTop: '4px', display: 'block' }}>
                            {item.presentDays} Days
                          </span>
                        </div>

                        <div style={{ background: '#3b82f6', color: '#ffffff', padding: '12px', borderRadius: '10px' }}>
                          <span style={{ fontSize: '12px', opacity: 0.9, fontWeight: 600, display: 'block' }}>Total Payable Days</span>
                          <span style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px', display: 'block' }}>
                            {item.netDaysPayable} / {item.totalDays} Days
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: EARNINGS & DEDUCTIONS BREAKDOWN */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                      {/* EARNINGS TABLE */}
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ background: '#1e3a8a', color: '#ffffff', padding: '12px 16px', fontWeight: 700, fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Earnings</span>
                          <span>Amount (₹)</span>
                        </div>
                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px border-dashed #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ color: '#334155' }}>Basic Salary</span>
                            <strong>₹{Number(item.earnedBasic || 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px border-dashed #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ color: '#334155' }}>House Rent Allowance</span>
                            <strong>₹{Number(item.earnedHra || 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px border-dashed #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ color: '#334155' }}>Conveyance Allowance</span>
                            <strong>₹{Number(item.earnedConveyance || 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px border-dashed #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ color: '#334155' }}>Other Allowance</span>
                            <strong>₹{Number(item.earnedOtherAllowance || 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px border-dashed #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ color: '#334155' }}>Arrears</span>
                            <strong>₹{Number(item.arrears || 0).toLocaleString('en-IN')}</strong>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: '10px', fontWeight: 700, fontSize: '14px', color: '#1e3a8a' }}>
                            <span>Total Earnings (A)</span>
                            <span>₹{Number(item.totalAdditions || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>

                      {/* DEDUCTIONS TABLE */}
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ background: '#475569', color: '#ffffff', padding: '12px 16px', fontWeight: 700, fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Deductions</span>
                          <span>Amount (₹)</span>
                        </div>
                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px border-dashed #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ color: '#334155' }}>PF (Employee Contribution)</span>
                            <strong>{item.pf > 0 ? `₹${Number(item.pf).toLocaleString('en-IN')}` : '₹0 (Exempt / Unchecked)'}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px border-dashed #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ color: '#334155' }}>ESI (Employee Contribution)</span>
                            <strong>{item.esi > 0 ? `₹${Number(item.esi).toLocaleString('en-IN')}` : '₹0 (Exempt / Unchecked)'}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px border-dashed #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ color: '#334155' }}>Professional Tax (PTax)</span>
                            <strong>₹{Number(item.ptax || 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px border-dashed #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ color: '#334155' }}>Loss of Pay (LOP) / Penalty</span>
                            <strong>{item.unpaidLeaveDays} LOP / {item.penaltyDays} Penalty Days</strong>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: '10px', fontWeight: 700, fontSize: '14px', color: '#dc2626' }}>
                            <span>Total Deductions (B)</span>
                            <span>₹{Number(item.totalDeductions || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: NET SALARY TOTAL & WORDS */}
                    <div style={{ 
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
                      color: '#ffffff', 
                      borderRadius: '12px', 
                      padding: '16px 20px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '20px'
                    }}>
                      <div>
                        <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>
                          Net Salary (Total Earnings A - Total Deductions B)
                        </span>
                        <div style={{ fontSize: '13px', fontStyle: 'italic', opacity: 0.9, marginTop: '4px' }}>
                          Amount in Words: {numberToWords(Number(item.netSalary || 0))}
                        </div>
                      </div>
                      <div style={{ fontSize: '26px', fontWeight: 800, color: '#4ade80' }}>
                        ₹{Number(item.netSalary || 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* ACTIONS FOOTER */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                      {isAdminOrHR && (
                        <button 
                          onClick={() => handleSaveSlip(item)}
                          disabled={isSaving}
                          className="btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px' }}
                        >
                          <CheckCircle size={16} color="#16a34a" /> {isSaving ? 'Saving...' : 'Generate & Save Slip'}
                        </button>
                      )}
                      <button 
                        onClick={() => handleDownloadPDF(item)}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px', background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                      >
                        <Download size={16} /> Download PDF Slip
                      </button>
                      {isAdminOrHR && (
                        <button 
                          onClick={() => handleSendEmail(item)}
                          disabled={isEmailing}
                          className="btn-primary"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 16px' }}
                        >
                          <Mail size={16} /> {isEmailing ? 'Sending...' : 'Email Slip to Employee'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
