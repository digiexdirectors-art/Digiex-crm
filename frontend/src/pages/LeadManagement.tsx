import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Upload, Search, X, Edit, Trash2, Eye, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

const getStatusBadgeClass = (stage: string) => {
  switch (stage) {
    case 'Another Visit Required':
      return 'badge-orange';
    case 'Appointment Fixed':
      return 'badge-indigo';
    case 'Budget Constraints':
      return 'badge-yellow';
    case 'Deal Won':
    case 'Deal Close':
    case 'Deal Won With Full Payment':
    case 'Deal Close With Full Payment':
      return 'badge-green';
    case 'Deal Won With Partial Payment':
    case 'Deal Close With Partial Payment':
      return 'badge-teal';
    case 'Decision Pending':
      return 'badge-orange';
    case 'Future Interest Expressed':
      return 'badge-purple';
    case 'Meeting Cancelled - By MM':
    case 'Meeting Cancelled - By Prospect':
    case 'Meeting Conducted - Not Interested':
      return 'badge-red';
    case 'Meeting Rescheduled':
      return 'badge-indigo';
    case 'MM Follow-up Required':
      return 'badge-orange';
    case 'Positive Response':
      return 'badge-green';
    case 'Proposal Requested':
    case 'Proposal Sent':
      return 'badge-blue';
    case 'Prospect Unavailable':
      return 'badge-gray';
    case 'Referred to Another Decision Maker':
      return 'badge-purple';
    case 'TME Follow-up Required':
      return 'badge-orange';
    case 'Bounced Collection':
    case 'Details Incorrect':
    case 'Do Not Disturb':
    case 'Fake Appointmen':
      return 'badge-red';
    case 'Not Available':
      return 'badge-gray';
    case 'Not Visited':
      return 'badge-gray';
    // Legacy support
    case 'Call Back / Reschedule':
      return 'badge-orange';
    case 'Interested':
      return 'badge-green';
    case 'Not Interested':
      return 'badge-red';
    case 'Busy / No Answer':
      return 'badge-yellow';
    case 'Wrong Number':
    case 'Invalid Number':
      return 'badge-red';
    case 'Data':
      return 'badge-gray';
    case 'Telecalling':
      return 'badge-blue';
    case 'Marketing':
      return 'badge-purple';
    case 'Deal':
      return 'badge-teal';
    case 'Service':
    case 'Retention':
      return 'badge-yellow';
    default:
      return 'badge-gray';
  }
};

const formatStatusDisplay = (stage: string) => {
  if (!stage) return 'Data';
  if (stage === 'Deal Won') return 'Deal Close';
  if (stage === 'Deal Won With Full Payment') return 'Deal Close With Full Payment';
  if (stage === 'Deal Won With Partial Payment') return 'Deal Close With Partial Payment';
  return stage;
};

const TIME_SLOTS = (() => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const hh = String(hour).padStart(2, '0');
      const mm = String(min).padStart(2, '0');
      const period = hour >= 12 ? 'PM' : 'AM';
      const dispHour = hour % 12 === 0 ? 12 : hour % 12;
      const dispMin = String(min).padStart(2, '0');
      const label = `${String(dispHour).padStart(2, '0')}:${dispMin} ${period}`;
      slots.push({ value: `${hh}:${mm}`, label });
    }
  }
  return slots;
})();

// Verhoeff algorithm tables for Aadhaar checksum verification
const verhoeffD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const verhoeffP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

const validateVerhoeff = (str: string): boolean => {
  let c = 0;
  const ArrayStr = str.split('').reverse();
  for (let i = 0; i < ArrayStr.length; i++) {
    const digit = parseInt(ArrayStr[i], 10);
    if (isNaN(digit)) return false;
    c = verhoeffD[c][verhoeffP[i % 8][digit]];
  }
  return c === 0;
};

const validatePAN = (pan: string): { isValid: boolean; reason?: string } => {
  const cleanPan = pan.trim().toUpperCase();
  if (cleanPan.length !== 10) {
    return { isValid: false, reason: "PAN number must be exactly 10 characters long." };
  }
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(cleanPan)) {
    return { isValid: false, reason: "PAN number must follow standard format (5 letters, 4 digits, 1 letter)." };
  }
  const allowed4th = ['P', 'C', 'H', 'A', 'B', 'G', 'J', 'L', 'F', 'T'];
  if (!allowed4th.includes(cleanPan[3])) {
    return { isValid: false, reason: "4th character of PAN must represent entity status (e.g., P for Individual, C for Company, F for Firm)." };
  }
  return { isValid: true };
};

const validateTIN = (tin: string): { isValid: boolean; reason?: string } => {
  const cleanTin = tin.trim();
  if (cleanTin.length !== 11) {
    return { isValid: false, reason: "TIN number must be exactly 11 digits long." };
  }
  if (!/^[0-9]{11}$/.test(cleanTin)) {
    return { isValid: false, reason: "TIN number must contain only numeric digits." };
  }
  return { isValid: true };
};

const validateAadhar = (aadhar: string): { isValid: boolean; reason?: string } => {
  const cleanAadhar = aadhar.trim().replace(/\s+/g, '');
  if (cleanAadhar.length !== 12) {
    return { isValid: false, reason: "Aadhar number must be exactly 12 digits long." };
  }
  if (!/^[0-9]{12}$/.test(cleanAadhar)) {
    return { isValid: false, reason: "Aadhar number must contain only numeric digits." };
  }
  if (cleanAadhar[0] === '0' || cleanAadhar[0] === '1') {
    return { isValid: false, reason: "Aadhar number cannot start with 0 or 1." };
  }
  if (!validateVerhoeff(cleanAadhar)) {
    return { isValid: false, reason: "Aadhar number fails mathematical Verhoeff checksum validation (it is invalid/fake)." };
  }
  return { isValid: true };
};

const validateEpic = (epic: string): { isValid: boolean; reason?: string } => {
  const cleanEpic = epic.trim().toUpperCase();
  if (cleanEpic.length !== 10) {
    return { isValid: false, reason: "Epic / Voter ID must be exactly 10 characters long." };
  }
  const epicRegex = /^[A-Z]{3}[0-9]{7}$/;
  if (!epicRegex.test(cleanEpic)) {
    return { isValid: false, reason: "Epic / Voter ID must match the format: 3 letters followed by 7 digits (e.g. ABC1234567)." };
  }
  return { isValid: true };
};

const validateCIN = (cin: string): { isValid: boolean; reason?: string } => {
  const cleanCin = cin.trim().toUpperCase();
  if (cleanCin.length > 0 && cleanCin.length !== 21) {
    return { isValid: false, reason: "CIN must be exactly 21 characters long." };
  }
  const cinRegex = /^[L|U][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
  if (cleanCin.length > 0 && !cinRegex.test(cleanCin)) {
    return { isValid: false, reason: "CIN format is invalid. Standard CIN matches: L/U (1 character) + Industry Code (5 digits) + State Code (2 letters) + Year (4 digits) + Registration Type (3 letters) + Registration Number (6 digits)." };
  }
  return { isValid: true };
};

const validateGSTIN = (gstin: string): { isValid: boolean; reason?: string } => {
  const cleanGstin = gstin.trim().toUpperCase();
  if (cleanGstin.length !== 15) {
    return { isValid: false, reason: "GST number must be exactly 15 characters long." };
  }

  // Regex format check
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(cleanGstin)) {
    const statePart = cleanGstin.substring(0, 2);
    const panPart = cleanGstin.substring(2, 12);
    
    if (!/^[0-9]{2}$/.test(statePart)) {
      return { isValid: false, reason: "First 2 characters must be a numeric State Code." };
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panPart)) {
      return { isValid: false, reason: "Characters 3 to 12 must follow PAN format (5 letters, 4 digits, 1 letter)." };
    }
    return { isValid: false, reason: "GST number does not match standard GSTIN format structure." };
  }

  // State code validation
  const stateCode = parseInt(cleanGstin.substring(0, 2), 10);
  const validStateCodes = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 
    31, 32, 33, 34, 35, 36, 37, 38, 97, 98
  ];
  if (!validStateCodes.includes(stateCode)) {
    return { isValid: false, reason: `State code "${cleanGstin.substring(0, 2)}" is not a valid Indian State/UT GST code.` };
  }

  // Checksum calculation (Mod 36)
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;

  for (let i = 0; i < 14; i++) {
    const charValue = chars.indexOf(cleanGstin[i]);
    if (charValue === -1) {
      return { isValid: false, reason: "GST number contains invalid characters." };
    }
    const factor = (i % 2) + 1;
    const product = charValue * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }

  const remainder = sum % 36;
  const checkCode = (36 - remainder) % 36;
  const calculatedCheckDigit = chars[checkCode];

  if (cleanGstin[14] !== calculatedCheckDigit) {
    return { 
      isValid: false, 
      reason: `Invalid checksum digit. The last character should be "${calculatedCheckDigit}" (calculated checksum), but is "${cleanGstin[14]}".` 
    };
  }

  return { isValid: true };
};


