import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit, Upload, PlusCircle, X, Download, Mail, Info, AlertTriangle, Calculator } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function UserManagement() {
  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
  const roleName = (typeof loggedInUser?.role === 'object' ? loggedInUser?.role?.name : loggedInUser?.role || '').toLowerCase().trim();
  const userTypeName = (typeof loggedInUser?.role?.userType === 'object' ? loggedInUser?.role?.userType?.name : loggedInUser?.role?.userType || loggedInUser?.userType || '').toLowerCase().trim();
  const isSuperAdmin = roleName === 'super admin' || userTypeName === 'super admin';

  const loggedInUserDept = (typeof loggedInUser?.role?.department === 'object' ? loggedInUser?.role?.department?.name : loggedInUser?.role?.department || '').toLowerCase().trim();
  const isHR = roleName.includes('hr') || roleName.includes('human resource') || loggedInUserDept.includes('hr');
  const isAdmin = ['admin', 'super admin'].includes(roleName) || ['admin', 'super admin'].includes(userTypeName);
  const isAdminOrHR = isAdmin || isHR;

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [calcCTC, setCalcCTC] = useState<number>(16000);
  const [calcHasPF, setCalcHasPF] = useState(true);
  const [calcHasESI, setCalcHasESI] = useState(true);
  const [formHasPF, setFormHasPF] = useState(true);
  const [formHasESI, setFormHasESI] = useState(true);
  const [sameAsCurrentAddress, setSameAsCurrentAddress] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [uploading, setUploading] = useState(false);

  const [showSlipModal, setShowSlipModal] = useState(false);
  const [slipUserId, setSlipUserId] = useState<string | null>(null);
  const [slipMonth, setSlipMonth] = useState(new Date().getMonth() + 1);
  const [slipYear, setSlipYear] = useState(new Date().getFullYear());
  const [slipData, setSlipData] = useState<any>(null);
  const [arrearsInput, setArrearsInput] = useState(0);
  const [companySettings, setCompanySettings] = useState<any>({});
  
  const [showWfhModal, setShowWfhModal] = useState(false);
  const [showMaternityModal, setShowMaternityModal] = useState(false);
  const [maternityEmployee, setMaternityEmployee] = useState<any>(null);
  const [maternityForm, setMaternityForm] = useState({
    fromDate: '',
    toDate: '',
    maternityScenario: 'None',
    expectedDeliveryDate: '',
    reason: '',
    attachment: ''
  });
  const [maternitySaving, setMaternitySaving] = useState(false);
  const [maternityUploading, setMaternityUploading] = useState(false);
  const [maternityError, setMaternityError] = useState('');
  const [mlLeaveTypeId, setMlLeaveTypeId] = useState('');

  useEffect(() => {
    const fetchMlType = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/leaves/types');
        const ml = (res.data.data || []).find((t: any) => t.code === 'ML');
        if (ml) setMlLeaveTypeId(ml._id);
      } catch (err) {
        console.error('Failed to fetch ML leave type ID:', err);
      }
    };
    fetchMlType();
  }, []);

  const handleOpenMaternityModal = (user: any) => {
    setMaternityEmployee(user);
    setMaternityError('');
    setMaternityForm({
      fromDate: '',
      toDate: '',
      maternityScenario: 'None',
      expectedDeliveryDate: '',
      reason: '',
      attachment: ''
    });
    setShowMaternityModal(true);
  };

  const handleMaternityFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);
    setMaternityUploading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMaternityForm(prev => ({ ...prev, attachment: res.data.fileUrl }));
    } catch (err) {
      alert('Error uploading file');
    } finally {
      setMaternityUploading(false);
    }
  };

  const handleMaternitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mlLeaveTypeId) {
      alert('Maternity Leave type is not configured in the database.');
      return;
    }
    setMaternitySaving(true);
    setMaternityError('');

    if (!maternityForm.attachment) {
      setMaternityError('Medical certificate upload is required for Maternity Leave');
      setMaternitySaving(false);
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/leaves/apply', {
        employeeId: maternityEmployee._id,
        leaveTypeId: mlLeaveTypeId,
        fromDate: maternityForm.fromDate,
        toDate: maternityForm.toDate,
        halfDay: false,
        halfDaySession: 'None',
        reason: maternityForm.reason,
        attachment: maternityForm.attachment,
        maternityScenario: maternityForm.maternityScenario,
        expectedDeliveryDate: maternityForm.expectedDeliveryDate
      });

      alert(`Maternity leave applied successfully for ${maternityEmployee.name}!`);
      setShowMaternityModal(false);
      setMaternityForm({
        fromDate: '',
        toDate: '',
        maternityScenario: 'None',
        expectedDeliveryDate: '',
        reason: '',
        attachment: ''
      });
    } catch (err: any) {
      setMaternityError(err.response?.data?.message || 'Failed to submit maternity leave request');
    } finally {
      setMaternitySaving(false);
    }
  };

  const [wfhUserId, setWfhUserId] = useState<string | null>(null);
  const [wfhDates, setWfhDates] = useState<any[]>([]);
  const [wfhDate, setWfhDate] = useState(new Date().toISOString().split('T')[0]);
  const [wfhFromDate, setWfhFromDate] = useState('');
  const [wfhToDate, setWfhToDate] = useState('');
  const [wfhMode, setWfhMode] = useState<'range' | 'single'>('range');

  const fetchWfhDates = async (id: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/attendance/wfh/${id}`);
      setWfhDates(res.data.data);
    } catch (err) { console.error(err); }
  };

  const handleOpenWfh = (id: string) => {
    setWfhUserId(id);
    setWfhFromDate('');
    setWfhToDate('');
    setWfhDate(new Date().toISOString().split('T')[0]);
    fetchWfhDates(id);
    setShowWfhModal(true);
  };

  const handleAddWfhRange = async () => {
    if (!wfhFromDate || !wfhToDate) {
      alert('Please select both From Date and To Date');
      return;
    }
    const start = new Date(wfhFromDate);
    const end = new Date(wfhToDate);
    if (start > end) {
      alert('From Date cannot be after To Date');
      return;
    }

    const dateList: string[] = [];
    const loopDate = new Date(start);
    while (loopDate <= end) {
      dateList.push(loopDate.toISOString().split('T')[0]);
      loopDate.setDate(loopDate.getDate() + 1);
    }

    try {
      await axios.post('http://localhost:5000/api/attendance/mark-wfh', { userId: wfhUserId, dates: dateList });
      alert(`${dateList.length} WFH date(s) marked successfully!`);
      setWfhFromDate('');
      setWfhToDate('');
      fetchWfhDates(wfhUserId!);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error adding WFH dates');
    }
  };

  const handleOpenSlip = (id: string) => {
    setSlipUserId(id);
    setSlipData(null);
    setArrearsInput(0);
    setShowSlipModal(true);
  };

  const generateSlip = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/salary/generate', { userId: slipUserId, month: slipMonth, year: slipYear, arrears: arrearsInput });
      setSlipData(res.data.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error generating slip');
    }
  };

  const sendEmailToEmployee = async () => {
    if (!slipData?._id) return;
    try {
      await axios.post('http://localhost:5000/api/salary/send-email', { slipId: slipData._id });
      alert('Salary slip emailed to employee successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error sending email');
    }
  };

  const fetchBankName = async (ifsc: string) => {
    if (ifsc.length !== 11) return;
    try {
      const res = await axios.get(`https://ifsc.razorpay.com/${ifsc}`);
      if (res.data && res.data.BANK) {
        setFormData((prev: any) => ({ ...prev, bankName: res.data.BANK }));
      }
    } catch (err) {
      console.error("Error fetching bank details:", err);
    }
  };

  const numberToWords = (num: number) => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const numStr = num.toString();
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

  const downloadPDF = async () => {
    if (!slipData) {
      alert("Please generate the slip first");
      return;
    }
    
    const doc = new jsPDF();
    const user = users.find(u => u._id === slipUserId);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Header Data
    const logoUrl = companySettings.company_logo ? `http://localhost:5000${companySettings.company_logo}` : 'https://digiexweb.com/assets/img/logo.png';
    const companyName = companySettings.company_name || 'DIGIEX WEB SERVICES';

    // Helper to load image as base64 using Canvas to ensure format is known (PNG)
    const loadImageAsPng = async (url: string): Promise<string | null> => {
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error("Network response was not ok");
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
        console.error("Error loading logo image:", err);
        return null;
      }
    };

    try {
      // 1. Add Logo and Header Text
      const logoPng = await loadImageAsPng(logoUrl);
      
      // Header Section
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

      // 2. Pay Slip Month Header
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(245, 245, 245);
      doc.rect(15, 28, 180, 8, 'F');
      doc.text(`Salary Slip Month ${monthNames[slipMonth-1]}-${slipYear}`, 105, 33.5, { align: 'center' });

      // 3. Employee Details Section (New Layout)
      autoTable(doc, {
        startY: 38,
        body: [
          ['Employee Name', String(user?.name || 'N/A'), 'Bank Name', String(user?.bankName || 'N/A')],
          ['Employee Code', String(user?.employeeId || 'N/A'), 'Bank A/C number', String(user?.bankAccountNo || 'N/A')],
          ['D.O.J', user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : 'N/A', 'Net Days Payable', String(slipData.presentDays + slipData.paidLeavesUsed)],
          ['Location', String(user?.workLocation || 'Kolkata'), `Leave Balance ${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`, String(companySettings.annual_leaves || 22)],
          ['Department / Section', String(user?.role?.department?.name || 'N/A'), 'Leave Count', String(slipData.leaveDays)],
          ['Designation', String(user?.role?.name || 'N/A'), 'Rest of Leave Balance', String(Number(companySettings.annual_leaves || 22) - Number(user?.leavesUsed || 0))]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [250, 250, 250] }, 2: { fontStyle: 'bold', fillColor: [250, 250, 250] } }
      });

      // 4. Earnings vs Deductions Table
      const finalY = (doc as any).lastAutoTable?.finalY || 45;
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Earnings', 'Amt. (INR)', 'Deductions', 'Amt. (INR)']],
        body: [
          ['Basic Salary', Number(slipData.basic || 0).toLocaleString(), 'PF Employee Contribution', Number(slipData.pf || 0).toLocaleString()],
          ['House Rent Allowance', Number(slipData.hra || 0).toLocaleString(), 'ESIC Employee Contribution', Number(slipData.esi || 0).toLocaleString()],
          ['Conveyance & Other Allowance', Number(slipData.incentives || 0).toLocaleString(), 'Professional Tax', Number(slipData.ptax || 0).toLocaleString()],
          ['Arrears', Number(slipData.arrears || 0).toLocaleString(), 'Income Tax', '0'],
          ['', '', 'Loans and Advances', '0'],
          ['Total Earnings(A)', Number(slipData.totalAdditions || 0).toLocaleString(), 'Total Deductions(B)', Number(slipData.totalDeductions || 0).toLocaleString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } }
      });

      // 5. Net Payable
      const netY = (doc as any).lastAutoTable?.finalY + 5;
      doc.setFillColor(240, 240, 240);
      doc.rect(15, netY, 180, 8, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Net Payable(A-B)`, 20, netY + 5.5);
      doc.text(`${Number(slipData.netSalary || 0).toLocaleString()}`, 190, netY + 5.5, { align: 'right' });

      // Calculate Employer Contributions
      const slipGross = (slipData.basic || 0) + (slipData.hra || 0) + (slipData.incentives || 0);
      const slipEmrPF = (slipData.pf && parseFloat(slipData.pf) > 0) ? ((slipData.basic || 0) * 0.12) : 0;
      const slipEmrESI = (slipData.esi && parseFloat(slipData.esi) > 0) ? (slipGross * 0.0325) : 0;
      const slipTotalEmr = slipEmrPF + slipEmrESI;

      // Employer Contributions Table
      const emrY = netY + 11;
      autoTable(doc, {
        startY: emrY,
        head: [['Employer Contributions (Not Deducted from Net Salary)', 'Amt. (INR)']],
        body: [
          ['Employer PF Contribution (12% of Basic)', slipEmrPF.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
          ['Employer ESIC Contribution (3.25% of Gross)', slipEmrESI.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
          ['Total Employer Contribution', slipTotalEmr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]
        ],
        theme: 'grid',
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 1: { halign: 'right' } }
      });
      
      const nextY = (doc as any).lastAutoTable?.finalY + 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Amount in Words: ${numberToWords(Math.round(Number(slipData.netSalary || 0)))}`, 15, nextY + 4);

      // 6. Long Legal Disclaimer
      const disclaimer = `This is a system-generated payslip and therefore does not require a company seal or signature. It is a confidential document and must not be shared or published on any public or digital platform without prior written consent from the company. Any unauthorized disclosure, including on social media or other digital media, will entitle the company to take appropriate action against the concerned employee or ex-employee at any time. The term “TBD” (To Be Declared) indicates that the relevant information is pending and will be updated upon submission by the employee or respective authorities.`;
      
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'normal');
      const splitDisclaimer = doc.splitTextToSize(disclaimer, 180);
      doc.text(splitDisclaimer, 15, nextY + 12);

      // 7. Save the file
      doc.save(`SalarySlip_${String(user?.name || 'Employee').replace(/[^a-z0-9]/gi, '_')}_${monthNames[slipMonth-1]}_${slipYear}.pdf`);
      
    } catch (err: any) {
      console.error("PDF Generation Error:", err);
      alert("Error: " + err.message);
    }
  };

  const handleApplyCalculatorToForm = (ctcAmount: number, includePF = true, includeESI = true) => {
    setFormHasPF(includePF);
    setFormHasESI(includeESI);

    let multiplier = 1.0;
    if (includePF) multiplier += 0.048;
    if (includeESI) multiplier += 0.0325;

    const gross = ctcAmount / multiplier;
    const basic = gross * 0.4;
    const hra = basic * 0.2;
    const incentives = gross - basic - hra;

    let ptax = 0;
    if (ctcAmount > 40000) ptax = 200;
    else if (ctcAmount > 25000) ptax = 150;
    else if (ctcAmount > 15000) ptax = 130;
    else if (ctcAmount > 10000) ptax = 110;

    const pf = includePF ? (basic * 0.12) : 0;
    const esi = includeESI ? (gross * 0.0075) : 0;

    setFormData((prev: any) => ({
      ...prev,
      salaryAmount: ctcAmount.toString(),
      basic: basic.toFixed(2),
      hra: hra.toFixed(2),
      incentives: incentives.toFixed(2),
      ptax: ptax.toString(),
      pfAmount: pf.toFixed(2),
      esiAmount: esi.toFixed(2)
    }));
  };

  const handleDownloadAnnexurePDF = async (ctcAmount: number, includePF = true, includeESI = true) => {
    const doc = new jsPDF();
    const logoUrl = companySettings.company_logo ? `http://localhost:5000${companySettings.company_logo}` : 'https://digiexweb.com/assets/img/logo.png';
    const companyName = companySettings.company_name || 'DIGIEX WEB SERVICES';

    const loadImageAsPng = async (url: string): Promise<string | null> => {
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error("Network response was not ok");
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
        console.error("Error loading logo image:", err);
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

      // Annexure Header
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(245, 245, 245);
      doc.rect(15, 28, 180, 8, 'F');
      doc.text(`Salary Annexure (Offer & Appointment Letter)`, 105, 33.5, { align: 'center' });

      // Calculations
      let multiplier = 1.0;
      if (includePF) multiplier += 0.048;
      if (includeESI) multiplier += 0.0325;

      const gross = ctcAmount / multiplier;
      const basic = gross * 0.4;
      const hra = basic * 0.2;
      const conveyance = gross - basic - hra;

      const emrPF = includePF ? (basic * 0.12) : 0;
      const emrESIC = includeESI ? (gross * 0.0325) : 0;
      const totalEmrContr = emrPF + emrESIC;

      const emePF = includePF ? (basic * 0.12) : 0;
      const emeESIC = includeESI ? (gross * 0.0075) : 0;
      
      let ptax = 0;
      if (ctcAmount > 40000) ptax = 200;
      else if (ctcAmount > 25000) ptax = 150;
      else if (ctcAmount > 15000) ptax = 130;
      else if (ctcAmount > 10000) ptax = 110;

      const totalDeductions = emePF + emeESIC + ptax;
      const netSalary = gross - totalDeductions;

      const formatVal = (val: number) => val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Assumptions & Basic Metadata Table
      autoTable(doc, {
        startY: 38,
        body: [
          ['Basic % of Gross', '40%', 'Employer PF % of Basic', '12%'],
          ['HRA % of Basic', '20%', 'Employer ESIC % of Gross', '3.25%'],
          ['Employee PF % of Basic', '12%', 'Employee ESIC % of Gross', '0.75%']
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [250, 250, 250] }, 2: { fontStyle: 'bold', fillColor: [250, 250, 250] } }
      });

      const nextY = (doc as any).lastAutoTable?.finalY || 48;

      // Main Table
      autoTable(doc, {
        startY: nextY + 5,
        head: [['Salary Component', 'Monthly (INR)', 'Annual (INR)']],
        body: [
          ['Basic Salary (40% of Gross)', formatVal(basic), formatVal(basic * 12)],
          ['HRA (20% of Basic)', formatVal(hra), formatVal(hra * 12)],
          ['Conveyance & Other Allowance', formatVal(conveyance), formatVal(conveyance * 12)],
          ['Gross Salary', formatVal(gross), formatVal(gross * 12)],
          
          [{ content: 'Employee Deductions', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [245, 245, 245], fontSize: 8 } }],
          ['Employee PF (12% of Basic)', formatVal(emePF), formatVal(emePF * 12)],
          ['Employee ESIC (0.75% of Gross)', formatVal(emeESIC), formatVal(emeESIC * 12)],
          ['Professional Tax', formatVal(ptax), formatVal(ptax * 12)],
          ['Total Deductions', formatVal(totalDeductions), formatVal(totalDeductions * 12)],
          
          ['Net Salary Payable', formatVal(netSalary), formatVal(netSalary * 12)],
          
          [{ content: 'Employer Contribution (Included in CTC)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [245, 245, 245], fontSize: 8 } }],
          ['Employer PF (12% of Basic)', formatVal(emrPF), formatVal(emrPF * 12)],
          ['Employer ESIC (3.25% of Gross)', formatVal(emrESIC), formatVal(emrESIC * 12)],
          ['Total Employer Contribution', formatVal(totalEmrContr), formatVal(totalEmrContr * 12)],
          
          ['Total CTC', formatVal(ctcAmount), formatVal(ctcAmount * 12)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        didParseCell: (data) => {
          const rowIndex = data.row.index;
          if (rowIndex === 3 || rowIndex === 8 || rowIndex === 13) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
          if (rowIndex === 9) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [230, 242, 237];
            data.cell.styles.textColor = [6, 95, 70];
          }
          if (rowIndex === 14) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [239, 246, 255];
            data.cell.styles.textColor = [30, 64, 175];
          }
        }
      });

      const finalY2 = (doc as any).lastAutoTable?.finalY || 180;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text("Notes: All figures are in INR. Tax liabilities are subject to change as per government guidelines.", 15, finalY2 + 15);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text("For DIGIEX WEB SERVICES", 15, finalY2 + 30);
      doc.text("Employee Acceptance", 140, finalY2 + 30);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text("Authorized Signatory", 15, finalY2 + 45);
      doc.text("Signature & Date", 140, finalY2 + 45);

      doc.save(`Salary_Annexure_${ctcAmount}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF");
    }
  };

  const generateOfferLetterPDF = async (data: any) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      const headerUrl = '/pdf_header.png';
      const footerUrl = '/pdf_footer.png';

      const loadImageAsPng = async (url: string): Promise<string | null> => {
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error("Network response was not ok");
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
          console.error("Error loading image:", err);
          return null;
        }
      };

      const [headerPng, footerPng] = await Promise.all([
        loadImageAsPng(headerUrl),
        loadImageAsPng(footerUrl)
      ]);

      const printParts = (
        parts: { text: string; bold?: boolean }[],
        startX: number,
        startY: number,
        maxWidth = 180,
        fontSize = 9.5,
        lineLeading = 5
      ) => {
        let currentX = startX;
        let currentY = startY;

        const words: { word: string; bold: boolean }[] = [];
        parts.forEach(p => {
          const splitArr = p.text.split(' ');
          splitArr.forEach((w, idx) => {
            const space = idx < splitArr.length - 1 ? ' ' : '';
            words.push({ word: w + space, bold: Boolean(p.bold) });
          });
        });

        words.forEach(wObj => {
          doc.setFont('helvetica', wObj.bold ? 'bold' : 'normal');
          doc.setFontSize(fontSize);
          const wWidth = doc.getTextWidth(wObj.word);
          if (currentX + wWidth > startX + maxWidth && currentX > startX) {
            currentX = startX;
            currentY += lineLeading;
          }
          doc.text(wObj.word, currentX, currentY);
          currentX += wWidth;
        });

        return currentY + lineLeading;
      };

      const empName = data.name || 'Sudipta Pandit';
      const salutation = data.gender === 'Female' ? 'Ms.' : 'Mr.';
      const empAddress = data.permanentAddress || data.currentAddress || 'Purba Bardhaman';
      
      let roleName = 'Digital Marketing Executive';
      let deptName = 'Digital Marketing';
      if (data.roles && data.roles.length > 0) {
        const foundRole = roles.find(r => r._id === (typeof data.roles[0] === 'object' ? data.roles[0]._id : data.roles[0]));
        if (foundRole) {
          roleName = foundRole.name || roleName;
          deptName = typeof foundRole.department === 'object' ? foundRole.department?.name : (foundRole.department || deptName);
        }
      } else if (data.role) {
        const foundRole = roles.find(r => r._id === (typeof data.role === 'object' ? data.role._id : data.role));
        if (foundRole) {
          roleName = foundRole.name || roleName;
          deptName = typeof foundRole.department === 'object' ? foundRole.department?.name : (foundRole.department || deptName);
        }
      }

      let managerName = 'Mr. Vikash Kumar Singh';
      let managerRole = 'Project Manager';
      if (data.reportingManager) {
        const foundMgr = users.find(u => u._id === (typeof data.reportingManager === 'object' ? data.reportingManager._id : data.reportingManager));
        if (foundMgr) {
          managerName = foundMgr.name || managerName;
          if (foundMgr.role) {
            const mgrRoleObj = roles.find(r => r._id === (typeof foundMgr.role === 'object' ? foundMgr.role._id : foundMgr.role));
            if (mgrRoleObj) managerRole = mgrRoleObj.name || managerRole;
          }
        }
      }

      const joiningDate = data.joiningDate ? new Date(data.joiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '18 May 2026';
      const offerDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const fixedAmt = parseFloat(data.salaryAmount) || 0;
      const varAmt = parseFloat(data.variableSalary) || 0;
      const totalCTC = (fixedAmt + varAmt) > 0 ? (fixedAmt + varAmt) : 15000;
      const monthlyGross = totalCTC;
      const annualGross = monthlyGross * 12;
      const empTypeStr = (data.employmentType || 'full-time').toLowerCase();

      // ================= PAGE 1 =================
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text("OFFER AND APPOINTMENT LETTER", pageWidth / 2, 58, { align: 'center' });

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text("Date: ", 15, 70);
      doc.setFont('helvetica', 'normal');
      doc.text(offerDate, 15 + doc.getTextWidth("Date: "), 70);

      doc.setFont('helvetica', 'bold');
      doc.text("To:", 15, 82);
      doc.text(`${salutation} ${empName},`, 15, 88);
      doc.setFont('helvetica', 'normal');
      doc.text(empAddress, 15, 94);

      doc.setFont('helvetica', 'bold');
      doc.text(`Dear ${salutation} ${empName},`, 15, 106);

      let curY = 114;
      curY = printParts([
        { text: "We are delighted to congratulate you and welcome you to " },
        { text: "Digiex Web Services Private Limited", bold: true },
        { text: ", where innovation meets excellence. We are pleased to offer you the position of " },
        { text: roleName, bold: true },
        { text: " in the " },
        { text: deptName + " Department", bold: true },
        { text: "." }
      ], 15, curY, 180, 9.5, 5);

      curY += 2;
      curY = printParts([
        { text: "Your employment will commence on " },
        { text: joiningDate, bold: true },
        { text: ", and you will be based at our " },
        { text: "Kolkata Corporate Office, West Bengal", bold: true },
        { text: ". You will report directly to " },
        { text: `${managerName}, ${managerRole}`, bold: true },
        { text: "." }
      ], 15, curY, 180, 9.5, 5);

      curY += 4;
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.text("Remuneration", 15, curY);

      curY += 8;
      const bullet = (label: string, val: string) => {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        const prefix = "•   " + label + ":";
        doc.text(prefix, 18, curY);
        const prefixWidth = doc.getTextWidth(prefix);
        doc.setFont('helvetica', 'normal');
        doc.text(" " + val, 18 + prefixWidth, curY);
        curY += 7;
      };

      bullet("Designation", roleName);
      bullet("Department", deptName);
      bullet("Date of Joining", joiningDate);
      bullet("Reporting To", `${managerName}, ${managerRole}`);
      bullet("Monthly Gross Salary", `Rs. ${monthlyGross.toLocaleString('en-IN')}/- (Rupees ${numberToWords(Math.round(monthlyGross))} Only)`);
      bullet("Annual Gross Salary", `Rs. ${annualGross.toLocaleString('en-IN')}/- (Rupees ${numberToWords(Math.round(annualGross))} Only)`);

      curY += 3;
      curY = printParts([
        { text: "Your employment may be confirmed as a " },
        { text: `regular ${empTypeStr} employee`, bold: true },
        { text: ", subject to the company's performance evaluation and management approval." }
      ], 15, curY, 180, 9.5, 5);

      // ================= PAGE 2 =================
      doc.addPage();
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text("Annexure", pageWidth / 2, 56, { align: 'center' });

      let multiplier = 1.0;
      if (formHasPF) multiplier += 0.048;
      if (formHasESI) multiplier += 0.0325;
      
      const grossM = totalCTC / multiplier;
      const basicM = grossM * 0.4;
      const hraM = basicM * 0.2;
      const convM = grossM - basicM - hraM;

      let ptaxM = 0;
      if (totalCTC > 40000) ptaxM = 200;
      else if (totalCTC > 25000) ptaxM = 150;
      else if (totalCTC > 15000) ptaxM = 130;
      else if (totalCTC > 10000) ptaxM = 110;

      const pfM = formHasPF ? (basicM * 0.12) : 0;
      const esiM = formHasESI ? (grossM * 0.0075) : 0;
      const totalDedM = pfM + esiM + ptaxM;
      const netM = grossM - totalDedM;

      const emrPfM = formHasPF ? (basicM * 0.12) : 0;
      const emrEsiM = formHasESI ? (grossM * 0.0325) : 0;
      const totalEmrM = emrPfM + emrEsiM;

      const fmt = (v: number) => v.toFixed(6).replace(/\.?0+$/, '');

      autoTable(doc, {
        startY: 62,
        head: [['Salary Heads', 'Monthly (Rs.)', 'Annual (Rs.)']],
        body: [
          ['Basic Salary (40%)', fmt(basicM), fmt(basicM * 12)],
          ['HRA (20% of Basic)', fmt(hraM), fmt(hraM * 12)],
          ['Conveyance & Other Allowance', fmt(convM), fmt(convM * 12)],
          ['Gross Salary', fmt(grossM), fmt(grossM * 12)],
          [{ content: 'Employee Deductions', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
          ['Employee PF', fmt(pfM), fmt(pfM * 12)],
          ['Employee ESIC', fmt(esiM), fmt(esiM * 12)],
          ['P. Tax', fmt(ptaxM), fmt(ptaxM * 12)],
          ['Total Deductions', fmt(totalDedM), fmt(totalDedM * 12)],
          ['Net Salary Payable', fmt(netM), fmt(netM * 12)],
          [{ content: 'Employer Contribution (Included in CTC)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
          ['Employer PF', fmt(emrPfM), fmt(emrPfM * 12)],
          ['Employer ESIC', fmt(emrEsiM), fmt(emrEsiM * 12)],
          ['Total Employer Contribution', fmt(totalEmrM), fmt(totalEmrM * 12)],
          ['Total CTC', fmt(totalCTC), fmt(totalCTC * 12)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [220, 235, 220], textColor: [0, 0, 0], fontSize: 8.5, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
      });

      const annFinalY = (doc as any).lastAutoTable?.finalY || 145;

      curY = annFinalY + 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Terms & Conditions of Employment", 15, curY);

      curY += 7;
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text("1. Working Hours & Transfer", 15, curY);
      curY += 6;
      doc.setFont('helvetica', 'normal');
      const t1 = "You shall observe the official working hours of the Company. The Company reserves the right to transfer you between departments, projects, shifts, branches, or any existing or future office locations anywhere in India without any additional remuneration.";
      doc.text(doc.splitTextToSize(t1, 180), 15, curY);

      curY += 16;
      doc.setFont('helvetica', 'bold');
      doc.text("2. Company Policies", 15, curY);
      curY += 6;
      doc.setFont('helvetica', 'normal');
      const t2 = "You are required to comply with all company rules, regulations, policies, and procedures currently in force or introduced from time to time.";
      doc.text(doc.splitTextToSize(t2, 180), 15, curY);

      // ================= PAGE 3 =================
      doc.addPage();
      curY = 56;

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text("3. Exclusivity of Employment", 15, curY);
      curY += 6;
      doc.setFont('helvetica', 'normal');
      const t3 = "During your employment with Digiex Web Services Private Limited, you shall not engage in any other employment, business, consultancy, freelancing, or part-time assignment without prior written approval from the Company.";
      doc.text(doc.splitTextToSize(t3, 180), 15, curY);

      curY += 16;
      doc.setFont('helvetica', 'bold');
      doc.text("4. Company Property", 15, curY);
      curY += 6;
      doc.setFont('helvetica', 'normal');
      const t4 = "You shall be responsible for the safe custody and return of all company assets entrusted to you, including but not limited to laptops, accessories, documents, software, books, equipment, ID cards, and other official materials. The Company reserves the right to recover the cost of any damaged or unreturned property.";
      doc.text(doc.splitTextToSize(t4, 180), 15, curY);

      curY += 20;
      doc.setFont('helvetica', 'bold');
      doc.text("5. Professional Conduct", 15, curY);
      curY += 6;
      doc.setFont('helvetica', 'normal');
      const t5 = "You are expected to maintain the highest standards of professionalism, integrity, courtesy, and discipline while interacting with clients, colleagues, vendors, and management.";
      doc.text(doc.splitTextToSize(t5, 180), 15, curY);

      // Dynamic Job Responsibilities Generator
      const getJobResponsibilities = (role: string) => {
        const r = (role || '').toLowerCase();
        
        // 1. Video Editor / Videographer / Motion Graphics
        if (r.includes('video') || r.includes('editor') || r.includes('motion') || r.includes('videographer') || r.includes('animat')) {
          return [
            { title: "Video Editing & Post-Production", text: "Assemble, edit, and cut raw footage into high-quality videos for promotional, social media, and client projects." },
            { 
              title: "Motion Graphics & Animation", 
              text: "Design visual effects, animated titles, lower thirds, callouts, and transition effects using Adobe After Effects and Premiere Pro.",
              parts: [
                { text: "Design visual effects, animated titles, lower thirds, callouts, and transition effects using " },
                { text: "Adobe After Effects, Premiere Pro, and Motion Graphics software", bold: true },
                { text: "." }
              ]
            },
            { title: "Social Media Video Formats", text: "Create high-converting short-form video content optimized for Instagram Reels, YouTube Shorts, Facebook, and LinkedIn." },
            { title: "Audio Mixing & Sound Design", text: "Mix sound tracks, clean audio, sync voiceovers, and balance background music to ensure crisp audio production." },
            { title: "Color Grading & Correction", text: "Perform color correction and color grading to achieve consistent visual tones, brand aesthetics, and cinema-grade appeal." },
            { 
              title: "AI Video Editing Tools", 
              text: "Utilize Runway AI, CapCut Pro, Topaz Video AI, Premiere AI tools, and voice generation software to accelerate post-production workflow.",
              parts: [
                { text: "Utilize " },
                { text: "Runway AI, CapCut Pro, Topaz Video AI, Premiere AI tools, and voice generation software", bold: true },
                { text: " to accelerate post-production workflow." }
              ]
            },
            { title: "Storyboarding & Creative Direction", text: "Collaborate with content creators and marketers to align video concepts, scripts, storyboards, and visual storytelling." },
            { title: "Video Asset & File Management", text: "Organize raw footage, graphics, audio files, and exported masters in structured project directories and backup servers." },
            { title: "Client Revisions & Feedback", text: "Incorporate client and internal feedback efficiently while maintaining visual standards and meeting project delivery deadlines." },
            { title: "Editing Trends & Technical Upgradation", text: "Stay updated on trending video editing styles, VFX techniques, social video algorithms, and emerging video software." }
          ];
        }
        // 2. SEO Executive / SEO Specialist / SEO Manager
        else if (r.includes('seo') || r.includes('search engine')) {
          return [
            { title: "Keyword Research & Search Strategy", text: "Conduct comprehensive keyword research, search intent analysis, and competitor keyword mapping to drive targeted organic traffic." },
            { title: "On-Page SEO Optimization", text: "Optimize title tags, meta descriptions, heading structures, image alt text, URL structures, and internal linking across client websites." },
            { title: "Technical SEO & Site Audits", text: "Perform technical SEO audits, resolve crawl errors, improve Core Web Vitals, site speed, XML sitemaps, and canonical tags." },
            { 
              title: "Off-Page SEO & Link Building", 
              text: "Develop high-authority backlink strategies through guest posting, outreach, directory submissions, and digital PR activities.",
              parts: [
                { text: "Develop high-authority backlink strategies through " },
                { text: "guest posting, outreach, directory submissions, and digital PR activities", bold: true },
                { text: "." }
              ]
            },
            { title: "Local SEO & Business Listings", text: "Manage Google Business Profiles, local citations, NAP consistency, customer reviews, and location-based search optimizations." },
            { 
              title: "AI-Powered SEO Tools", 
              text: "Utilize Surfer SEO, Ahrefs, SEMrush, Screaming Frog, ChatGPT, and Google Search Console to optimize search strategies.",
              parts: [
                { text: "Utilize " },
                { text: "Surfer SEO, Ahrefs, SEMrush, Screaming Frog, ChatGPT, and Google Search Console", bold: true },
                { text: " to optimize search strategies." }
              ]
            },
            { 
              title: "Analytics & Ranking Reports", 
              text: "Monitor organic rankings, organic traffic trends, and conversions using Google Analytics 4 (GA4) and Google Search Console.",
              parts: [
                { text: "Monitor organic rankings, organic traffic trends, and conversions using " },
                { text: "Google Analytics 4 (GA4) and Google Search Console", bold: true },
                { text: "." }
              ]
            },
            { title: "Content Strategy & SEO Briefs", text: "Collaborate with content writers to create SEO-friendly blog briefs, landing page content, and topical authority clusters." },
            { title: "Algorithm Update Tracking", text: "Stay informed about Google search algorithm updates, helpful content guidelines, and search engine policy changes." },
            { title: "Client Reporting & Performance Growth", text: "Prepare monthly SEO performance reports, highlight keyword ranking improvements, traffic growth, and action items." }
          ];
        }
        // 3. SMM Executive / Social Media Specialist
        else if (r.includes('smm') || r.includes('social media')) {
          return [
            { title: "Social Media Campaign Strategy", text: "Develop and execute social media strategies across Facebook, Instagram, LinkedIn, X (Twitter), and YouTube to grow brand presence." },
            { title: "Content Creation & Scheduling", text: "Create engaging social media posts, carousel graphics, reel concepts, and maintain an organized monthly content calendar." },
            { title: "Community Management & Engagement", text: "Interact with followers, respond promptly to comments and direct messages, and foster active brand communities." },
            { 
              title: "Social Media Advertising (Paid Ads)", 
              text: "Set up, monitor, and optimize Meta Ads (Facebook & Instagram) and LinkedIn ad campaigns to generate leads and traffic.",
              parts: [
                { text: "Set up, monitor, and optimize " },
                { text: "Meta Ads (Facebook & Instagram) and LinkedIn ad campaigns", bold: true },
                { text: " to generate leads and traffic." }
              ]
            },
            { title: "Viral Trend & Reel Research", text: "Identify trending audio tracks, viral formats, and creative hooks to boost organic social reach and engagement." },
            { 
              title: "AI-Powered Social Media Tools", 
              text: "Utilize ChatGPT, Canva AI, Copy.ai, Metricool, and Buffer to streamline copy generation, graphics, and multi-channel scheduling.",
              parts: [
                { text: "Utilize " },
                { text: "ChatGPT, Canva AI, Copy.ai, Metricool, and Buffer", bold: true },
                { text: " to streamline copy generation, graphics, and multi-channel scheduling." }
              ]
            },
            { title: "Brand Voice & Visual Consistency", text: "Ensure all social media messaging, aesthetics, and visuals adhere strictly to company and client brand guidelines." },
            { title: "Influencer & Partner Outreach", text: "Identify relevant micro-influencers and industry partners for brand collaborations and cross-promotional campaigns." },
            { title: "Social Analytics & Reporting", text: "Track impressions, reach, engagement rates, and follower growth using native insights and analytics dashboards." },
            { title: "Platform Algorithm Upgrades", text: "Stay ahead of social media algorithm changes, new feature releases, and social commerce innovations." }
          ];
        }
        // 4. Content Writer / Copywriter
        else if (r.includes('content') || r.includes('copywriter') || r.includes('writer') || r.includes('blog')) {
          return [
            { title: "Content Creation & Copywriting", text: "Write high-quality blogs, articles, website copy, sales pages, email newsletters, and promotional marketing collateral." },
            { title: "SEO Copywriting & Optimization", text: "Incorporate targeted keywords naturally into content, craft compelling headlines, meta tags, and structure articles for search engines." },
            { title: "Social Media & Ad Copy", text: "Draft catchy social media captions, reel scripts, ad headlines, and high-converting copy for Facebook, Instagram, and Google Ads." },
            { 
              title: "AI Writing & Prompt Engineering", 
              text: "Leverage ChatGPT, Claude AI, Jasper, and Grammarly Premium for ideation, research, draft structuring, and proofreading.",
              parts: [
                { text: "Leverage " },
                { text: "ChatGPT, Claude AI, Jasper, and Grammarly Premium", bold: true },
                { text: " for ideation, research, draft structuring, and proofreading." }
              ]
            },
            { title: "Research & Fact-Checking", text: "Conduct thorough industry research, competitor analysis, and fact-checking to produce authoritative, accurate content." },
            { title: "Brand Tone & Style Consistency", text: "Adapt writing tone and voice according to specific client personas, brand guidelines, and target audience segments." },
            { title: "Editing & Proofreading", text: "Review, edit, and refine content to ensure zero grammatical errors, clear readability, and logical structure." },
            { title: "Content Planning & Strategy", text: "Collaborate with SEO specialists and marketers to build topic clusters, content calendars, and content marketing funnels." },
            { title: "Client Revisions & Feedback", text: "Refine written content according to feedback from internal team leads and external clients in a timely manner." },
            { title: "Content Performance Tracking", text: "Analyze content performance, user engagement, and reader feedback to continuously improve content quality." }
          ];
        }
        // 5. Designer / Graphic / UI/UX / Web Designer
        else if (r.includes('design') || r.includes('graphic') || r.includes('ui') || r.includes('ux') || r.includes('creative') || r.includes('art') || r.includes('illustrator')) {
          return [
            { title: "Graphic & UI/UX Design", text: "Create visually appealing designs, graphics, branding materials, UI layouts, and user experience components aligned with client requirements." },
            { title: "Social Media & Advertising Creatives", text: "Design high-converting ad banners, social media posts, promotional materials, infographics, and digital assets for multi-channel marketing campaigns." },
            { 
              title: "Wireframing & Prototyping", 
              text: "Develop wireframes, user flows, and interactive prototypes using Figma, Adobe XD, or Photoshop to communicate visual concepts effectively.",
              parts: [
                { text: "Develop wireframes, user flows, and interactive prototypes using " },
                { text: "Figma, Adobe XD, Photoshop, and Illustrator", bold: true },
                { text: " to communicate visual concepts effectively." }
              ]
            },
            { title: "Brand Identity & Guidelines", text: "Assist in developing and maintaining corporate brand guidelines, color palettes, typography standards, and brand assets." },
            { title: "Marketing & Sales Collaterals", text: "Design brochures, pitch decks, corporate presentations, email templates, and web graphics for marketing and sales initiatives." },
            { 
              title: "AI-Powered Design Tools", 
              text: "Utilize Canva AI, Midjourney, Adobe Firefly, Photoshop Generative Fill, and other AI tools to accelerate asset creation and creative ideation.",
              parts: [
                { text: "Utilize " },
                { text: "Canva AI, Midjourney, Adobe Firefly, Photoshop Generative Fill, and other AI tools", bold: true },
                { text: " to accelerate asset creation and creative ideation." }
              ]
            },
            { title: "Asset Optimization & File Delivery", text: "Prepare, slice, and optimize graphics for web and mobile performance, ensuring proper resolution, format, and file compression." },
            { title: "Cross-Functional Collaboration", text: "Work closely with content writers, web developers, digital marketers, and project managers to deliver cohesive design solutions." },
            { title: "Design Quality Assurance & Revisions", text: "Incorporate client feedback and revision requests diligently while maintaining visual quality, design consistency, and project deadlines." },
            { title: "Industry Trends & Skill Upgradation", text: "Stay updated with contemporary design trends, typography techniques, UI/UX best practices, and emerging creative design software." }
          ];
        } 
        // 6. Developer / Software / Web / Engineer
        else if (r.includes('dev') || r.includes('engineer') || r.includes('software') || r.includes('programmer') || r.includes('coder') || r.includes('web')) {
          return [
            { title: "Web & Software Development", text: "Design, develop, and maintain responsive web applications, websites, and software modules using clean, maintainable, and scalable code." },
            { 
              title: "Frontend & Backend Implementation", 
              text: "Implement frontend user interfaces and backend API integrations using React, HTML5, CSS3, JavaScript, Node.js, and modern frameworks.",
              parts: [
                { text: "Implement frontend user interfaces and backend API integrations using " },
                { text: "React, HTML5, CSS3, JavaScript, Node.js, and modern frameworks", bold: true },
                { text: "." }
              ]
            },
            { title: "Database & Server Management", text: "Design and manage database schemas (MongoDB, MySQL), write optimized queries, and maintain server-side business logic." },
            { title: "Code Testing & Debugging", text: "Perform rigorous testing, code reviews, and debugging to identify and resolve software bugs, performance bottlenecks, and security vulnerabilities." },
            { title: "Performance & SEO Optimization", text: "Optimize website speed, core web vitals, responsiveness, and code structure for search engine optimization and user experience." },
            { 
              title: "AI-Powered Coding Tools", 
              text: "Utilize GitHub Copilot, ChatGPT, Claude AI, Cursor AI, and automated dev tools to streamline coding, code refactoring, and problem-solving.",
              parts: [
                { text: "Utilize " },
                { text: "GitHub Copilot, ChatGPT, Claude AI, Cursor AI, and automated dev tools", bold: true },
                { text: " to streamline coding, code refactoring, and problem-solving." }
              ]
            },
            { title: "API Integration & Cloud Services", text: "Integrate third-party APIs, payment gateways, authentication systems, and cloud services into web applications." },
            { title: "Collaboration & Agile Workflow", text: "Work closely with UI/UX designers, QA testers, project managers, and clients following Agile/Scrum development methodologies." },
            { title: "Version Control & Deployment", text: "Maintain codebase repositories using Git, manage branch deployments, CI/CD pipelines, and web hosting server environments." },
            { title: "Continuous Learning & Tech Stack Upgrades", text: "Keep pace with evolving software technologies, framework updates, security protocols, and web development best practices." }
          ];
        } 
        // 7. Telemarketing / Inside Sales / Cold Calling
        else if (r.includes('tele') || r.includes('cold call') || r.includes('inside sales')) {
          return [
            { title: "Outbound Calling & Prospecting", text: "Conduct daily outbound cold calls and warm follow-ups to potential B2B and B2C clients to generate qualified leads." },
            { title: "Lead Qualification & Needs Analysis", text: "Identify client requirements, pain points, and budget availability during telephonic discovery calls." },
            { title: "Service Pitching & Presentation", text: "Articulate company services, digital packages, and value propositions effectively over phone calls." },
            { title: "Appointment & Demo Scheduling", text: "Schedule sales discovery meetings, product demos, and consultations for Senior Sales Managers." },
            { title: "Objection Handling & Call Scripting", text: "Address client queries, handle sales objections professionally, and follow structured call scripts." },
            { 
              title: "CRM & Call Data Management", 
              text: "Maintain accurate call logs, client status updates, and follow-up reminders inside the company CRM.",
              parts: [
                { text: "Maintain accurate call logs, client status updates, and follow-up reminders inside the " },
                { text: "company CRM and lead portal", bold: true },
                { text: "." }
              ]
            },
            { title: "Daily & Monthly Call Targets", text: "Achieve individual daily call count, connect rates, lead conversion metrics, and pipeline targets." },
            { title: "Follow-Up & Nurturing", text: "Consistently follow up with prospects through phone calls, WhatsApp messages, and email communications." },
            { title: "Sales Team Collaboration", text: "Work closely with Sales Heads and Business Development Executives to transition qualified prospects seamlessly." },
            { title: "Sales Training & Skill Improvement", text: "Participate in regular sales communication workshops, phone etiquette sessions, and negotiation training." }
          ];
        }
        // 8. Sales / Business Development / Revenue Manager / Branch Manager
        else if (r.includes('sales') || r.includes('bdm') || r.includes('business dev') || r.includes('revenue') || r.includes('branch manager') || r.includes('client executive')) {
          return [
            { title: "B2B Lead Generation & Prospecting", text: "Identify, prospect, and qualify potential corporate clients through outbound outreach, networking, and market research." },
            { title: "Client Consultation & Pitching", text: "Conduct discovery calls, present company services, pitch customized digital solutions, and articulate value propositions to prospects." },
            { title: "Proposal & Quotation Preparation", text: "Prepare detailed commercial proposals, quotations, sales scope documents, and service agreements tailored to prospect needs." },
            { title: "Deal Closing & Revenue Targets", text: "Negotiate terms, overcome client objections, close sales deals, and achieve individual and team monthly revenue targets." },
            { title: "Relationship Management", text: "Nurture long-term relationships with existing clients, identify upsell/cross-sell opportunities, and drive client retention." },
            { 
              title: "AI-Powered Sales & Outreach Tools", 
              text: "Utilize CRM platforms, AI email drafting, automated follow-up sequences, and lead intelligence tools to optimize sales pipeline.",
              parts: [
                { text: "Utilize " },
                { text: "CRM platforms, AI email drafting, automated follow-up sequences, and lead intelligence tools", bold: true },
                { text: " to optimize sales pipeline." }
              ]
            },
            { title: "Pipeline & CRM Updates", text: "Maintain accurate, real-time records of sales leads, deal stages, call logs, and customer interactions within the CRM system." },
            { title: "Market Intelligence", text: "Monitor industry trends, competitor offerings, pricing strategies, and customer demands to refine sales pitching approaches." },
            { title: "Cross-Functional Coordination", text: "Coordinate smoothly with project management, operations, and technical teams to ensure seamless client onboarding." },
            { title: "Sales Performance & Skill Enhancement", text: "Participate in sales reviews, objection-handling workshops, negotiation training, and continuous professional development." }
          ];
        } 
        // 9. HR / Human Resources / Talent / Recruiter
        else if (r.includes('hr') || r.includes('human resource') || r.includes('talent') || r.includes('recruiter') || r.includes('people ops')) {
          return [
            { title: "Recruitment & Talent Acquisition", text: "Source, screen, interview, and onboard qualified candidates across departments through job portals, social platforms, and campus drives." },
            { title: "Employee Onboarding & Offboarding", text: "Facilitate smooth employee joining procedures, document verification, background checks, orientation, exit interviews, and full settlements." },
            { title: "Attendance & Leave Administration", text: "Monitor employee daily attendance, shift rosters, leave requests, WFH applications, and maintain accurate attendance records." },
            { 
              title: "Payroll Coordination", 
              text: "Coordinate payroll calculations, monthly salary slip generation, statutory deductions (PF, ESI, PTAX), and incentive calculations.",
              parts: [
                { text: "Coordinate payroll calculations, monthly salary slip generation, statutory deductions " },
                { text: "(PF, ESI, PTAX)", bold: true },
                { text: ", and incentive calculations." }
              ]
            },
            { title: "Performance Management", text: "Support performance evaluation cycles, probation confirmations, KPI tracking, feedback sessions, and annual appraisal processes." },
            { title: "Employee Engagement & Culture", text: "Organize team-building activities, celebration events, wellness programs, and cultivate a positive and motivating workplace culture." },
            { title: "Policy Compliance & HR Records", text: "Ensure strict adherence to company HR policies, labor laws, confidentiality agreements, and maintain secure employee digital files." },
            { title: "Conflict Resolution & Employee Relations", text: "Address employee grievances, mediate workplace disputes professionally, and ensure compliance with office decorum and rules." },
            { title: "HRMS System Management", text: "Maintain and update employee records, role assignments, department structures, and official document issuance within HRMS." },
            { title: "HR Analytics & Continuous Improvement", text: "Generate HR reports on turnover, absenteeism, hiring metrics, and continuously refine HR processes and policies." }
          ];
        } 
        // 10. Accounts / Finance / Billing / Tax
        else if (r.includes('account') || r.includes('finance') || r.includes('billing') || r.includes('tax') || r.includes('audit') || r.includes('bookkeeper')) {
          return [
            { title: "Bookkeeping & Financial Accounting", text: "Maintain accurate, up-to-date accounting ledgers, daily financial transactions, voucher entries, and general ledger records." },
            { title: "Invoicing & Billing Operations", text: "Generate and dispatch client tax invoices, debit/credit notes, recurring billing slips, and track billing schedules." },
            { title: "Accounts Receivable & Payable", text: "Manage client payment collections, follow up on outstanding invoices, verify vendor bills, and process vendor payments timely." },
            { 
              title: "Tax Compliance & Filings", 
              text: "Assist in preparing and filing statutory taxes including GST returns, TDS deductions, Professional Tax (PTAX), and income tax filings.",
              parts: [
                { text: "Assist in preparing and filing statutory taxes including " },
                { text: "GST returns, TDS deductions, Professional Tax (PTAX), and income tax filings", bold: true },
                { text: "." }
              ]
            },
            { title: "Bank Reconciliation", text: "Perform monthly bank account reconciliations, verify payment gateway settlements, and resolve transaction discrepancies." },
            { title: "Payroll Accounting Assistance", text: "Verify monthly salary components, statutory PF/ESI employer-employee contributions, and disburse employee salaries." },
            { title: "Financial Reporting", text: "Prepare monthly cash flow statements, profit & loss reports, balance sheets, and financial summaries for management review." },
            { title: "Audit Preparation", text: "Maintain complete supporting documentation, receipts, vouchers, and assist internal and external statutory auditors." },
            { title: "Expense Tracking & Budget Control", text: "Monitor operational expenses, departmental petty cash disbursements, and ensure adherence to internal financial controls." },
            { title: "Accounting Software & System Updates", text: "Utilize Tally, Zoho Books, Excel, and HRMS billing modules efficiently while staying updated on changing GST/tax regulations." }
          ];
        } 
        // 11. Project Manager / Team Lead / Operations Manager
        else if (r.includes('project') || r.includes('lead') || r.includes('operations') || r.includes('scrum') || r.includes('pm')) {
          return [
            { title: "Project Planning & Scope Management", text: "Define project objectives, scope, resource requirements, timelines, and deliverables for client and internal projects." },
            { title: "Team Leadership & Task Allocation", text: "Assign tasks, manage daily standups, guide team members, and ensure optimal productivity across project teams." },
            { title: "Client Communication & Updates", text: "Serve as primary point of contact for clients, providing regular status reports, milestone updates, and resolving queries." },
            { title: "Quality Control & Assurance", text: "Review deliverables prior to client handover to ensure adherence to high quality standards and specifications." },
            { title: "Timeline & Sprint Tracking", text: "Monitor project milestones, sprint schedules, and task velocity to guarantee on-time project completion." },
            { title: "Risk Mitigation & Issue Resolution", text: "Identify potential project risks, bottlenecks, or scope creeps early and implement corrective solutions proactively." },
            { title: "Resource & Budget Optimization", text: "Manage project resource allocation efficiently to maximize output while maintaining budget constraints." },
            { title: "Cross-Functional Coordination", text: "Coordinate smoothly between design, development, marketing, sales, and accounts teams." },
            { title: "Documentation & Process Adherence", text: "Maintain detailed project documentation, client sign-offs, scope revisions, and retrospective notes." },
            { title: "Continuous Process Improvement", text: "Evaluate project outcomes, gather team feedback, and refine operational workflows for continuous efficiency." }
          ];
        }
        // 12. Super Admin / Admin / Management
        else if (r.includes('admin') || r.includes('management') || r.includes('director') || r.includes('executive')) {
          return [
            { title: "Strategic Leadership & Oversight", text: "Provide strategic direction, operational leadership, and departmental supervision to drive overall business growth." },
            { title: "Operational Policy Enforcement", text: "Establish, enforce, and maintain company policies, operational standards, and workplace regulations." },
            { title: "Resource Allocation & Budgeting", text: "Oversee operational budgets, capital expenditures, resource distribution, and financial planning." },
            { title: "Key Stakeholder & Client Relations", text: "Manage relationships with strategic enterprise clients, partners, vendors, and internal leadership." },
            { title: "Team Management & Development", text: "Mentor team leaders and managers, conduct performance evaluations, and foster leadership growth." },
            { title: "Process & Efficiency Optimization", text: "Analyze business processes, implement automation, and optimize operational workflows across departments." },
            { title: "Compliance & Risk Governance", text: "Ensure company compliance with legal, statutory, labor, and industry regulatory frameworks." },
            { title: "Inter-Departmental Synchronization", text: "Ensure seamless communication and alignment between sales, service, development, HR, and finance departments." },
            { title: "Performance Monitoring & Analytics", text: "Track key performance indicators (KPIs), company revenue metrics, and operational goals regularly." },
            { title: "Organizational Culture & Growth", text: "Build a positive, goal-oriented, and innovative work environment focused on long-term corporate success." }
          ];
        }
        // 13. Digital Marketing / Marketing Executive
        else if (r.includes('marketing') || r.includes('digital')) {
          return [
            { title: "Digital Marketing Campaigns", text: "Assist in planning, executing, and optimizing digital marketing campaigns to increase brand awareness, website traffic, lead generation, and customer engagement." },
            { title: "Search Engine Optimization (SEO)", text: "Perform on-page, off-page, and technical SEO activities, including keyword research, content optimization, website audits, link building, and performance tracking." },
            { 
              title: "Social Media Marketing (SMM)", 
              text: "Create, schedule, and manage content for Facebook, Instagram, LinkedIn, YouTube, and other social media platforms to improve engagement and brand visibility.",
              parts: [
                { text: "Create, schedule, and manage content for " },
                { text: "Facebook, Instagram, LinkedIn, YouTube, and other social media platforms", bold: true },
                { text: " to improve engagement and brand visibility." }
              ]
            },
            { 
              title: "Paid Advertising", 
              text: "Support the creation, monitoring, and optimization of Google Ads, Meta Ads (Facebook & Instagram), and other paid marketing campaigns to maximize campaign performance and ROI.",
              parts: [
                { text: "Support the creation, monitoring, and optimization of " },
                { text: "Google Ads, Meta Ads (Facebook & Instagram), and other paid marketing campaigns", bold: true },
                { text: " to maximize campaign performance and ROI." }
              ]
            },
            { title: "Content Marketing", text: "Coordinate with content writers and designers to create blogs, website content, social media creatives, email campaigns, and promotional materials aligned with marketing objectives." },
            { 
              title: "AI-Powered Marketing Tools", 
              text: "Utilize ChatGPT, Google Gemini, Claude AI, Canva AI, Adobe Firefly, Surfer SEO, Jasper AI, and other AI-powered marketing tools to improve content creation, keyword research, campaign optimization, and productivity.",
              parts: [
                { text: "Utilize " },
                { text: "ChatGPT, Google Gemini, Claude AI, Canva AI, Adobe Firefly, Surfer SEO, Jasper AI, and other AI-powered marketing tools", bold: true },
                { text: " to improve content creation, keyword research, campaign optimization, and productivity." }
              ]
            },
            { 
              title: "Website & Analytics", 
              text: "Monitor website performance using Google Analytics 4 (GA4), Google Search Console, Google Tag Manager (GTM), and Meta Business Suite. Analyze campaign data and prepare reports to identify opportunities for improvement.",
              parts: [
                { text: "Monitor website performance using " },
                { text: "Google Analytics 4 (GA4), Google Search Console, Google Tag Manager (GTM), and Meta Business Suite", bold: true },
                { text: ". Analyze campaign data and prepare reports to identify opportunities for improvement." }
              ]
            },
            { title: "Lead Generation & Email Marketing", text: "Assist in lead generation activities, email marketing campaigns, CRM updates, and customer engagement initiatives to support business growth." },
            { title: "Collaboration", text: "Work closely with designers, developers, content writers, SEO specialists, and the sales team to execute marketing campaigns effectively and meet project deadlines." },
            { title: "Continuous Learning & Improvement", text: "Stay updated with the latest digital marketing trends, search engine algorithm updates, AI-powered marketing technologies, and industry best practices to continuously improve skills and campaign performance." }
          ];
        }
        // 14. Smart Generic Responsibilities Fallback for Custom / Unrecognized Roles
        else {
          const displayRole = role || 'Employee';
          return [
            { title: "Core Operational Execution", text: `Execute core operational duties and responsibilities effectively in your capacity as ${displayRole}.` },
            { title: "Quality Assurance & Accuracy", text: "Maintain high standards of quality, precision, and diligence in all assigned tasks and deliverables." },
            { title: "Team Collaboration", text: "Work collaboratively with team members, supervisors, and cross-functional departments to achieve project goals." },
            { title: "Task & Time Management", text: "Plan, organize, and prioritize daily work assignments to ensure timely completion of project milestones." },
            { title: "Tools & Software Utilization", text: "Utilize relevant software applications, digital tools, and internal HRMS systems to streamline daily operations." },
            { title: "Problem Solving & Initiative", text: "Proactively identify operational challenges and propose effective, practical solutions to management." },
            { title: "Professional Communication", text: "Maintain clear, professional, and respectful communication with colleagues, clients, and key stakeholders." },
            { title: "Policy & Process Compliance", text: "Adhere strictly to company policies, code of conduct, data security rules, and confidentiality agreements." },
            { title: "Reporting & Documentation", text: "Maintain organized records, task logs, and provide regular progress reports to your reporting manager." },
            { title: "Continuous Skill Enhancement", text: "Actively engage in ongoing professional learning, skill development, and industry best practices." }
          ];
        }
      };

      const respList = getJobResponsibilities(roleName);

      curY += 18;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Job Responsibilities – ${roleName}`, 15, curY);

      curY += 7;
      curY = printParts([
        { text: "As " },
        { text: roleName, bold: true },
        { text: ", your responsibilities include, but are not limited to:" }
      ], 15, curY, 180, 9.5, 5);

      curY += 2;
      const addRespBlock = (numStr: string, itemObj: { title: string; text: string; parts?: { text: string; bold?: boolean }[] }) => {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`${numStr}. ${itemObj.title}`, 18, curY);
        curY += 5;
        if (itemObj.parts) {
          curY = printParts(itemObj.parts, 24, curY, 171, 9.5, 5);
        } else {
          curY = printParts([{ text: itemObj.text }], 24, curY, 171, 9.5, 5);
        }
        curY += 2;
      };

      for (let i = 0; i < 5; i++) {
        if (respList[i]) {
          addRespBlock(String(i + 1), respList[i]);
        }
      }

      // ================= PAGE 4 =================
      doc.addPage();
      curY = 56;

      for (let i = 5; i < 10; i++) {
        if (respList[i]) {
          addRespBlock(String(i + 1), respList[i]);
        }
      }

      curY += 4;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Leave Policy", 15, curY);
      curY += 7;

      doc.setFontSize(9.5);
      const leaveBulletsP4 = [
        "No paid leave shall be granted during the probation period.",
        "Leave shall be governed by the Company's Leave Policy.",
        "Any leave request must be submitted in advance and approved by the Reporting Manager and HR.",
        "In exceptional situations, unpaid leave may be granted at Management's discretion."
      ];

      leaveBulletsP4.forEach(lb => {
        doc.setFont('helvetica', 'normal');
        doc.text("•   " + lb, 18, curY);
        curY += 6;
      });

      // ================= PAGE 5 =================
      doc.addPage();
      curY = 56;

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text("•   Paid leave benefits shall become applicable only after successful confirmation of employment.", 18, curY);

      curY += 12;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Resignation & Termination", 15, curY);
      curY += 7;

      curY = printParts([
        { text: "You may resign from your position after completing the initial " },
        { text: "one (1) month", bold: true },
        { text: " by serving " },
        { text: "one (1) month's written notice", bold: true },
        { text: " to receive your final settlement." }
      ], 15, curY, 180, 9.5, 5);

      curY += 2;
      curY = printParts([
        { text: "The Company reserves the right to terminate your employment by giving " },
        { text: "one day's notice", bold: true },
        { text: " without assigning any reason." }
      ], 15, curY, 180, 9.5, 5);

      curY += 2;
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text("Your employment may also be terminated in cases including but not limited to:", 15, curY);
      curY += 6;

      const termCauses = [
        "Prolonged or repeated illness affecting work.",
        "Physical or mental incapacity.",
        "Serious misconduct or suspected misconduct.",
        "Unsatisfactory background verification or adverse reports from Government authorities.",
        "Consistent poor performance or inefficiency.",
        "Conviction by a court of law involving moral turpitude or any criminal offence."
      ];

      termCauses.forEach((tc, idx) => {
        doc.setFont('helvetica', 'normal');
        doc.text(`${idx + 1}.  ${tc}`, 22, curY);
        curY += 5.5;
      });

      curY += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Confidentiality", 15, curY);
      curY += 7;

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      const conf1 = "Your salary structure, incentives, business information, client data, internal processes, and all confidential information of the Company shall remain strictly confidential.";
      doc.text(doc.splitTextToSize(conf1, 180), 15, curY);

      curY += 10;
      const conf2 = "Disclosure of salary or confidential company information to unauthorized persons or employees may invite disciplinary action, including termination of employment.";
      doc.text(doc.splitTextToSize(conf2, 180), 15, curY);

      curY += 14;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Company Rules & Regulations", 15, curY);
      curY += 7;

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text("Employees are expected to adhere to the following rules:", 15, curY);
      curY += 6;

      const rulesList = [
        { num: "1", text: "Three instances of late attendance shall be treated as one full day's absence, and one day's salary may be deducted." },
        { num: "2", prefix: "Leave requests must be emailed at least one day in advance to ", boldTxt: "hr@digiexweb.com", suffix: " with a copy to the Reporting Manager." },
        { num: "3", text: "Medical leave requires submission of a valid medical certificate or doctor's prescription." },
        { num: "4", text: "Personal use of social media and entertainment platforms during office hours is strictly prohibited." },
        { num: "5", text: "Sharing salary information with colleagues is considered a violation of Company policy and may result in disciplinary action." },
        { num: "6", text: "Unnecessary gossip, disruptive behaviour, and non-work-related discussions during office hours are strictly prohibited." }
      ];

      rulesList.forEach(rl => {
        doc.setFont('helvetica', 'normal');
        if (rl.boldTxt) {
          doc.text(`${rl.num}.  ${rl.prefix}`, 22, curY);
          const pWidth = doc.getTextWidth(`${rl.num}.  ${rl.prefix}`);
          doc.setFont('helvetica', 'bold');
          doc.text(rl.boldTxt, 22 + pWidth, curY);
          const bWidth = doc.getTextWidth(rl.boldTxt);
          doc.setFont('helvetica', 'normal');
          doc.text(rl.suffix, 22 + pWidth + bWidth, curY);
        } else {
          doc.text(`${rl.num}.  ${rl.text}`, 22, curY);
        }
        curY += 6;
      });

      // ================= PAGE 6 =================
      doc.addPage();
      curY = 56;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Acceptance of Offer", 15, curY);
      curY += 7;

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text("Please sign and return a copy of this Offer Letter as a token of your acceptance of the terms and conditions mentioned herein.", 15, curY);
      curY += 8;

      doc.text("We are confident that your skills and experience will contribute significantly to the continued growth and success of Digiex Web Services Private Limited.", 15, curY);
      curY += 8;

      doc.text("We warmly welcome you to our organization and wish you a long, successful, and rewarding career with us.", 15, curY);
      curY += 8;

      doc.text("Should you require any clarification regarding this offer, please feel free to contact us.", 15, curY);
      curY += 8;

      doc.setFont('helvetica', 'bold');
      doc.text("Phone: ", 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.text("+91 7003853350", 15 + doc.getTextWidth("Phone: "), curY);
      curY += 5;

      doc.setFont('helvetica', 'bold');
      doc.text("Email: ", 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.text("hr@digiexweb.com", 15 + doc.getTextWidth("Email: "), curY);
      curY += 8;

      doc.text("We look forward to working with you.", 15, curY);
      curY += 8;

      doc.text("Warm Regards,", 15, curY);
      curY += 8;

      doc.setFont('helvetica', 'bold');
      doc.text("Sincerely,", 15, curY);
      curY += 8;

      doc.setFont('times', 'italic');
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text("Arup Mondal", 18, curY);
      doc.setTextColor(0, 0, 0);
      curY += 9;

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text("Arup Mondal", 15, curY); curY += 5;
      doc.text("Director", 15, curY); curY += 5;
      doc.text("Digiex Web Services Pvt. Ltd", 15, curY); curY += 5;
      doc.text("Place: Kolkata", 15, curY);

      curY += 16;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text("Employee Acceptance", 15, curY);
      curY += 7;

      curY = printParts([
        { text: "I, " },
        { text: `${salutation} ${empName}`, bold: true },
        { text: ", have carefully read and understood the terms and conditions of this Offer and Appointment Letter and hereby accept the appointment as " },
        { text: roleName, bold: true },
        { text: " with Digiex Web Services Private Limited." }
      ], 15, curY, 180, 9.5, 5);

      curY += 4;
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text("Employee Signature: ", 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.text("______________________", 15 + doc.getTextWidth("Employee Signature: "), curY);

      curY += 8;
      doc.setFont('helvetica', 'bold');
      doc.text("Name: ", 15, curY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${salutation} ${empName}`, 15 + doc.getTextWidth("Name: "), curY);

      curY += 8;
      doc.setFont('helvetica', 'bold');
      doc.text("Date: ", 15, curY);
      doc.setFont('helvetica', 'normal');
      doc.text("______________________", 15 + doc.getTextWidth("Date: "), curY);

      // ================= HEADER & FOOTER ON ALL PAGES =================
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Render Exact Uploaded Header Image at Top (Full Width)
        if (headerPng) {
          try {
            doc.addImage(headerPng, 'PNG', 0, 0, 210, 48);
          } catch (e) {
            console.error("Error adding header image to PDF page", e);
          }
        }
        
        // Render Exact Uploaded Footer Image at Bottom (Full Width)
        if (footerPng) {
          try {
            doc.addImage(footerPng, 'PNG', 0, 240, 210, 57);
          } catch (e) {
            console.error("Error adding footer image to PDF page", e);
          }
        }
      }

      doc.save(`Offer_And_Appointment_Letter_${String(empName).replace(/[^a-z0-9]/gi, '_')}.pdf`);

    } catch (err: any) {
      console.error("Offer and Appointment Letter PDF generation error:", err);
      alert("Error generating Offer and Appointment Letter: " + err.message);
    }
  };

  const generateIncrementLetterPDF = async (data: any) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      const headerUrl = '/pdf_header.png';
      const footerUrl = '/pdf_footer.png';

      const loadImageAsPng = async (url: string): Promise<string | null> => {
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error("Network response was not ok");
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
          console.error("Error loading image:", err);
          return null;
        }
      };

      const [headerPng, footerPng] = await Promise.all([
        loadImageAsPng(headerUrl),
        loadImageAsPng(footerUrl)
      ]);

      const printParts = (
        parts: { text: string; bold?: boolean }[],
        startX: number,
        startY: number,
        maxWidth = 180,
        fontSize = 9.5,
        lineLeading = 5
      ) => {
        let currentX = startX;
        let currentY = startY;

        const words: { word: string; bold: boolean }[] = [];
        parts.forEach(p => {
          const splitArr = p.text.split(' ');
          splitArr.forEach((w, idx) => {
            const space = idx < splitArr.length - 1 ? ' ' : '';
            words.push({ word: w + space, bold: Boolean(p.bold) });
          });
        });

        words.forEach(wObj => {
          doc.setFont('helvetica', wObj.bold ? 'bold' : 'normal');
          doc.setFontSize(fontSize);
          const wWidth = doc.getTextWidth(wObj.word);
          if (currentX + wWidth > startX + maxWidth && currentX > startX) {
            currentX = startX;
            currentY += lineLeading;
          }
          doc.text(wObj.word, currentX, currentY);
          currentX += wWidth;
        });

        return currentY + lineLeading;
      };

      const empName = data.name || 'Employee';
      const salutation = data.gender === 'Female' ? 'Ms.' : 'Mr.';
      const empAddress = data.permanentAddress || data.currentAddress || 'Kolkata, West Bengal';

      let roleName = 'Employee';
      let deptName = 'General';
      if (data.roles && data.roles.length > 0) {
        const foundRole = roles.find(r => r._id === (typeof data.roles[0] === 'object' ? data.roles[0]._id : data.roles[0]));
        if (foundRole) {
          roleName = foundRole.name || roleName;
          deptName = typeof foundRole.department === 'object' ? foundRole.department?.name : (foundRole.department || deptName);
        }
      } else if (data.role) {
        const foundRole = roles.find(r => r._id === (typeof data.role === 'object' ? data.role._id : data.role));
        if (foundRole) {
          roleName = foundRole.name || roleName;
          deptName = typeof foundRole.department === 'object' ? foundRole.department?.name : (foundRole.department || deptName);
        }
      }

      const currentFixedAmt = parseFloat(data.salaryAmount) || 0;
      const currentVarAmt = parseFloat(data.variableSalary) || 0;
      const currentCTC = (currentFixedAmt + currentVarAmt) > 0 ? (currentFixedAmt + currentVarAmt) : 15000;

      const revisedCTC = parseFloat(data.revisedSalary) > 0 ? parseFloat(data.revisedSalary) : (currentCTC + 5000);
      const incrementDelta = Math.max(0, revisedCTC - currentCTC);
      const percentIncrease = currentCTC > 0 ? ((incrementDelta / currentCTC) * 100).toFixed(1) : '0';

      const effectiveDateStr = data.incrementEffectiveDate 
        ? new Date(data.incrementEffectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const letterDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      // ================= PAGE 1 =================
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text("INCREMENT LETTER", pageWidth / 2, 58, { align: 'center' });

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text("Date: ", 15, 70);
      doc.setFont('helvetica', 'normal');
      doc.text(letterDate, 15 + doc.getTextWidth("Date: "), 70);

      doc.setFont('helvetica', 'bold');
      doc.text("To:", 15, 82);
      doc.text(`${salutation} ${empName},`, 15, 88);
      doc.setFont('helvetica', 'normal');
      doc.text(empAddress, 15, 94);

      doc.setFont('helvetica', 'bold');
      doc.text(`Dear ${salutation} ${empName},`, 15, 106);

      let curY = 114;
      curY = printParts([
        { text: "We take great pleasure in appreciating your dedication, hard work, and valuable contributions to " },
        { text: "Digiex Web Services Private Limited", bold: true },
        { text: ". In recognition of your consistent performance and commitment to organizational excellence, the management is pleased to revise your monthly remuneration." }
      ], 15, curY, 180, 9.5, 5);

      curY += 4;
      curY = printParts([
        { text: "Effective from " },
        { text: effectiveDateStr, bold: true },
        { text: ", your salary structure has been revised as detailed below:" }
      ], 15, curY, 180, 9.5, 5);

      curY += 6;
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.text("Salary Revision Details", 15, curY);

      curY += 8;
      const bullet = (label: string, val: string) => {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        const prefix = "•   " + label + ":";
        doc.text(prefix, 18, curY);
        const prefixWidth = doc.getTextWidth(prefix);
        doc.setFont('helvetica', 'normal');
        doc.text(" " + val, 18 + prefixWidth, curY);
        curY += 7;
      };

      bullet("Designation", roleName);
      bullet("Department", deptName);
      bullet("Previous Monthly CTC", `Rs. ${currentCTC.toLocaleString('en-IN')}/-`);
      bullet("Revised Monthly CTC", `Rs. ${revisedCTC.toLocaleString('en-IN')}/- (Rupees ${numberToWords(Math.round(revisedCTC))} Only)`);
      bullet("Increment Amount", `Rs. ${incrementDelta.toLocaleString('en-IN')}/- (${percentIncrease}% Increase)`);
      bullet("Effective Date", effectiveDateStr);

      curY += 4;
      curY = printParts([
        { text: "All other terms and conditions of your employment contract remain unchanged. We look forward to your continued dedication and commitment towards the growth of Digiex Web Services Private Limited." }
      ], 15, curY, 180, 9.5, 5);

      curY += 14;
      doc.setFont('helvetica', 'bold');
      doc.text("For DIGIEX WEB SERVICES PRIVATE LIMITED", 15, curY);

      curY += 18;
      doc.setFont('helvetica', 'bold');
      doc.text("Authorized Signatory", 15, curY);

      // ================= PAGE 2 (REVISED ANNEXURE) =================
      doc.addPage();
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text("Revised Salary Annexure", pageWidth / 2, 56, { align: 'center' });

      let multiplier = 1.0;
      const formHasPF = data.pf === 'Yes' || data.includePF;
      const formHasESI = data.esi === 'Yes' || data.includeESI;
      if (formHasPF) multiplier += 0.048;
      if (formHasESI) multiplier += 0.0325;
      
      const grossM = revisedCTC / multiplier;
      const basicM = grossM * 0.4;
      const hraM = basicM * 0.2;
      const convM = grossM - basicM - hraM;

      let ptaxM = 0;
      if (revisedCTC > 40000) ptaxM = 200;
      else if (revisedCTC > 25000) ptaxM = 150;
      else if (revisedCTC > 15000) ptaxM = 130;
      else if (revisedCTC > 10000) ptaxM = 110;

      const pfM = formHasPF ? (basicM * 0.12) : 0;
      const esiM = formHasESI ? (grossM * 0.0075) : 0;
      const totalDedM = pfM + esiM + ptaxM;
      const netM = grossM - totalDedM;

      const emrPfM = formHasPF ? (basicM * 0.12) : 0;
      const emrEsiM = formHasESI ? (grossM * 0.0325) : 0;
      const totalEmrM = emrPfM + emrEsiM;

      const fmt = (v: number) => v.toFixed(6).replace(/\.?0+$/, '');

      autoTable(doc, {
        startY: 62,
        head: [['Revised Salary Heads', 'Monthly (Rs.)', 'Annual (Rs.)']],
        body: [
          ['Basic Salary (40%)', fmt(basicM), fmt(basicM * 12)],
          ['HRA (20% of Basic)', fmt(hraM), fmt(hraM * 12)],
          ['Conveyance & Other Allowance', fmt(convM), fmt(convM * 12)],
          ['Gross Salary', fmt(grossM), fmt(grossM * 12)],
          [{ content: 'Employee Deductions', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
          ['Employee PF', fmt(pfM), fmt(pfM * 12)],
          ['Employee ESIC', fmt(esiM), fmt(esiM * 12)],
          ['P. Tax', fmt(ptaxM), fmt(ptaxM * 12)],
          ['Total Deductions', fmt(totalDedM), fmt(totalDedM * 12)],
          ['Net Salary Payable', fmt(netM), fmt(netM * 12)],
          [{ content: 'Employer Contribution (Included in CTC)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
          ['Employer PF', fmt(emrPfM), fmt(emrPfM * 12)],
          ['Employer ESIC', fmt(emrEsiM), fmt(emrEsiM * 12)],
          ['Total Employer Contribution', fmt(totalEmrM), fmt(totalEmrM * 12)],
          ['Total Revised CTC', fmt(revisedCTC), fmt(revisedCTC * 12)]
        ],
        theme: 'grid',
        headStyles: { fillColor: [220, 235, 220], textColor: [0, 0, 0], fontSize: 8.5, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
      });

      const annFinalY = (doc as any).lastAutoTable?.finalY || 160;

      curY = annFinalY + 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("Employee Acceptance", 15, curY);

      curY += 6;
      curY = printParts([
        { text: "I, " },
        { text: `${salutation} ${empName}`, bold: true },
        { text: ", acknowledge and accept the revised salary structure and terms of this Increment Letter." }
      ], 15, curY, 180, 9.5, 5);

      curY += 8;
      doc.setFont('helvetica', 'bold');
      doc.text("Employee Signature: ______________________", 15, curY);
      doc.text("Date: ______________________", 130, curY);

      // ================= HEADER & FOOTER ON ALL PAGES =================
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (headerPng) {
          try {
            doc.addImage(headerPng, 'PNG', 0, 0, 210, 48);
          } catch (e) {
            console.error("Error adding header image", e);
          }
        }
        if (footerPng) {
          try {
            doc.addImage(footerPng, 'PNG', 0, 240, 210, 57);
          } catch (e) {
            console.error("Error adding footer image", e);
          }
        }
      }

      doc.save(`Increment_Letter_${String(empName).replace(/[^a-z0-9]/gi, '_')}.pdf`);

    } catch (err: any) {
      console.error("Increment Letter PDF generation error:", err);
      alert("Error generating Increment Letter: " + err.message);
    }
  };

  const initialForm = {
    name: '', email: '', password: '', phone: '', alternativePhone: '', profilePhoto: '', gender: 'Male', dob: '', currentAddress: '', permanentAddress: '', socialMediaProfile: '',
    emergencyContact: { name: '', phone: '', relation: '' },
    aadhaar: '', pan: '', digiLockerEntry: '', joiningDate: '', exitDate: '', employmentType: 'Full-time', employmentStatus: 'Active',
    role: '', roles: [], reportingManager: '', workLocation: 'Office', expectedEntryTime: '10:00',
    salaryStructure: 'Fixed', salaryAmount: '', variableSalary: '', basic: '', hra: '', incentives: '', ptax: '', pfAmount: '', esiAmount: '', bankAccountNo: '', bankIfsc: '', bankName: '', pf: '', esi: '',
    enableIncrement: false,
    revisedSalary: '',
    incrementEffectiveDate: new Date().toISOString().split('T')[0],
    incrementHistory: [],
    documents: {
      aadhaarFront: '',
      aadhaarBack: '',
      panCard: '',
      bankPassbook: '',
      educationalCertificates: [],
      pastExperience: [],
    },
    officialDocuments: {
      offerLetter: '',
      appointmentLetter: '',
      incrementLetter: ''
    },
    offSaturdays: []
  };

  const [formData, setFormData] = useState<any>(initialForm);

  // Dynamically calculate Employer Contributions
  const basicVal = parseFloat(formData.basic) || 0;
  const hraVal = parseFloat(formData.hra) || 0;
  const incentivesVal = parseFloat(formData.incentives) || 0;
  const grossVal = basicVal + hraVal + incentivesVal;
  const employerPF = formHasPF ? (basicVal * 0.12) : 0;
  const employerESI = formHasESI ? (grossVal * 0.0325) : 0;
  const totalEmployer = employerPF + employerESI;

  // Check if given role IDs belong to Sales Department
  const checkIsSalesDepartment = (selectedRoleIds: string[]) => {
    return roles.some(r => {
      if (!selectedRoleIds.includes(r._id)) return false;
      const deptName = typeof r.department === 'object' ? r.department?.name : (r.department || '');
      const roleName = r.name || '';
      return (
        String(deptName).toLowerCase().includes('sales') || 
        String(deptName).toLowerCase().includes('telemarketing') ||
        String(roleName).toLowerCase().includes('sales')
      );
    });
  };

  // Check if current user selection belongs to Sales Department
  const isSalesDepartment = (() => {
    const selectedRoleIds = Array.isArray(formData.roles) && formData.roles.length > 0 
      ? formData.roles 
      : (formData.role ? [formData.role] : []);
    
    return checkIsSalesDepartment(selectedRoleIds);
  })();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(users.length / itemsPerPage);
  const displayedUsers = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [users.length, totalPages, currentPage]);

  const fetchData = async () => {
    try {
      const [userRes, roleRes, settingsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/users'),
        axios.get('http://localhost:5000/api/roles'),
        axios.get('http://localhost:5000/api/settings')
      ]);
      if (!isAdminOrHR) {
        const myUserId = String(loggedInUser._id || loggedInUser.id || '');
        const filtered = (userRes.data.data || []).filter((u: any) => String(u._id || u.id) === myUserId);
        setUsers(filtered);
        if (filtered.length > 0) {
          handleEditClick(filtered[0]);
        }
      } else {
        setUsers(userRes.data.data || []);
      }
      setRoles(roleRes.data.data);
      
      // Extract settings into a flat object
      const settingsMap: any = {};
      settingsRes.data.data.forEach((s: any) => {
        settingsMap[s.key] = s.value;
      });
      setCompanySettings(settingsMap);

      if (roleRes.data.data.length > 0) {
        setFormData((prev: any) => ({ ...prev, role: roleRes.data.data[0]._id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNew = () => {
    setEditingUserId(null);
    setFormHasPF(true);
    setFormHasESI(true);
    setSameAsCurrentAddress(false);
    const defaultRoleId = roles[0]?._id || '';
    const defaultRoleIds = defaultRoleId ? [defaultRoleId] : [];
    const defaultSalaryStructure = checkIsSalesDepartment(defaultRoleIds) ? 'Variable' : 'Fixed';
    setFormData({ ...initialForm, role: defaultRoleId, roles: defaultRoleIds, salaryStructure: defaultSalaryStructure });
    setActiveTab('basic');
    setShowModal(true);
  };

  const handleEditClick = (user: any) => {
    setEditingUserId(user._id);
    const hasPF = user.pfAmount === undefined || user.pfAmount === null || parseFloat(user.pfAmount) !== 0;
    const hasESI = user.esiAmount === undefined || user.esiAmount === null || parseFloat(user.esiAmount) !== 0;
    const isSameAddr = Boolean(user.currentAddress && user.currentAddress === user.permanentAddress);
    setFormHasPF(hasPF);
    setFormHasESI(hasESI);
    setSameAsCurrentAddress(isSameAddr);

    let userRoleIds: string[] = [];
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      userRoleIds = user.roles.map((r: any) => typeof r === 'object' ? r._id : r);
    } else if (user.role) {
      userRoleIds = [typeof user.role === 'object' ? user.role._id : user.role];
    }

    const defaultSalaryStructure = checkIsSalesDepartment(userRoleIds) ? 'Variable' : 'Fixed';

    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '', 
      phone: user.phone || '',
      alternativePhone: user.alternativePhone || '',
      profilePhoto: user.profilePhoto || '',
      gender: user.gender || 'Male',
      dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
      currentAddress: user.currentAddress || '',
      permanentAddress: user.permanentAddress || '',
      socialMediaProfile: user.socialMediaProfile || '',
      emergencyContact: {
        name: user.emergencyContact?.name || '',
        phone: user.emergencyContact?.phone || '',
        relation: user.emergencyContact?.relation || ''
      },
      aadhaar: user.aadhaar || '',
      pan: user.pan || '',
      digiLockerEntry: user.digiLockerEntry || '',
      joiningDate: user.joiningDate ? new Date(user.joiningDate).toISOString().split('T')[0] : '',
      exitDate: user.exitDate ? new Date(user.exitDate).toISOString().split('T')[0] : '',
      employmentType: user.employmentType || 'Full-time',
      employmentStatus: user.employmentStatus || 'Active',
      role: userRoleIds[0] || '',
      roles: userRoleIds,
      reportingManager: user.reportingManager || '',
      workLocation: user.workLocation || 'Office',
      expectedEntryTime: user.expectedEntryTime || '10:00',
      salaryStructure: (user.salaryStructure && user.salaryStructure !== 'CTC') ? user.salaryStructure : defaultSalaryStructure,
      salaryAmount: user.salaryAmount || '',
      variableSalary: user.variableSalary || '',
      basic: user.basic || '',
      hra: user.hra || '',
      incentives: user.incentives || '',
      ptax: user.ptax || '',
      pfAmount: user.pfAmount || '',
      esiAmount: user.esiAmount || '',
      bankAccountNo: user.bankAccountNo || '',
      bankIfsc: user.bankIfsc || '',
      bankName: user.bankName || '',
      pf: user.pf || '',
      esi: user.esi || '',
      enableIncrement: Boolean(user.enableIncrement || user.revisedSalary),
      revisedSalary: user.revisedSalary || '',
      incrementEffectiveDate: user.incrementEffectiveDate ? new Date(user.incrementEffectiveDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      incrementHistory: user.incrementHistory || [],
      documents: {
        aadhaarFront: user.documents?.aadhaarFront || '',
        aadhaarBack: user.documents?.aadhaarBack || '',
        panCard: user.documents?.panCard || '',
        bankPassbook: user.documents?.bankPassbook || '',
        educationalCertificates: user.documents?.educationalCertificates || [],
        pastExperience: user.documents?.pastExperience || []
      },
      officialDocuments: {
        offerLetter: user.officialDocuments?.offerLetter || '',
        appointmentLetter: user.officialDocuments?.appointmentLetter || '',
        incrementLetter: user.officialDocuments?.incrementLetter || ''
      },
      offSaturdays: user.offSaturdays || []
    });
    setActiveTab('basic');
    setShowModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldPath: string, index?: number, subField?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file formats for official documents (.pdf, .docx)
    if (fieldPath.startsWith('officialDocuments.')) {
      const allowedExtensions = ['pdf', 'docx'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        alert('Only .pdf and .docx file formats are allowed for official documents.');
        e.target.value = ''; // Clear file input
        return;
      }
    }

    const uploadData = new FormData();
    uploadData.append('file', file);
    setUploading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = res.data.fileUrl;

      setFormData((prev: any) => {
        const newData = { ...prev };
        if (fieldPath === 'profilePhoto') {
          newData.profilePhoto = fileUrl;
        } else if (fieldPath.startsWith('documents.')) {
          const docField = fieldPath.split('.')[1];
          if (index !== undefined && subField) {
             newData.documents[docField][index][subField] = fileUrl;
          } else {
             newData.documents[docField] = fileUrl;
          }
        } else if (fieldPath.startsWith('officialDocuments.')) {
          const officialField = fieldPath.split('.')[1];
          newData.officialDocuments[officialField] = fileUrl;
        }
        return newData;
      });
    } catch (err) {
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const addEducation = () => {
    setFormData((prev: any) => ({
      ...prev,
      documents: {
        ...prev.documents,
        educationalCertificates: [...prev.documents.educationalCertificates, { title: '', fileUrl: '' }]
      }
    }));
  };

  const removeEducation = (index: number) => {
    setFormData((prev: any) => {
      const newList = [...prev.documents.educationalCertificates];
      newList.splice(index, 1);
      return { ...prev, documents: { ...prev.documents, educationalCertificates: newList } };
    });
  };

  const addExperience = () => {
    setFormData((prev: any) => ({
      ...prev,
      documents: {
        ...prev.documents,
        pastExperience: [...prev.documents.pastExperience, { companyName: '', fileUrl: '' }]
      }
    }));
  };

  const removeExperience = (index: number) => {
    setFormData((prev: any) => {
      const newList = [...prev.documents.pastExperience];
      newList.splice(index, 1);
      return { ...prev, documents: { ...prev.documents, pastExperience: newList } };
    });
  };

  const handleSalaryChange = (amount: string, variableAmount?: string, includePF = formHasPF, includeESI = formHasESI) => {
    const fixed = parseFloat(amount) || 0;
    const variable = parseFloat(variableAmount !== undefined ? variableAmount : formData.variableSalary) || 0;
    const total = fixed + variable;
    
    let multiplier = 1.0;
    if (includePF) multiplier += 0.048; // 12% of 40% basic = 4.8%
    if (includeESI) multiplier += 0.0325; // 3.25% of gross
    
    const gross = total / multiplier;
    const basic = gross * 0.4;
    const hra = basic * 0.2;
    const incentives = gross - basic - hra;

    // PTAX Calculation (WB Standard checked against Total CTC)
    let ptax = 0;
    if (total > 40000) ptax = 200;
    else if (total > 25000) ptax = 150;
    else if (total > 15000) ptax = 130;
    else if (total > 10000) ptax = 110;

    // Employee PF (12% of basic)
    const pf = includePF ? (basic * 0.12) : 0;

    // Employee ESIC (0.75% of gross)
    const esi = includeESI ? (gross * 0.0075) : 0;

    setFormData((prev: any) => ({
      ...prev,
      salaryAmount: amount,
      variableSalary: variableAmount !== undefined ? variableAmount : prev.variableSalary,
      basic: basic.toFixed(2),
      hra: hra.toFixed(2),
      incentives: incentives.toFixed(2),
      ptax: ptax.toString(),
      pfAmount: pf.toFixed(2),
      esiAmount: esi.toFixed(2)
    }));
  };

  const handleBasicChange = (newBasicStr: string) => {
    const newBasic = parseFloat(newBasicStr) || 0;
    const hra = newBasic * 0.2;
    const incentives = parseFloat(formData.incentives) || 0;
    const gross = newBasic + hra + incentives;
    
    const pf = formHasPF ? (newBasic * 0.12) : 0;
    const esi = formHasESI ? (gross * 0.0075) : 0;

    setFormData((prev: any) => ({
      ...prev,
      basic: newBasicStr,
      hra: hra.toFixed(2),
      pfAmount: pf.toFixed(2),
      esiAmount: esi.toFixed(2)
    }));
  };

  const handleIncentivesChange = (newIncStr: string) => {
    const incentives = parseFloat(newIncStr) || 0;
    const basic = parseFloat(formData.basic) || 0;
    const hra = parseFloat(formData.hra) || 0;
    const gross = basic + hra + incentives;
    const esi = formHasESI ? (gross * 0.0075) : 0;

    setFormData((prev: any) => ({
      ...prev,
      incentives: newIncStr,
      esiAmount: esi.toFixed(2)
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let payload = { ...formData };

      // Handle salary increment recording and automatic recalculation
      if (payload.enableIncrement && payload.revisedSalary && parseFloat(payload.revisedSalary) > 0) {
        const prevSalary = parseFloat(payload.salaryAmount) || 0;
        const newSalary = parseFloat(payload.revisedSalary) || 0;

        if (newSalary > 0 && newSalary !== prevSalary) {
          const incAmt = Math.max(0, newSalary - prevSalary);
          const incPct = prevSalary > 0 ? (incAmt / prevSalary) * 100 : 0;

          const newIncRecord = {
            previousSalary: prevSalary,
            revisedSalary: newSalary,
            incrementAmount: incAmt,
            incrementPercentage: incPct,
            effectiveDate: payload.incrementEffectiveDate || new Date()
          };

          const currentHistory = Array.isArray(payload.incrementHistory) ? [...payload.incrementHistory] : [];
          const isDuplicate = currentHistory.some((h: any) => h.revisedSalary === newSalary && h.previousSalary === prevSalary);
          if (!isDuplicate) {
            payload.incrementHistory = [...currentHistory, newIncRecord];
          }

          // Update active salaryAmount (Monthly CTC) to the new revised salary
          payload.salaryAmount = newSalary.toString();

          // Recalculate Basic, HRA, Conveyance, PF, ESI, PTAX based on revised salary
          const fixed = newSalary;
          const variable = parseFloat(payload.variableSalary) || 0;
          const total = fixed + variable;

          let multiplier = 1.0;
          if (formHasPF) multiplier += 0.048;
          if (formHasESI) multiplier += 0.0325;

          const gross = total / multiplier;
          const basic = gross * 0.4;
          const hra = basic * 0.2;
          const incentives = gross - basic - hra;

          let ptax = 0;
          if (total > 40000) ptax = 200;
          else if (total > 25000) ptax = 150;
          else if (total > 15000) ptax = 130;
          else if (total > 10000) ptax = 110;

          const pf = formHasPF ? (basic * 0.12) : 0;
          const esi = formHasESI ? (gross * 0.0075) : 0;

          payload.basic = basic.toFixed(2);
          payload.hra = hra.toFixed(2);
          payload.incentives = incentives.toFixed(2);
          payload.ptax = ptax.toString();
          payload.pfAmount = pf.toFixed(2);
          payload.esiAmount = esi.toFixed(2);
        }
      }

      if (editingUserId) {
        const { password, ...updateData } = payload;
        const finalPayload = password ? payload : updateData;
        await axios.put(`http://localhost:5000/api/users/${editingUserId}`, finalPayload);
      } else {
        await axios.post('http://localhost:5000/api/users', payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving user');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/users/${id}`);
      fetchData();
    } catch (err) {
      alert('Error deleting user');
    }
  };

  const renderFilePreview = (url: string) => {
    if (!url) return null;
    return (
      <div style={{ marginTop: '8px' }}>
        <a 
          href={`http://localhost:5000${url}`} 
          target="_blank" 
          rel="noreferrer" 
          download
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px', 
            background: '#eff6ff', 
            color: '#1d4ed8', 
            border: '1px solid #bfdbfe',
            borderRadius: '8px', 
            fontSize: '13px', 
            fontWeight: 600, 
            textDecoration: 'none',
            boxShadow: '0 2px 4px rgba(29, 78, 216, 0.05)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#dbeafe';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = '#eff6ff';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          📥 Download / View File
        </a>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isAdminOrHR ? 'User Management' : 'My Own Profile'}</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {isAdminOrHR && (
            <button className="btn-secondary" onClick={() => setShowCalculatorModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={18} /> Salary Calculator
            </button>
          )}
          {isAdminOrHR && (
            <button className="btn-primary" onClick={handleOpenNew}>
              <Plus size={18} /> Add New User
            </button>
          )}
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>Loading users...</div>
        ) : (
          <>
            <table>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Designation (Role)</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedUsers.map(user => (
                <tr key={user._id}>
                  <td><strong>{user.employeeId || 'N/A'}</strong></td>
                  <td style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {user.profilePhoto ? (
                      <img src={`http://localhost:5000${user.profilePhoto}`} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{user.name}</span>
                        <span 
                          style={{ 
                            display: 'inline-block', 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: user.isOnline ? '#22c55e' : '#f97316',
                            boxShadow: user.isOnline ? '0 0 6px #22c55e' : 'none'
                          }} 
                          title={user.isOnline ? 'Online' : 'Busy'}
                        ></span>
                        <span style={{ fontSize: '11px', color: user.isOnline ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                          {user.isOnline ? 'Online' : 'Busy'}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{user.email}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(() => {
                        const userRolesList = (Array.isArray(user.roles) && user.roles.length > 0)
                          ? user.roles 
                          : (user.role ? [user.role] : []);
                        if (userRolesList.length === 0) return <span className="badge badge-gray">N/A</span>;
                        return userRolesList.map((r: any, idx: number) => (
                          <span key={r._id || idx} className="badge badge-blue">
                            {r.name || 'N/A'}
                          </span>
                        ));
                      })()}
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const userRolesList = (Array.isArray(user.roles) && user.roles.length > 0)
                        ? user.roles 
                        : (user.role ? [user.role] : []);
                      const depts = [...new Set(userRolesList.map((r: any) => r.department?.name || r.department).filter(Boolean))];
                      return depts.join(', ') || 'N/A';
                    })()}
                  </td>
                  <td>
                    <span className={`badge ${user.employmentStatus === 'Active' ? 'badge-green' : 'badge-gray'}`}>
                      {user.employmentStatus || (user.isActive ? 'Active' : 'Inactive')}
                    </span>
                  </td>
                  <td style={{ gap: '8px' }}>
                    <button className="btn-secondary" style={{ padding: '6px 12px', marginRight: '8px' }} onClick={() => handleEditClick(user)}>
                      <Edit size={16} />
                    </button>
                    {user.gender === 'Female' && isAdminOrHR && (
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '6px 12px', marginRight: '8px', background: '#fdf2f8', color: '#db2777', borderColor: '#fbcfe8' }} 
                        onClick={() => handleOpenMaternityModal(user)} 
                        title="Apply Maternity Leave"
                      >
                        🤰
                      </button>
                    )}
                    {isAdminOrHR && (
                      <button className="btn-secondary" style={{ padding: '6px 12px', marginRight: '8px', background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }} onClick={() => handleOpenWfh(user._id)} title="Mark WFH">
                        🏠
                      </button>
                    )}
                    {isAdminOrHR && (
                      <button className="btn-danger" style={{ padding: '6px 12px' }} onClick={() => handleDelete(user._id)}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center' }}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
          {users.length > 0 && isAdminOrHR && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Showing {Math.min(users.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(users.length, currentPage * itemsPerPage)} of {users.length} entries
              </span>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: currentPage === 1 ? '#f8fafc' : '#ffffff',
                    color: currentPage === 1 ? '#cbd5e1' : '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: currentPage === pageNum ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      background: currentPage === pageNum ? '#2563eb' : '#ffffff',
                      color: currentPage === pageNum ? '#ffffff' : '#475569',
                      fontSize: '13px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: currentPage === totalPages ? '#f8fafc' : '#ffffff',
                    color: currentPage === totalPages ? '#cbd5e1' : '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <h3>{editingUserId ? 'Edit Employee' : 'Add New Employee'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', marginTop: '16px', overflowX: 'auto' }}>
              {['basic', 'identity', 'job', 'salary', 'documents', 'official'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '12px 20px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid #1e3a8a' : '2px solid transparent',
                    color: activeTab === tab ? '#1e3a8a' : '#64748b',
                    fontWeight: activeTab === tab ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab === 'basic' && '👤 Basic Info'}
                  {tab === 'identity' && '🆔 Identity & Legal'}
                  {tab === 'job' && '💼 Job Details'}
                  {tab === 'salary' && '💰 Salary Info'}
                  {tab === 'documents' && '📁 Documents'}
                  {tab === 'official' && '📜 Official Docs'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="auth-form" style={{ gap: '20px' }}>
              
              {/* TAB 1: BASIC INFO */}
              <div style={{ display: activeTab === 'basic' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {formData.profilePhoto ? (
                    <img src={`http://localhost:5000${formData.profilePhoto}`} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f8fafc', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Upload size={24} color="#94a3b8" />
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Profile Photo</label>
                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'profilePhoto')} disabled={uploading} />
                    {uploading && <span style={{ fontSize: '12px', color: '#2563eb', marginLeft: '8px' }}>Uploading...</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Email ID *</label>
                  <input type="email" className="input-field" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} />
                </div>
                <div className="form-group">
                  <label>Password {editingUserId && '(Leave blank to keep)'}</label>
                  <input type="password" className="input-field" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingUserId} />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Alternative Phone</label>
                  <input type="text" className="input-field" value={formData.alternativePhone} onChange={e => setFormData({...formData, alternativePhone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select className="input-field" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                    <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input type="date" className="input-field" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Current Address</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formData.currentAddress} 
                    onChange={e => {
                      const val = e.target.value;
                      setFormData((prev: any) => ({
                        ...prev,
                        currentAddress: val,
                        permanentAddress: sameAsCurrentAddress ? val : prev.permanentAddress
                      }));
                    }} 
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '-8px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#475569', fontWeight: 500, userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={sameAsCurrentAddress} 
                      onChange={e => {
                        const checked = e.target.checked;
                        setSameAsCurrentAddress(checked);
                        if (checked) {
                          setFormData((prev: any) => ({
                            ...prev,
                            permanentAddress: prev.currentAddress
                          }));
                        }
                      }} 
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                    />
                    Permanent address is same as current address
                  </label>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Permanent Address</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formData.permanentAddress} 
                    onChange={e => setFormData({...formData, permanentAddress: e.target.value})} 
                    disabled={sameAsCurrentAddress}
                    style={{ background: sameAsCurrentAddress ? '#f1f5f9' : '#ffffff' }}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Social Media Profile (Optional)</label>
                  <input type="text" className="input-field" value={formData.socialMediaProfile} onChange={e => setFormData({...formData, socialMediaProfile: e.target.value})} placeholder="LinkedIn, GitHub, etc." />
                </div>
                <div className="form-group">
                  <label>Emergency Contact Name</label>
                  <input type="text" className="input-field" value={formData.emergencyContact.name} onChange={e => setFormData({...formData, emergencyContact: {...formData.emergencyContact, name: e.target.value}})} />
                </div>
                <div className="form-group">
                  <label>Emergency Contact Phone</label>
                  <input type="text" className="input-field" value={formData.emergencyContact.phone} onChange={e => setFormData({...formData, emergencyContact: {...formData.emergencyContact, phone: e.target.value}})} />
                </div>
              </div>

              {/* TAB 2: IDENTITY & LEGAL */}
              <div style={{ display: activeTab === 'identity' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Employee ID {isSuperAdmin ? '' : '(Auto-generated)'}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="E.g. DX0001"
                    value={formData.employeeId || ''} 
                    onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                    disabled={!isSuperAdmin} 
                    style={{ background: isSuperAdmin ? '#ffffff' : '#f1f5f9' }} 
                  />
                </div>
                <div className="form-group">
                  <label>Joining Date</label>
                  <input type="date" className="input-field" value={formData.joiningDate} onChange={e => setFormData({...formData, joiningDate: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} />
                </div>
                <div className="form-group">
                  <label>Aadhaar Number</label>
                  <input type="text" className="input-field" value={formData.aadhaar} onChange={e => setFormData({...formData, aadhaar: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>PAN Card</label>
                  <input type="text" className="input-field" value={formData.pan} onChange={e => setFormData({...formData, pan: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Employment Type</label>
                  <select className="input-field" value={formData.employmentType} onChange={e => setFormData({...formData, employmentType: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }}>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Trainee">Trainee</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Employment Status</label>
                  <select className="input-field" value={formData.employmentStatus} onChange={e => setFormData({...formData, employmentStatus: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }}>
                    <option value="Active">Active</option><option value="Inactive">Inactive</option><option value="On Notice">On Notice</option>
                  </select>
                </div>
              </div>

              {/* TAB 3: JOB DETAILS */}
              <div style={{ display: activeTab === 'job' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Designations / Roles *</span>
                    <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>
                      {(formData.roles || []).length} Selected
                    </span>
                  </label>
                  <div style={{ 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '8px', 
                    padding: '12px', 
                    maxHeight: '180px', 
                    overflowY: 'auto', 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
                    gap: '8px',
                    background: isAdminOrHR ? '#ffffff' : '#f8fafc'
                  }}>
                    {roles.map(r => {
                      const isChecked = (formData.roles || []).includes(r._id);
                      return (
                        <label 
                          key={r._id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '6px 10px', 
                            borderRadius: '6px', 
                            border: isChecked ? '1px solid #93c5fd' : '1px solid #e2e8f0', 
                            background: isChecked ? '#eff6ff' : '#ffffff', 
                            cursor: isAdminOrHR ? 'pointer' : 'default',
                            fontSize: '13px',
                            fontWeight: isChecked ? 600 : 400,
                            color: isChecked ? '#1d4ed8' : '#334155',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            disabled={!isAdminOrHR}
                            style={{ accentColor: '#2563eb', cursor: isAdminOrHR ? 'pointer' : 'default' }}
                            onChange={e => {
                              const checked = e.target.checked;
                              let newRoles = [...(formData.roles || [])];
                              if (checked) {
                                newRoles.push(r._id);
                              } else {
                                newRoles = newRoles.filter((id: string) => id !== r._id);
                              }
                              const isSales = checkIsSalesDepartment(newRoles);
                              setFormData((prev: any) => ({
                                ...prev,
                                roles: newRoles,
                                role: newRoles[0] || '',
                                salaryStructure: isSales ? 'Variable' : 'Fixed'
                              }));
                            }}
                          />
                          <span>{r.name}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
                            ({r.department?.name || r.department})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="form-group">
                  <label>Reporting Manager</label>
                  <select className="input-field" value={formData.reportingManager} onChange={e => setFormData({...formData, reportingManager: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }}>
                    <option value="">None</option>
                    {users.map(u => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Work Location</label>
                  <select className="input-field" value={formData.workLocation} onChange={e => setFormData({...formData, workLocation: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }}>
                    <option value="Office">Office</option><option value="Remote">Remote</option><option value="Hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Expected Entry Time (HH:mm)</label>
                  <input type="text" className="input-field" placeholder="10:00" value={formData.expectedEntryTime} onChange={e => setFormData({...formData, expectedEntryTime: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} />
                </div>
                <div className="form-group">
                  <label>Exit Date</label>
                  <input type="date" className="input-field" value={formData.exitDate} onChange={e => setFormData({...formData, exitDate: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Off Saturdays of Month</label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    {[1, 2, 3, 4, 5].map(num => (
                      <label key={num} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: isAdminOrHR ? 'pointer' : 'not-allowed', fontSize: '13px' }}>
                        <input 
                          type="checkbox" 
                          checked={formData.offSaturdays?.includes(num)} 
                          disabled={!isAdminOrHR}
                          onChange={e => {
                            const current = [...(formData.offSaturdays || [])];
                            if (e.target.checked) current.push(num);
                            else {
                              const index = current.indexOf(num);
                              if (index > -1) current.splice(index, 1);
                            }
                            setFormData({...formData, offSaturdays: current});
                          }} 
                        />
                        {num}{num === 1 ? 'st' : (num === 2 ? 'nd' : (num === 3 ? 'rd' : 'th'))} Sat
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Select which Saturdays are off for this employee (e.g. 2nd & 4th).</p>
                </div>
              </div>

              {/* TAB 4: SALARY INFO */}
              <div style={{ display: activeTab === 'salary' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Salary Structure</label>
                  <select 
                    className="input-field" 
                    value={(formData.salaryStructure === 'CTC' || !formData.salaryStructure) ? (isSalesDepartment ? 'Variable' : 'Fixed') : formData.salaryStructure} 
                    onChange={e => {
                      const newStruct = e.target.value;
                      setFormData((prev: any) => ({ ...prev, salaryStructure: newStruct }));
                      const varVal = newStruct === 'Variable' ? formData.variableSalary : '0';
                      handleSalaryChange(formData.salaryAmount, varVal, formHasPF, formHasESI);
                    }} 
                    disabled={!isAdminOrHR} 
                    style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }}
                  >
                    <optgroup label="CTC">
                      <option value="Fixed">Fixed</option>
                      <option value="Variable">Variable</option>
                    </optgroup>
                  </select>
                </div>
                {((formData.salaryStructure === 'CTC' || !formData.salaryStructure) ? (isSalesDepartment ? 'Variable' : 'Fixed') : formData.salaryStructure) === 'Variable' ? (
                  <>
                    <div className="form-group">
                      <label>Fixed Salary Amount (₹)</label>
                      <input type="number" className="input-field" value={formData.salaryAmount} onChange={e => handleSalaryChange(e.target.value, formData.variableSalary, formHasPF, formHasESI)} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} />
                    </div>
                    <div className="form-group">
                      <label>Variable Part Salary (₹)</label>
                      <input type="number" className="input-field" value={formData.variableSalary} onChange={e => handleSalaryChange(formData.salaryAmount, e.target.value, formHasPF, formHasESI)} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} />
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label>Salary Amount (₹)</label>
                    <input type="number" className="input-field" value={formData.salaryAmount} onChange={e => handleSalaryChange(e.target.value, '0', formHasPF, formHasESI)} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} />
                  </div>
                )}

                <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', gap: '24px', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '4px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isAdminOrHR ? 'pointer' : 'not-allowed', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                    <input 
                      type="checkbox" 
                      checked={formHasPF} 
                      disabled={!isAdminOrHR}
                      onChange={e => {
                        const val = e.target.checked;
                        setFormHasPF(val);
                        handleSalaryChange(formData.salaryAmount, formData.variableSalary, val, formHasESI);
                      }} 
                    />
                    Include PF (Provident Fund)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isAdminOrHR ? 'pointer' : 'not-allowed', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                    <input 
                      type="checkbox" 
                      checked={formHasESI} 
                      disabled={!isAdminOrHR}
                      onChange={e => {
                        const val = e.target.checked;
                        setFormHasESI(val);
                        handleSalaryChange(formData.salaryAmount, formData.variableSalary, formHasPF, val);
                      }} 
                    />
                    Include ESI (ESIC)
                  </label>
                </div>
                <div className="form-group"><label>Basic (₹)</label><input type="number" className="input-field" value={formData.basic} onChange={e => handleBasicChange(e.target.value)} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} /></div>
                <div className="form-group"><label>HRA (₹)</label><input type="number" className="input-field" value={formData.hra} onChange={e => setFormData({...formData, hra: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} /></div>
                <div className="form-group"><label>Conveyance & Other Allowance (₹)</label><input type="number" className="input-field" value={formData.incentives} onChange={e => handleIncentivesChange(e.target.value)} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} /></div>
                <div className="form-group"><label>Prof. Tax (PTax) Deduction (₹)</label><input type="number" className="input-field" value={formData.ptax} onChange={e => setFormData({...formData, ptax: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} /></div>
                <div className="form-group"><label>PF Deduction Amount (₹)</label><input type="number" className="input-field" value={formData.pfAmount} onChange={e => setFormData({...formData, pfAmount: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} /></div>
                <div className="form-group"><label>ESI Deduction Amount (₹)</label><input type="number" className="input-field" value={formData.esiAmount} onChange={e => setFormData({...formData, esiAmount: e.target.value})} disabled={!isAdminOrHR} style={{ background: isAdminOrHR ? '#ffffff' : '#f1f5f9' }} /></div>

                {/* Employer Contributions Section */}
                <div style={{
                  gridColumn: '1 / -1',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  marginTop: '8px',
                  marginBottom: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '14.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🏢</span> Employer Contributions (Not Deducted from Net Salary)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                    <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employer PF</span>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                        ₹{employerPF.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'block' }}>12% of Basic</span>
                    </div>
                    <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employer ESI</span>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                        ₹{employerESI.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'block' }}>3.25% of Gross</span>
                    </div>
                    <div style={{ background: '#eff6ff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                      <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Employer Contribution</span>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e3a8a', marginTop: '6px' }}>
                        ₹{totalEmployer.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span style={{ fontSize: '11px', color: '#3b82f6', marginTop: '2px', display: 'block' }}>PF + ESI</span>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Bank Account No.</label>
                  <input type="text" className="input-field" value={formData.bankAccountNo} onChange={e => setFormData({...formData, bankAccountNo: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>IFSC Code</label>
                  <input type="text" className="input-field" value={formData.bankIfsc} onChange={e => {
                    const val = e.target.value.toUpperCase();
                    setFormData({...formData, bankIfsc: val});
                    if (val.length === 11) fetchBankName(val);
                  }} />
                </div>
                <div className="form-group">
                  <label>Bank Name</label>
                  <input type="text" className="input-field" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} placeholder="Auto-fetched from IFSC" />
                </div>
                <div className="form-group">
                  <label>PF Number</label>
                  <input type="text" className="input-field" value={formData.pf} onChange={e => setFormData({...formData, pf: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>ESI Number</label>
                  <input type="text" className="input-field" value={formData.esi} onChange={e => setFormData({...formData, esi: e.target.value})} />
                </div>

                {/* Salary Increment & Revision History Table */}
                <div style={{
                  gridColumn: '1 / -1',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '20px',
                  marginTop: '12px',
                  marginBottom: '8px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#166534', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>📈</span> Salary Increment & Revision History
                  </h4>
                  {formData.incrementHistory && formData.incrementHistory.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: '#ffffff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #dcfce7' }}>
                        <thead>
                          <tr style={{ background: '#dcfce7', color: '#14532d', textAlign: 'left' }}>
                            <th style={{ padding: '8px 12px' }}>#</th>
                            <th style={{ padding: '8px 12px' }}>Previous CTC (₹)</th>
                            <th style={{ padding: '8px 12px' }}>Revised CTC (₹)</th>
                            <th style={{ padding: '8px 12px' }}>Increment (₹)</th>
                            <th style={{ padding: '8px 12px' }}>% Increase</th>
                            <th style={{ padding: '8px 12px' }}>Effective Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.incrementHistory.map((inc: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f0fdf4' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{idx + 1}</td>
                              <td style={{ padding: '8px 12px', color: '#64748b' }}>₹{Number(inc.previousSalary || 0).toLocaleString('en-IN')}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#166534' }}>₹{Number(inc.revisedSalary || 0).toLocaleString('en-IN')}</td>
                              <td style={{ padding: '8px 12px', color: '#047857', fontWeight: 600 }}>+₹{Number(inc.incrementAmount || 0).toLocaleString('en-IN')}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '12px' }}>
                                  +{Number(inc.incrementPercentage || 0).toFixed(1)}%
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', color: '#475569' }}>
                                {inc.effectiveDate ? new Date(inc.effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#166534', fontStyle: 'italic', background: '#ffffff', padding: '12px 16px', borderRadius: '8px', border: '1px dashed #86efac' }}>
                      No previous salary increments recorded yet. When an increment is saved, the historical record will appear here.
                    </div>
                  )}
                </div>
              </div>

              {/* TAB 5: DOCUMENTS */}
              <div style={{ display: activeTab === 'documents' ? 'block' : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: 600, color: '#1e293b' }}>Aadhaar Number</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="E.g. 1234 5678 9012" 
                      value={formData.aadhaar || ''} 
                      onChange={e => setFormData({...formData, aadhaar: e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: 600, color: '#1e293b' }}>PAN Number</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="E.g. ABCDE1234F" 
                      value={formData.pan || ''} 
                      onChange={e => setFormData({...formData, pan: e.target.value.toUpperCase()})} 
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#1e293b' }}>
                      <span style={{ fontSize: '16px' }}>🔐</span> DigiLocker Entry
                    </label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Enter DigiLocker URI / Document ID / Account Link" 
                        value={formData.digiLockerEntry || ''} 
                        onChange={e => setFormData({...formData, digiLockerEntry: e.target.value})} 
                        style={{ flex: 1 }}
                      />
                      <a 
                        href="https://digilocker.gov.in" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn-secondary" 
                        style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                      >
                        🌐 Open DigiLocker
                      </a>
                    </div>
                    <p style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px', marginBottom: 0 }}>
                      Enter the employee's verified DigiLocker document URI, ID, or account link for instant verification.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: activeTab === 'official' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '15px' }}>📜 Offer & Appointment Letter</h4>
                      <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                        Generate and download the official Offer & Appointment Letter PDF dynamically populated with employee details, salary annexure & job responsibilities.
                      </p>
                    </div>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
                      onClick={() => generateOfferLetterPDF(formData)}
                    >
                      <Download size={16} /> Generate & Download Offer & Appointment Letter
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1', background: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ background: '#16a34a', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px' }}>1</span>
                        <label style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#15803d', cursor: isAdminOrHR ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            checked={formData.enableIncrement || false} 
                            disabled={!isAdminOrHR}
                            onChange={e => setFormData({ ...formData, enableIncrement: e.target.checked })} 
                            style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: isAdminOrHR ? 'pointer' : 'not-allowed' }}
                          />
                          Generate Increment Letter (Salary Revision)
                        </label>
                      </div>
                      {formData.enableIncrement && (
                        <button 
                          type="button" 
                          className="btn-primary" 
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#16a34a', borderColor: '#15803d' }}
                          onClick={() => generateIncrementLetterPDF(formData)}
                        >
                          <Download size={16} /> Generate & Download Increment Letter
                        </button>
                      )}
                    </div>

                    {formData.enableIncrement && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '10px', borderTop: '1px dashed #86efac' }}>
                        <div>
                          <label style={{ fontWeight: 600, fontSize: '13px', color: '#166534', marginBottom: '6px', display: 'block' }}>
                            Current Monthly CTC (₹): <span style={{ fontWeight: 700, color: '#0f766e' }}>₹{formData.salaryAmount || 0}</span>
                          </label>
                          <label style={{ fontWeight: 600, fontSize: '13px', color: '#166534', marginBottom: '4px', display: 'block' }}>
                            Revised Monthly CTC (Amount After Increment ₹)
                          </label>
                          <input 
                            type="number" 
                            placeholder="e.g. 25000" 
                            value={formData.revisedSalary || ''} 
                            disabled={!isAdminOrHR}
                            readOnly={!isAdminOrHR}
                            onChange={e => setFormData({ ...formData, revisedSalary: e.target.value })} 
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #86efac', background: isAdminOrHR ? '#fff' : '#f1f5f9', cursor: isAdminOrHR ? 'text' : 'not-allowed' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontWeight: 600, fontSize: '13px', color: '#166534', marginBottom: '4px', display: 'block' }}>
                            Increment Effective Date
                          </label>
                          <input 
                            type="date" 
                            value={formData.incrementEffectiveDate || ''} 
                            disabled={!isAdminOrHR}
                            readOnly={!isAdminOrHR}
                            onChange={e => setFormData({ ...formData, incrementEffectiveDate: e.target.value })} 
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #86efac', background: isAdminOrHR ? '#fff' : '#f1f5f9', cursor: isAdminOrHR ? 'text' : 'not-allowed' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px', position: 'sticky', bottom: 0, background: '#fff', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading Files...' : 'Save Employee Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSlipModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h3>Generate Salary Slip</h3>
              <button className="close-btn" onClick={() => setShowSlipModal(false)}>✕</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Month</label>
                  <select className="input-field" value={slipMonth} onChange={e => setSlipMonth(Number(e.target.value))}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Year</label>
                  <input type="number" className="input-field" value={slipYear} onChange={e => setSlipYear(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Arrears (₹)</label>
                  <input type="number" className="input-field" value={arrearsInput} onChange={e => setArrearsInput(Number(e.target.value))} placeholder="0" />
                </div>
              </div>
              <button className="btn-primary" onClick={generateSlip} style={{ width: '100%', marginBottom: '20px' }}>Generate Slip</button>
              
              {slipData && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 16px 0', textAlign: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>Salary Slip - {slipMonth}/{slipYear}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                    <div><strong>Total Present:</strong> {slipData.presentDays} days</div>
                    <div><strong>Leaves Taken:</strong> {slipData.leaveDays} days</div>
                    <div><strong>Total Lates:</strong> {slipData.lateCount}</div>
                    <div><strong>Late Penalty:</strong> {slipData.absentDaysDueToLate} days</div>
                    <div><strong>Arrears:</strong> ₹{slipData.arrears || 0}</div>
                    <div style={{ color: '#059669' }}><strong>Paid Leaves used:</strong> {slipData.paidLeavesUsed} days</div>
                    <div style={{ color: '#ef4444' }}><strong>Leave Deduction:</strong> ₹{slipData.leaveDeduction?.toFixed(2)}</div>
                    
                    <div style={{ gridColumn: '1/-1', borderBottom: '1px solid #e2e8f0', margin: '8px 0' }}></div>
                    <div><strong>Basic:</strong> ₹{slipData.basic?.toFixed(2)}</div>
                    <div><strong>PTax:</strong> ₹{slipData.ptax?.toFixed(2)}</div>
                    <div><strong>HRA:</strong> ₹{slipData.hra?.toFixed(2)}</div>
                    <div><strong>PF (Employee):</strong> ₹{slipData.pf?.toFixed(2)}</div>
                    <div><strong>Conveyance & Other Allowance:</strong> ₹{slipData.incentives?.toFixed(2)}</div>
                    <div><strong>ESI (Employee):</strong> ₹{slipData.esi?.toFixed(2)}</div>
                    
                    {(() => {
                      const slipGross = (slipData.basic || 0) + (slipData.hra || 0) + (slipData.incentives || 0);
                      const slipEmrPF = (slipData.pf && parseFloat(slipData.pf) > 0) ? ((slipData.basic || 0) * 0.12) : 0;
                      const slipEmrESI = (slipData.esi && parseFloat(slipData.esi) > 0) ? (slipGross * 0.0325) : 0;
                      const slipTotalEmr = slipEmrPF + slipEmrESI;

                      return (
                        <>
                          <div style={{ gridColumn: '1/-1', borderBottom: '1px solid #e2e8f0', margin: '8px 0' }}></div>
                          <div style={{ gridColumn: '1/-1', fontWeight: 600, color: '#475569', fontSize: '12px' }}>Employer Contributions (Not Deducted)</div>
                          <div><strong>Employer PF:</strong> ₹{slipEmrPF.toFixed(2)}</div>
                          <div><strong>Employer ESI:</strong> ₹{slipEmrESI.toFixed(2)}</div>
                          <div style={{ gridColumn: '1/-1', fontSize: '13px', fontWeight: 'bold', color: '#1e3a8a', marginTop: '4px' }}>
                            Total Employer Contribution: ₹{slipTotalEmr.toFixed(2)}
                          </div>
                        </>
                      );
                    })()}

                    <div style={{ gridColumn: '1/-1', borderBottom: '1px solid #e2e8f0', margin: '8px 0' }}></div>
                    <div><strong>Total Additions:</strong> ₹{slipData.totalAdditions?.toFixed(2)}</div>
                    <div><strong>Total Deductions:</strong> ₹{slipData.totalDeductions?.toFixed(2)}</div>
                    <div style={{ gridColumn: '1/-1', fontSize: '18px', fontWeight: 'bold', textAlign: 'right', marginTop: '12px', color: '#16a34a' }}>
                      Net Salary: ₹{slipData.netSalary?.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={downloadPDF}>
                      <Download size={18} /> Download PDF
                    </button>
                    <button className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={sendEmailToEmployee}>
                      <Mail size={18} /> Email to Employee
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showWfhModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '90%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🏠</span>
                <h3 style={{ margin: 0 }}>Manage Work From Home (WFH)</h3>
              </div>
              <button className="close-btn" onClick={() => setShowWfhModal(false)}>✕</button>
            </div>
            <div style={{ padding: '20px' }}>
              
              {/* Toggle Mode: Date Range vs Single Date */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button 
                  type="button"
                  onClick={() => setWfhMode('range')} 
                  style={{ 
                    flex: 1, 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: 'none', 
                    fontWeight: 600, 
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: wfhMode === 'range' ? '#ffffff' : 'transparent',
                    color: wfhMode === 'range' ? '#2563eb' : '#64748b',
                    boxShadow: wfhMode === 'range' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  📅 Multiple Dates (Range)
                </button>
                <button 
                  type="button"
                  onClick={() => setWfhMode('single')} 
                  style={{ 
                    flex: 1, 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: 'none', 
                    fontWeight: 600, 
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: wfhMode === 'single' ? '#ffffff' : 'transparent',
                    color: wfhMode === 'single' ? '#2563eb' : '#64748b',
                    boxShadow: wfhMode === 'single' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  📆 Single Date
                </button>
              </div>

              {wfhMode === 'range' ? (
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px', display: 'block' }}>
                    Set Multiple WFH Dates Range
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>From Date</span>
                      <input type="date" className="input-field" value={wfhFromDate} onChange={e => setWfhFromDate(e.target.value)} />
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>To Date</span>
                      <input type="date" className="input-field" value={wfhToDate} onChange={e => setWfhToDate(e.target.value)} />
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleAddWfhRange}
                    style={{ width: '100%', padding: '9px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    ➕ Mark Date Range as WFH
                  </button>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px', display: 'block' }}>
                    Add Single WFH Date
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="date" className="input-field" value={wfhDate} onChange={e => setWfhDate(e.target.value)} />
                    <button 
                      type="button" 
                      className="btn-primary" 
                      onClick={async () => {
                        if (!wfhDate) return;
                        try {
                          await axios.post('http://localhost:5000/api/attendance/mark-wfh', { userId: wfhUserId, dates: [wfhDate] });
                          fetchWfhDates(wfhUserId!);
                        } catch (err) { alert('Error adding WFH date'); }
                      }}
                      style={{ padding: '9px 18px', fontWeight: 600 }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Currently Marked WFH Dates List */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#334155', fontWeight: 700 }}>
                    Currently Marked WFH Dates ({wfhDates.length})
                  </h4>
                </div>

                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#ffffff' }}>
                  {wfhDates.map(d => (
                    <div key={d._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#1e293b' }}>
                        🗓️ {new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <button 
                        style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        onClick={async () => {
                          if (window.confirm('Remove this WFH date?')) {
                            try {
                              await axios.post('http://localhost:5000/api/attendance/remove-wfh', { userId: wfhUserId, date: d.date });
                              fetchWfhDates(wfhUserId!);
                            } catch (err) { alert('Error removing WFH date'); }
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {wfhDates.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px', fontSize: '13px' }}>No WFH dates set for this employee yet.</div>}
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <button className="btn-secondary" onClick={() => setShowWfhModal(false)} style={{ width: '100%', padding: '10px' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMaternityModal && maternityEmployee && (() => {
        const joiningDateStr = maternityEmployee.joiningDate;
        const targetDate = maternityForm.fromDate ? new Date(maternityForm.fromDate).getTime() : Date.now();
        const daysOfService = joiningDateStr ? Math.floor((targetDate - new Date(joiningDateStr).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const isTenureEligible = daysOfService >= 80;

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '550px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Apply Maternity Leave for {maternityEmployee.name}</h3>
                <button onClick={() => setShowMaternityModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
              </div>

              {maternityError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} />
                  <span>{maternityError}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '30px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                {/* Form side */}
                <form onSubmit={handleMaternitySubmit} style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                    {!isTenureEligible && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <AlertTriangle size={16} />
                        <span>Ineligible: Employee has {daysOfService} service days (80 required).</span>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Maternity Scenario *</label>
                      <select 
                        className="input-field" 
                        value={maternityForm.maternityScenario} 
                        onChange={e => setMaternityForm({ ...maternityForm, maternityScenario: e.target.value })} 
                        required
                      >
                        <option value="None">Select Scenario</option>
                        <option value="First two surviving children">First two surviving children (26 weeks)</option>
                        <option value="Third or subsequent child">Third or subsequent child (12 weeks)</option>
                        <option value="Adoption">Adoption of child below 3 months (12 weeks)</option>
                        <option value="Surrogacy">Commissioning mother / Surrogacy (12 weeks)</option>
                      </select>
                    </div>

                    {maternityForm.maternityScenario === 'First two surviving children' && (
                      <div className="form-group">
                        <label>Expected Delivery Date *</label>
                        <input 
                          type="date" 
                          className="input-field" 
                          value={maternityForm.expectedDeliveryDate} 
                          onChange={e => setMaternityForm({ ...maternityForm, expectedDeliveryDate: e.target.value })} 
                          required 
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className="form-group">
                      <label>From Date *</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={maternityForm.fromDate} 
                        onChange={e => setMaternityForm({ ...maternityForm, fromDate: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>To Date *</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={maternityForm.toDate} 
                        onChange={e => setMaternityForm({ ...maternityForm, toDate: e.target.value })} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Reason *</label>
                    <textarea 
                      className="input-field" 
                      placeholder="Explain why maternity leave is requested..." 
                      value={maternityForm.reason} 
                      onChange={e => setMaternityForm({ ...maternityForm, reason: e.target.value })} 
                      required
                      style={{ minHeight: '80px', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Attachment * (Medical Certificate Required)</label>
                    <input type="file" accept=".pdf,image/*" onChange={handleMaternityFileUpload} disabled={maternityUploading} />
                    {maternityUploading && <span style={{ fontSize: '13px', color: '#2563eb', marginLeft: '10px' }}>Uploading...</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={maternitySaving || maternityUploading || !isTenureEligible}
                    >
                      {maternitySaving ? 'Submitting...' : 'Apply Maternity Leave'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setShowMaternityModal(false)}>Close</button>
                  </div>

                </form>
              </div>

            </div>
          </div>
        );
      })()}

      {showCalculatorModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '95vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calculator size={22} color="#1e3a8a" />
                <h3 style={{ margin: 0 }}>Offer & Appointment Letter Salary Annexure Calculator</h3>
              </div>
              <button className="close-btn" onClick={() => setShowCalculatorModal(false)}>✕</button>
            </div>

            <div style={{ padding: '20px 0', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              {/* Left Column: Input and Assumptions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px', color: '#1e293b', fontSize: '14px' }}>Enter Monthly CTC (₹)</label>
                  <input
                    type="number"
                    className="input-field"
                    style={{ fontSize: '16px', fontWeight: 600, color: '#1e3a8a' }}
                    value={calcCTC}
                    onChange={(e) => setCalcCTC(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>Salary Options</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>
                    <input 
                      type="checkbox" 
                      checked={calcHasPF} 
                      onChange={e => setCalcHasPF(e.target.checked)} 
                    />
                    Include PF (Provident Fund)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>
                    <input 
                      type="checkbox" 
                      checked={calcHasESI} 
                      onChange={e => setCalcHasESI(e.target.checked)} 
                    />
                    Include ESI (ESIC)
                  </label>
                </div>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#475569', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>Calculation Assumptions</h4>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f8fafc' }}><td style={{ padding: '6px 0', color: '#64748b' }}>Basic % of Gross</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>40%</td></tr>
                      <tr style={{ borderBottom: '1px solid #f8fafc' }}><td style={{ padding: '6px 0', color: '#64748b' }}>HRA % of Basic</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>20%</td></tr>
                      <tr style={{ borderBottom: '1px solid #f8fafc' }}><td style={{ padding: '6px 0', color: '#64748b' }}>Employer PF % of Basic</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>12%</td></tr>
                      <tr style={{ borderBottom: '1px solid #f8fafc' }}><td style={{ padding: '6px 0', color: '#64748b' }}>Employer ESIC % of Gross</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>3.25%</td></tr>
                      <tr style={{ borderBottom: '1px solid #f8fafc' }}><td style={{ padding: '6px 0', color: '#64748b' }}>Employee PF % of Basic</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>12%</td></tr>
                      <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Employee ESIC % of Gross</td><td style={{ textAlign: 'right', fontWeight: 600, color: '#334155' }}>0.75%</td></tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#475569' }}>P. Tax Slab (Gross)</h4>
                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', color: '#64748b' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #cbd5e1' }}><th style={{ textAlign: 'left', paddingBottom: '4px' }}>Gross Salary</th><th style={{ textAlign: 'right', paddingBottom: '4px' }}>Tax</th></tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '4px 0' }}>Up to ₹10,000</td><td style={{ textAlign: 'right', fontWeight: 600 }}>Nil</td></tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '4px 0' }}>₹10,001 to ₹15,000</td><td style={{ textAlign: 'right', fontWeight: 600 }}>₹110</td></tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '4px 0' }}>₹15,001 to ₹25,000</td><td style={{ textAlign: 'right', fontWeight: 600 }}>₹130</td></tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '4px 0' }}>₹25,001 to ₹40,000</td><td style={{ textAlign: 'right', fontWeight: 600 }}>₹150</td></tr>
                      <tr><td style={{ padding: '4px 0' }}>Above ₹40,000</td><td style={{ textAlign: 'right', fontWeight: 600 }}>₹200</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Breakdown Table */}
              <div>
                {(() => {
                  let multiplier = 1.0;
                  if (calcHasPF) multiplier += 0.048;
                  if (calcHasESI) multiplier += 0.0325;

                  const gross = calcCTC / multiplier;
                  const basic = gross * 0.4;
                  const hra = basic * 0.2;
                  const conveyance = gross - basic - hra;

                  const emrPF = calcHasPF ? (basic * 0.12) : 0;
                  const emrESIC = calcHasESI ? (gross * 0.0325) : 0;
                  const totalEmrContr = emrPF + emrESIC;

                  const emePF = calcHasPF ? (basic * 0.12) : 0;
                  const emeESIC = calcHasESI ? (gross * 0.0075) : 0;
                  
                  let ptax = 0;
                  if (calcCTC > 40000) ptax = 200;
                  else if (calcCTC > 25000) ptax = 150;
                  else if (calcCTC > 15000) ptax = 130;
                  else if (calcCTC > 10000) ptax = 110;

                  const totalDeductions = emePF + emeESIC + ptax;
                  const netSalary = gross - totalDeductions;

                  const formatVal = (val: number) => val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  
                  return (
                    <div className="data-table-container" style={{ padding: '0', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                      <table style={{ margin: 0, width: '100%' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Salary Heads</th>
                            <th style={{ textAlign: 'right', padding: '12px 16px' }}>Monthly (₹)</th>
                            <th style={{ textAlign: 'right', padding: '12px 16px' }}>Annual (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 500 }}>Basic Salary (40%)</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(basic)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(basic * 12)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 500 }}>HRA (20% of Basic)</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(hra)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(hra * 12)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 500 }}>Conveyance & Other Allowance</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(conveyance)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(conveyance * 12)}</td>
                          </tr>
                          <tr style={{ background: '#f1f5f9', fontWeight: 700, borderBottom: '2px solid #cbd5e1' }}>
                            <td style={{ padding: '10px 16px' }}>Gross Salary</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(gross)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(gross * 12)}</td>
                          </tr>

                          {/* Employee Deductions */}
                          <tr style={{ background: '#f8fafc' }}>
                            <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 600, color: '#475569', fontSize: '12px' }}>EMPLOYEE DEDUCTIONS</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 16px', paddingLeft: '24px', color: '#475569' }}>Employee PF (12% of Basic)</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(emePF)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(emePF * 12)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 16px', paddingLeft: '24px', color: '#475569' }}>Employee ESIC (0.75% of Gross)</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(emeESIC)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(emeESIC * 12)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 16px', paddingLeft: '24px', color: '#475569' }}>P. Tax (Slab based)</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(ptax)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(ptax * 12)}</td>
                          </tr>
                          <tr style={{ background: '#f8fafc', fontWeight: 600, borderBottom: '2px solid #cbd5e1' }}>
                            <td style={{ padding: '10px 16px', paddingLeft: '24px' }}>Total Deductions</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(totalDeductions)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(totalDeductions * 12)}</td>
                          </tr>

                          {/* Net Payable */}
                          <tr style={{ background: '#ecfdf5', fontWeight: 800, borderBottom: '2px solid #a7f3d0', color: '#065f46' }}>
                            <td style={{ padding: '12px 16px' }}>Net Salary Payable</td>
                            <td style={{ textAlign: 'right', padding: '12px 16px' }}>{formatVal(netSalary)}</td>
                            <td style={{ textAlign: 'right', padding: '12px 16px' }}>{formatVal(netSalary * 12)}</td>
                          </tr>

                          {/* Employer Contribution */}
                          <tr style={{ background: '#f8fafc' }}>
                            <td colSpan={3} style={{ padding: '8px 16px', fontWeight: 600, color: '#475569', fontSize: '12px' }}>EMPLOYER CONTRIBUTION (INCLUDED IN CTC)</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 16px', paddingLeft: '24px', color: '#475569' }}>Employer PF (12% of Basic)</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(emrPF)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(emrPF * 12)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 16px', paddingLeft: '24px', color: '#475569' }}>Employer ESIC (3.25% of Gross)</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(emrESIC)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(emrESIC * 12)}</td>
                          </tr>
                          <tr style={{ background: '#f8fafc', fontWeight: 600, borderBottom: '2px solid #cbd5e1' }}>
                            <td style={{ padding: '10px 16px', paddingLeft: '24px' }}>Total Employer Contribution</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(totalEmrContr)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>{formatVal(totalEmrContr * 12)}</td>
                          </tr>

                          {/* Total CTC */}
                          <tr style={{ background: '#eff6ff', fontWeight: 800, color: '#1e40af' }}>
                            <td style={{ padding: '12px 16px' }}>Total CTC</td>
                            <td style={{ textAlign: 'right', padding: '12px 16px' }}>{formatVal(calcCTC)}</td>
                            <td style={{ textAlign: 'right', padding: '12px 16px' }}>{formatVal(calcCTC * 12)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCalculatorModal(false)}>Close</button>
              
              <button
                type="button"
                className="btn-secondary"
                style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  handleDownloadAnnexurePDF(calcCTC, calcHasPF, calcHasESI);
                }}
              >
                <Download size={16} /> Download PDF Annexure
              </button>

              {showModal && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    handleApplyCalculatorToForm(calcCTC, calcHasPF, calcHasESI);
                    setShowCalculatorModal(false);
                  }}
                >
                  Apply to Employee Form
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