export default function LeadManagement() {
  const navigate = useNavigate();
  const [isSaveAndNext, setIsSaveAndNext] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDataId, setFilterDataId] = useState('');
  const [filterBusinessName, setFilterBusinessName] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterTme, setFilterTme] = useState('');
  const [filterMeetingDate, setFilterMeetingDate] = useState('');
  const [filterCurrentStatus, setFilterCurrentStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedLeadForInfo, setSelectedLeadForInfo] = useState<any>(null);
  const [duplicateLeadError, setDuplicateLeadError] = useState<any>(null);
  const [bulkUploadResult, setBulkUploadResult] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Lead Conversion & Package Assignment states
  const [packages, setPackages] = useState<any[]>([]);
  const [showLeadConvertModal, setShowLeadConvertModal] = useState(false);
  const [convertLeadId, setConvertLeadId] = useState<string | null>(null);
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [convertStartDate, setConvertStartDate] = useState('');
  const [convertEndDate, setConvertEndDate] = useState('');
  const [convertPrice, setConvertPrice] = useState(0);
  const [convertGstAmount, setConvertGstAmount] = useState(0);
  const [convertTotal, setConvertTotal] = useState(0);
  const [convertPaidAmount, setConvertPaidAmount] = useState(0);
  const [convertAccountManager, setConvertAccountManager] = useState('');
  const [convertBillingCycle, setConvertBillingCycle] = useState('Monthly');
  const itemsPerPage = 20;

  // Dynamic Categories & Dependent Subcategories
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [showAddCatInput, setShowAddCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showAddSubcatInput, setShowAddSubcatInput] = useState(false);
  const [newSubcatName, setNewSubcatName] = useState('');

  // Set Appointment States
  const [selectedLeadForAppointment, setSelectedLeadForAppointment] = useState<any>(null);
  const [appointmentStatus, setAppointmentStatus] = useState('Select an option');
  const [appointmentRemarks, setAppointmentRemarks] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [assignedBDM, setAssignedBDM] = useState('');
  const [appointmentAddress, setAppointmentAddress] = useState('');
  const [appointmentPhone, setAppointmentPhone] = useState('');
  const [isEditingAppointment, setIsEditingAppointment] = useState(false);

  useEffect(() => {
    if (appointmentStatus === 'Deal Close') {
      setConvertPaidAmount(0);
    }
  }, [appointmentStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterDataId, filterBusinessName, filterLocation, filterTme, filterMeetingDate, filterCurrentStatus, filterType]);



  const leadObj = leads.find(l => l._id === editingLeadId);
  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
  const loggedInName = loggedInUser.name || 'Self';
  const loggedInUserId = loggedInUser.id || loggedInUser._id || '';
  const loggedInRole = (loggedInUser.role?.name || '').toLowerCase().trim();
  const loggedInDept = (typeof loggedInUser.role?.department === 'object' ? loggedInUser.role?.department?.name : loggedInUser.role?.department || '').toLowerCase().trim();
  const userTypeName = (loggedInUser.role?.userType?.name || loggedInUser.role?.userType || '').toLowerCase().trim();
  const isTme = loggedInRole.includes('tele') || loggedInRole.includes('tme');
  const isMarketing = loggedInRole.includes('marketing manager') || loggedInRole.includes('marketing executive');
  const isAdmin = loggedInRole.includes('admin') || loggedInRole.includes('super admin') || userTypeName === 'admin' || userTypeName === 'super admin';
  const isHR = loggedInRole.includes('hr') || loggedInRole.includes('human resource') || loggedInDept.includes('hr');
  const isSales = (loggedInRole.includes('sales') || loggedInRole.includes('bdm') || loggedInDept.includes('sales')) && !isTme;
  const canViewEditPage = isTme || isMarketing || isAdmin || isSales;

  const isMarketingUser = () => {
    const roleLower = loggedInRole.toLowerCase();
    const deptLower = loggedInDept.toLowerCase();
    if (roleLower.includes('tele') || roleLower.includes('tme') || deptLower.includes('tele')) {
      return false;
    }
    return ['bdm', 'marketing', 'business development'].some(keyword => roleLower.includes(keyword) || deptLower.includes(keyword));
  };

  const [formData, setFormData] = useState({
    clientType: '',
    location: '',
    businessName: '',
    contactPerson: '',
    phone: '',
    alternatePhone: '',
    address: '',
    dataSource: '',
    email: '',
    website: '',
    dataFeedBy: '',
    remarks: '',
    assignedTelecaller: '',
    assignedSales: '',
    stage: 'Data',
    referralName: '',
    businessCategory: '',
    businessSubCategory: '',
    businessHoursType: '',
    openingTime: '',
    closingTime: '',
    businessStartTime: '',
    businessEndTime: '',
    yearOfEstablishment: '',
    socialMedia: '',
    kycGst: '',
    isGstVerified: false,
    businessLogo: '',
    shopFrontImage: '',
    serviceImages: [] as string[]
  });

  const [kycItems, setKycItems] = useState<{ type: string; number: string; verified?: boolean }[]>([{ type: 'GST', number: '', verified: false }]);

  const parseKycString = (str: string, isGstVerified?: boolean) => {
    if (!str) return [{ type: 'GST', number: '', verified: false }];
    const parts = str.split(',');
    const items = parts.map(p => {
      const colIdx = p.indexOf(':');
      if (colIdx !== -1) {
        const type = p.substring(0, colIdx).trim();
        const rest = p.substring(colIdx + 1).trim();
        
        const secondColIdx = rest.indexOf(':');
        let num = rest;
        let verified = false;
        
        if (secondColIdx !== -1) {
          num = rest.substring(0, secondColIdx).trim();
          const status = rest.substring(secondColIdx + 1).trim().toLowerCase();
          verified = status === 'verified';
        } else {
          // Fallback to legacy format
          verified = type === 'GST' ? !!isGstVerified : false;
        }
        
        return {
          type,
          number: num,
          verified
        };
      }
      return { type: 'GST', number: p.trim(), verified: !!isGstVerified };
    }).filter(item => item.number);
    return items.length > 0 ? items : [{ type: 'GST', number: '', verified: false }];
  };

  useEffect(() => {
    const kycString = kycItems
      .filter(item => item.number.trim())
      .map(item => `${item.type}:${item.number.trim().toUpperCase()}:${item.verified ? 'Verified' : 'Pending'}`)
      .join(',');
    const isGstVerified = kycItems.some(item => item.type === 'GST' && item.number.trim() && item.verified);
    setFormData(prev => ({ ...prev, kycGst: kycString, isGstVerified }));
  }, [kycItems]);

  const handleKycVerification = (idx: number) => {
    const item = kycItems[idx];
    if (!item || !item.number.trim()) return;

    const val = item.number.trim().toUpperCase();
    
    let validation: { isValid: boolean; reason?: string } = { isValid: true, reason: '' };
    let portalUrl = '';
    
    if (item.type === 'GST') {
      validation = validateGSTIN(val);
      portalUrl = 'https://services.gst.gov.in/services/searchtp';
    } else if (item.type === 'PAN') {
      validation = validatePAN(val);
      portalUrl = 'https://eportal.incometax.gov.in/iec/foservices/#/pre-login/verifyYourPAN';
    } else if (item.type === 'TIN') {
      validation = validateTIN(val);
      portalUrl = 'https://www.tinvat.in/';
    } else if (item.type === 'Aadhar') {
      validation = validateAadhar(val);
      portalUrl = 'https://myaadhaar.uidai.gov.in/verify-aadhaar';
    } else if (item.type === 'Epic') {
      validation = validateEpic(val);
      portalUrl = 'https://electoralsearch.eci.gov.in/';
    } else if (item.type === 'CIN') {
      validation = validateCIN(val);
      portalUrl = 'https://www.mca.gov.in/mcafoportal/viewCompanyOrLLPDetails.do';
    }
    
    if (!validation.isValid) {
      alert(`${item.type} Number Verification Error:\n\n"${val}" is invalid!\nReason: ${validation.reason}`);
      return;
    }

    // Open Government portal in new tab
    window.open(portalUrl, '_blank');

    // Display confirmation prompt
    setTimeout(() => {
      const isVerified = window.confirm(`${item.type} Verification for "${val}"\n\nDid the number verify successfully on the Government portal?`);
      if (isVerified) {
        const newItems = [...kycItems];
        newItems[idx].number = val; // clean/uppercase the number
        newItems[idx].verified = true;
        setKycItems(newItems);
      }
    }, 1000);
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/leads');
      setLeads(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      setUsers(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/business-categories');
      setCategories(res.data.data);
    } catch (err) {
      console.error('Error fetching business categories:', err);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get('/api/locations');
      setLocations(res.data.data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await axios.get('/api/packages');
      if (res.data.success) {
        setPackages(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchUsers();
    fetchCategories();
    fetchLocations();
    fetchPackages();
  }, []);

  useEffect(() => {
    const handleReset = () => {
      setEditingLeadId(null);
      setShowModal(false);
      setShowBulkModal(false);
      setShowInfoModal(false);
      setSelectedLeadForInfo(null);
      setSelectedLeadForAppointment(null);
      setIsEditingAppointment(false);
    };

    window.addEventListener('reset-lead-view', handleReset);
    return () => {
      window.removeEventListener('reset-lead-view', handleReset);
    };
  }, []);

  useEffect(() => {
    const targetEditId = localStorage.getItem('editLeadId');
    if (targetEditId && leads.length > 0) {
      const targetLead = leads.find(l => l._id === targetEditId);
      if (targetLead) {
        handleEditClick(targetLead);
        localStorage.removeItem('editLeadId');
      }
    }
  }, [leads]);

  useEffect(() => {
    const handleNotificationLead = (e: Event) => {
      const customEvent = e as CustomEvent;
      const leadId = customEvent.detail;
      if (leadId && leads.length > 0) {
        const targetLead = leads.find(l => l._id === leadId);
        if (targetLead) {
          handleEditClick(targetLead);
          localStorage.removeItem('editLeadId');
        }
      }
    };

    window.addEventListener('notification-lead-click', handleNotificationLead);
    return () => {
      window.removeEventListener('notification-lead-click', handleNotificationLead);
    };
  }, [leads]);

  const handleConvertLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertLeadId) return;

    const lead = leads.find(l => l._id === convertLeadId);
    if (!lead) return;

    const selectedPkg = packages.find(p => p._id === selectedPkgId);

    const payload = {
      leadId: convertLeadId,
      packageId: selectedPkgId || null,
      customServices: selectedPkg ? selectedPkg.services.map((s: any) => ({
        serviceId: s._id || s,
        name: s.name,
        price: s.pricing?.[convertBillingCycle === 'Half-Yearly' ? 'halfYearly' : convertBillingCycle.toLowerCase()] || 0,
        deliverables: (selectedPkg.deliverables || []).find((d: any) => d.serviceId === (s._id || s))?.items || []
      })) : [],
      startDate: convertStartDate,
      endDate: convertEndDate,
      billingCycle: convertBillingCycle,
      price: convertPrice,
      gstAmount: convertGstAmount,
      total: convertTotal,
      paidAmount: convertPaidAmount,
      accountManager: convertAccountManager,
      stage: appointmentStatus,
      remarks: appointmentRemarks || 'Lead converted to client and package assigned.',
      changedBy: `${loggedInName} [${loggedInUser.role?.name || 'User'}]`
    };

    try {
      const res = await axios.post('/api/client-packages/convert-lead', payload);
      if (res.data.success) {
        alert('Lead successfully converted to Client. Subscription activated and first Invoice generated!');
        setShowLeadConvertModal(false);
        setEditingLeadId(null);
        fetchLeads();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to convert lead');
    }
  };

  const handleConvertPkgChange = (pkgId: string, cycle: string) => {
    setSelectedPkgId(pkgId);
    if (!pkgId) {
      setConvertPrice(0);
      setConvertGstAmount(0);
      setConvertTotal(0);
      return;
    }
    const pkg = packages.find(p => p._id === pkgId);
    if (pkg) {
      const cycleKey = cycle === 'Half-Yearly' ? 'halfYearly' : cycle.toLowerCase();
      const price = pkg.pricing?.[cycleKey] || 0;
      const gst = Math.round(price * 0.18);
      setConvertPrice(price);
      setConvertGstAmount(gst);
      setConvertTotal(price + gst);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.email.trim()) {
      alert('Email Address is mandatory.');
      return;
    }

    const filledKyc = kycItems.filter(item => item.number.trim());

    for (const item of filledKyc) {
      const val = item.number.trim();
      if (item.type === 'GST') {
        const validation = validateGSTIN(val);
        if (!validation.isValid) {
          alert(`GST Number Validation Error:\n\n"${val}" is invalid!\nReason: ${validation.reason}`);
          return;
        }
      } else if (item.type === 'PAN') {
        const validation = validatePAN(val);
        if (!validation.isValid) {
          alert(`PAN Number Validation Error:\n\n"${val}" is invalid!\nReason: ${validation.reason}`);
          return;
        }
      } else if (item.type === 'TIN') {
        const validation = validateTIN(val);
        if (!validation.isValid) {
          alert(`TIN Number Validation Error:\n\n"${val}" is invalid!\nReason: ${validation.reason}`);
          return;
        }
      } else if (item.type === 'Aadhar') {
        const validation = validateAadhar(val);
        if (!validation.isValid) {
          alert(`Aadhar Number Validation Error:\n\n"${val}" is invalid!\nReason: ${validation.reason}`);
          return;
        }
      } else if (item.type === 'Epic') {
        const validation = validateEpic(val);
        if (!validation.isValid) {
          alert(`Epic / Voter ID Validation Error:\n\n"${val}" is invalid!\nReason: ${validation.reason}`);
          return;
        }
      } else if (item.type === 'CIN') {
        const validation = validateCIN(val);
        if (!validation.isValid) {
          alert(`CIN Validation Error:\n\n"${val}" is invalid!\nReason: ${validation.reason}`);
          return;
        }
      }
    }

    if (editingLeadId) {
      if (!appointmentStatus || appointmentStatus === 'Select an option') {
        alert('Please select a Disposition in the Disposition & Remarks section before saving.');
        const selectElem = document.getElementById('disposition-select') || document.getElementById('disposition-section');
        if (selectElem) {
          selectElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if ('focus' in selectElem) (selectElem as HTMLElement).focus();
        }
        return;
      }
      if (!appointmentRemarks || !appointmentRemarks.trim()) {
        alert('Please enter Remarks in the Disposition & Remarks section.');
        const remarksElem = document.getElementById('disposition-remarks') || document.getElementById('disposition-section');
        if (remarksElem) {
          remarksElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if ('focus' in remarksElem) (remarksElem as HTMLElement).focus();
        }
        return;
      }
      if (appointmentStatus === 'Appointment Fixed') {
        if (!assignedBDM) {
          alert('Please select an Assigned BDM for the appointment.');
          const bdmElem = document.getElementById('disposition-bdm') || document.getElementById('disposition-section');
          if (bdmElem) {
            bdmElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if ('focus' in bdmElem) (bdmElem as HTMLElement).focus();
          }
          return;
        }
        if (!appointmentDate) {
          alert('Please select an Appointment Date.');
          const dateElem = document.getElementById('disposition-date') || document.getElementById('disposition-section');
          if (dateElem) {
            dateElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if ('focus' in dateElem) (dateElem as HTMLElement).focus();
          }
          return;
        }
      }
      if (isMarketingUser()) {
        if (!formData.shopFrontImage) {
          alert('Shop Front Image is mandatory for Marketing/BDM users.');
          return;
        }
        if (!formData.serviceImages || formData.serviceImages.length === 0 || formData.serviceImages.every((img: string) => !img)) {
          alert('At least one Service Image is mandatory for Marketing/BDM users.');
          return;
        }
      }
    }

    try {
      let savedLeadId = editingLeadId;
      if (editingLeadId) {
        let updatePayload: any = { ...formData };
        if (appointmentStatus && appointmentStatus !== 'Select an option') {
          const currentLead = leads.find(l => l._id === editingLeadId);
          let updatedHistory = [...(currentLead?.appointmentHistory || [])];

          const newEntry: any = {
            status: appointmentStatus,
            remarks: appointmentRemarks,
            changedBy: isEditingAppointment && updatedHistory.length > 0
              ? updatedHistory[0].changedBy
              : `${loggedInName} [${loggedInUser.role?.name || 'User'}]`,
            changedAt: new Date().toISOString(),
            appointmentDate: (appointmentStatus === 'Appointment Fixed' || appointmentStatus === 'Call Back / Reschedule' || appointmentStatus === 'Meeting Rescheduled') && appointmentDate
              ? new Date(`${appointmentDate}T${appointmentTime || '10:00'}`).toISOString()
              : null
          };

          if (isEditingAppointment && updatedHistory.length > 0) {
            updatedHistory[0] = {
              ...updatedHistory[0],
              status: appointmentStatus,
              remarks: appointmentRemarks,
              appointmentDate: newEntry.appointmentDate,
              changedAt: newEntry.changedAt
            };
          } else {
            updatedHistory = [newEntry, ...updatedHistory];
          }

          updatePayload.appointmentHistory = updatedHistory;
          updatePayload.stage = appointmentStatus;

          if (appointmentStatus === 'Appointment Fixed') {
            updatePayload.assignedSales = assignedBDM;
            if (appointmentAddress) updatePayload.address = appointmentAddress;
            if (appointmentPhone) updatePayload.phone = appointmentPhone;
          }
        }

        await axios.put(`/api/leads/${editingLeadId}`, updatePayload);
        alert('Lead updated successfully!');
      } else {
        const res = await axios.post('/api/leads', formData);
        alert('Lead added successfully!');
        if (res.data && res.data.data && res.data.data._id) {
          savedLeadId = res.data.data._id;
        }
      }
      setShowModal(false);
      setEditingLeadId(null);
      setIsEditingAppointment(false);
      setAppointmentStatus('Select an option');
      setAppointmentRemarks('');
      setAppointmentDate('');
      setAppointmentTime('10:00');
      setKycItems([{ type: 'GST', number: '', verified: false }]);

      setFormData({
        clientType: '', location: '', businessName: '', contactPerson: '', phone: '',
        alternatePhone: '', address: '', dataSource: '', email: '', website: '', dataFeedBy: loggedInName, remarks: '',
        assignedTelecaller: '', assignedSales: '', stage: 'Data', referralName: '',
        businessCategory: '', businessSubCategory: '', businessHoursType: '', openingTime: '', closingTime: '',
        businessStartTime: '', businessEndTime: '',
        yearOfEstablishment: '', socialMedia: '', kycGst: '', isGstVerified: false,
        businessLogo: '', shopFrontImage: '', serviceImages: []
      });
      setShowAddCatInput(false);
      setShowAddSubcatInput(false);
      
      if (isSaveAndNext && savedLeadId) {
        navigate(`/dashboard/packages?tab=builder&leadId=${savedLeadId}`);
      } else {
        fetchLeads();
      }
    } catch (err: any) {
      if (err.response?.data?.duplicate) {
        setDuplicateLeadError(err.response.data);
      } else {
        alert(err.response?.data?.message || 'Error saving lead');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await axios.delete(`/api/leads/${id}`);
      alert('Lead deleted successfully!');
      fetchLeads();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deleting lead');
    }
  };

  const handleInfoClick = (lead: any) => {
    setSelectedLeadForInfo(lead);
    setShowInfoModal(true);
  };

  const handleEditClick = (lead: any) => {
    if (!canViewEditPage) {
      alert('You are not authorized to view or edit this lead.');
      return;
    }
    setEditingLeadId(lead._id);
    setSelectedLeadForAppointment(lead);
    setKycItems(parseKycString(lead.kycGst || '', lead.isGstVerified));
    setAppointmentStatus('Select an option');
    setAppointmentRemarks('');
    setAppointmentDate('');
    setAppointmentTime('10:00');
    setAssignedBDM(lead.assignedSales?._id || lead.assignedSales || '');
    setAppointmentAddress(lead.address || '');
    setAppointmentPhone(lead.phone || '');
    setIsEditingAppointment(false);
    setShowAddCatInput(false);
    setShowAddSubcatInput(false);
    setFormData({
      clientType: lead.clientType || '',
      location: lead.location || '',
      businessName: lead.businessName || '',
      contactPerson: lead.contactPerson || '',
      phone: lead.phone || '',
      alternatePhone: lead.alternatePhone || '',
      address: lead.address || '',
      dataSource: lead.dataSource || '',
      email: lead.email || '',
      website: lead.website || '',
      dataFeedBy: lead.dataFeedBy || loggedInName,
      remarks: lead.remarks || '',
      assignedTelecaller: lead.assignedTelecaller?._id || lead.assignedTelecaller || '',
      assignedSales: lead.assignedSales?._id || lead.assignedSales || '',
      stage: lead.stage || 'Data',
      referralName: lead.referralName || '',
      businessCategory: lead.businessCategory || '',
      businessSubCategory: lead.businessSubCategory || '',
      businessHoursType: lead.businessHoursType || '',
      openingTime: lead.openingTime || '',
      closingTime: lead.closingTime || '',
      businessStartTime: lead.businessStartTime || '',
      businessEndTime: lead.businessEndTime || '',
      yearOfEstablishment: lead.yearOfEstablishment || '',
      socialMedia: lead.socialMedia || '',
      kycGst: lead.kycGst || '',
      isGstVerified: lead.isGstVerified || false,
      businessLogo: lead.businessLogo || '',
      shopFrontImage: lead.shopFrontImage || '',
      serviceImages: (() => {
        const imgs = [...(lead.serviceImages || [])];
        while (imgs.length < 3) {
          imgs.push('');
        }
        return imgs;
      })()
    });
  };


  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appointmentStatus === 'Select an option' || !appointmentStatus) {
      alert('Please select a Disposition.');
      return;
    }

    const currentLeadId = editingLeadId || selectedLeadForAppointment?._id;
    if (!currentLeadId) return;

    const currentLead = leads.find(l => l._id === currentLeadId);
    if (!currentLead) return;

    if (['Deal Close', 'Deal Close With Full Payment', 'Deal Close With Partial Payment'].includes(appointmentStatus)) {
      setConvertLeadId(currentLeadId);
      setConvertStartDate('');
      setConvertEndDate('');
      setConvertAccountManager(currentLead.assignedSales?._id || currentLead.assignedSales || '');
      setSelectedPkgId('');
      setConvertPrice(0);
      setConvertGstAmount(0);
      setConvertTotal(0);
      setConvertPaidAmount(0);
      setConvertBillingCycle('Monthly');
      setShowLeadConvertModal(true);
      return;
    }

    try {
      const loggedInRole = loggedInUser.role?.name || 'User';

      let updatedHistory = [...(currentLead.appointmentHistory || [])];

      const newEntry: any = {
        status: appointmentStatus,
        remarks: appointmentRemarks,
        changedBy: isEditingAppointment && updatedHistory.length > 0
          ? updatedHistory[0].changedBy
          : `${loggedInName} [${loggedInRole}]`,
        changedAt: new Date().toISOString(),
        appointmentDate: (appointmentStatus === 'Appointment Fixed' || appointmentStatus === 'Call Back / Reschedule' || appointmentStatus === 'Meeting Rescheduled') && appointmentDate
          ? new Date(`${appointmentDate}T${appointmentTime || '10:00'}`).toISOString()
          : null
      };

      if (isEditingAppointment && updatedHistory.length > 0) {
        // Edit the latest history entry
        updatedHistory[0] = {
          ...updatedHistory[0],
          status: appointmentStatus,
          remarks: appointmentRemarks,
          appointmentDate: newEntry.appointmentDate,
          changedAt: newEntry.changedAt
        };
      } else {
        // Add new history entry
        updatedHistory = [newEntry, ...updatedHistory];
      }

      const payload: any = {
        appointmentHistory: updatedHistory,
        stage: appointmentStatus
      };

      if (appointmentStatus === 'Appointment Fixed') {
        if (!assignedBDM) {
          alert('Please select an Assigned BDM.');
          return;
        }
        payload.assignedSales = assignedBDM;
        payload.address = appointmentAddress;
        payload.phone = appointmentPhone;
      }

      await axios.put(`/api/leads/${currentLeadId}`, payload);

      alert(isEditingAppointment ? 'Appointment details updated successfully!' : 'Disposition updated successfully!');
      setIsEditingAppointment(false);
      setAppointmentStatus('Select an option');
      setAppointmentRemarks('');
      setAppointmentDate('');
      setAppointmentTime('10:00');
      fetchLeads();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error updating disposition');
    }
  };

  const handleAddCategorySubmit = async () => {
    if (!newCatName.trim()) return;
    try {
      const res = await axios.post('/api/business-categories', { name: newCatName.trim() });
      alert('Category added successfully!');
      setNewCatName('');
      setShowAddCatInput(false);
      await fetchCategories();
      setFormData(prev => ({
        ...prev,
        businessCategory: res.data.data.name,
        businessSubCategory: ''
      }));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error adding category');
    }
  };

  const handleAddSubcategorySubmit = async () => {
    if (!newSubcatName.trim()) return;
    const selectedCatObj = categories.find(cat => cat.name === formData.businessCategory);
    if (!selectedCatObj) {
      alert('Please select a Category first.');
      return;
    }
    try {
      await axios.post(`/api/business-categories/${selectedCatObj._id}/subcategories`, {
        subcategoryName: newSubcatName.trim()
      });
      alert('Subcategory added successfully!');
      setNewSubcatName('');
      setShowAddSubcatInput(false);
      await fetchCategories();
      setFormData(prev => ({
        ...prev,
        businessSubCategory: newSubcatName.trim()
      }));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error adding subcategory');
    }
  };

  const handleAddLeadClick = () => {
    setEditingLeadId(null);
    setShowAddCatInput(false);
    setShowAddSubcatInput(false);
    setKycItems([{ type: 'GST', number: '', verified: false }]);
    setFormData({
      clientType: '',
      location: '',
      businessName: '',
      contactPerson: '',
      phone: '',
      alternatePhone: '',
      address: '',
      dataSource: '',
      email: '',
      website: '',
      dataFeedBy: loggedInName,
      remarks: '',
      assignedTelecaller: '',
      assignedSales: '',
      stage: 'Data',
      referralName: '',
      businessCategory: '',
      businessSubCategory: '',
      businessHoursType: '',
      openingTime: '',
      closingTime: '',
      businessStartTime: '',
      businessEndTime: '',
      yearOfEstablishment: '',
      socialMedia: '',
      kycGst: '',
      isGstVerified: false,
      businessLogo: '',
      shopFrontImage: '',
      serviceImages: []
    });
    setDuplicateLeadError(null);
    setShowModal(true);
  };

  const downloadSampleTemplate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const headers = [
      'Client Type *',
      'Location *',
      'Business Name *',
      'Contact Person Name *',
      'Contact Number *',
      'Alternate Contact Number',
      'Address',
      'City',
      'State',
      'Data Source *',
      'Referral Name (Required if Referral)',
      'Email Address *',
      'Website',
      'Business Category',
      'Business Sub Category',
      'Business Hours Type',
      'Opening Time',
      'Closing Time',
      'Business Start Time',
      'Business End Time',
      'Year of Establishment',
      'Social Media URL',
      'KYC / GST Number',
      'TME Name / Employee ID',
      'BDM Name / Employee ID',
      'Remarks'
    ];

    const sampleRows = [
      [
        'New Prospect',
        'Kolkata',
        'Acme Corporation',
        'John Doe',
        '9876543210',
        '9876543211',
        '123 Business Boulevard, Sector V',
        'Kolkata',
        'West Bengal',
        'Google',
        '',
        'contact@acmecorp.com',
        'https://acmecorp.com',
        'IT Services',
        'Software Development',
        'Monday - Friday',
        '09:30 AM',
        '06:30 PM',
        '10:00 AM',
        '06:00 PM',
        '2018',
        'https://linkedin.com/company/acmecorp',
        '19AAAAA0000A1Z1',
        'Jane TME Name',
        'John BDM Name',
        'Prospect is interested in premium plan.'
      ]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    
    // Instructions / Validation Guidance worksheet
    const guidanceHeaders = ['Field Name', 'Mandatory?', 'Accepted Formats / Example', 'Validation Rules & Notes'];
    const guidanceRows = [
      ['Client Type *', 'YES', 'New Prospect, Renewal Client', 'Must match one of the accepted values exactly.'],
      ['Location *', 'YES', 'e.g. Kolkata, Bhubaneswar, Delhi, etc.', 'Must match an active location registered in the system.'],
      ['Business Name *', 'YES', 'Text', 'Name of the prospect company.'],
      ['Contact Person Name *', 'YES', 'Text', 'First and last name of the key contact person.'],
      ['Contact Number *', 'YES', '10-digit mobile/phone number', 'Must be unique. Leads with duplicate phone numbers will fail to import.'],
      ['Alternate Contact Number', 'NO', 'Number', 'Optional secondary contact number.'],
      ['Address', 'NO', 'Text', 'Street address of the company.'],
      ['City', 'NO', 'Text', 'City name.'],
      ['State', 'NO', 'Text', 'State name.'],
      ['Data Source *', 'YES', 'Justdial, Google, Facebook, Referral, Manual', 'Must match one of the standard sources exactly.'],
      ['Referral Name', 'YES (if Referral)', 'Text', 'Required only when Data Source is "Referral". Otherwise, leave blank.'],
      ['Email Address *', 'YES', 'Email format (e.g. name@domain.com)', 'Required. Must be unique. Leads with duplicate email addresses will fail to import.'],
      ['Website', 'NO', 'URL (e.g. https://domain.com)', 'Optional website link.'],
      ['Business Category', 'NO', 'Text', 'Optional business category.'],
      ['Business Sub Category', 'NO', 'Text', 'Optional subcategory.'],
      ['Business Hours Type', 'NO', 'Monday - Friday, Monday - Saturday, 24x7', 'Optional operational hours pattern.'],
      ['Opening Time', 'NO', 'Time format (e.g. 09:30 AM)', 'Optional opening hour.'],
      ['Closing Time', 'NO', 'Time format (e.g. 06:30 PM)', 'Optional closing hour.'],
      ['Business Start Time', 'NO', 'Time format (e.g. 10:00 AM)', 'Optional start of business hour.'],
      ['Business End Time', 'NO', 'Time format (e.g. 06:00 PM)', 'Optional end of business hour.'],
      ['Year of Establishment', 'NO', 'Year format (e.g. 2018)', 'Optional year.'],
      ['Social Media URL', 'NO', 'URL link', 'Optional social media profile link.'],
      ['KYC / GST Number', 'NO', 'Text', 'Optional GSTIN or registration ID.'],
      ['TME Name / Employee ID', 'NO', 'e.g. Jane TME Name or EMP045', 'Matches an active TME user by name or employee ID to automatically assign the lead.'],
      ['BDM Name / Employee ID', 'NO', 'e.g. John BDM Name or EMP012', 'Matches an active BDM user by name or employee ID to automatically assign the lead.'],
      ['Remarks', 'NO', 'Text', 'Optional remarks or initial comments.']
    ];

    const guidanceWorksheet = XLSX.utils.aoa_to_sheet([guidanceHeaders, ...guidanceRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Template');
    XLSX.utils.book_append_sheet(workbook, guidanceWorksheet, 'Validation Guidance');
    XLSX.writeFile(workbook, 'sample_leads_template.xlsx');
  };

  const downloadErrorReport = () => {
    if (!bulkUploadResult || !bulkUploadResult.failedRecords || bulkUploadResult.failedRecords.length === 0) return;
    
    const headers = ['Row Number', 'Business Name', 'Status', 'Error / Reason'];
    const rows = bulkUploadResult.failedRecords.map((rec: any) => [
      rec.row,
      rec.businessName,
      rec.status || 'Failed',
      rec.error
    ]);
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Error Report');
    XLSX.writeFile(workbook, 'bulk_import_error_report.xlsx');
  };

  const closeBulkModal = () => {
    setShowBulkModal(false);
    setBulkUploadResult(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (rows.length <= 1) {
          throw new Error('The uploaded file is empty or missing data rows.');
        }

        const dataRows = rows.slice(1);

        // Map columns to our schema by index to support flexible header names
        const mappedData = dataRows.map((row: any) => ({
          clientType: row[0] || 'New Prospect',
          location: row[1] || 'Other',
          businessName: row[2] || '',
          contactPerson: row[3] || '',
          phone: row[4] || '',
          alternatePhone: row[5] || '',
          address: row[6] || '',
          city: row[7] || '',
          state: row[8] || '',
          dataSource: row[9] || 'Bulk Upload',
          referralName: row[10] || '',
          email: row[11] || '',
          website: row[12] || '',
          businessCategory: row[13] || '',
          businessSubCategory: row[14] || '',
          businessHoursType: row[15] || '',
          openingTime: row[16] || '',
          closingTime: row[17] || '',
          businessStartTime: row[18] || '',
          businessEndTime: row[19] || '',
          yearOfEstablishment: row[20] || '',
          socialMedia: row[21] || '',
          kycGst: row[22] || '',
          tmeValue: row[23] || '',
          bdmValue: row[24] || '',
          remarks: row[25] || ''
        })).filter((lead: any) => lead.businessName || lead.phone); // Filter empty rows

        setIsUploading(true);
        setBulkUploadResult(null);
        const res = await axios.post('/api/leads/bulk', { leads: mappedData });
        setBulkUploadResult(res.data);
        fetchLeads();
      } catch (err: any) {
        alert(err.response?.data?.message || err.message || 'Error uploading file');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'businessLogo' | 'shopFrontImage' | number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);
    
    const uploadKey = typeof fieldName === 'number' ? `service-${fieldName}` : fieldName;
    setUploadingImage(uploadKey);
    try {
      const res = await axios.post('/api/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = res.data.fileUrl;

      if (typeof fieldName === 'number') {
        setFormData((prev: any) => {
          const updatedImages = [...prev.serviceImages];
          updatedImages[fieldName] = fileUrl;
          return { ...prev, serviceImages: updatedImages };
        });
      } else {
        setFormData((prev: any) => ({ ...prev, [fieldName]: fileUrl }));
      }
      alert('Image uploaded successfully');
    } catch (err) {
      alert('Error uploading image');
    } finally {
      setUploadingImage(null);
    }
  };

  const filteredLeads = leads.filter(lead => {
    // Role-based visibility logic removed: lead listing is now uniform for all roles

    // 1. Global search (existing search field)
    if (search) {
      const s = search.toLowerCase();
      const matchSearch = 
        lead.businessName?.toLowerCase().includes(s) ||
        lead.email?.toLowerCase().includes(s) ||
        lead.phone?.toLowerCase().includes(s);
      if (!matchSearch) return false;
    }

    // 2. Filter with Data ID
    if (filterDataId) {
      const matchDataId = lead.dataId?.toLowerCase().includes(filterDataId.toLowerCase());
      if (!matchDataId) return false;
    }

    // 3. Filter with Business Name
    if (filterBusinessName) {
      const matchBizName = lead.businessName?.toLowerCase().includes(filterBusinessName.toLowerCase());
      if (!matchBizName) return false;
    }

    // 4. Filter with Location
    if (filterLocation) {
      const matchLoc = lead.location === filterLocation;
      if (!matchLoc) return false;
    }

    // 5. Filter with TME
    if (filterTme) {
      const leadTmeId = lead.assignedTelecaller?._id || lead.assignedTelecaller;
      const tmeUser = users.find(u => String(u._id) === String(filterTme));
      const tmeName = tmeUser ? tmeUser.name : '';
      const isMatchTme = (leadTmeId && String(leadTmeId) === String(filterTme)) || 
                         (!leadTmeId && tmeName && lead.dataFeedBy === tmeName);
      if (!isMatchTme) return false;
    }

    // 6. Filter with Meeting Date
    if (filterMeetingDate) {
      const appt = lead.appointmentHistory?.[0];
      if (!appt || !appt.appointmentDate) return false;
      const apptDateStr = new Date(appt.appointmentDate).toISOString().slice(0, 10);
      if (apptDateStr !== filterMeetingDate) return false;
    }

    // 7. Filter with Current Status
    if (filterCurrentStatus) {
      const matchStatus = (lead.stage || 'Data') === filterCurrentStatus;
      if (!matchStatus) return false;
    }

    // 8. Filter with Type
    if (filterType) {
      const matchType = lead.clientType === filterType;
      if (!matchType) return false;
    }


    return true;
  });

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const displayedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [filteredLeads.length, totalPages, currentPage]);



  return (
    <div>
      {editingLeadId ? (
        <div className="edit-lead-page" style={{ background: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>
              Edit Lead: <span style={{ color: '#2563eb' }}>{formData.businessName || 'Lead Details'}</span>
            </h2>
            <button 
              className="btn-secondary" 
              onClick={() => {
                setEditingLeadId(null);
              }}
              style={{ padding: '8px 16px' }}
            >
              Back to Leads
            </button>
          </div>

          {/* Top Section: Disposition Update & Status Box */}
          <div id="disposition-section" style={{ background: '#f8fafc', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} color="#7c3aed" /> Disposition & Remarks
            </h3>
            
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              {/* Disposition update form */}
              <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <form onSubmit={handleAppointmentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {isEditingAppointment && (
                    <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#b45309', padding: '10px 15px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>✏️ Editing Latest Appointment Details</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsEditingAppointment(false);
                          setAppointmentStatus('Select an option');
                          setAppointmentRemarks('');
                          setAppointmentDate('');
                          setAppointmentTime('10:00');
                          setAssignedBDM(leadObj?.assignedSales?._id || leadObj?.assignedSales || '');
                          setAppointmentAddress(leadObj?.address || '');
                          setAppointmentPhone(leadObj?.phone || '');
                        }}
                        style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Disposition *</label>
                    <select 
                      id="disposition-select"
                      className="input-field" 
                      value={appointmentStatus} 
                      onChange={e => {
                        const val = e.target.value;
                        setAppointmentStatus(val);
                        if (val === 'Appointment Fixed') {
                          if (leadObj) {
                            setAppointmentAddress(leadObj.address || '');
                            setAppointmentPhone(leadObj.phone || '');
                          }
                          if ((isMarketing || isSales) && !isEditingAppointment) {
                            setAssignedBDM(loggedInUserId);
                          }
                        }
                      }} 
                      required
                    >
                      <option value="Select an option">Select an option</option>
                      <option value="Another Visit Required">Another Visit Required</option>
                      <option value="Appointment Fixed">Appointment Fixed</option>
                      <option value="Bounced Collection">Bounced Collection</option>
                      <option value="Budget Constraints">Budget Constraints</option>
                      <option value="Decision Pending">Decision Pending</option>
                      <option value="Details Incorrect">Details Incorrect</option>
                      <option value="Do Not Disturb">Do Not Disturb</option>
                      <option value="Fake Appointmen">Fake Appointmen</option>
                      <option value="Future Interest Expressed">Future Interest Expressed</option>
                      <option value="Meeting Cancelled - By MM">Meeting Cancelled - By MM</option>
                      <option value="Meeting Cancelled - By Prospect">Meeting Cancelled - By Prospect</option>
                      <option value="Meeting Conducted - Not Interested">Meeting Conducted - Not Interested</option>
                      <option value="Meeting Rescheduled">Meeting Rescheduled</option>
                      <option value="MM Follow-up Required">MM Follow-up Required</option>
                      <option value="Not Available">Not Available</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Not Visited">Not Visited</option>
                      <option value="Positive Response">Positive Response</option>
                      <option value="Prospect Unavailable">Prospect Unavailable</option>
                      <option value="Referred to Another Decision Maker">Referred to Another Decision Maker</option>
                      <option value="TME Follow-up Required">TME Follow-up Required</option>
                      <option value="Deal Close">Deal Close</option>
                    </select>
                  </div>

                  {appointmentStatus === 'Appointment Fixed' && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Assigned BDM *</label>
                      <select 
                        id="disposition-bdm"
                        className="input-field" 
                        value={assignedBDM} 
                        onChange={e => setAssignedBDM(e.target.value)} 
                        disabled={(isMarketing || isSales) && !isEditingAppointment}
                        required
                      >
                        {(isMarketing || isSales) && !isEditingAppointment ? (
                          <option value={loggedInUserId}>{loggedInName} ({loggedInUser.role?.name || 'N/A'})</option>
                        ) : (
                          <>
                            <option value="">Select BDM</option>
                            {users
                              .filter(u => {
                                const rName = u.role?.name?.toLowerCase() || '';
                                return rName.includes('admin') || 
                                       rName.includes('super admin') || 
                                       rName.includes('marketing head') || 
                                       rName.includes('marketing manager') || 
                                       rName.includes('marketing executive') ||
                                       rName.includes('marketinghead') || 
                                       rName.includes('marketingmanager') || 
                                       rName.includes('marketingexecutive');
                              })
                              .map(u => (
                                <option key={u._id} value={u._id}>{u.name} ({u.role?.name || 'N/A'})</option>
                              ))
                            }
                          </>
                        )}
                      </select>
                    </div>
                  )}

                  {(appointmentStatus === 'Appointment Fixed' || appointmentStatus === 'Call Back / Reschedule' || appointmentStatus === 'Meeting Rescheduled') && (
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <div className="form-group" style={{ margin: 0, flex: 1 }}>
                        <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Appointment Date *</label>
                        <input 
                          id="disposition-date"
                          type="date" 
                          className="input-field" 
                          value={appointmentDate} 
                          onChange={e => setAppointmentDate(e.target.value)} 
                          required 
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, flex: 1 }}>
                        <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Appointment Time *</label>
                        <select 
                          className="input-field" 
                          value={appointmentTime} 
                          onChange={e => setAppointmentTime(e.target.value)} 
                          required 
                        >
                          {TIME_SLOTS.map(slot => (
                            <option key={slot.value} value={slot.value}>{slot.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {appointmentStatus === 'Appointment Fixed' && (
                    <>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Appointment Address *</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="Meeting Address" 
                          value={appointmentAddress} 
                          onChange={e => setAppointmentAddress(e.target.value)} 
                          required 
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Appointment Contact Phone *</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="Contact Phone" 
                          value={appointmentPhone} 
                          onChange={e => setAppointmentPhone(e.target.value)} 
                          required 
                        />
                      </div>
                    </>
                  )}

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Remarks *</label>
                    <textarea 
                      id="disposition-remarks"
                      className="input-field" 
                      placeholder="Remarks" 
                      rows={3} 
                      style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} 
                      value={appointmentRemarks} 
                      onChange={e => setAppointmentRemarks(e.target.value)} 
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', width: 'fit-content' }}
                  >
                    {isEditingAppointment ? 'Save Appointment Changes' : 'Update Disposition'}
                  </button>
                </form>
              </div>

              {/* Latest Status & History timeline (Right column) */}
              <div style={{ flex: '1.2', minWidth: '350px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {(() => {
                  if (leadObj && leadObj.appointmentHistory && leadObj.appointmentHistory.length > 0) {
                    const latest = leadObj.appointmentHistory[0];

                    const isProfileOwner = 
                      (leadObj.assignedTelecaller?._id === loggedInUser.id || leadObj.assignedTelecaller === loggedInUser.id || leadObj.assignedTelecaller?._id === loggedInUser._id || leadObj.assignedTelecaller === loggedInUser._id) ||
                      (leadObj.assignedSales?._id === loggedInUser.id || leadObj.assignedSales === loggedInUser.id || leadObj.assignedSales?._id === loggedInUser._id || leadObj.assignedSales === loggedInUser._id) ||
                      (leadObj.dataFeedBy === loggedInUser.name);

                    const roleNameLower = (loggedInUser.role?.name || '').toLowerCase();
                    const isPrivileged = roleNameLower.includes('admin') || roleNameLower.includes('manager') || roleNameLower.includes('head');

                    const canSeeAllHistory = isProfileOwner || isPrivileged || roleNameLower.includes('marketing') || roleNameLower.includes('sales') || roleNameLower.includes('executive');

                    return (
                      <>
                        <div style={{ background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>Created By & Date:</div>
                              <div style={{ fontSize: '12.5px', fontWeight: 500, color: '#0369a1', marginTop: '2px' }}>
                                {latest.changedBy} / {new Date(latest.changedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {latest.status === 'Appointment Fixed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingAppointment(true);
                                    setAppointmentStatus('Appointment Fixed');
                                    if (latest.appointmentDate) {
                                      const d = new Date(latest.appointmentDate);
                                      const year = d.getFullYear();
                                      const month = String(d.getMonth() + 1).padStart(2, '0');
                                      const day = String(d.getDate()).padStart(2, '0');
                                      setAppointmentDate(`${year}-${month}-${day}`);
                                      
                                      const minutesVal = d.getMinutes();
                                      let roundedMinutes = 0;
                                      let roundedHours = d.getHours();
                                      if (minutesVal >= 45) {
                                        roundedMinutes = 0;
                                        roundedHours = (roundedHours + 1) % 24;
                                      } else if (minutesVal >= 15) {
                                        roundedMinutes = 30;
                                      } else {
                                        roundedMinutes = 0;
                                      }
                                      const hours = String(roundedHours).padStart(2, '0');
                                      const minutes = String(roundedMinutes).padStart(2, '0');
                                      setAppointmentTime(`${hours}:${minutes}`);
                                    } else {
                                      setAppointmentDate('');
                                      setAppointmentTime('10:00');
                                    }
                                    setAssignedBDM(leadObj.assignedSales?._id || leadObj.assignedSales || '');
                                    setAppointmentRemarks(latest.remarks || '');
                                    setAppointmentAddress(leadObj.address || '');
                                    setAppointmentPhone(leadObj.phone || '');
                                  }}
                                  className="btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '11px', height: 'auto', background: '#fff', border: '1px solid #bae6fd', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                >
                                  ✏️ Edit Appt
                                </button>
                              )}
                              <span className={`badge ${getStatusBadgeClass(latest.status)}`}>
                                {formatStatusDisplay(latest.status)}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '10px', borderTop: '1px solid #bae6fd', paddingTop: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#0284c7' }}>Call Status</div>
                              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{formatStatusDisplay(latest.status)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#0284c7' }}>Assigned BDM</div>
                              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                                {leadObj.assignedSales?.name || 'N/A'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#0284c7' }}>Appt Date & Time</div>
                              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                                {latest.appointmentDate 
                                  ? new Date(latest.appointmentDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                                  : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#0284c7' }}>Address</div>
                              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a', marginTop: '2px', lineHeight: '1.3' }}>
                                {leadObj.address || 'N/A'}
                              </div>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid #bae6fd', paddingTop: '10px' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#0284c7' }}>Remarks</div>
                            <div style={{ fontSize: '12px', color: '#0f172a', marginTop: '3px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                              {latest.remarks}
                            </div>
                          </div>
                        </div>

                        {/* Previous History */}
                        {canSeeAllHistory && leadObj.appointmentHistory.length > 1 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', margin: '5px 0 0 0' }}>Previous Appointment History</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '5px' }}>
                              {leadObj.appointmentHistory.slice(1).map((item: any, idx: number) => (
                                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                                    <span style={{ fontWeight: 600 }}>{item.changedBy}</span>
                                    <span>{new Date(item.changedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className={`badge ${getStatusBadgeClass(item.status)}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                                      {formatStatusDisplay(item.status)}
                                    </span>
                                    {item.appointmentDate && (
                                      <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 500 }}>
                                        Appt: {new Date(item.appointmentDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#334155', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                                    "{item.remarks}"
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  } else {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#94a3b8', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '30px', textAlign: 'center', height: '100%' }}>
                        <Calendar size={36} color="#cbd5e1" />
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>No appointment history has been recorded yet.</p>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          </div>

          {/* Bottom Section: Lead Fields Edit Form */}
          {true && (
            <form onSubmit={handleManualSubmit} style={{ borderTop: '2px solid #f1f5f9', paddingTop: '30px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
              Lead Information
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Client Type *</label>
                <select className="input-field" value={formData.clientType} onChange={e => setFormData({...formData, clientType: e.target.value})} required>
                  <option value="">Select an option</option>
                  <option value="New Prospect">New Prospect</option>
                  <option value="Renewal Client">Renewal Client</option>
                </select>
              </div>
              <div className="form-group">
                <label>Location *</label>
                <select className="input-field" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required>
                  <option value="">Select an option</option>
                  {locations.filter((loc: any) => loc.status === 'Active').map((loc: any) => (
                    <option key={loc._id} value={loc.name}>{loc.name}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Business Name *</label>
                <input type="text" className="input-field" placeholder="Business Name" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Contact Person *</label>
                <input type="text" className="input-field" placeholder="Contact Person" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Contact Number *</label>
                <input type="text" className="input-field" placeholder="Contact Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Alternate Contact Number</label>
                <input type="text" className="input-field" placeholder="Alternate Contact Number" value={formData.alternatePhone} onChange={e => setFormData({...formData, alternatePhone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input type="text" className="input-field" placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Data Source *</label>
                <select className="input-field" value={formData.dataSource} onChange={e => setFormData({...formData, dataSource: e.target.value})} required>
                  <option value="">Select an option</option>
                  <option value="Justdial">Justdial</option>
                  <option value="Google">Google</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Referral">Referral</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              {formData.dataSource === 'Referral' && (
                <div className="form-group">
                  <label>Referral Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Referral Name" 
                    value={formData.referralName || ''} 
                    onChange={e => setFormData({...formData, referralName: e.target.value})} 
                    required 
                  />
                </div>
              )}
              <div className="form-group">
                <label>Email <span style={{color: '#ef4444'}}>*</span></label>
                <input type="email" className="input-field" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input type="text" className="input-field" placeholder="Website" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label>Business Category</label>
                <select 
                  className="input-field" 
                  value={formData.businessCategory} 
                  onChange={e => {
                    setFormData({
                      ...formData, 
                      businessCategory: e.target.value,
                      businessSubCategory: ''
                    });
                  }}
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <div style={{ marginTop: '2px' }}>
                  {!showAddCatInput ? (
                    <button 
                      type="button" 
                      onClick={() => setShowAddCatInput(true)} 
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Plus size={12} style={{ display: 'inline' }} /> Add option
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '5px' }}>
                      <input 
                        type="text" 
                        placeholder="New category name" 
                        value={newCatName} 
                        onChange={e => setNewCatName(e.target.value)} 
                        className="input-field"
                        style={{ padding: '4px 8px', fontSize: '12px', height: 'auto', margin: 0, flex: 1 }}
                      />
                      <button 
                        type="button" 
                        onClick={handleAddCategorySubmit} 
                        style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Add
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setShowAddCatInput(false); setNewCatName(''); }} 
                        style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label>Business Sub category</label>
                {formData.businessCategory ? (
                  <div style={{ 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '6px', 
                    padding: '10px', 
                    maxHeight: '150px', 
                    overflowY: 'auto', 
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {(() => {
                      const selectedCatObj = categories.find(cat => cat.name === formData.businessCategory);
                      const subcats = selectedCatObj ? selectedCatObj.subcategories : [];
                      if (subcats.length === 0) {
                        return <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No subcategories found.</div>;
                      }
                      
                      const selectedSubcats = formData.businessSubCategory ? formData.businessSubCategory.split(',').map((s: string) => s.trim()) : [];

                      return subcats.map((sub: string) => {
                        const isChecked = selectedSubcats.includes(sub);
                        return (
                          <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#334155', cursor: 'pointer', fontWeight: 500 }}>
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={() => {
                                let newSelected;
                                if (isChecked) {
                                  newSelected = selectedSubcats.filter((s: string) => s !== sub);
                                } else {
                                  newSelected = [...selectedSubcats, sub];
                                }
                                setFormData({
                                  ...formData,
                                  businessSubCategory: newSelected.filter(Boolean).join(', ')
                                });
                              }} 
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            {sub}
                          </label>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div style={{ 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '6px', 
                    padding: '12px', 
                    background: '#f8fafc', 
                    color: '#94a3b8', 
                    fontSize: '13px', 
                    fontStyle: 'italic',
                    textAlign: 'center'
                  }}>
                    Please select a category first
                  </div>
                )}
                <div style={{ marginTop: '2px' }}>
                  {!showAddSubcatInput ? (
                    <button 
                      type="button" 
                      onClick={() => {
                        if (!formData.businessCategory) {
                          alert('Please select a Category first to add a subcategory.');
                          return;
                        }
                        setShowAddSubcatInput(true);
                      }} 
                      style={{ background: 'none', border: 'none', color: formData.businessCategory ? '#2563eb' : '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: formData.businessCategory ? 'pointer' : 'not-allowed', padding: 0, display: 'flex', alignItems: 'center', gap: '3px' }}
                      disabled={!formData.businessCategory}
                    >
                      <Plus size={12} style={{ display: 'inline' }} /> Add option
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '5px' }}>
                      <input 
                        type="text" 
                        placeholder="New subcategory name" 
                        value={newSubcatName} 
                        onChange={e => setNewSubcatName(e.target.value)} 
                        className="input-field"
                        style={{ padding: '4px 8px', fontSize: '12px', height: 'auto', margin: 0, flex: 1 }}
                      />
                      <button 
                        type="button" 
                        onClick={handleAddSubcategorySubmit} 
                        style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Add
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setShowAddSubcatInput(false); setNewSubcatName(''); }} 
                        style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Business Hours Type</label>
                <select 
                  className="input-field" 
                  value={formData.businessHoursType} 
                  onChange={e => {
                    const val = e.target.value;
                    setFormData({
                      ...formData, 
                      businessHoursType: val,
                      openingTime: val === '24x7' ? '' : formData.openingTime,
                      closingTime: val === '24x7' ? '' : formData.closingTime
                    });
                  }}
                >
                  <option value="">Select Business Hours</option>
                  <option value="Monday - Friday">Monday - Friday</option>
                  <option value="Monday - Saturday">Monday - Saturday</option>
                  <option value="24x7">24x7</option>
                </select>
              </div>
              {(formData.businessHoursType === 'Monday - Friday' || formData.businessHoursType === 'Monday - Saturday') && (
                <>
                  <div className="form-group">
                    <label>Opening Time</label>
                    <select 
                      className="input-field" 
                      value={formData.openingTime} 
                      onChange={e => setFormData({...formData, openingTime: e.target.value})} 
                    >
                      <option value="">Select Opening Time</option>
                      {TIME_SLOTS.map(slot => (
                        <option key={slot.value} value={slot.value}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Closing Time</label>
                    <select 
                      className="input-field" 
                      value={formData.closingTime} 
                      onChange={e => setFormData({...formData, closingTime: e.target.value})} 
                    >
                      <option value="">Select Closing Time</option>
                      {TIME_SLOTS.map(slot => (
                        <option key={slot.value} value={slot.value}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}



              <div className="form-group">
                <label>Year of Establishment</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. 2015" 
                  value={formData.yearOfEstablishment} 
                  onChange={e => setFormData({...formData, yearOfEstablishment: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label>Social Media URL</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Facebook, LinkedIn, Instagram link, etc." 
                  value={formData.socialMedia} 
                  onChange={e => setFormData({...formData, socialMedia: e.target.value})} 
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>KYC / GST Numbers</span>
                  <button 
                    type="button" 
                    onClick={() => setKycItems([...kycItems, { type: 'GST', number: '' }])}
                    style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Add More
                  </button>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
                  {kycItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <select 
                        className="input-field" 
                        style={{ width: '120px', flexShrink: 0 }}
                        value={item.type}
                        onChange={e => {
                          const newItems = [...kycItems];
                          newItems[idx].type = e.target.value;
                          setKycItems(newItems);
                        }}
                      >
                        <option value="GST">GST</option>
                        <option value="PAN">PAN</option>
                        <option value="TIN">TIN</option>
                        <option value="Aadhar">Aadhar</option>
                        <option value="Epic">Epic</option>
                        <option value="CIN">CIN</option>
                      </select>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            className="input-field" 
                            placeholder={`Enter ${item.type} Number`}
                            value={item.number}
                            onChange={e => {
                              const newItems = [...kycItems];
                              newItems[idx].number = e.target.value;
                              newItems[idx].verified = false;
                              setKycItems(newItems);
                            }}
                            style={{ flex: 1 }}
                          />
                          {item.verified && (
                            <span 
                              style={{ 
                                color: '#10b981', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                backgroundColor: '#ecfdf5',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                border: '1px solid #10b981',
                                fontWeight: 'bold',
                                flexShrink: 0
                              }} 
                              title="Verified from Government Portal"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                        {item.number.trim() && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleKycVerification(idx)}
                              style={{ 
                                padding: '2px 8px', 
                                fontSize: '11px', 
                                backgroundColor: item.verified ? '#10b981' : '#f59e0b', 
                                color: '#fff', 
                                border: 'none', 
                                borderRadius: '4px', 
                                cursor: 'pointer', 
                                fontWeight: 600,
                                width: 'fit-content'
                              }}
                            >
                              {item.verified ? 'Verified (Recheck)' : 'Verify on Govt Portal'}
                            </button>
                            {!item.verified && (
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                {item.type === 'GST' && 'Format: 15-digit alphanumeric (e.g. 27AAAAA1111A1Z1)'}
                                {item.type === 'PAN' && 'Format: 10-digit alphanumeric (e.g. ABCDE1234F)'}
                                {item.type === 'TIN' && 'Format: 11-digit numeric'}
                                {item.type === 'Aadhar' && 'Format: 12-digit numeric'}
                                {item.type === 'Epic' && 'Format: 10-digit alphanumeric (e.g. ABC1234567)'}
                                {item.type === 'CIN' && 'Format: 21-digit alphanumeric'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {kycItems.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => setKycItems(kycItems.filter((_, i) => i !== idx))}
                          style={{ padding: '8px 12px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Data Feed By *</label>
                <select 
                  className="input-field" 
                  value={formData.dataFeedBy || loggedInName} 
                  onChange={e => setFormData({...formData, dataFeedBy: e.target.value})} 
                  required
                >
                  <option value={formData.dataFeedBy || loggedInName}>{formData.dataFeedBy || loggedInName}</option>
                </select>
              </div>
              <div className="form-group">
                <label>Assigned TME</label>
                <select className="input-field" value={formData.assignedTelecaller} onChange={e => setFormData({...formData, assignedTelecaller: e.target.value})}>
                  <option value="">Select TME</option>
                  {users
                    .filter(u => {
                      const rName = u.role?.name?.toLowerCase() || '';
                      return rName.includes('tele sales manager') || rName.includes('telemarketing') || rName.includes('tele marketing');
                    })
                    .map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role?.name || 'N/A'})</option>
                    ))
                  }
                </select>
              </div>
              <div className="form-group">
                <label>Assigned BDM</label>
                <select 
                  className="input-field" 
                  value={formData.assignedSales} 
                  onChange={e => setFormData({...formData, assignedSales: e.target.value})}
                >
                  <option value="">Select BDM</option>
                  {users
                    .filter(u => {
                      const rName = u.role?.name?.toLowerCase() || '';
                      return rName.includes('admin') || 
                             rName.includes('super admin') || 
                             rName.includes('marketing head') || 
                             rName.includes('marketing manager') || 
                             rName.includes('bdm') || 
                             rName.includes('sales');
                    })
                    .map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role?.name || 'N/A'})</option>
                    ))
                  }
                </select>
              </div>
              {/* Shop Front Image */}

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  Shop Front Image {isMarketingUser() && ' *'}
                </label>
                {formData.shopFrontImage && (
                  <div style={{ marginBottom: '10px' }}>
                    <img 
                      src={`${formData.shopFrontImage}`}
                      alt="Shop Front Preview" 
                      style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                    />
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => handleImageUpload(e, 'shopFrontImage')} 
                  disabled={uploadingImage === 'shopFrontImage'}
                />
                {uploadingImage === 'shopFrontImage' && <span style={{ fontSize: '12px', color: '#2563eb', marginLeft: '8px' }}>Uploading...</span>}
              </div>

              {/* Service Related Images */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '15px', fontSize: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>
                  Service Related Images {isMarketingUser() && ' * (At least 1 required)'}
                </label>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                  {(formData.serviceImages || []).map((imgUrl: string, idx: number) => {
                    const isRequiredField = idx < 3;
                    const label = isRequiredField ? `Service Image ${idx + 1}` : `Service Image ${idx + 1} (Additional)`;
                    
                    return (
                      <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
                        {!isRequiredField ? (
                          <button 
                            type="button" 
                            onClick={() => {
                              setFormData((prev: any) => {
                                const updated = [...prev.serviceImages];
                                updated.splice(idx, 1);
                                return { ...prev, serviceImages: updated };
                              });
                            }}
                            style={{ position: 'absolute', top: '8px', right: '8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', zIndex: 5 }}
                            title="Remove Image"
                          >
                            ×
                          </button>
                        ) : (
                          imgUrl && (
                            <button 
                              type="button" 
                              onClick={() => {
                                setFormData((prev: any) => {
                                  const updated = [...prev.serviceImages];
                                  updated[idx] = '';
                                  return { ...prev, serviceImages: updated };
                                });
                              }}
                              style={{ position: 'absolute', top: '8px', right: '8px', background: '#94a3b8', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', zIndex: 5 }}
                              title="Clear Image"
                            >
                              ×
                            </button>
                          )
                        )}

                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>
                          {label} {isMarketingUser() && idx === 0 && <span style={{ color: '#ef4444' }}>*</span>}
                        </div>

                        {imgUrl ? (
                          <div style={{ width: '100%', height: '120px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                            <img src={`${imgUrl}`} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: '100%', height: '120px', border: '2px dashed #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#94a3b8' }}>
                            No Image Uploaded
                          </div>
                        )}

                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={e => handleImageUpload(e, idx)} 
                          disabled={uploadingImage === `service-${idx}`}
                          style={{ fontSize: '12px', width: '100%' }}
                        />
                        {uploadingImage === `service-${idx}` && <span style={{ fontSize: '11px', color: '#2563eb' }}>Uploading...</span>}
                      </div>
                    );
                  })}

                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Remarks</label>
                <textarea 
                  className="input-field" 
                  placeholder="Remarks" 
                  rows={4} 
                  style={{ minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }} 
                  value={formData.remarks} 
                  onChange={e => setFormData({...formData, remarks: e.target.value})} 
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setEditingLeadId(null)}
                style={{ padding: '10px 24px' }}
              >
                CANCEL
              </button>
              <button 
                type="submit" 
                onClick={() => setIsSaveAndNext(false)}
                style={{ background: '#64748b', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                SAVE
              </button>
              <button 
                type="submit" 
                onClick={() => setIsSaveAndNext(true)}
                style={{ background: '#1e293b', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                SAVE AND NEXT
              </button>
            </div>
          </form>
          )}
        </div>
      ) : (
        <>
          <div className="page-header">
            <h1 className="page-title">Lead Management</h1>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(isAdmin || isHR) && (
                <button className="btn-secondary" onClick={() => setShowBulkModal(true)}>
                  <Upload size={16} style={{ marginRight: '8px' }} /> Bulk Upload
                </button>
              )}
              <button className="btn-primary" onClick={handleAddLeadClick}>
                <Plus size={16} style={{ marginRight: '8px' }} /> Add Lead
              </button>
            </div>
          </div>

          <div className="data-table-container">
            <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '15px', background: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)' }}>
              {/* Header section with title and search icon */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#e0f2fe', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Search size={16} color="#0284c7" />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search & Filters</span>
                </div>
                
                {/* Clear Filters action in the header to save space */}
                {(filterDataId || filterBusinessName || filterLocation || filterTme || filterMeetingDate || filterCurrentStatus || filterType || search) && (
                  <button 
                    onClick={() => {
                      setFilterDataId('');
                      setFilterBusinessName('');
                      setFilterLocation('');
                      setFilterTme('');
                      setFilterMeetingDate('');
                      setFilterCurrentStatus('');
                      setFilterType('');
                      setSearch('');
                    }}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '11px', height: 'auto', background: '#ffffff', color: '#64748b', borderColor: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '6px' }}
                  >
                    🧹 Clear All Filters
                  </button>
                )}
              </div>

              {/* Global search */}
              <div style={{ position: 'relative', width: '100%' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Global search leads by name, email, or phone..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '35px', margin: 0, background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)' }}
                />
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>

              {/* Grid of filters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                {/* Filter with Data ID */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter with Data ID</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Enter Data ID" 
                    value={filterDataId} 
                    onChange={e => setFilterDataId(e.target.value)} 
                    style={{ margin: 0, background: '#ffffff', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Filter with Business Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter with Business Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Enter Business Name" 
                    value={filterBusinessName} 
                    onChange={e => setFilterBusinessName(e.target.value)} 
                    style={{ margin: 0, background: '#ffffff', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Filter with Location */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter with Location</label>
                  <select 
                    className="input-field" 
                    value={filterLocation} 
                    onChange={e => setFilterLocation(e.target.value)} 
                    style={{ margin: 0, background: '#ffffff', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">All Locations</option>
                    {locations.map((loc: any) => (
                      <option key={loc._id} value={loc.name}>{loc.name}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Filter with TME */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter with TME</label>
                  <select 
                    className="input-field" 
                    value={filterTme} 
                    onChange={e => setFilterTme(e.target.value)} 
                    style={{ margin: 0, background: '#ffffff', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Select an option</option>
                    {users
                      .filter(u => {
                        const rName = u.role?.name?.toLowerCase() || '';
                        return rName.includes('tele sales manager') || rName.includes('telemarketing') || rName.includes('tele marketing');
                      })
                      .map(u => (
                        <option key={u._id} value={u._id}>{u.name}</option>
                      ))
                    }
                  </select>
                </div>

                {/* Filter with Meeting Date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter with Meeting Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={filterMeetingDate} 
                    onChange={e => setFilterMeetingDate(e.target.value)} 
                    style={{ margin: 0, background: '#ffffff', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Filter with Current Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter with Current Status</label>
                  <select 
                    className="input-field" 
                    value={filterCurrentStatus} 
                    onChange={e => setFilterCurrentStatus(e.target.value)} 
                    style={{ margin: 0, background: '#ffffff', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Select an option</option>
                    <option value="Data">Data</option>
                    <option value="Another Visit Required">Another Visit Required</option>
                    <option value="Appointment Fixed">Appointment Fixed</option>
                    <option value="Bounced Collection">Bounced Collection</option>
                    <option value="Budget Constraints">Budget Constraints</option>
                    <option value="Decision Pending">Decision Pending</option>
                    <option value="Details Incorrect">Details Incorrect</option>
                    <option value="Do Not Disturb">Do Not Disturb</option>
                    <option value="Fake Appointmen">Fake Appointmen</option>
                    <option value="Future Interest Expressed">Future Interest Expressed</option>
                    <option value="Meeting Cancelled - By MM">Meeting Cancelled - By MM</option>
                    <option value="Meeting Conducted - Not Interested">Meeting Conducted - Not Interested</option>
                    <option value="Meeting Rescheduled">Meeting Rescheduled</option>
                    <option value="MM Follow-up Required">MM Follow-up Required</option>
                    <option value="Not Available">Not Available</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Not Visited">Not Visited</option>
                    <option value="Positive Response">Positive Response</option>
                    <option value="Proposal Requested">Proposal Requested</option>
                    <option value="Proposal Sent">Proposal Sent</option>
                    <option value="Referred to Another Decision Maker">Referred to Another Decision Maker</option>
                    <option value="TME Follow-up Required">TME Follow-up Required</option>
                  </select>
                </div>

                {/* Filter with Type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter with Type</label>
                  <select 
                    className="input-field" 
                    value={filterType} 
                    onChange={e => setFilterType(e.target.value)} 
                    style={{ margin: 0, background: '#ffffff', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Select an option</option>
                    <option value="New Prospect">New Prospect</option>
                    <option value="Renewal Client">Renewal Client</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>Loading leads...</div>
            ) : (
              <>
                <table>
                <thead>
                  <tr>
                    <th>Data ID</th>
                    <th>Business Name</th>
                    <th>TME</th>
                    <th>BDM</th>
                    <th>Created By</th>
                    <th>Appointment Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedLeads.map((lead) => (
                    <tr key={lead._id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {lead.dataId || (lead._id ? `#${lead._id.slice(-6).toUpperCase()}` : 'N/A')}
                          </span>
                          {lead.clientType && (
                            <span className={`badge ${
                              lead.clientType.includes('New') ? 'badge-green' :
                              lead.clientType.includes('Renewal') ? 'badge-blue' :
                              'badge-yellow'
                            }`} style={{ width: 'fit-content', fontSize: '10px', padding: '2px 6px', fontWeight: 600 }}>
                              {lead.clientType.includes('New') ? 'New' :
                               lead.clientType.includes('Renewal') ? 'Renewal' : 'Existing'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '4px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {lead.businessLogo ? (
                              <img src={`${lead.businessLogo}`} alt="logo" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#94a3b8' }}>🏢</div>
                            )}
                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>
                              {lead.businessName}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: '12px', color: '#475569' }}>
                            <span>
                              <span style={{ fontWeight: 500, color: '#64748b' }}>Contact:</span> {lead.contactPerson}
                            </span>
                            <span>
                              <span style={{ fontWeight: 500, color: '#64748b' }}>Phone:</span> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{lead.phone}</span>
                            </span>
                          </div>
                          {lead.address && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              <span style={{ fontWeight: 500, color: '#94a3b8' }}>Addr:</span> {lead.address}
                            </div>
                          )}
                          {(lead.website || lead.email) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', fontSize: '11px' }}>
                              {lead.website && (
                                <span>
                                  <span style={{ fontWeight: 500, color: '#94a3b8' }}>Web:</span>{' '}
                                  <a 
                                    href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ color: '#2563eb', textDecoration: 'underline' }}
                                  >
                                    {lead.website}
                                  </a>
                                </span>
                              )}
                              {lead.email && (
                                <span>
                                  <span style={{ fontWeight: 500, color: '#94a3b8' }}>Email:</span>{' '}
                                  <a href={`mailto:${lead.email}`} style={{ color: '#0f766e', textDecoration: 'underline' }}>
                                    {lead.email}
                                  </a>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{lead.assignedTelecaller?.name || lead.dataFeedBy || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>}</td>
                      <td>{lead.assignedSales?.name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>}</td>
                      <td>{lead.dataFeedBy || lead.source || 'N/A'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span className={`badge ${getStatusBadgeClass(lead.stage || 'Data')}`} style={{ width: 'fit-content' }}>
                            {formatStatusDisplay(lead.stage || 'Data')}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: '#475569' }}>
                            <div>
                              <span style={{ fontWeight: 600, color: '#0284c7' }}>Appt Date:</span>{' '}
                              <span style={{ fontWeight: 500 }}>
                                {lead.appointmentHistory?.[0]?.appointmentDate
                                  ? new Date(lead.appointmentHistory[0].appointmentDate).toLocaleString('en-GB', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : 'N/A'}
                              </span>
                            </div>
                            <div style={{ lineHeight: '1.3' }}>
                              <span style={{ fontWeight: 600, color: '#475569' }}>Meeting Address:</span>{' '}
                              <span style={{ color: '#64748b' }}>{lead.address || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleInfoClick(lead)} className="btn-secondary" style={{ padding: '6px 12px', background: '#f8fafc', color: '#64748b' }} title="Info / View Details">
                            <Eye size={16} />
                          </button>
                          {canViewEditPage && (
                            <button 
                              onClick={() => handleEditClick(lead)} 
                              className="btn-secondary" 
                              style={{ padding: '6px 12px' }} 
                              title="Edit Lead"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(lead._id)} className="btn-danger" style={{ padding: '6px 12px' }} title="Delete Lead">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>No leads found</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredLeads.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                    Showing {Math.min(filteredLeads.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredLeads.length, currentPage * itemsPerPage)} of {filteredLeads.length} entries
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
        </>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Add Lead</h2>
              <button className="close-btn" onClick={() => { setShowModal(false); setDuplicateLeadError(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleManualSubmit} style={{ padding: '20px' }}>
              {duplicateLeadError && (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fcd34d',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  color: '#b45309',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  boxShadow: '0 2px 4px rgba(245, 158, 11, 0.05)'
                }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
                  <div>
                    Lead already exists with this Email Address or Phone Number.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        const existing = duplicateLeadError.existingLead;
                        setDuplicateLeadError(null);
                        handleEditClick(existing);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 600
                      }}
                    >
                      Click here to edit the existing lead profile.
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Client Type <span style={{color: '#ef4444'}}>*</span></label>
                  <select className="input-field" value={formData.clientType} onChange={e => setFormData({...formData, clientType: e.target.value})} required>
                    <option value="">Select an option</option>
                    <option value="New Prospect">New Prospect</option>
                    <option value="Renewal Client">Renewal Client</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Location <span style={{color: '#ef4444'}}>*</span></label>
                  <select className="input-field" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required>
                    <option value="">Select an option</option>
                    {locations.filter((loc: any) => loc.status === 'Active').map((loc: any) => (
                      <option key={loc._id} value={loc.name}>{loc.name}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Business Name <span style={{color: '#ef4444'}}>*</span></label>
                  <input type="text" className="input-field" placeholder="Business Name" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Contact Person <span style={{color: '#ef4444'}}>*</span></label>
                  <input type="text" className="input-field" placeholder="Contact Person" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Contact Number <span style={{color: '#ef4444'}}>*</span></label>
                  <input type="text" className="input-field" placeholder="Contact Number" value={formData.phone} onChange={e => { setFormData({...formData, phone: e.target.value}); if (duplicateLeadError) setDuplicateLeadError(null); }} required />
                </div>
                <div className="form-group">
                  <label>Alternate Contact Number</label>
                  <input type="text" className="input-field" placeholder="Alternate Contact Number" value={formData.alternatePhone} onChange={e => setFormData({...formData, alternatePhone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" className="input-field" placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Data Source <span style={{color: '#ef4444'}}>*</span></label>
                  <select className="input-field" value={formData.dataSource} onChange={e => setFormData({...formData, dataSource: e.target.value})} required>
                    <option value="">Select an option</option>
                    <option value="Justdial">Justdial</option>
                    <option value="Google">Google</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Referral">Referral</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
                {formData.dataSource === 'Referral' && (
                  <div className="form-group">
                    <label>Referral Name <span style={{color: '#ef4444'}}>*</span></label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Referral Name" 
                      value={formData.referralName || ''} 
                      onChange={e => setFormData({...formData, referralName: e.target.value})} 
                      required 
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Email <span style={{color: '#ef4444'}}>*</span></label>
                  <input type="email" className="input-field" placeholder="Email" value={formData.email} onChange={e => { setFormData({...formData, email: e.target.value}); if (duplicateLeadError) setDuplicateLeadError(null); }} required />
                </div>
                <div className="form-group">
                  <label>Website</label>
                  <input type="text" className="input-field" placeholder="Website" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label>Business Category</label>
                  <select 
                    className="input-field" 
                    value={formData.businessCategory} 
                    onChange={e => {
                      setFormData({
                        ...formData, 
                        businessCategory: e.target.value,
                        businessSubCategory: ''
                      });
                    }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <div style={{ marginTop: '2px' }}>
                    {!showAddCatInput ? (
                      <button 
                        type="button" 
                        onClick={() => setShowAddCatInput(true)} 
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <Plus size={12} style={{ display: 'inline' }} /> Add option
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '5px' }}>
                        <input 
                          type="text" 
                          placeholder="New category name" 
                          value={newCatName} 
                          onChange={e => setNewCatName(e.target.value)} 
                          className="input-field"
                          style={{ padding: '4px 8px', fontSize: '12px', height: 'auto', margin: 0, flex: 1 }}
                        />
                        <button 
                          type="button" 
                          onClick={handleAddCategorySubmit} 
                          style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Add
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { setShowAddCatInput(false); setNewCatName(''); }} 
                          style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label>Business Sub category</label>
                  {formData.businessCategory ? (
                    <div style={{ 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '6px', 
                      padding: '10px', 
                      maxHeight: '150px', 
                      overflowY: 'auto', 
                      background: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {(() => {
                        const selectedCatObj = categories.find(cat => cat.name === formData.businessCategory);
                        const subcats = selectedCatObj ? selectedCatObj.subcategories : [];
                        if (subcats.length === 0) {
                          return <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No subcategories found.</div>;
                        }
                        
                        const selectedSubcats = formData.businessSubCategory ? formData.businessSubCategory.split(',').map((s: string) => s.trim()) : [];

                        return subcats.map((sub: string) => {
                          const isChecked = selectedSubcats.includes(sub);
                          return (
                            <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#334155', cursor: 'pointer', fontWeight: 500 }}>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => {
                                  let newSelected;
                                  if (isChecked) {
                                    newSelected = selectedSubcats.filter((s: string) => s !== sub);
                                  } else {
                                    newSelected = [...selectedSubcats, sub];
                                  }
                                  setFormData({
                                    ...formData,
                                    businessSubCategory: newSelected.filter(Boolean).join(', ')
                                  });
                                }} 
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              {sub}
                            </label>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div style={{ 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '6px', 
                      padding: '12px', 
                      background: '#f8fafc', 
                      color: '#94a3b8', 
                      fontSize: '13px', 
                      fontStyle: 'italic',
                      textAlign: 'center'
                    }}>
                      Please select a category first
                    </div>
                  )}
                  <div style={{ marginTop: '2px' }}>
                    {!showAddSubcatInput ? (
                      <button 
                        type="button" 
                        onClick={() => {
                          if (!formData.businessCategory) {
                            alert('Please select a Category first to add a subcategory.');
                            return;
                          }
                          setShowAddSubcatInput(true);
                        }} 
                        style={{ background: 'none', border: 'none', color: formData.businessCategory ? '#2563eb' : '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: formData.businessCategory ? 'pointer' : 'not-allowed', padding: 0, display: 'flex', alignItems: 'center', gap: '3px' }}
                        disabled={!formData.businessCategory}
                      >
                        <Plus size={12} style={{ display: 'inline' }} /> Add option
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '5px' }}>
                        <input 
                          type="text" 
                          placeholder="New subcategory name" 
                          value={newSubcatName} 
                          onChange={e => setNewSubcatName(e.target.value)} 
                          className="input-field"
                          style={{ padding: '4px 8px', fontSize: '12px', height: 'auto', margin: 0, flex: 1 }}
                        />
                        <button 
                          type="button" 
                          onClick={handleAddSubcategorySubmit} 
                          style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Add
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { setShowAddSubcatInput(false); setNewSubcatName(''); }} 
                          style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>Business Hours Type</label>
                  <select 
                    className="input-field" 
                    value={formData.businessHoursType} 
                    onChange={e => {
                      const val = e.target.value;
                      setFormData({
                        ...formData, 
                        businessHoursType: val,
                        openingTime: val === '24x7' ? '' : formData.openingTime,
                        closingTime: val === '24x7' ? '' : formData.closingTime
                      });
                    }}
                  >
                    <option value="">Select Business Hours</option>
                    <option value="Monday - Friday">Monday - Friday</option>
                    <option value="Monday - Saturday">Monday - Saturday</option>
                    <option value="24x7">24x7</option>
                  </select>
                </div>
                {(formData.businessHoursType === 'Monday - Friday' || formData.businessHoursType === 'Monday - Saturday') && (
                  <>
                    <div className="form-group">
                      <label>Opening Time</label>
                      <select 
                        className="input-field" 
                        value={formData.openingTime} 
                        onChange={e => setFormData({...formData, openingTime: e.target.value})} 
                      >
                        <option value="">Select Opening Time</option>
                        {TIME_SLOTS.map(slot => (
                          <option key={slot.value} value={slot.value}>{slot.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Closing Time</label>
                      <select 
                        className="input-field" 
                        value={formData.closingTime} 
                        onChange={e => setFormData({...formData, closingTime: e.target.value})} 
                      >
                        <option value="">Select Closing Time</option>
                        {TIME_SLOTS.map(slot => (
                          <option key={slot.value} value={slot.value}>{slot.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}



                <div className="form-group">
                  <label>Year of Establishment</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 2015" 
                    value={formData.yearOfEstablishment} 
                    onChange={e => setFormData({...formData, yearOfEstablishment: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label>Social Media URL</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Facebook, LinkedIn, Instagram link, etc." 
                    value={formData.socialMedia} 
                    onChange={e => setFormData({...formData, socialMedia: e.target.value})} 
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>KYC / GST Numbers</span>
                    <button 
                      type="button" 
                      onClick={() => setKycItems([...kycItems, { type: 'GST', number: '' }])}
                      style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Add More
                    </button>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
                    {kycItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select 
                          className="input-field" 
                          style={{ width: '120px', flexShrink: 0 }}
                          value={item.type}
                          onChange={e => {
                            const newItems = [...kycItems];
                            newItems[idx].type = e.target.value;
                            setKycItems(newItems);
                          }}
                        >
                          <option value="GST">GST</option>
                          <option value="PAN">PAN</option>
                          <option value="TIN">TIN</option>
                          <option value="Aadhar">Aadhar</option>
                          <option value="Epic">Epic</option>
                          <option value="CIN">CIN</option>
                        </select>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder={`Enter ${item.type} Number`}
                              value={item.number}
                              onChange={e => {
                                const newItems = [...kycItems];
                                newItems[idx].number = e.target.value;
                                newItems[idx].verified = false;
                                setKycItems(newItems);
                              }}
                              style={{ flex: 1 }}
                            />
                            {item.verified && (
                              <span 
                                style={{ 
                                  color: '#10b981', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  backgroundColor: '#ecfdf5',
                                  borderRadius: '50%',
                                  width: '24px',
                                  height: '24px',
                                  border: '1px solid #10b981',
                                  fontWeight: 'bold',
                                  flexShrink: 0
                                }} 
                                title="Verified from Government Portal"
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          {item.number.trim() && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleKycVerification(idx)}
                                style={{ 
                                  padding: '2px 8px', 
                                  fontSize: '11px', 
                                  backgroundColor: item.verified ? '#10b981' : '#f59e0b', 
                                  color: '#fff', 
                                  border: 'none', 
                                  borderRadius: '4px', 
                                  cursor: 'pointer', 
                                  fontWeight: 600,
                                  width: 'fit-content'
                                }}
                              >
                                {item.verified ? 'Verified (Recheck)' : 'Verify on Govt Portal'}
                              </button>
                              {!item.verified && (
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {item.type === 'GST' && 'Format: 15-digit alphanumeric (e.g. 27AAAAA1111A1Z1)'}
                                  {item.type === 'PAN' && 'Format: 10-digit alphanumeric (e.g. ABCDE1234F)'}
                                  {item.type === 'TIN' && 'Format: 11-digit numeric'}
                                  {item.type === 'Aadhar' && 'Format: 12-digit numeric'}
                                  {item.type === 'Epic' && 'Format: 10-digit alphanumeric (e.g. ABC1234567)'}
                                  {item.type === 'CIN' && 'Format: 21-digit alphanumeric'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {kycItems.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => setKycItems(kycItems.filter((_, i) => i !== idx))}
                            style={{ padding: '8px 12px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Data Feed By <span style={{color: '#ef4444'}}>*</span></label>
                  <select 
                    className="input-field" 
                    value={formData.dataFeedBy || loggedInName} 
                    onChange={e => setFormData({...formData, dataFeedBy: e.target.value})} 
                    required
                  >
                    <option value={formData.dataFeedBy || loggedInName}>{formData.dataFeedBy || loggedInName}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Assigned TME</label>
                  <select className="input-field" value={formData.assignedTelecaller} onChange={e => setFormData({...formData, assignedTelecaller: e.target.value})}>
                    <option value="">Select TME</option>
                    {users
                      .filter(u => {
                        const rName = u.role?.name?.toLowerCase() || '';
                        return rName.includes('tele sales manager') || rName.includes('telemarketing') || rName.includes('tele marketing');
                      })
                      .map(u => (
                        <option key={u._id} value={u._id}>{u.name} ({u.role?.name || 'N/A'})</option>
                      ))
                    }
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Remarks</label>
                  <textarea 
                    className="input-field" 
                    placeholder="Remarks" 
                    rows={4} 
                    style={{ minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }} 
                    value={formData.remarks} 
                    onChange={e => setFormData({...formData, remarks: e.target.value})} 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
                <button type="submit" style={{ background: '#1e293b', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>SUBMIT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>Bulk Upload Leads</h2>
              <button className="close-btn" onClick={closeBulkModal}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Excel Template</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Download the required columns template</p>
                </div>
                <button 
                  type="button" 
                  onClick={downloadSampleTemplate}
                  className="btn-secondary"
                  style={{ background: '#fff', padding: '6px 14px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  📥 Download Sample
                </button>
              </div>

              {isUploading ? (
                <div style={{ padding: '35px', textAlign: 'center', color: '#2563eb', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px', animation: 'spin 1s linear infinite' }}>⏳</span>
                  <span>Processing file and importing leads...</span>
                </div>
              ) : bulkUploadResult ? (
                <div style={{ background: '#ffffff', borderRadius: '8px', padding: '5px 0 0 0' }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    📊 Import Summary
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    <div style={{ background: '#f8fafc', padding: '10px 15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Records</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{bulkUploadResult.summary.total}</div>
                    </div>
                    <div style={{ background: '#f0fdf4', padding: '10px 15px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>Successfully Imported</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#166534', marginTop: '2px' }}>{bulkUploadResult.summary.success}</div>
                    </div>
                    <div style={{ background: '#fffbeb', padding: '10px 15px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>Duplicate Records</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#9a3412', marginTop: '2px' }}>{bulkUploadResult.summary.duplicate}</div>
                    </div>
                    <div style={{ background: '#fef2f2', padding: '10px 15px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600, textTransform: 'uppercase' }}>Failed Records</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#991b1b', marginTop: '2px' }}>{bulkUploadResult.summary.failed}</div>
                    </div>
                  </div>

                  {bulkUploadResult.failedRecords && bulkUploadResult.failedRecords.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', marginBottom: '15px' }}>
                      <div style={{ fontSize: '12.5px', color: '#dc2626', fontWeight: 600 }}>
                        ⚠️ {bulkUploadResult.failedRecords.length} records failed to import.
                      </div>
                      <button 
                        type="button" 
                        onClick={downloadErrorReport}
                        className="btn-secondary"
                        style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 600, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        ⚠️ Download Error Report (.xlsx)
                      </button>
                    </div>
                  )}

                  <button 
                    type="button" 
                    onClick={closeBulkModal}
                    className="btn-primary" 
                    style={{ width: '100%', marginTop: '5px', background: '#1e293b', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div style={{ border: '2px dashed #cbd5e1', padding: '40px', textAlign: 'center', borderRadius: '8px' }}>
                  <Upload size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
                  <br/>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showInfoModal && selectedLeadForInfo && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={22} color="#2563eb" style={{ flexShrink: 0 }} /> Lead Information
              </h2>
              <button className="close-btn" onClick={() => setShowInfoModal(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              


              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 25px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Client Type</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.clientType || 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Location</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.location || 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Contact Person</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.contactPerson || 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Contact Number</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.phone || 'N/A'}</span>
                </div>
                {selectedLeadForInfo.alternatePhone && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Alternate Phone</label>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.alternatePhone}</span>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Email</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.email || 'N/A'}</span>
                </div>
                {selectedLeadForInfo.website && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Website</label>
                    <a href={selectedLeadForInfo.website.startsWith('http') ? selectedLeadForInfo.website : `https://${selectedLeadForInfo.website}`} target="_blank" rel="noreferrer" style={{ fontSize: '14px', fontWeight: 500, color: '#2563eb', textDecoration: 'underline' }}>{selectedLeadForInfo.website}</a>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Business Hours</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>
                    {selectedLeadForInfo.businessHoursType ? (
                      selectedLeadForInfo.businessHoursType === '24x7' ? (
                        '24x7 Open'
                      ) : (
                        `${selectedLeadForInfo.businessHoursType} (${selectedLeadForInfo.openingTime || 'N/A'} - ${selectedLeadForInfo.closingTime || 'N/A'})`
                      )
                    ) : 'N/A'}
                  </span>
                </div>
                {(selectedLeadForInfo.businessStartTime || selectedLeadForInfo.businessEndTime) && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Business Start/End Time</label>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>
                      {selectedLeadForInfo.businessStartTime || 'N/A'} to {selectedLeadForInfo.businessEndTime || 'N/A'}
                    </span>
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Year of Establishment</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.yearOfEstablishment || 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Social Media</label>
                  {selectedLeadForInfo.socialMedia ? (
                    <a 
                      href={selectedLeadForInfo.socialMedia.startsWith('http') ? selectedLeadForInfo.socialMedia : `https://${selectedLeadForInfo.socialMedia}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      style={{ fontSize: '14px', fontWeight: 500, color: '#2563eb', textDecoration: 'underline' }}
                    >
                      {selectedLeadForInfo.socialMedia}
                    </a>
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>N/A</span>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>KYC / GST</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                    {selectedLeadForInfo.kycGst ? (
                      parseKycString(selectedLeadForInfo.kycGst, selectedLeadForInfo.isGstVerified).map((item: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>
                            <strong>{item.type}:</strong> {item.number}
                          </span>
                          {item.verified && (
                            <span 
                              style={{ 
                                color: '#10b981', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                backgroundColor: '#ecfdf5',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                border: '1px solid #10b981',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }} 
                              title="Verified from Government Portal"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>N/A</span>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Business Category</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.businessCategory || 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Business Sub Category</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.businessSubCategory || 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Deal Value (₹)</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.value !== undefined ? `₹${selectedLeadForInfo.value.toLocaleString()}` : 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Data Source</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>
                    {selectedLeadForInfo.dataSource || 'N/A'} 
                    {selectedLeadForInfo.dataSource === 'Referral' && selectedLeadForInfo.referralName && ` (Ref: ${selectedLeadForInfo.referralName})`}
                  </span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Data Feed By</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.dataFeedBy || selectedLeadForInfo.source || 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Appointment Status (Stage)</label>
                  <div style={{ marginTop: '4px' }}>
                    <span className={`badge ${getStatusBadgeClass(selectedLeadForInfo.stage || 'Data')}`}>
                      {formatStatusDisplay(selectedLeadForInfo.stage || 'Data')}
                    </span>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Assigned TME</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.assignedTelecaller?.name || selectedLeadForInfo.dataFeedBy || 'Unassigned'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Assigned BDM</label>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.assignedSales?.name || 'Unassigned'}</span>
                </div>
                {selectedLeadForInfo.address && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Address</label>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>{selectedLeadForInfo.address}</span>
                  </div>
                )}
                {selectedLeadForInfo.remarks && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>Remarks</label>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569', background: '#f8fafc', padding: '10px 15px', borderRadius: '6px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {selectedLeadForInfo.remarks}
                    </p>
                  </div>
                )}
                {(selectedLeadForInfo.businessLogo || selectedLeadForInfo.shopFrontImage || (selectedLeadForInfo.serviceImages && selectedLeadForInfo.serviceImages.length > 0)) && (
                  <div style={{ gridColumn: '1 / -1', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>Business Images</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px' }}>
                      {selectedLeadForInfo.businessLogo && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Logo</span>
                          <img src={`${selectedLeadForInfo.businessLogo}`} alt="Logo" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                        </div>
                      )}
                      {selectedLeadForInfo.shopFrontImage && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Shop Front</span>
                          <img src={`${selectedLeadForInfo.shopFrontImage}`} alt="Shop Front" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                        </div>
                      )}
                      {(selectedLeadForInfo.serviceImages || []).filter((img: string) => img).map((imgUrl: string, idx: number) => (
                        <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Service Image {idx + 1}</span>
                          <img src={`${imgUrl}`} alt={`Service ${idx + 1}`} style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedLeadForInfo.appointmentHistory && selectedLeadForInfo.appointmentHistory.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>Disposition & Remarks History</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
                      {selectedLeadForInfo.appointmentHistory.map((item: any, idx: number) => (
                        <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                            <span style={{ fontWeight: 600 }}>{item.changedBy}</span>
                            <span>{new Date(item.changedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`badge ${getStatusBadgeClass(item.status)}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                              {formatStatusDisplay(item.status)}
                            </span>
                            {item.appointmentDate && (
                              <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 500 }}>
                                Appt: {new Date(item.appointmentDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          {item.remarks && (
                            <div style={{ fontSize: '11px', color: '#334155', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                              "{item.remarks}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                <button className="btn-primary" onClick={() => setShowInfoModal(false)} style={{ background: '#1e293b', color: 'white', padding: '8px 20px', borderRadius: '6px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Conversion Modal */}
      {showLeadConvertModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Convert Lead to Client</h3>
              <button type="button" onClick={() => setShowLeadConvertModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleConvertLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Billing Cycle *</label>
                <select className="input-field" value={convertBillingCycle} onChange={e => { setConvertBillingCycle(e.target.value); handleConvertPkgChange(selectedPkgId, e.target.value); }} required>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Half-Yearly">Half-Yearly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Select Package *</label>
                <select className="input-field" value={selectedPkgId} onChange={e => handleConvertPkgChange(e.target.value, convertBillingCycle)} required>
                  <option value="">Choose Package</option>
                  {packages.map(p => (
                    <option key={p._id} value={p._id}>{p.name} ({p.category})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Price (Excl GST) *</label>
                  <input type="number" className="input-field" value={convertPrice} onChange={e => { setConvertPrice(Number(e.target.value)); setConvertGstAmount(Math.round(Number(e.target.value)*0.18)); setConvertTotal(Number(e.target.value) + Math.round(Number(e.target.value)*0.18)); }} required />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>GST Tax (18%)</label>
                  <input type="number" className="input-field" value={convertGstAmount} disabled style={{ background: '#f8fafc' }} />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Total Price (INR)</label>
                <input type="number" className="input-field" value={convertTotal} disabled style={{ background: '#f8fafc', fontWeight: 700 }} />
              </div>

              {['Deal Close', 'Deal Close With Full Payment', 'Deal Close With Partial Payment'].includes(appointmentStatus) && (
                <div className="form-group">
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Paid Amount (INR) *</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={convertPaidAmount} 
                      onChange={e => setConvertPaidAmount(Math.min(Number(e.target.value), convertTotal))} 
                      required 
                      min={0}
                      max={convertTotal}
                      style={{ flex: 1, margin: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => setConvertPaidAmount(convertTotal)}
                      style={{
                        padding: '10px 16px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#475569',
                        whiteSpace: 'nowrap',
                        height: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                      onMouseOut={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                    >
                      Full Payment
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Balance Due: INR {(convertTotal - convertPaidAmount).toLocaleString()}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Subscription Start Date *</label>
                <input type="date" className="input-field" value={convertStartDate} onChange={e => setConvertStartDate(e.target.value)} required />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Subscription End Date *</label>
                <input type="date" className="input-field" value={convertEndDate} onChange={e => setConvertEndDate(e.target.value)} required />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Assigned Account Manager *</label>
                <select className="input-field" value={convertAccountManager} onChange={e => setConvertAccountManager(e.target.value)} required>
                  <option value="">Select Manager</option>
                  {users.filter(u => {
                    const rName = (u.role?.name || '').toLowerCase();
                    return rName.includes('bdm') || rName.includes('business development');
                  }).map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role?.name || 'Staff'})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowLeadConvertModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Convert & Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
