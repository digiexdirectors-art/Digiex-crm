import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Users, DollarSign, Search, Download, ArrowLeft, 
  Building, MapPin, Globe, FileText, CheckCircle, 
  AlertTriangle, ShieldAlert, Trash2, Edit, RefreshCw, 
  Send, Check, Upload, ExternalLink, Activity, MessageSquare, X
} from 'lucide-react';

interface Note {
  _id?: string;
  note: string;
  userName: string;
  date: string;
}

interface Document {
  _id?: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedAt: string;
}

interface TimelineEvent {
  _id?: string;
  title: string;
  description: string;
  date: string;
}

interface Client {
  _id: string;
  name: string;
  companyName: string;
  email: string;
  phone?: string;
  address?: string;
  status: 'Active' | 'Expired' | 'Renewal Due' | 'Suspended' | 'Closed' | 'Lead';
  createdAt: string;

  // Contact details
  contactPerson?: string;
  designation?: string;
  whatsAppNumber?: string;
  alternateNumber?: string;
  alternateEmail?: string;

  // Identifiers
  businessCategory?: string;
  gstNumber?: string;
  panNumber?: string;
  cinNumber?: string;

  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;

  // Presence
  websiteUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedInUrl?: string;
  youtubeUrl?: string;
  googleBusinessProfileUrl?: string;

  // Assignments
  assignedAccountManager?: any;
  assignedSalesExecutive?: any;
  assignedServiceManager?: any;
  assignedProjectManager?: any;
  assignedCustomerCareExecutive?: any;
  assignedTeamMembers?: any[];
  projectStatus?: string;

  notes: Note[];
  documents: Document[];
  timeline: TimelineEvent[];

  isVerified?: boolean;
  isGstVerified?: boolean;
  verificationDetails?: {
    verifiedAt: string;
    verifiedBy: string;
    verifiedByEmployeeId: string;
  };
  businessType?: string;
  industry?: string;
  companyRegistrationNumber?: string;
  companyEmail?: string;
  companyPhone?: string;
  description?: string;
  numberOfEmployees?: number;
  techStack?: string;
  competitors?: string;
  remarks?: string;

  // Aggregated fields
  activeServicesCount?: number;
  expiredServicesCount?: number;
  totalRevenueGenerated?: number;
  serviceStartDate?: string;
  serviceEndDate?: string;
  lastExpiredServiceDate?: string;
  clientPackages?: any[];
}

interface ServiceRow {
  rowId: string;
  client: Client;
  serviceName: string;
  serviceCategory: string;
  startDate?: string;
  endDate?: string;
  status: string;
  price: number;
  totalWithGst: number;
  billingCycle?: string;
  pkgRef?: any;
  serviceIndex?: number;
  deliverables?: any[];
}

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

const DM_DELIVERABLES_TEMPLATE = [
  { value: 'Photo & Media Uploads', key: '4 posts per month (updates, offers, photos)', price: 8000 },
  { value: 'Image Optimization', key: 'Faster responses + reputation strategy', price: 4000 },
  { value: 'Advanced Review Management', key: '40–50 posts/year', price: 5000 },
  { value: 'Monthly Strategy & Optimization', key: 'Geo-tagged photos & updates', price: 2000 },
  { value: 'Competitor Activity Monitoring', key: 'Keyword tweaks, category tuning, post optimisation', price: 3000 },
  { value: 'Trends + Action Plan', key: 'Trends + action plan for next quarter', price: 0 },
  { value: 'Directory Listings', key: 'Local citations / directory listings (10–20 sites)', price: 0 },
  { value: 'Sponsor Ads', key: 'Sponsor Ads---Rs. 4000 at a time', price: 4000 }
];

const WEB_DELIVERABLES_TEMPLATE = [
  { value: 'SEO Enabled', key: 'SEO Enabled', price: 5000 },
  { value: 'Appointment Booking System', key: 'Appointment Booking System', price: 1000 },
  { value: '1 Professional Email Address', key: '1 Professional Email Address', price: 0 },
  { value: 'SSL Certificate', key: 'SSL Certificate', price: 0 },
  { value: 'Domain & Hosting', key: 'Domain [domain .in, 500 rupees extra for .com] & Hosting For 1 Year', price: 1500 },
  { value: 'Location/Map Integration', key: 'Location or Google Map Integration', price: 2000 },
  { value: 'WhatsApp/Social Integration', key: 'WhatsApp Chat, Social Media Integration', price: 2000 },
  { value: 'WordPress Site Creation', key: 'WordPress Site Up To 15 Pages', price: 7000 }
];

export default function ClientManagement() {
  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = (loggedInUser.role?.name || '').toLowerCase().trim();
  const userType = (typeof loggedInUser.role?.userType === 'object' ? loggedInUser.role?.userType?.name : loggedInUser.role?.userType || '').toLowerCase().trim();
  const isAdmin = ['admin', 'super admin'].includes(userRole) || ['admin', 'super admin'].includes(userType);
  const isCustomerCare = userRole.includes('customer care') || userRole.includes('customer support') || userRole.includes('support');
  const isServiceManager = userRole.includes('service manager') || userRole === 'service manager';
  const canManageProjectTeam = isAdmin || isServiceManager;
  
  const allowedRoles = ['admin', 'super admin', 'tele sales', 'telemarketing', 'tele marketing', 'sales manager', 'sales executive', 'bdm', 'sales'];
  const canSeeBillings = allowedRoles.some(r => userRole.includes(r)) || ['admin', 'super admin'].includes(userType);
  const isManagerOrAdmin = ['admin', 'super admin', 'sales manager', 'tele sales manager', 'telemarketing manager', 'tele manager', 'tme manager'].some(r => userRole.includes(r)) || ['admin', 'super admin'].includes(userType);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // System States
  const [clients, setClients] = useState<Client[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Search & Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // View States
  const [activeView, setActiveView] = useState<'list' | 'detail'>('list');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // 360 Client Detailed states
  const [clientProfile, setClientProfile] = useState<Client | null>(null);
  const [packagesHistory, setPackagesHistory] = useState<any[]>([]);
  const [invoicesHistory, setInvoicesHistory] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [allServiceDetails, setAllServiceDetails] = useState<any[]>([]);

  // Detailed view tab
  const [activeProfileTab, setActiveProfileTab] = useState<'overview' | 'services' | 'billing' | 'documents' | 'timeline' | 'audit' | 'support_summary'>('overview');

  // Edit forms/modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Verification, Services, and Features states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [showAddFeatureModal, setShowAddFeatureModal] = useState(false);
  const [showEditFeatureModal, setShowEditFeatureModal] = useState(false);
  
  const [currentService, setCurrentService] = useState<any>(null);
  const [currentFeature, setCurrentFeature] = useState<any>(null);
  
  const [serviceForm, setServiceForm] = useState<any>({
    name: '',
    category: '',
    startDate: '',
    endDate: '',
    status: 'Active',
    description: '',
    price: 0,
    renewalDate: '',
    assignedTeam: '',
    deliverables: []
  });

  const [featureForm, setFeatureForm] = useState({
    name: '',
    description: '',
    status: 'Pending',
    estimatedCost: 0,
    approvalStatus: 'Pending'
  });

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Notes and Document upload form
  const [noteText, setNoteText] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState('Signed Agreement');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Account management assignment form
  const [assignAM, setAssignAM] = useState('');
  const [assignSE, setAssignSE] = useState('');
  const [assignPM, setAssignPM] = useState('');

  // Project Development Team Assignment states
  const [showAssignTeamModal, setShowAssignTeamModal] = useState(false);
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);
  const [selectedMemberTimelines, setSelectedMemberTimelines] = useState<Record<string, { startDate: string; endDate: string }>>({});
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [selectedProjectStatus, setSelectedProjectStatus] = useState('Assigned for Development');

  // Alerts
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchClientsList = async () => {
    setLoading(true);
    try {
      const [resClients, resUsers, resServices, resDetails] = await Promise.all([
        axios.get('/api/clients'),
        axios.get('/api/users'),
        axios.get('/api/services'),
        axios.get('/api/service-details')
      ]);

      if (resClients.data.success) setClients(resClients.data.data);
      if (resUsers.data.success) setUsersList(resUsers.data.data);
      if (resServices.data.success) setAllServices(resServices.data.data);
      if (resDetails.data.success) setAllServiceDetails(resDetails.data.data);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to load client database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsList();

    const handleResetView = () => {
      console.log("Client view reset triggered");
      setActiveView('list');
      setSelectedClientId(null);
      setClientProfile(null);
      setActiveProfileTab('overview');
    };

    window.addEventListener('reset-client-view', handleResetView);
    return () => {
      window.removeEventListener('reset-client-view', handleResetView);
    };
  }, []);

  const showToast = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const fetchAuditLogs = async (clientId: string) => {
    try {
      setAuditLoading(true);
      const res = await axios.get(`/api/audit-logs/client/${clientId}`);
      if (res.data.success) {
        setAuditLogs(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching audit logs', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Fetch complete client 360 profile
  const fetchClientProfile = async (clientId: string) => {
    setDetailLoading(true);
    try {
      const res = await axios.get(`/api/clients/${clientId}`);
      if (res.data.success) {
        const { client, packagesHistory, invoicesHistory } = res.data.data;
        setClientProfile(client);
        setPackagesHistory(packagesHistory);
        setInvoicesHistory(invoicesHistory);
        fetchAuditLogs(clientId);
        
        // initialize assignment form inputs
        setAssignAM(client.assignedAccountManager?._id || client.assignedAccountManager || '');
        const sysServiceMgr = usersList.find((u: any) => {
          const rName = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
          return rName.includes('service manager') || rName === 'service manager' || rName.includes('service');
        }) || usersList.find((u: any) => u.name?.toLowerCase().includes('vikash'));

        const explicitSM = client.assignedServiceManager?._id || client.assignedServiceManager;
        const explicitSE = (client.assignedSalesExecutive && client.assignedSalesExecutive._id !== client.assignedAccountManager?._id) ? (client.assignedSalesExecutive._id || client.assignedSalesExecutive) : null;
        const leadSalesSM = packagesHistory.find((p: any) => p.lead?.assignedSales && p.lead.assignedSales._id !== client.assignedAccountManager?._id)?.lead?.assignedSales;

        const resolvedSM = explicitSM || explicitSE || (leadSalesSM?._id || leadSalesSM) || (sysServiceMgr?._id || sysServiceMgr) || '';
        setAssignSE(resolvedSM);
        setAssignPM(client.assignedProjectManager?._id || client.assignedProjectManager || '');

        // Initialize project team members & per-member timelines
        const teamIds = (client.assignedTeamMembers || []).map((u: any) => u._id || u);
        setSelectedTeamMemberIds(teamIds);

        const initialTimelines: Record<string, { startDate: string; endDate: string }> = {};
        ((client as any).teamAssignments || []).forEach((ta: any) => {
          const uId = String(ta.user?._id || ta.user || '');
          if (uId) {
            initialTimelines[uId] = {
              startDate: ta.startDate ? new Date(ta.startDate).toISOString().split('T')[0] : '',
              endDate: ta.endDate ? new Date(ta.endDate).toISOString().split('T')[0] : ''
            };
          }
        });
        setSelectedMemberTimelines(initialTimelines);

        const defaultStatus = (teamIds.length === 0 || client.projectStatus === 'Pending Verification') ? 'Pending Team Members' : (client.projectStatus || 'Assigned for Development');
        setSelectedProjectStatus(defaultStatus);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to fetch client 360 profile data.');
      setActiveView('list');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleClientClick = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveProfileTab('overview');
    setActiveView('detail');
    fetchClientProfile(clientId);
  };

  const handleVerifyClientSubmit = async () => {
    if (!selectedClientId) return;
    try {
      setSubmitLoading(true);
      const res = await axios.post(`/api/clients/${selectedClientId}/send-verification-email`);
      if (res.data.success) {
        showToast('success', res.data.message || 'Verification email sent to client with verification link!');
        setShowVerifyModal(false);
        fetchClientProfile(selectedClientId);
        fetchClientsList();
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', err.response?.data?.message || 'Failed to send verification email.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOverrideVerification = async (targetStatus: boolean) => {
    if (!selectedClientId) return;
    try {
      setSubmitLoading(true);
      const res = await axios.post(`/api/clients/${selectedClientId}/override-verification`, { isVerified: targetStatus });
      if (res.data.success) {
        showToast('success', `Verification status overridden to ${targetStatus}`);
        fetchClientProfile(selectedClientId);
        fetchClientsList();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to override verification.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;
    try {
      setSubmitLoading(true);
      const res = await axios.post('/api/client-packages/add-service', {
        clientId: selectedClientId,
        ...serviceForm
      });
      if (res.data.success) {
        showToast('success', 'Service added successfully!');
        setShowAddServiceModal(false);
        setServiceForm({
          name: '',
          category: '',
          startDate: '',
          endDate: '',
          status: 'Active',
          description: '',
          price: 0,
          renewalDate: '',
          assignedTeam: '',
          deliverables: []
        });
        fetchClientProfile(selectedClientId);
        fetchClientsList();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to add service.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentService) return;
    try {
      setSubmitLoading(true);
      const res = await axios.put(`/api/client-packages/update-service/${currentService._id}`, serviceForm);
      if (res.data.success) {
        showToast('success', 'Service updated successfully!');
        setShowEditServiceModal(false);
        setCurrentService(null);
        fetchClientProfile(selectedClientId!);
        fetchClientsList();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update service.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleToggleService = (pkgId: string, srv: any) => {
    const updatedHistory = packagesHistory.map(pkg => {
      if (pkg._id !== pkgId) return pkg;
      
      const isPurchased = (pkg.services || []).some((s: any) => 
        String(s.serviceId?._id || s.serviceId || s._id) === String(srv._id) || 
        s.name === srv.name
      );

      let newServices = [];
      if (isPurchased) {
        // Remove service
        newServices = (pkg.services || []).filter((s: any) => 
          !(String(s.serviceId?._id || s.serviceId || s._id) === String(srv._id) || s.name === srv.name)
        );
      } else {
        // Add service
        newServices = [...(pkg.services || []), {
          name: srv.name,
          category: srv.category || '',
          serviceId: srv._id,
          deliverables: []
        }];
      }

      // Recalculate package subtotal price
      const newPrice = newServices.reduce((sum: number, s: any) => {
        return sum + (s.deliverables || []).reduce((dSum: number, d: any) => dSum + (d.price || 0), 0);
      }, 0);

      return { ...pkg, services: newServices, price: newPrice, isChanged: true };
    });
    setPackagesHistory(updatedHistory);
  };

  const handleToggleDeliverable = (pkgId: string, serviceNameOrId: string, detail: any) => {
    const updatedHistory = packagesHistory.map(pkg => {
      if (pkg._id !== pkgId) return pkg;
      
      // Toggle the detail ID in pkg.serviceDetails
      let newServiceDetails = [...(pkg.serviceDetails || [])];
      const isDetailPresent = newServiceDetails.some(id => String(id?._id || id) === String(detail._id));
      if (isDetailPresent) {
        newServiceDetails = newServiceDetails.filter(id => String(id?._id || id) !== String(detail._id));
      } else {
        newServiceDetails.push(detail._id);
      }
      
      const updatedServices = (pkg.services || []).map((s: any) => {
        const isMatch = String(s.serviceId?._id || s.serviceId || s._id) === String(serviceNameOrId) || s.name === serviceNameOrId;
        if (!isMatch) return s;

        const isChecked = (s.deliverables || []).some((del: any) => 
          del.key === detail.name || 
          del.value === detail.name || 
          (del.serviceDetailId && String(del.serviceDetailId) === String(detail._id))
        );

        let newDeliverables = [];
        if (isChecked) {
          newDeliverables = (s.deliverables || []).filter((del: any) => 
            del.key !== detail.name && 
            del.value !== detail.name && 
            !(del.serviceDetailId && String(del.serviceDetailId) === String(detail._id))
          );
        } else {
          newDeliverables = [...(s.deliverables || []), {
            key: detail.name,
            value: detail.name,
            price: detail.price,
            serviceDetailId: detail._id
          }];
        }

        return { ...s, deliverables: newDeliverables };
      });

      // Recalculate package subtotal price
      const newPrice = updatedServices.reduce((sum: number, s: any) => {
        return sum + (s.deliverables || []).reduce((dSum: number, d: any) => dSum + (d.price || 0), 0);
      }, 0);

      return { ...pkg, services: updatedServices, serviceDetails: newServiceDetails, price: newPrice, isChanged: true };
    });
    setPackagesHistory(updatedHistory);
  };

  const handleSavePackageDeliverables = async (pkg: any) => {
    try {
      setSubmitLoading(true);
      const payload = {
        name: pkg.services?.[0]?.name,
        category: pkg.services?.[0]?.category,
        startDate: pkg.startDate,
        endDate: pkg.endDate,
        status: pkg.status,
        description: pkg.notes,
        price: pkg.price,
        renewalDate: pkg.renewalDate,
        assignedTeam: pkg.assignedTeam,
        services: pkg.services,
        serviceDetails: pkg.serviceDetails
      };
      const res = await axios.put(`/api/client-packages/update-service/${pkg._id}`, payload);
      if (res.data.success) {
        showToast('success', 'Deliverables and pricing updated successfully!');
        fetchClientProfile(selectedClientId!);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update deliverables.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAddFeatureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentService) return;
    try {
      setSubmitLoading(true);
      const res = await axios.post(`/api/client-packages/${currentService._id}/features`, featureForm);
      if (res.data.success) {
        showToast('success', 'Feature added successfully!');
        setShowAddFeatureModal(false);
        setFeatureForm({
          name: '',
          description: '',
          status: 'Pending',
          estimatedCost: 0,
          approvalStatus: 'Pending'
        });
        fetchClientProfile(selectedClientId!);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to add feature.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditFeatureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentService || !currentFeature) return;
    try {
      setSubmitLoading(true);
      const res = await axios.put(`/api/client-packages/${currentService._id}/features/${currentFeature._id}`, featureForm);
      if (res.data.success) {
        showToast('success', 'Feature updated successfully!');
        setShowEditFeatureModal(false);
        setCurrentFeature(null);
        fetchClientProfile(selectedClientId!);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update feature.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteFeature = async (serviceId: string, featureId: string) => {
    if (!window.confirm('Are you sure you want to delete this feature?')) return;
    try {
      setSubmitLoading(true);
      const res = await axios.delete(`/api/client-packages/${serviceId}/features/${featureId}`);
      if (res.data.success) {
        showToast('success', 'Feature deleted successfully!');
        fetchClientProfile(selectedClientId!);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to delete feature.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Note Submission
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !selectedClientId) return;

    try {
      const res = await axios.post(`/api/clients/${selectedClientId}/notes`, { note: noteText });
      if (res.data.success) {
        showToast('success', 'Internal note added successfully.');
        setNoteText('');
        // Refresh profile data to display note in history
        fetchClientProfile(selectedClientId);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to add internal note.');
    }
  };

  // Document Upload Submission
  const handleDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !selectedClientId) return;

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', docFile);

    try {
      // 1. Upload file to static folder
      const uploadRes = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (uploadRes.data.success) {
        const fileUrl = uploadRes.data.fileUrl;
        
        // 2. Save document details in client profile
        const docPayload = {
          fileName: docFile.name,
          fileUrl: fileUrl,
          fileType: docCategory
        };

        const saveRes = await axios.post(`/api/clients/${selectedClientId}/documents`, docPayload);
        if (saveRes.data.success) {
          showToast('success', `${docCategory} uploaded successfully.`);
          setDocFile(null);
          // Reset file input
          const fileInput = document.getElementById('client-file-input') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
          fetchClientProfile(selectedClientId);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'File upload failed.');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document
  const handleDeleteDoc = async (docId: string) => {
    if (!selectedClientId || !window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const res = await axios.delete(`/api/clients/${selectedClientId}/documents/${docId}`);
      if (res.data.success) {
        showToast('success', 'Document deleted successfully.');
        fetchClientProfile(selectedClientId);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to delete document.');
    }
  };

  // Edit client basic/business coordinates
  const openEditModal = () => {
    if (!clientProfile) return;
    setEditForm({ ...clientProfile });
    setShowEditModal(true);
  };

  const handleClientGstVerification = () => {
    if (!editForm.gstNumber || !editForm.gstNumber.trim()) return;
    const gstin = editForm.gstNumber.trim().toUpperCase();
    const validation = validateGSTIN(gstin);
    if (!validation.isValid) {
      showToast('error', `GST Number Verification Error: ${validation.reason}`);
      return;
    }

    // Open Government portal in new tab
    window.open('https://services.gst.gov.in/services/searchtp', '_blank');

    // Display confirmation prompt
    setTimeout(() => {
      const isVerified = window.confirm(`GST Verification for "${gstin}"\n\nDid the GST number verify successfully on the Government portal?`);
      if (isVerified) {
        setEditForm(prev => ({ ...prev, gstNumber: gstin, isGstVerified: true }));
      }
    }, 1000);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;

    if (editForm.gstNumber && editForm.gstNumber.trim()) {
      const gstVal = editForm.gstNumber.trim().toUpperCase();
      const validation = validateGSTIN(gstVal);
      if (!validation.isValid) {
        showToast('error', `GST Number Validation Error: ${validation.reason}`);
        return;
      }
      editForm.gstNumber = gstVal;
      if (gstVal !== clientProfile?.gstNumber) {
        editForm.isGstVerified = false;
      }
    } else {
      editForm.isGstVerified = false;
    }

    if (editForm.panNumber && editForm.panNumber.trim()) {
      const panVal = editForm.panNumber.trim().toUpperCase();
      const validation = validatePAN(panVal);
      if (!validation.isValid) {
        showToast('error', `PAN Number Validation Error: ${validation.reason}`);
        return;
      }
      editForm.panNumber = panVal;
    }

    if (editForm.cinNumber && editForm.cinNumber.trim()) {
      const cinVal = editForm.cinNumber.trim().toUpperCase();
      const validation = validateCIN(cinVal);
      if (!validation.isValid) {
        showToast('error', `CIN Validation Error: ${validation.reason}`);
        return;
      }
      editForm.cinNumber = cinVal;
    }

    setSubmitLoading(true);
    try {
      // Deconstruct populated objects/arrays to avoid Mongoose CastErrors
      const {
        assignedAccountManager,
        assignedSalesExecutive,
        assignedProjectManager,
        notes,
        documents,
        timeline,
        createdAt,
        updatedAt,
        __v,
        ...cleanedPayload
      } = editForm as any;

      // Extract string ObjectIds if they are populated objects
      if (assignedAccountManager && typeof assignedAccountManager === 'object') {
        cleanedPayload.assignedAccountManager = assignedAccountManager._id;
      }
      if (assignedSalesExecutive && typeof assignedSalesExecutive === 'object') {
        cleanedPayload.assignedSalesExecutive = assignedSalesExecutive._id;
      }
      if (assignedProjectManager && typeof assignedProjectManager === 'object') {
        cleanedPayload.assignedProjectManager = assignedProjectManager._id;
      }

      // Handle blank numbers
      if (cleanedPayload.numberOfEmployees === "" || isNaN(cleanedPayload.numberOfEmployees)) {
        delete cleanedPayload.numberOfEmployees;
      }

      const res = await axios.put(`/api/clients/${selectedClientId}`, cleanedPayload);
      if (res.data.success) {
        try {
          const emailRes = await axios.post(`/api/clients/${selectedClientId}/send-verification-email`);
          showToast('success', emailRes.data.message || 'Client details saved & verification email sent to client!');
        } catch (verErr: any) {
          console.error('Failed to send verification email link after update:', verErr);
          showToast('success', 'Client details updated successfully.');
        }
        setShowEditModal(false);
        fetchClientProfile(selectedClientId);
        fetchClientsList();
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', err.response?.data?.message || 'Failed to update client details.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Save staff assignments
  const handleAssignSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;

    setSubmitLoading(true);
    const payload = {
      assignedAccountManager: assignAM || null,
      assignedServiceManager: assignSE || null,
      assignedSalesExecutive: assignSE || null
    };

    try {
      const res = await axios.put(`/api/clients/${selectedClientId}`, payload);
      if (res.data.success) {
        showToast('success', 'Account Management assignments updated.');
        setShowAssignModal(false);
        fetchClientProfile(selectedClientId);
        fetchClientsList();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update assignments.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Save Project Development Team Members (Multiple Selection)
  const handleSaveTeamAssignment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedClientId) return;

    if (!canManageProjectTeam) {
      showToast('error', 'Only Service Manager, Admin, or Super Admin can assign project development team members.');
      return;
    }

    setSubmitLoading(true);
    try {
      let statusToSave = selectedProjectStatus;
      if (selectedTeamMemberIds.length > 0 && (selectedProjectStatus === 'Pending Team Members' || selectedProjectStatus === 'Pending Verification')) {
        statusToSave = 'Assigned for Development';
      } else if (selectedTeamMemberIds.length === 0) {
        statusToSave = 'Pending Team Members';
      }

      const payload = {
        assignedTeamMembers: selectedTeamMemberIds,
        teamAssignments: selectedTeamMemberIds.map(id => ({
          user: id,
          startDate: selectedMemberTimelines[id]?.startDate || null,
          endDate: selectedMemberTimelines[id]?.endDate || null
        })),
        projectStatus: statusToSave
      };
      const res = await axios.put(`/api/clients/${selectedClientId}`, payload);
      if (res.data.success) {
        showToast('success', 'Project assigned to development team members successfully!');
        setShowAssignTeamModal(false);
        fetchClientProfile(selectedClientId);
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', err.response?.data?.message || 'Failed to update team assignments.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Dashboard KPI Widgets calculations
  const calculateDashboardKPIs = () => {
    const totalCount = clients.length;
    const activeCount = clients.filter(c => c.status === 'Active').length;
    const renewalDueCount = clients.filter(c => c.status === 'Renewal Due').length;
    const expiredCount = clients.filter(c => c.status === 'Expired').length;

    // Monthly revenue (active client packages converted to monthly MRR prorated)
    const monthlyRev = clients.reduce((sum, client) => {
      // We can sum the total revenues or we can estimate active MRR
      return sum + (client.totalRevenueGenerated || 0);
    }, 0);

    const totalRevenue = clients.reduce((sum, c) => sum + (c.totalRevenueGenerated || 0), 0);

    let monthlyDealWonAmount = 0;
    clients.forEach((c: any) => {
      if (!isManagerOrAdmin) {
        const isAssigned = 
          (c.assignedAccountManager?._id || c.assignedAccountManager) === loggedInUser._id ||
          (c.assignedSalesExecutive?._id || c.assignedSalesExecutive) === loggedInUser._id;
        if (!isAssigned) return;
      }

      const pkgs = c.clientPackages || [];
      pkgs.forEach((p: any) => {
        const startDate = new Date(p.startDate);
        if (!isNaN(startDate.getTime())) {
          const m = startDate.getMonth() + 1;
          const y = startDate.getFullYear();
          if (m === selectedMonth && y === selectedYear) {
            monthlyDealWonAmount += p.total || 0;
          }
        }
      });
    });

    return {
      totalCount,
      activeCount,
      renewalDueCount,
      expiredCount,
      monthlyRev,
      totalRevenue,
      monthlyDealWonAmount
    };
  };

  const dashboardKPIs = calculateDashboardKPIs();

  // Search & Filter items list logic - 1 row per ClientPackage purchase (subscription transaction)
  const getFilteredServiceRows = (): ServiceRow[] => {
    const rows: ServiceRow[] = [];

    clients.forEach(c => {
      const matchSearchTerm = (term: string) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          term.toLowerCase().includes(q)
        );
      };

      const matchManager = managerFilter ? (
        c.assignedAccountManager?._id === managerFilter || 
        c.assignedAccountManager === managerFilter
      ) : true;

      const matchVerification = verificationFilter === 'Verified' 
        ? c.isVerified === true 
        : verificationFilter === 'Not Verified' 
        ? !c.isVerified 
        : true;

      if (!matchManager || !matchVerification) return;

      const pkgs = c.clientPackages || [];

      if (pkgs.length > 0) {
        pkgs.forEach((pkg: any, pIdx: number) => {
          const pkgServices = pkg.services || [];
          const pkgStartDate = pkg.startDate || c.serviceStartDate || c.createdAt;
          const pkgEndDate = pkg.endDate || c.serviceEndDate;
          const pkgStatus = pkg.status || c.status;
          const pkgBilling = pkg.billingCycle || 'Monthly';
          const pkgCategory = pkg.packageCategory || pkg.package?.category || ((c.totalRevenueGenerated || 0) > 50000 ? 'Premium' : 'Standard');

          const serviceNamesText = pkgServices.length > 0
            ? pkgServices.map((s: any) => s.name || '').join(' ')
            : (pkg.packageName || '');
          
          const serviceNameDisplay = pkgServices.length > 0
            ? pkgServices.map((s: any) => s.name || pkg.packageName || 'Active Service').join(', ')
            : (pkg.packageName || 'Active Package');

          const matchSearch = matchSearchTerm(serviceNamesText) || matchSearchTerm(serviceNameDisplay) || matchSearchTerm(pkgCategory);
          const matchStatus = statusFilter ? (pkgStatus === statusFilter || c.status === statusFilter) : true;

          if (matchSearch && matchStatus) {
            rows.push({
              rowId: `${c._id}_pkg_${pkg._id || pIdx}`,
              client: c,
              serviceName: serviceNameDisplay,
              serviceCategory: pkgCategory,
              startDate: pkgStartDate,
              endDate: pkgEndDate,
              status: pkgStatus,
              price: pkg.price || 0,
              totalWithGst: pkg.total || (pkg.price ? Math.round(pkg.price * 1.18) : 0),
              billingCycle: pkgBilling,
              pkgRef: pkg,
              deliverables: pkgServices
            });
          }
        });
      } else {
        const serviceName = 'No Active Service';
        const matchSearch = matchSearchTerm(serviceName);
        const matchStatus = statusFilter ? c.status === statusFilter : true;

        if (matchSearch && matchStatus) {
          rows.push({
            rowId: `${c._id}_fallback`,
            client: c,
            serviceName: 'No Active Service',
            serviceCategory: (c.totalRevenueGenerated || 0) > 50000 ? 'Premium' : 'Standard',
            startDate: c.serviceStartDate,
            endDate: c.serviceEndDate,
            status: c.status,
            price: 0,
            totalWithGst: c.totalRevenueGenerated || 0,
            billingCycle: 'N/A'
          });
        }
      }
    });

    // Datewise sorting: Newest start date / creation date first
    return rows.sort((a, b) => {
      const timeA = a.startDate ? new Date(a.startDate).getTime() : (a.client.createdAt ? new Date(a.client.createdAt).getTime() : 0);
      const timeB = b.startDate ? new Date(b.startDate).getTime() : (b.client.createdAt ? new Date(b.client.createdAt).getTime() : 0);
      if (timeA !== timeB) return timeB - timeA;
      return String(b.client._id).localeCompare(String(a.client._id));
    });
  };

  const filteredServiceRows = getFilteredServiceRows();
  const totalPages = Math.max(1, Math.ceil(filteredServiceRows.length / itemsPerPage));
  const startIndex = filteredServiceRows.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endIndex = Math.min(filteredServiceRows.length, currentPage * itemsPerPage);
  const displayedServiceRows = filteredServiceRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Excel / CSV Export
  const exportToCSV = () => {
    const headers = [
      'Client ID', 'Client Name', 'Business Name', 'Service Name', 'Category', 'Mobile', 
      'Email', 'Account Manager', 'Start Date', 'End Date', 'Price (INR)', 'Status'
    ];

    const rows = filteredServiceRows.map((r) => [
      r.client._id,
      r.client.name,
      r.client.companyName,
      r.serviceName,
      r.serviceCategory,
      r.client.phone || '',
      r.client.email,
      r.client.assignedAccountManager?.name || 'Unassigned',
      r.startDate ? new Date(r.startDate).toLocaleDateString('en-GB') : 'N/A',
      r.endDate ? new Date(r.endDate).toLocaleDateString('en-GB') : 'N/A',
      r.totalWithGst || r.price || 0,
      r.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CRM_Client_Services_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Directory Export
  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape
    doc.setFontSize(16);
    doc.text('CRM Client Active Services Listing', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 20);

    const tableData = filteredServiceRows.map(r => [
      r.client.companyName,
      r.client.name,
      r.serviceName,
      r.serviceCategory,
      r.client.phone || 'N/A',
      r.client.email,
      r.client.assignedAccountManager?.name || 'Unassigned',
      r.endDate ? new Date(r.endDate).toLocaleDateString('en-GB') : 'N/A',
      `INR ${(r.totalWithGst || r.price || 0).toLocaleString('en-IN')}`,
      r.status
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Business Name', 'Client Name', 'Service Name', 'Category', 'Mobile', 'Email', 'Account Manager', 'Expires', 'Revenue', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`CRM_Client_Services_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Renewal alerts calculations (Section 7)
  const getClientPackageExpiryAlerts = (pkg: any) => {
    if (!pkg.endDate || pkg.status !== 'Active') return null;
    
    const expiry = new Date(pkg.endDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    expiry.setHours(0,0,0,0);

    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Already Expired', color: '#dc2626', bg: '#fef2f2', days: diffDays };
    if (diffDays === 0) return { label: 'Expiring Today', color: '#ef4444', bg: '#fff5f5', days: 0 };
    if (diffDays <= 7) return { label: `Expiring in ${diffDays} Days`, color: '#f97316', bg: '#fff7ed', days: diffDays };
    if (diffDays <= 15) return { label: `Expiring in ${diffDays} Days`, color: '#eab308', bg: '#fefcbf', days: diffDays };
    if (diffDays <= 30) return { label: `Expiring in ${diffDays} Days`, color: '#3b82f6', bg: '#eff6ff', days: diffDays };
    
    return null;
  };

  return (
    <div className="client-module-container" style={{ padding: '20px' }}>
      
      {/* HEADER SECTION */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>
            {activeView === 'list' ? (
              'CRM Client Directory'
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                Client 360° Profile: {clientProfile?.companyName || 'Loading...'}
                {clientProfile?.isVerified && (
                  <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                    ✔ Verified
                  </span>
                )}
              </span>
            )}
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            CRM → Clients {activeView === 'detail' && `→ ${clientProfile?.name}`}
          </p>
        </div>
        <div>
          {activeView === 'detail' && (
            <button 
              onClick={() => { setActiveView('list'); setClientProfile(null); }}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 600 }}
            >
              <ArrowLeft size={16} /> Back to Directory
            </button>
          )}
        </div>
      </div>

      {/* alerts */}
      {successMsg && (
        <div style={{ padding: '12px 20px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Check size={20} /> <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div style={{ padding: '12px 20px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={20} /> <span>{errorMsg}</span>
        </div>
      )}

      {/* CLIENTS LIST TAB VIEW */}
      {activeView === 'list' && (
        <>
          {/* STATS COUNTERS WIDGETS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            
            <div className="chart-card" style={{ background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', padding: '20px', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Total Accounts</span>
                <Users size={18} color="#4f46e5" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '10px', color: '#1e293b' }}>{dashboardKPIs.totalCount}</h2>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Central Client Database size</div>
            </div>

            <div className="chart-card" style={{ background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', padding: '20px', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Active Clients</span>
                <CheckCircle size={18} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '10px', color: '#10b981' }}>{dashboardKPIs.activeCount}</h2>
              <div style={{ fontSize: '11px', color: '#10b981', marginTop: '6px' }}>Active subscriptions running</div>
            </div>

            <div className="chart-card" style={{ background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', padding: '20px', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Renewals Due</span>
                <AlertTriangle size={18} color="#f59e0b" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '10px', color: '#f59e0b' }}>{dashboardKPIs.renewalDueCount}</h2>
              <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px' }}>Expiries in 15 days or overdue</div>
            </div>

            {canSeeBillings && (
              <div className="chart-card" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Deal Won Amount</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(Number(e.target.value))}
                      style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '4px', color: 'white', padding: '2px 4px', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                    >
                      <option style={{ color: 'black' }} value={1}>Jan</option>
                      <option style={{ color: 'black' }} value={2}>Feb</option>
                      <option style={{ color: 'black' }} value={3}>Mar</option>
                      <option style={{ color: 'black' }} value={4}>Apr</option>
                      <option style={{ color: 'black' }} value={5}>May</option>
                      <option style={{ color: 'black' }} value={6}>Jun</option>
                      <option style={{ color: 'black' }} value={7}>Jul</option>
                      <option style={{ color: 'black' }} value={8}>Aug</option>
                      <option style={{ color: 'black' }} value={9}>Sep</option>
                      <option style={{ color: 'black' }} value={10}>Oct</option>
                      <option style={{ color: 'black' }} value={11}>Nov</option>
                      <option style={{ color: 'black' }} value={12}>Dec</option>
                    </select>
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '4px', color: 'white', padding: '2px 4px', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                    >
                      {[2025, 2026, 2027, 2028].map(y => (
                        <option key={y} style={{ color: 'black' }} value={y}>{y}</option>
                      ))}
                    </select>
                    <span style={{ color: '#10b981', fontWeight: 800, fontSize: '13px', marginLeft: '2px' }}>Rs</span>
                  </div>
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '10px' }}>Rs. {dashboardKPIs.monthlyDealWonAmount.toLocaleString('en-IN')}</h2>
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '6px' }}>Total deal value for selected month</div>
              </div>
            )}

          </div>

          {/* SEARCH FILTERS PANEL */}
          <div className="chart-card" style={{ padding: '18px', borderRadius: '12px', background: 'white', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Search Directory</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ paddingLeft: '32px', marginBottom: 0 }}
                    placeholder="Search by Name, Company, Email, Mobile..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Client Status</label>
                <select className="input-field" style={{ marginBottom: 0 }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Renewal Due">Renewal Due</option>
                  <option value="Expired">Expired</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Account Manager</label>
                <select className="input-field" style={{ marginBottom: 0 }} value={managerFilter} onChange={(e) => { setManagerFilter(e.target.value); setCurrentPage(1); }}>
                  <option value="">All Managers</option>
                  {usersList.filter(u => {
                    const rName = (u.role?.name || '').toLowerCase();
                    return rName.includes('bdm') || rName.includes('business development');
                  }).map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Verification</label>
                <select className="input-field" style={{ marginBottom: 0 }} value={verificationFilter} onChange={(e) => { setVerificationFilter(e.target.value); setCurrentPage(1); }}>
                  <option value="">All Verification</option>
                  <option value="Verified">Verified</option>
                  <option value="Not Verified">Not Verified</option>
                </select>
              </div>

              {/* Exports Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={exportToCSV}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '9px 14px' }}
                >
                  <Download size={14} /> Export CSV
                </button>
                <button 
                  onClick={exportToPDF}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '9px 14px' }}
                >
                  <FileText size={14} /> Export PDF
                </button>
              </div>

            </div>
          </div>

          {/* CLIENT LIST TABLE GRID */}
          <div className="chart-card" style={{ padding: 0, borderRadius: '12px', overflow: 'hidden', background: 'white' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '16px' }}>Business / Client</th>
                  <th style={{ padding: '16px' }}>Category</th>
                  <th style={{ padding: '16px' }}>Contact Coordinates</th>
                  <th style={{ padding: '16px' }}>Account Manager</th>
                  <th style={{ padding: '16px' }}>Service Period</th>
                  <th style={{ padding: '16px', textAlign: 'center' }}>Active Services</th>
                  <th style={{ padding: '16px', textAlign: 'center' }}>Expires Service</th>
                  <th style={{ padding: '16px' }}>Total Revenue</th>
                  <th style={{ padding: '16px' }}>Status</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
                      Loading Clients & Active Services...
                    </td>
                  </tr>
                ) : displayedServiceRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      No services found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  displayedServiceRows.map(row => {
                    const c = row.client;
                    return (
                      <tr key={row.rowId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{c.companyName}</div>
                            {c.isVerified && (
                              <span style={{ 
                                background: '#ecfdf5', 
                                color: '#059669', 
                                border: '1px solid #a7f3d0', 
                                padding: '1px 6px', 
                                borderRadius: '4px', 
                                fontSize: '10px', 
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                ✔ Verified
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{c.name}</div>
                          {row.deliverables && row.deliverables.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                              {row.deliverables.map((srv: any, idx: number) => (
                                <div key={idx} style={{ 
                                  fontSize: '12px', 
                                  fontWeight: 700, 
                                  color: '#1d4ed8', 
                                  background: '#eff6ff', 
                                  border: '1px solid #bfdbfe',
                                  padding: '2px 8px', 
                                  borderRadius: '6px', 
                                  display: 'inline-block',
                                  width: 'fit-content'
                                }}>
                                  🛠️ {srv.name || row.serviceName}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ 
                              fontSize: '12px', 
                              fontWeight: 700, 
                              color: '#1d4ed8', 
                              marginTop: '4px', 
                              background: '#eff6ff', 
                              border: '1px solid #bfdbfe',
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              display: 'inline-block' 
                            }}>
                              🛠️ {row.serviceName}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: row.serviceCategory.toLowerCase().includes('premium') || (c.totalRevenueGenerated || 0) > 50000 ? '#f0fdf4' : '#f1f5f9',
                            color: row.serviceCategory.toLowerCase().includes('premium') || (c.totalRevenueGenerated || 0) > 50000 ? '#15803d' : '#475569',
                            border: row.serviceCategory.toLowerCase().includes('premium') || (c.totalRevenueGenerated || 0) > 50000 ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                          }}>
                            {row.serviceCategory}
                          </span>
                        </td>
                        <td style={{ padding: '16px', fontSize: '12px', color: '#475569' }}>
                          <div>📧 {c.email}</div>
                          <div>📱 {c.phone || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '16px', fontSize: '13px', color: '#334155' }}>
                          {c.assignedAccountManager?.name || <span style={{ color: '#94a3b8' }}>Unassigned</span>}
                        </td>
                        <td style={{ padding: '16px', fontSize: '12.5px', color: '#334155' }}>
                          {row.startDate ? (
                            <div>
                              <div><strong>Start:</strong> {new Date(row.startDate as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                              <div style={{ marginTop: '2px' }}><strong>End:</strong> {new Date(row.endDate as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                              {(() => {
                                const today = new Date();
                                const end = new Date(row.endDate as string);
                                const diffTime = end.getTime() - today.getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                if (diffDays >= 0 && diffDays <= 60) {
                                  return (
                                    <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '10px', marginTop: '4px', background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      ⚠️ Expiring in {diffDays} days!
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>No Active Service</span>
                          )}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: 600, color: '#059669' }}>
                          {c.activeServicesCount || 0}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center', fontSize: '12.5px', color: '#475569' }}>
                          {(() => {
                            const expDate = row.endDate || c.serviceEndDate || c.lastExpiredServiceDate;
                            if (!expDate) return <span style={{ color: '#94a3b8' }}>N/A</span>;
                            
                            const d = new Date(expDate as string);
                            const dateFormattedUS = d.toLocaleDateString('en-US'); // e.g., 9/23/2027
                            const dateFormattedGB = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); // e.g., 23 Sept 2027

                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const diffTime = d.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            const isExpired = diffDays < 0 || row.status === 'Expired';
                            const isExpiringSoon = diffDays >= 0 && diffDays <= 30;

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ 
                                  fontSize: '12px', 
                                  fontWeight: 700, 
                                  color: isExpired ? '#dc2626' : isExpiringSoon ? '#d97706' : '#2563eb' 
                                }}>
                                  Expires: {dateFormattedUS}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  ({dateFormattedGB})
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '16px', fontWeight: 700, color: '#1e293b' }}>
                          INR {(row.totalWithGst || row.price || c.totalRevenueGenerated || 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '16px' }}>
                          {(() => {
                            const expDate = row.endDate || c.serviceEndDate || c.lastExpiredServiceDate;
                            let isExpired = row.status === 'Expired' || c.status === 'Expired' || c.projectStatus === 'Inactive';
                            if (expDate) {
                              const d = new Date(expDate as string);
                              d.setHours(0,0,0,0);
                              const today = new Date();
                              today.setHours(0,0,0,0);
                              if (d.getTime() < today.getTime()) isExpired = true;
                            }
                            const displayStatus = isExpired ? '⛔ Inactive' : row.status;
                            return (
                              <span style={{ 
                                padding: '4px 10px', 
                                borderRadius: '12px', 
                                fontSize: '11px', 
                                fontWeight: 700,
                                background: isExpired ? '#fee2e2' : row.status === 'Active' ? '#d1fae5' : row.status === 'Renewal Due' ? '#fef3c7' : '#f1f5f9',
                                color: isExpired ? '#dc2626' : row.status === 'Active' ? '#065f46' : row.status === 'Renewal Due' ? '#b45309' : '#475569',
                                border: isExpired ? '1px solid #fca5a5' : '1px solid #e2e8f0'
                              }}>
                                {displayStatus}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleClientClick(c._id)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontWeight: 600 }}
                          >
                            <Activity size={14} /> Profile 360
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', alignItems: 'center', borderTop: '1px solid #f1f5f9', background: '#ffffff', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                  Showing {filteredServiceRows.length > 0 ? `${startIndex}–${endIndex}` : '0'} of {filteredServiceRows.length} active service rows
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                  <span>Rows per page:</span>
                  <select 
                    value={itemsPerPage} 
                    onChange={e => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(currentPage - 1)} 
                  className="btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '13px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                
                {(() => {
                  const pages: number[] = [];
                  const maxButtons = 5;
                  let start = Math.max(1, currentPage - 2);
                  let end = Math.min(totalPages, start + maxButtons - 1);
                  if (end - start + 1 < maxButtons) {
                    start = Math.max(1, end - maxButtons + 1);
                  }
                  for (let i = start; i <= end; i++) {
                    pages.push(i);
                  }
                  return pages.map(pNum => (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: pNum === currentPage ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: pNum === currentPage ? '#2563eb' : 'white',
                        color: pNum === currentPage ? 'white' : '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      {pNum}
                    </button>
                  ));
                })()}

                <button 
                  disabled={currentPage >= totalPages} 
                  onClick={() => setCurrentPage(currentPage + 1)} 
                  className="btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '13px', opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </>
      )}

      {/* CLIENT 360 DEGREE DETAILED PROFILE VIEW */}
      {activeView === 'detail' && (
        <div>
          {detailLoading || !clientProfile ? (
            <div className="chart-card" style={{ padding: '60px', textAlign: 'center', background: 'white' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 15px auto', color: '#3b82f6' }} />
              Loading Client 360° Profile details...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              
              {/* LEFT PROFILE CONTENT */}
              <div>
                
                {/* Tabs selection */}
                <div style={{ display: 'flex', gap: '5px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px', paddingBottom: '2px' }}>
                  {(isCustomerCare 
                    ? ['overview', 'services', 'support_summary', 'timeline'] 
                    : ['overview', 'services', 'billing', 'documents', 'timeline', 'audit']
                  ).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveProfileTab(tab as any)}
                      style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: 'transparent',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                        color: activeProfileTab === tab ? '#3b82f6' : '#64748b',
                        borderBottom: activeProfileTab === tab ? '3px solid #3b82f6' : '3px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab === 'support_summary' ? 'SUPPORT & MESSAGES' : tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* TAB 1: OVERVIEW & PROFILE CARD */}
                {activeProfileTab === 'overview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* SECTION 1: BUSINESS INFORMATION CARD */}
                    <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}><Building size={18} /> Business Information</h3>
                        {isAdmin && (
                          <button onClick={openEditModal} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Edit size={14} /> Edit Coordinates
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <h4 style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Basic Information</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                            <div><strong>Client Name:</strong> {clientProfile.name}</div>
                            <div><strong>Company Name:</strong> {clientProfile.companyName}</div>
                            <div><strong>Contact Person/Designation:</strong> {clientProfile.contactPerson || 'N/A'} {clientProfile.designation ? `(${clientProfile.designation})` : ''}</div>
                            <div><strong>Mobile / Phone:</strong> {clientProfile.phone || 'N/A'}</div>
                            <div><strong>WhatsApp No:</strong> {clientProfile.whatsAppNumber || 'N/A'}</div>
                            <div><strong>Alternate Mobile:</strong> {clientProfile.alternateNumber || 'N/A'}</div>
                            <div><strong>Email Address:</strong> {clientProfile.email}</div>
                            <div><strong>Alternate Email:</strong> {clientProfile.alternateEmail || 'N/A'}</div>
                          </div>
                        </div>

                        <div>
                          <h4 style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Business Identifiers</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginBottom: '15px' }}>
                            <div><strong>Category:</strong> {(clientProfile.totalRevenueGenerated || 0) > 50000 ? 'Premium' : 'Standard'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong>GSTIN Number:</strong> {clientProfile.gstNumber || 'N/A'}
                              {clientProfile.gstNumber && clientProfile.isGstVerified && (
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
                            <div><strong>PAN Number:</strong> {clientProfile.panNumber || 'N/A'}</div>
                            <div><strong>CIN Number:</strong> {clientProfile.cinNumber || 'N/A'}</div>
                          </div>

                          <h4 style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Address Details</h4>
                          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                            {clientProfile.addressLine1 || clientProfile.address || 'N/A'}<br />
                            {clientProfile.addressLine2 && <>{clientProfile.addressLine2}<br /></>}
                            {clientProfile.city && `${clientProfile.city}, `} {clientProfile.state && `${clientProfile.state} - `} {clientProfile.pinCode}<br />
                            <strong>Country:</strong> {clientProfile.country || 'India'}
                          </div>
                        </div>
                      </div>

                      {/* Online Presence */}
                      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '20px', paddingTop: '15px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Online presence link mappings</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', fontSize: '13px' }}>
                          {clientProfile.websiteUrl && (
                            <a href={clientProfile.websiteUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2563eb', textDecoration: 'none' }}>
                              <Globe size={14} /> Website <ExternalLink size={10} />
                            </a>
                          )}
                          {clientProfile.facebookUrl && (
                            <a href={clientProfile.facebookUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3b5998', textDecoration: 'none' }}>
                              <span>📘 Facebook</span> <ExternalLink size={10} />
                            </a>
                          )}
                          {clientProfile.instagramUrl && (
                            <a href={clientProfile.instagramUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e1306c', textDecoration: 'none' }}>
                              <span>📸 Instagram</span> <ExternalLink size={10} />
                            </a>
                          )}
                          {clientProfile.linkedInUrl && (
                            <a href={clientProfile.linkedInUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0077b5', textDecoration: 'none' }}>
                              <span>💼 LinkedIn</span> <ExternalLink size={10} />
                            </a>
                          )}
                          {clientProfile.youtubeUrl && (
                            <a href={clientProfile.youtubeUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ff0000', textDecoration: 'none' }}>
                              <span>🎥 YouTube</span> <ExternalLink size={10} />
                            </a>
                          )}
                          {clientProfile.googleBusinessProfileUrl && (
                            <a href={clientProfile.googleBusinessProfileUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', textDecoration: 'none' }}>
                              <MapPin size={14} /> Google GBP <ExternalLink size={10} />
                            </a>
                          )}
                          {!clientProfile.websiteUrl && !clientProfile.facebookUrl && !clientProfile.instagramUrl && !clientProfile.linkedInUrl && !clientProfile.youtubeUrl && !clientProfile.googleBusinessProfileUrl && (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No social links configured.</span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* SECTION 10: BUSINESS DETAILS & SERVICES VERIFICATION */}
                    <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Business Details & Services Verification
                        </h3>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          {/* Verify & Submit Button (Only visible if not verified) */}
                          {!clientProfile.isVerified && (isCustomerCare || isAdmin) && (
                            <button 
                              onClick={() => setShowVerifyModal(true)}
                              className="btn-primary"
                              style={{ padding: '6px 16px', fontSize: '13px', background: '#059669', borderColor: '#059669' }}
                            >
                              Verify & Submit
                            </button>
                          )}

                          {/* Admin Override */}
                          {clientProfile.isVerified && isAdmin && (
                            <button 
                              onClick={() => handleOverrideVerification(false)}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '12px', color: '#ef4444', borderColor: '#fca5a5' }}
                            >
                              Override (Unverify)
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Verification Status UI */}
                      {clientProfile.isVerified ? (
                        <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '8px', border: '1px solid #a7f3d0', marginBottom: '20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
                            <span>✅ Verified</span>
                          </div>
                          {clientProfile.verificationDetails && (
                            <div style={{ fontSize: '13px', color: '#065f46', lineHeight: 1.6 }}>
                              <strong>Verified by:</strong> {clientProfile.verificationDetails.verifiedBy}<br />
                              <strong>Verified on:</strong> {new Date(clientProfile.verificationDetails.verifiedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background: '#fdf2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '20px', color: '#b91c1c', fontSize: '13.5px', fontWeight: 600 }}>
                          ❌ Unverified Client (Please complete the details and verify profile)
                        </div>
                      )}

                      {/* business coordinates */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Company Name</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.companyName || 'N/A'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Business Type</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.businessType || 'N/A'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Industry</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.industry || 'N/A'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Business Category</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.businessCategory || 'N/A'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Registration Number</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.companyRegistrationNumber || 'N/A'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>GST Number</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {clientProfile.gstNumber || 'N/A'}
                            {clientProfile.gstNumber && clientProfile.isGstVerified && (
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
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>PAN Number</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.panNumber || 'N/A'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Website</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>
                            {clientProfile.websiteUrl ? <a href={clientProfile.websiteUrl.startsWith('http') ? clientProfile.websiteUrl : `https://${clientProfile.websiteUrl}`} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>{clientProfile.websiteUrl}</a> : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Company Email</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.companyEmail || 'N/A'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Company Phone</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.companyPhone || 'N/A'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Number of Employees</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.numberOfEmployees || 'N/A'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Tech Stack</label>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.techStack || 'N/A'}</div>
                        </div>
                      </div>

                      {/* address */}
                      <div style={{ marginBottom: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b' }}>Business Address</h4>
                        <div style={{ fontSize: '14px', color: '#1e293b', lineHeight: 1.5 }}>
                          {clientProfile.addressLine1 || clientProfile.address || 'N/A'}<br />
                          {clientProfile.addressLine2 && <>{clientProfile.addressLine2}<br /></>}
                          {clientProfile.city && `${clientProfile.city}, `} {clientProfile.state && `${clientProfile.state} - `} {clientProfile.pinCode}<br />
                          <strong>Country:</strong> {clientProfile.country || 'India'}
                        </div>
                      </div>

                      {/* contact person */}
                      <div style={{ marginBottom: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b' }}>Contact Person Details</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                          <div>
                            <label style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Primary Contact Name</label>
                            <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.name || 'N/A'}</div>
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Designation</label>
                            <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.designation || 'N/A'}</div>
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Mobile Number</label>
                            <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.phone || 'N/A'}</div>
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Email Address</label>
                            <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{clientProfile.email || 'N/A'}</div>
                          </div>
                        </div>
                      </div>

                      {/* additional info */}
                      <div style={{ marginBottom: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Business Description</label>
                            <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>{clientProfile.description || 'No description provided.'}</div>
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Competitor Information</label>
                            <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>{clientProfile.competitors || 'No competitor details provided.'}</div>
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Remarks</label>
                            <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>{clientProfile.remarks || 'No remarks.'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Edit Details Action Button */}
                      {(isCustomerCare || isAdmin) && (
                        <button 
                          onClick={() => {
                            setEditForm(clientProfile);
                            setShowEditModal(true);
                          }}
                          className="btn-secondary" 
                          style={{ width: '100%', padding: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <Edit size={16} /> Edit & Verify Business Details
                        </button>
                      )}
                    </div>

                    {/* SECTION 11: PROJECT DEVELOPMENT & TEAM MEMBERS ASSIGNMENT */}
                    <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '12px', marginTop: '24px', border: clientProfile.isVerified ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={18} color="#2563eb" /> Project Development & Team Assignment
                          </h3>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                            {clientProfile.isVerified 
                              ? 'Verification completed. Service Manager, Admin, and Super Admin can assign team members for development.' 
                              : '⚠️ Complete client verification above to unlock development team assignment.'}
                          </p>
                        </div>
                        {clientProfile.isVerified && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {(() => {
                              const isPendingTeam = (!clientProfile.assignedTeamMembers || clientProfile.assignedTeamMembers.length === 0) || clientProfile.projectStatus === 'Pending Verification' || clientProfile.projectStatus === 'Pending Team Members' || clientProfile.projectStatus === 'Pending Team Assignment';
                              const statusText = isPendingTeam ? 'Pending Team Members' : (clientProfile.projectStatus || 'Assigned for Development');
                              return (
                                <span style={{ 
                                  padding: '4px 10px', 
                                  borderRadius: '20px', 
                                  fontSize: '11px', 
                                  fontWeight: 700,
                                  background: isPendingTeam ? '#fffbeb' : '#eff6ff', 
                                  color: isPendingTeam ? '#b45309' : '#1d4ed8', 
                                  border: isPendingTeam ? '1px solid #fcd34d' : '1px solid #bfdbfe' 
                                }}>
                                  {statusText}
                                </span>
                              );
                            })()}
                            {canManageProjectTeam && clientProfile.assignedTeamMembers && clientProfile.assignedTeamMembers.length > 0 && (
                              <button 
                                onClick={() => {
                                  const currentTeamIds = (clientProfile.assignedTeamMembers || []).map((u: any) => u._id || u);
                                  setSelectedTeamMemberIds(currentTeamIds);
                                  setSelectedProjectStatus(clientProfile.projectStatus || 'Assigned for Development');
                                  setShowAssignTeamModal(true);
                                }}
                                className="btn-secondary"
                                style={{ padding: '6px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Users size={14} /> Edit / Manage Team Members
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      {!clientProfile.isVerified ? (
                        <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                          🔒 <strong>Verification Pending:</strong> Once the Customer Care Executive verifies this client profile, the Service Manager can select multiple team members to assign this project for development.
                        </div>
                      ) : (
                        <div>
                          {(!clientProfile.assignedTeamMembers || clientProfile.assignedTeamMembers.length === 0) ? (
                            <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #93c5fd', textAlign: 'center' }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>No Development Team Members Assigned Yet</div>
                              <p style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '16px' }}>
                                {canManageProjectTeam 
                                  ? 'Click below to select one or multiple team members (developers, designers, SEO specialists) for this project.'
                                  : 'Project development team members can be assigned by Service Manager, Admin, or Super Admin.'}
                              </p>
                              {canManageProjectTeam && (
                                <button 
                                  onClick={() => {
                                    setSelectedTeamMemberIds([]);
                                    setShowAssignTeamModal(true);
                                  }}
                                  className="btn-primary"
                                  style={{ padding: '8px 20px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                  + Choose Team Members (Multiple Selection)
                                </button>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>
                                Currently Assigned Development Team ({clientProfile.assignedTeamMembers.length} Members)
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                                {clientProfile.assignedTeamMembers.map((member: any) => {
                                  const roleName = (typeof member.role === 'object' ? member.role?.name : member.role) || 'Staff';
                                  return (
                                    <div key={member._id || member} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px' }}>
                                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px' }}>
                                        {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {member.name || 'Team Member'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {member.email || 'N/A'}
                                        </div>
                                        <span style={{ display: 'inline-block', marginTop: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                                          {roleName}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* TAB 2: PACKAGES & SERVICES HISTORY */}
                {activeProfileTab === 'services' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: 700 }}>Purchased Services Management</h2>
                      {(isCustomerCare || isAdmin) && (
                        <button 
                          onClick={() => {
                            setServiceForm({
                              name: '',
                              category: '',
                              startDate: '',
                              endDate: '',
                              status: 'Active',
                              description: '',
                              price: 0,
                              renewalDate: '',
                              assignedTeam: '',
                              deliverables: []
                            });
                            setShowAddServiceModal(true);
                          }}
                          className="btn-primary"
                          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          + Add Service
                        </button>
                      )}
                    </div>

                    {packagesHistory.length === 0 ? (
                      <div className="chart-card" style={{ background: 'white', padding: '40px', textAlign: 'center', color: '#94a3b8', borderRadius: '12px' }}>
                        No purchased services registered for this client.
                      </div>
                    ) : (
                      packagesHistory.map(pkg => {
                        const srvName = pkg.services?.[0]?.name || pkg.package?.name || 'Custom Plan';
                        return (
                          <div key={pkg._id} className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            
                            {/* Service Card Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                              <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1e293b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {srvName}
                                  {pkg.services?.[0]?.category && (
                                    <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                                      {pkg.services[0].category}
                                    </span>
                                  )}
                                </h3>
                                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '10px' }}>
                                  <span>Team: <strong>{pkg.assignedTeam || 'Unassigned'}</strong></span>
                                  <span>•</span>
                                  <span>Amount: <strong>Rs. {(pkg.price || 0).toLocaleString('en-IN')}</strong></span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ 
                                  padding: '4px 10px', 
                                  borderRadius: '20px', 
                                  fontSize: '11px', 
                                  fontWeight: 700,
                                  background: pkg.status === 'Active' ? '#ecfdf5' : pkg.status === 'In Progress' ? '#eff6ff' : pkg.status === 'Completed' ? '#faf5ff' : pkg.status === 'Expired' ? '#fdf2f2' : '#fffbeb',
                                  color: pkg.status === 'Active' ? '#059669' : pkg.status === 'In Progress' ? '#1d4ed8' : pkg.status === 'Completed' ? '#7c3aed' : pkg.status === 'Expired' ? '#dc2626' : '#d97706',
                                  border: pkg.status === 'Active' ? '1px solid #a7f3d0' : pkg.status === 'In Progress' ? '1px solid #bfdbfe' : pkg.status === 'Completed' ? '1px solid #e9d5ff' : pkg.status === 'Expired' ? '1px solid #fecaca' : '1px solid #fef3c7'
                                }}>
                                  {pkg.status}
                                </span>
                                {(isCustomerCare || isAdmin) && (
                                  <button 
                                    onClick={() => {
                                      setCurrentService(pkg);
                                      setServiceForm({
                                        name: srvName,
                                        category: pkg.services?.[0]?.category || '',
                                        startDate: pkg.startDate ? pkg.startDate.split('T')[0] : '',
                                        endDate: pkg.endDate ? pkg.endDate.split('T')[0] : '',
                                        status: pkg.status || 'Active',
                                        description: pkg.notes || '',
                                        price: pkg.price || 0,
                                        renewalDate: pkg.renewalDate ? pkg.renewalDate.split('T')[0] : '',
                                        assignedTeam: pkg.assignedTeam || '',
                                        deliverables: pkg.services?.[0]?.deliverables || []
                                      });
                                      setShowEditServiceModal(true);
                                    }}
                                    className="btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Service Card Details Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '20px', fontSize: '13.5px', color: '#334155', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Package / Plan Name</span>
                                <strong style={{ color: '#1e293b' }}>{pkg.package?.name || 'Custom Plan'}</strong>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Service Period</span>
                                <span><strong>Start:</strong> {pkg.startDate ? new Date(pkg.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                                <span style={{ marginLeft: '12px' }}><strong>Expiry:</strong> {pkg.endDate ? new Date(pkg.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Renewal Date</span>
                                <strong>{pkg.renewalDate ? new Date(pkg.renewalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</strong>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Assigned Owner/Team</span>
                                <strong>{pkg.assignedTeam || 'Unassigned'}</strong>
                              </div>
                              <div style={{ gridColumn: 'span 2' }}>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Description & Internal Remarks</span>
                                <span style={{ fontStyle: 'italic' }}>{pkg.notes || 'No description or remarks provided.'}</span>
                              </div>
                              <div style={{ gridColumn: 'span 2' }}>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>Included Deliverables & Service Pricing Details</span>
                                {(() => {
                                  const servicesToRender = allServices.length > 0 ? allServices.filter(s => s.status === 'Active') : (pkg.services || []);
                                  if (servicesToRender.length > 0) {
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {servicesToRender.map((srv: any, sIdx: number) => {
                                          // Check if srv is a predefined service or local service
                                          const isPredefined = !!srv._id;
                                          const srvName = srv.name;
                                          const srvId = srv._id;

                                          const matchingPurchased = (pkg.services || []).find((s: any) => 
                                            (isPredefined && String(s.serviceId?._id || s.serviceId || s._id) === String(srvId)) || 
                                            s.name === srvName
                                          );
                                          const isServiceChecked = !!matchingPurchased;
                                          const activeDeliverables = matchingPurchased ? (matchingPurchased.deliverables || []) : [];

                                          // Find matching predefined details
                                          const matchedPredefinedDetails = isPredefined ? allServiceDetails.filter(d => {
                                            const dServiceId = d.service?._id || d.service;
                                            return d.status === 'Active' && dServiceId && String(dServiceId) === String(srvId);
                                          }) : [];

                                          return (
                                            <div key={sIdx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#f8fafc', borderColor: isServiceChecked ? '#bfdbfe' : '#e2e8f0' }}>
                                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#1e293b', fontSize: '14.5px', cursor: 'pointer', marginBottom: isServiceChecked && matchedPredefinedDetails.length > 0 ? '12px' : '0' }}>
                                                <input 
                                                  type="checkbox" 
                                                  checked={isServiceChecked} 
                                                  onChange={() => handleToggleService(pkg._id, srv)}
                                                />
                                                <span>{srvName}</span>
                                                {isServiceChecked && (
                                                  <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 8px', borderRadius: '12px', marginLeft: '6px', fontWeight: 600 }}>
                                                    Purchased
                                                  </span>
                                                )}
                                              </label>

                                              {isServiceChecked && matchedPredefinedDetails.length > 0 && (
                                                <div style={{ paddingLeft: '24px', borderLeft: '2px dashed #cbd5e1', marginLeft: '8px', marginTop: '10px' }}>
                                                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Choose Service Details / Pricing Items:</div>
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {matchedPredefinedDetails.map(d => {
                                                      const isDetailSelected = 
                                                        (pkg.serviceDetails || []).some((id: any) => String(id?._id || id) === String(d._id)) ||
                                                        activeDeliverables.some((del: any) => 
                                                          del.key === d.name || 
                                                          del.value === d.name || 
                                                          (del.serviceDetailId && String(del.serviceDetailId) === String(d._id))
                                                        );

                                                      return (
                                                        <label key={d._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #f1f5f9', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: isDetailSelected ? '#eff6ff' : '#ffffff', borderColor: isDetailSelected ? '#bfdbfe' : '#e2e8f0' }}>
                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <input 
                                                              type="checkbox" 
                                                              checked={isDetailSelected} 
                                                              onChange={() => handleToggleDeliverable(pkg._id, srvId, d)} 
                                                            />
                                                            <span style={{ color: '#334155' }}>{d.name}</span>
                                                          </div>
                                                          <span style={{ fontWeight: 700, color: '#2563eb' }}>₹{(d.price || 0).toLocaleString('en-IN')}</span>
                                                        </label>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}

                                              {isServiceChecked && matchedPredefinedDetails.length === 0 && activeDeliverables.length > 0 && (
                                                <div style={{ paddingLeft: '24px', borderLeft: '2px dashed #cbd5e1', marginLeft: '8px', marginTop: '10px' }}>
                                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                    <thead>
                                                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>
                                                        <th style={{ padding: '8px 12px' }}>Description / Details</th>
                                                        <th style={{ padding: '8px 12px' }}>Service Component Name</th>
                                                        <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Price</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody style={{ color: '#334155' }}>
                                                      {activeDeliverables.map((d: any, idx: number) => (
                                                        <tr key={idx} style={{ borderBottom: idx < activeDeliverables.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                          <td style={{ padding: '8px 12px' }}>{d.key || 'N/A'}</td>
                                                          <td style={{ padding: '8px 12px' }}>{d.value || 'N/A'}</td>
                                                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                                                            {d.price !== undefined ? `INR ${(d.price || 0).toLocaleString('en-IN')}` : 'INR 0'}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}

                                        {pkg.isChanged && (
                                          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', alignItems: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '16px' }}>
                                            <button 
                                              onClick={() => handleSavePackageDeliverables(pkg)}
                                              className="btn-primary" 
                                              style={{ padding: '8px 16px', fontSize: '13px' }}
                                            >
                                              Save Deliverables & Update Pricing
                                            </button>
                                            <button 
                                              onClick={() => fetchClientProfile(selectedClientId!)}
                                              className="btn-secondary" 
                                              style={{ padding: '8px 16px', fontSize: '13px' }}
                                            >
                                              Reset / Cancel
                                            </button>
                                            <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                                              * Unsaved changes! New Package price: Rs. {(pkg.price || 0).toLocaleString('en-IN')}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } else {
                                    return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Standard features included.</span>;
                                  }
                                })()}
                              </div>
                              {pkg.lastUpdatedBy && (
                                <div style={{ gridColumn: 'span 2', fontSize: '11.5px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>
                                  Last updated by <strong>{pkg.lastUpdatedBy}</strong> on {new Date(pkg.lastUpdatedAt as string).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>

                            {/* Features Section */}
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '13px', color: '#334155', fontWeight: 700 }}>Additional Features & Custom Requirements</h4>
                                {(isCustomerCare || isAdmin) && (
                                  <button 
                                    onClick={() => {
                                      setCurrentService(pkg);
                                      setFeatureForm({
                                        name: '',
                                        description: '',
                                        status: 'Pending',
                                        estimatedCost: 0,
                                        approvalStatus: 'Pending'
                                      });
                                      setShowAddFeatureModal(true);
                                    }}
                                    style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                                  >
                                    + Add Feature
                                  </button>
                                )}
                              </div>

                              {(!pkg.features || pkg.features.length === 0) ? (
                                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                                  No additional custom features requested yet.
                                </div>
                              ) : (
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: 'white', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                    <thead>
                                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 12px' }}>Feature Name</th>
                                        <th style={{ padding: '8px 12px' }}>Description</th>
                                        <th style={{ padding: '8px 12px' }}>Status</th>
                                        <th style={{ padding: '8px 12px' }}>Cost</th>
                                        <th style={{ padding: '8px 12px' }}>Approval</th>
                                        {(isCustomerCare || isAdmin) && <th style={{ padding: '8px 12px', textAlign: 'center' }}>Actions</th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pkg.features.map((feat: any) => (
                                        <tr key={feat._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>{feat.name}</td>
                                          <td style={{ padding: '8px 12px', color: '#475569' }}>{feat.description || 'N/A'}</td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <span style={{ 
                                              padding: '2px 6px', 
                                              borderRadius: '4px', 
                                              fontSize: '10px', 
                                              fontWeight: 700,
                                              background: feat.status === 'Completed' ? '#dcfce7' : feat.status === 'In Progress' ? '#dbeafe' : '#f1f5f9',
                                              color: feat.status === 'Completed' ? '#15803d' : feat.status === 'In Progress' ? '#1d4ed8' : '#475569'
                                            }}>{feat.status}</span>
                                          </td>
                                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>Rs. {(feat.estimatedCost || 0).toLocaleString('en-IN')}</td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <span style={{ 
                                              padding: '2px 6px', 
                                              borderRadius: '4px', 
                                              fontSize: '10px', 
                                              fontWeight: 700,
                                              background: feat.approvalStatus === 'Approved' ? '#ecfdf5' : feat.approvalStatus === 'Rejected' ? '#fdf2f2' : '#fffbeb',
                                              color: feat.approvalStatus === 'Approved' ? '#065f46' : feat.approvalStatus === 'Rejected' ? '#991b1b' : '#92400e'
                                            }}>{feat.approvalStatus}</span>
                                          </td>
                                          {(isCustomerCare || isAdmin) && (
                                            <td style={{ padding: '8px 12px', textAlign: 'center', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                              <button 
                                                onClick={() => {
                                                  setCurrentService(pkg);
                                                  setCurrentFeature(feat);
                                                  setFeatureForm({
                                                    name: feat.name,
                                                    description: feat.description || '',
                                                    status: feat.status || 'Pending',
                                                    estimatedCost: feat.estimatedCost || 0,
                                                    approvalStatus: feat.approvalStatus || 'Pending'
                                                  });
                                                  setShowEditFeatureModal(true);
                                                }}
                                                style={{ border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                              >
                                                Edit
                                              </button>
                                              {(isCustomerCare || isAdmin) && (
                                                <button 
                                                  onClick={() => handleDeleteFeature(pkg._id, feat._id)}
                                                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                                >
                                                  Delete
                                                </button>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* TAB 3: BILLING & PAYMENT HISTORY */}
                {activeProfileTab === 'billing' && (
                  <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '12px' }}>
                    <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b' }}>
                      Invoices & Payment History Table
                    </h3>

                    {invoicesHistory.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                        No invoices generated for this client yet.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '12px' }}>Invoice No</th>
                              <th style={{ padding: '12px' }}>Invoice Date</th>
                              <th style={{ padding: '12px' }}>Invoice Amount</th>
                              <th style={{ padding: '12px' }}>GST Tax Amount</th>
                              <th style={{ padding: '12px' }}>Paid Amount</th>
                              <th style={{ padding: '12px' }}>Balance Due</th>
                              <th style={{ padding: '12px' }}>Payment Method</th>
                              <th style={{ padding: '12px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoicesHistory.map(inv => (
                              <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px', fontWeight: 600 }}>{inv.invoiceNumber}</td>
                                <td style={{ padding: '12px' }}>{new Date(inv.createdAt).toLocaleDateString('en-IN')}</td>
                                <td style={{ padding: '12px', fontWeight: 600 }}>INR {inv.amount.toFixed(2)}</td>
                                <td style={{ padding: '12px', color: '#64748b' }}>INR {inv.tax.toFixed(2)}</td>
                                <td style={{ padding: '12px', color: '#059669', fontWeight: 600 }}>INR {inv.paidAmount.toFixed(2)}</td>
                                <td style={{ padding: '12px', color: inv.dueAmount > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>INR {inv.dueAmount.toFixed(2)}</td>
                                <td style={{ padding: '12px', fontSize: '12px' }}>
                                  {inv.paymentMethod ? (
                                    <div>
                                      <div>💳 {inv.paymentMethod}</div>
                                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>ID: {inv.transactionId || 'N/A'}</div>
                                    </div>
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>N/A</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{ 
                                    padding: '2px 6px', 
                                    borderRadius: '8px', 
                                    fontSize: '11px', 
                                    background: inv.status === 'Paid' ? '#d1fae5' : inv.status === 'Partially Paid' ? '#cffafe' : '#fee2e2',
                                    color: inv.status === 'Paid' ? '#065f46' : inv.status === 'Partially Paid' ? '#0891b2' : '#b91c1c'
                                  }}>
                                    {inv.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: CLIENT DOCUMENTS */}
                {activeProfileTab === 'documents' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* SECTION 8: CLIENT DOCUMENTS MANAGER */}
                    <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '12px' }}>
                      <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b' }}>
                        Client Documents Vault
                      </h3>

                      {/* File Uploader */}
                      <form onSubmit={handleDocUpload} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.5fr', gap: '15px', alignItems: 'end', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Select File</label>
                          <input 
                            type="file" 
                            id="client-file-input"
                            className="input-field" 
                            style={{ padding: '5px', marginBottom: 0 }}
                            onChange={(e) => setDocFile(e.target.files ? e.target.files[0] : null)}
                            required
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Document Category</label>
                          <select className="input-field" style={{ marginBottom: 0 }} value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                            <option value="GST Certificate">GST Certificate</option>
                            <option value="PAN Card">PAN Card</option>
                            <option value="Trade License">Trade License</option>
                            <option value="Signed Agreement">Signed Agreement</option>
                            <option value="Proposal PDF">Proposal PDF</option>
                            <option value="Invoice PDF">Invoice PDF</option>
                            <option value="Other Document">Other Document</option>
                          </select>
                        </div>
                        <button type="submit" className="btn-primary" disabled={uploadingDoc || !docFile} style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <Upload size={16} /> {uploadingDoc ? 'Uploading...' : 'Upload'}
                        </button>
                      </form>

                      {/* Documents Directory */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                        {(clientProfile.documents || []).length === 0 ? (
                          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                            No client document records uploaded yet.
                          </div>
                        ) : (
                          clientProfile.documents.map(doc => (
                            <div key={doc._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileText size={24} color="#64748b" />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#334155', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {doc.fileName}
                                  </div>
                                  <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#4f46e5', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                    {doc.fileType}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <a 
                                  href={`${doc.fileUrl}`}
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="btn-secondary" 
                                  style={{ padding: '6px', minWidth: 'auto', background: '#eff6ff', border: '1px solid #bfdbfe' }}
                                  title="Download / View"
                                >
                                  <Download size={14} color="#2563eb" />
                                </a>
                                {isAdmin && (
                                  <button 
                                    onClick={() => handleDeleteDoc(doc._id || '')}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                                    onMouseOver={e => e.currentTarget.style.color = '#dc2626'}
                                    onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
                                    title="Delete document"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {/* TAB: SUPPORT & MESSAGES (Customer Care Specific) */}
                {activeProfileTab === 'support_summary' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* SECTION 1: KEY METRICS GRID */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                      
                      {/* CARD 1: Next Renewal Date */}
                      <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ background: '#eff6ff', color: '#2563eb', padding: '12px', borderRadius: '10px' }}>
                          <RefreshCw size={24} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Next Renewal Date</span>
                          <strong style={{ fontSize: '16px', color: '#1e293b' }}>
                            {(() => {
                              const activePkgs = packagesHistory.filter(p => p.status === 'Active' || p.status === 'Pending Renewal');
                              const nextRenewal = activePkgs.length > 0 
                                ? activePkgs.reduce((earliest, p) => {
                                    if (!p.renewalDate) return earliest;
                                    const pDate = new Date(p.renewalDate);
                                    return !earliest || pDate < earliest ? pDate : earliest;
                                  }, null as Date | null)
                                : null;
                              return nextRenewal 
                                ? nextRenewal.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'No Active Services';
                            })()}
                          </strong>
                        </div>
                      </div>

                      {/* CARD 2: Outstanding Balance Due */}
                      <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #e2e8f0' }}>
                        {(() => {
                          const totalPending = invoicesHistory.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
                          return (
                            <>
                              <div style={{ background: totalPending > 0 ? '#fdf2f2' : '#ecfdf5', color: totalPending > 0 ? '#ef4444' : '#10b981', padding: '12px', borderRadius: '10px' }}>
                                <DollarSign size={24} />
                              </div>
                              <div>
                                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Pending Amount</span>
                                <strong style={{ fontSize: '16px', color: totalPending > 0 ? '#ef4444' : '#10b981' }}>
                                  INR {totalPending.toLocaleString('en-IN')}
                                </strong>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* CARD 3: Services End Date */}
                      <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ background: '#f5f5f7', color: '#4b5563', padding: '12px', borderRadius: '10px' }}>
                          <CheckCircle size={24} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Services End Date</span>
                          <strong style={{ fontSize: '16px', color: '#1e293b' }}>
                            {(() => {
                              const activePkgs = packagesHistory.filter(p => p.status === 'Active' || p.status === 'Pending Renewal');
                              const nextEnd = activePkgs.length > 0 
                                ? activePkgs.reduce((earliest, p) => {
                                    if (!p.endDate) return earliest;
                                    const pDate = new Date(p.endDate);
                                    return !earliest || pDate < earliest ? pDate : earliest;
                                  }, null as Date | null)
                                : null;
                              const fallbackDate = nextEnd || (clientProfile.serviceEndDate ? new Date(clientProfile.serviceEndDate) : null);
                              return fallbackDate 
                                ? fallbackDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'No Active End Date';
                            })()}
                          </strong>
                        </div>
                      </div>

                      {/* CARD 4: Paid Amount */}
                      <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ background: '#ecfdf5', color: '#059669', padding: '12px', borderRadius: '10px' }}>
                          <DollarSign size={24} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Paid Amount</span>
                          <strong style={{ fontSize: '16px', color: '#059669' }}>
                            INR {(invoicesHistory.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)).toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>

                      {/* CARD 5: Paid Date */}
                      <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ background: '#fffbeb', color: '#d97706', padding: '12px', borderRadius: '10px' }}>
                          <Activity size={24} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Paid Date</span>
                          <strong style={{ fontSize: '16px', color: '#1e293b' }}>
                            {(() => {
                              let latest: any = null;
                              invoicesHistory.forEach(inv => {
                                if (inv.paymentDate) {
                                  const d = new Date(inv.paymentDate);
                                  if (!latest || d > latest) latest = d;
                                }
                                if (inv.payments) {
                                  inv.payments.forEach((p: any) => {
                                    if (p.paymentDate) {
                                      const d = new Date(p.paymentDate);
                                      if (!latest || d > latest) latest = d;
                                    }
                                  });
                                }
                              });
                              return latest 
                                ? latest.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'No Payments Yet';
                            })()}
                          </strong>
                        </div>
                      </div>

                      {/* CARD 6: BDM Name */}
                      <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ background: '#faf5ff', color: '#7c3aed', padding: '12px', borderRadius: '10px' }}>
                          <Users size={24} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>BDM Name</span>
                          <strong style={{ fontSize: '16px', color: '#1e293b' }}>
                            {clientProfile.assignedAccountManager?.name || 'Unassigned'}
                          </strong>
                        </div>
                      </div>

                    </div>

                    {/* SECTION 2: CLIENT / TEAM MEMBER MESSAGES BOARD */}
                    <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={18} /> Client / Team Member Messages
                      </h3>

                      {/* Messages Thread list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                        {(clientProfile.notes || []).length === 0 ? (
                          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 10px', fontSize: '13.5px', fontStyle: 'italic' }}>
                            No support messages or internal notes recorded yet. Use the field below to post the first update.
                          </div>
                        ) : (
                          clientProfile.notes.map((msg: any, index: number) => {
                            const noteDate = msg.date ? new Date(msg.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
                            const isCurrentUser = msg.userName?.toLowerCase() === (loggedInUser.name || loggedInUser.email || 'you').toLowerCase();
                            return (
                              <div key={msg._id || index} style={{ display: 'flex', flexDirection: 'column', alignSelf: isCurrentUser ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px', gap: '10px', padding: '0 4px' }}>
                                  <span style={{ fontWeight: 600 }}>{msg.userName || 'System/Staff'}</span>
                                  <span>{noteDate}</span>
                                </div>
                                <div style={{ 
                                  background: isCurrentUser ? '#dbeafe' : '#ffffff', 
                                  color: '#1e293b', 
                                  padding: '10px 14px', 
                                  borderRadius: '12px', 
                                  fontSize: '13.5px', 
                                  lineHeight: 1.5,
                                  border: '1px solid #e2e8f0',
                                  boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {msg.note}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Message Input form */}
                      <form onSubmit={handleAddNote}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>New Message / Support Note</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <textarea
                              rows={2}
                              className="input-field"
                              placeholder="Type support updates, client messages, or service notes here..."
                              style={{ flex: 1, resize: 'none', padding: '10px', marginBottom: 0 }}
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              required
                            />
                            <button 
                              type="submit" 
                              className="btn-primary" 
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: 'fit-content', padding: '12px 20px', alignSelf: 'flex-end' }}
                            >
                              <Send size={16} /> Send
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>

                  </div>
                )}

                {/* TAB 5: LIFECYCLE TIMELINE */}
                {activeProfileTab === 'timeline' && (
                  <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '12px' }}>
                    <h3 style={{ margin: '0 0 20px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b' }}>
                      Lifecycle Event Log Timeline
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderLeft: '2px solid #e2e8f0', paddingLeft: '15px', marginLeft: '10px' }}>
                      {(clientProfile.timeline || []).length === 0 ? (
                        <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No logged lifecycle timeline events yet.</div>
                      ) : (
                        clientProfile.timeline.slice().reverse().map((event, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '-21px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', border: '2px solid white' }} />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>{event.title}</div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{event.description}</div>
                              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(event.date).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 6: AUDIT LOGS */}
                {activeProfileTab === 'audit' && (
                  <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '12px' }}>
                    <h3 style={{ margin: '0 0 20px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b' }}>
                      Verification & Configuration Audit Logs
                    </h3>

                    {auditLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                        Loading audit logs...
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontStyle: 'italic' }}>
                        No audit logs available for this client.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {auditLogs.map((log: any) => (
                          <div key={log._id} style={{ borderLeft: '3px solid #64748b', paddingLeft: '15px', background: '#f8fafc', padding: '12px 18px', borderRadius: '0 8px 8px 0', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <strong style={{ color: '#1e293b' }}>{log.action}</strong>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(log.timestamp || log.createdAt).toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ color: '#475569', marginBottom: '8px' }}>
                              Performed by: <strong>{log.userName}</strong> ({log.userRole})
                            </div>
                            
                            {log.oldValue && Object.keys(log.oldValue).length > 0 && (
                              <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '4px', fontSize: '12px', border: '1px solid #fee2e2', color: '#991b1b', marginBottom: '6px' }}>
                                <strong>Previous Values:</strong>
                                <pre style={{ margin: '4px 0 0 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(log.oldValue, null, 2)}
                                </pre>
                              </div>
                            )}

                            {log.newValue && Object.keys(log.newValue).length > 0 && (
                              <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '4px', fontSize: '12px', border: '1px solid #d1fae5', color: '#065f46' }}>
                                <strong>New Values:</strong>
                                <pre style={{ margin: '4px 0 0 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(log.newValue, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* RIGHT PROFILE SIDEBAR */}
              <div>
                
                {/* SECTION 6: CLIENT SUMMARY WIDGET */}
                <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    Client Revenue summary
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Total Revenue Generated</span>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                        INR {(clientProfile.totalRevenueGenerated || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Total Collected Paid</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>
                        INR {(invoicesHistory.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Outstanding Balance Due</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                        INR {(invoicesHistory.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0)).toLocaleString('en-IN')}
                      </div>
                    </div>
                    
                    <div style={{ borderTop: '1px solid #f1f5f9', margin: '5px 0' }} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center' }}>
                      <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>{clientProfile.activeServicesCount || 0}</div>
                        <span style={{ fontSize: '9px', color: '#059669', fontWeight: 600 }}>Active Services</span>
                      </div>
                      <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#475569' }}>{clientProfile.expiredServicesCount || 0}</div>
                        <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>Expired Services</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 9: ACCOUNT MANAGEMENT STAFF ASSIGNMENTS */}
                <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>
                      Assigned Team Members
                    </h4>
                    {isAdmin && (
                      <button onClick={() => setShowAssignModal(true)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#3b82f6', fontSize: '12px', fontWeight: 600 }}>
                        Assign
                      </button>
                    )}
                  </div>

                  {(() => {
                    const sysServiceMgr = usersList.find((u: any) => {
                      const rName = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
                      return rName.includes('service manager') || rName === 'service manager' || rName.includes('service');
                    }) || usersList.find((u: any) => u.name?.toLowerCase().includes('vikash'));

                    let serviceMgr = clientProfile.assignedServiceManager?.name ? clientProfile.assignedServiceManager : null;
                    
                    if (!serviceMgr && clientProfile.assignedSalesExecutive?.name && clientProfile.assignedSalesExecutive._id !== clientProfile.assignedAccountManager?._id) {
                      serviceMgr = clientProfile.assignedSalesExecutive;
                    }

                    if (!serviceMgr && packagesHistory && packagesHistory.length > 0) {
                      for (const pkg of packagesHistory) {
                        if (pkg.lead?.assignedSales?.name && pkg.lead.assignedSales._id !== clientProfile.assignedAccountManager?._id) {
                          serviceMgr = pkg.lead.assignedSales;
                          break;
                        }
                        if (pkg.accountManager?.name && pkg.accountManager._id !== clientProfile.assignedAccountManager?._id) {
                          const rName = (typeof pkg.accountManager.role === 'object' ? pkg.accountManager.role?.name : pkg.accountManager.role) || '';
                          if (rName.toLowerCase().includes('service')) {
                            serviceMgr = pkg.accountManager;
                            break;
                          }
                        }
                      }
                    }

                    if (!serviceMgr && sysServiceMgr) {
                      serviceMgr = sysServiceMgr;
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Account Manager</span>
                          <strong>{clientProfile.assignedAccountManager?.name || 'Unassigned'}</strong>
                          {clientProfile.assignedAccountManager?.email && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{clientProfile.assignedAccountManager.email}</div>}
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Service Manager</span>
                          <strong>{serviceMgr?.name || 'Unassigned'}</strong>
                          {serviceMgr?.email && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{serviceMgr.email}</div>}
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Customer Care Executive</span>
                          <strong>{clientProfile.assignedCustomerCareExecutive?.name || 'Customer Care Team'}</strong>
                          {clientProfile.assignedCustomerCareExecutive?.email && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{clientProfile.assignedCustomerCareExecutive.email}</div>}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* SECTION 7: RENEWAL ALERTS WIDGET */}
                <div className="chart-card" style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    Active renewal alerts
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {packagesHistory.filter(p => p.status === 'Active').length === 0 ? (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No active package alerts.</span>
                    ) : (
                      packagesHistory.filter(p => p.status === 'Active').map(pkg => {
                        const alertInfo = getClientPackageExpiryAlerts(pkg);
                        if (!alertInfo) return null;
                        return (
                          <div key={pkg._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: alertInfo.bg, padding: '8px 12px', borderRadius: '8px', borderLeft: `4px solid ${alertInfo.color}` }}>
                            <div style={{ fontSize: '12px' }}>
                              <strong style={{ color: '#1e293b' }}>{pkg.package?.name || 'Custom Plan'}</strong>
                              <div style={{ fontSize: '10px', color: '#64748b' }}>Expires: {new Date(pkg.endDate).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontSize: '10px', background: 'white', color: alertInfo.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                              {alertInfo.label}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>
      )}

      {/* EDIT CLIENT COORDINATES MODAL */}
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleEditSubmit} className="auth-form" style={{ width: '100%', maxWidth: '640px', background: 'white', borderRadius: '16px', padding: '24px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Edit & Verify Business Details
              </h3>
              <button type="button" onClick={() => setShowEditModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              
              <div className="form-group">
                <label>Client Name *</label>
                <input type="text" className="input-field" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Company/Business Name *</label>
                <input type="text" className="input-field" value={editForm.companyName || ''} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Contact Person Name</label>
                <input type="text" className="input-field" value={editForm.contactPerson || ''} onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Designation</label>
                <input type="text" className="input-field" placeholder="e.g. Managing Director" value={editForm.designation || ''} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Primary Mobile *</label>
                <input type="text" className="input-field" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>WhatsApp Number</label>
                <input type="text" className="input-field" value={editForm.whatsAppNumber || ''} onChange={(e) => setEditForm({ ...editForm, whatsAppNumber: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Alternate Mobile</label>
                <input type="text" className="input-field" value={editForm.alternateNumber || ''} onChange={(e) => setEditForm({ ...editForm, alternateNumber: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Primary Email Address *</label>
                <input type="email" className="input-field" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Alternate Email</label>
                <input type="email" className="input-field" value={editForm.alternateEmail || ''} onChange={(e) => setEditForm({ ...editForm, alternateEmail: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Business Category</label>
                <input type="text" className="input-field" placeholder="e.g. Healthcare" value={editForm.businessCategory || ''} onChange={(e) => setEditForm({ ...editForm, businessCategory: e.target.value })} />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>GSTIN Number</span>
                  {editForm.gstNumber && editForm.gstNumber.trim() && (
                    <button
                      type="button"
                      onClick={handleClientGstVerification}
                      style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: editForm.isGstVerified ? '#10b981' : '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {editForm.isGstVerified ? 'Verified (Recheck)' : 'Verify on Govt Portal'}
                    </button>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.gstNumber || ''} 
                    onChange={(e) => setEditForm({ ...editForm, gstNumber: e.target.value, isGstVerified: false })} 
                    style={{ flex: 1 }}
                  />
                  {editForm.isGstVerified && (
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
              </div>

              <div className="form-group">
                <label>PAN Number</label>
                <input type="text" className="input-field" value={editForm.panNumber || ''} onChange={(e) => setEditForm({ ...editForm, panNumber: e.target.value })} />
              </div>

              <div className="form-group">
                <label>CIN Number (Optional)</label>
                <input type="text" className="input-field" value={editForm.cinNumber || ''} onChange={(e) => setEditForm({ ...editForm, cinNumber: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Website URL</label>
                <input type="text" className="input-field" placeholder="https://..." value={editForm.websiteUrl || ''} onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Business Type</label>
                <input type="text" className="input-field" placeholder="e.g. Private Limited" value={editForm.businessType || ''} onChange={(e) => setEditForm({ ...editForm, businessType: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Industry</label>
                <input type="text" className="input-field" placeholder="e.g. E-Commerce" value={editForm.industry || ''} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Company Reg. Number</label>
                <input type="text" className="input-field" placeholder="e.g. U72200DL..." value={editForm.companyRegistrationNumber || ''} onChange={(e) => setEditForm({ ...editForm, companyRegistrationNumber: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Company Email</label>
                <input type="email" className="input-field" placeholder="info@company.com" value={editForm.companyEmail || ''} onChange={(e) => setEditForm({ ...editForm, companyEmail: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Company Phone</label>
                <input type="text" className="input-field" placeholder="011-..." value={editForm.companyPhone || ''} onChange={(e) => setEditForm({ ...editForm, companyPhone: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Number of Employees</label>
                <input type="number" className="input-field" placeholder="e.g. 50" value={editForm.numberOfEmployees || ''} onChange={(e) => setEditForm({ ...editForm, numberOfEmployees: e.target.value ? Number(e.target.value) : undefined })} />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Existing Tech Stack</label>
                <input type="text" className="input-field" placeholder="e.g. Node.js, React, MongoDB" value={editForm.techStack || ''} onChange={(e) => setEditForm({ ...editForm, techStack: e.target.value })} />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Competitor Information</label>
                <textarea className="input-field" placeholder="Details about competitors..." value={editForm.competitors || ''} onChange={(e) => setEditForm({ ...editForm, competitors: e.target.value })} style={{ height: '80px', resize: 'vertical' }} />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Business Description</label>
                <textarea className="input-field" placeholder="Describe the company's business model..." value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} style={{ height: '80px', resize: 'vertical' }} />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Remarks</label>
                <textarea className="input-field" placeholder="Internal remarks..." value={editForm.remarks || ''} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} style={{ height: '80px', resize: 'vertical' }} />
              </div>

              <div className="form-group">
                <label>Client Status</label>
                <select className="input-field" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}>
                  <option value="Active">Active</option>
                  <option value="Renewal Due">Renewal Due</option>
                  <option value="Expired">Expired</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

            </div>

            {/* Address fields */}
            <h4 style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '5px', marginTop: '20px', color: '#64748b', fontSize: '13px' }}>Address Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Address Line 1</label>
                <input type="text" className="input-field" value={editForm.addressLine1 || ''} onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Address Line 2</label>
                <input type="text" className="input-field" value={editForm.addressLine2 || ''} onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })} />
              </div>
              <div className="form-group">
                <label>City</label>
                <input type="text" className="input-field" value={editForm.city || ''} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label>State</label>
                <input type="text" className="input-field" value={editForm.state || ''} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Pin Code</label>
                <input type="text" className="input-field" value={editForm.pinCode || ''} onChange={(e) => setEditForm({ ...editForm, pinCode: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input type="text" className="input-field" value={editForm.country || 'India'} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
              </div>
            </div>

            {/* Presence links */}
            <h4 style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '5px', marginTop: '20px', color: '#64748b', fontSize: '13px' }}>Social Profiles Presence Mappings</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Facebook Profile URL</label>
                <input type="text" className="input-field" placeholder="https://facebook.com/..." value={editForm.facebookUrl || ''} onChange={(e) => setEditForm({ ...editForm, facebookUrl: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Instagram Handle URL</label>
                <input type="text" className="input-field" placeholder="https://instagram.com/..." value={editForm.instagramUrl || ''} onChange={(e) => setEditForm({ ...editForm, instagramUrl: e.target.value })} />
              </div>
              <div className="form-group">
                <label>LinkedIn Page URL</label>
                <input type="text" className="input-field" placeholder="https://linkedin.com/..." value={editForm.linkedInUrl || ''} onChange={(e) => setEditForm({ ...editForm, linkedInUrl: e.target.value })} />
              </div>
              <div className="form-group">
                <label>YouTube Channel URL</label>
                <input type="text" className="input-field" placeholder="https://youtube.com/..." value={editForm.youtubeUrl || ''} onChange={(e) => setEditForm({ ...editForm, youtubeUrl: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Google Business Profile URL</label>
                <input type="text" className="input-field" placeholder="https://g.page/..." value={editForm.googleBusinessProfileUrl || ''} onChange={(e) => setEditForm({ ...editForm, googleBusinessProfileUrl: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button type="submit" className="btn-primary" disabled={submitLoading} style={{ flex: 1, padding: '12px', background: '#059669', borderColor: '#059669', color: '#ffffff', fontWeight: 700, borderRadius: '8px' }}>
                {submitLoading ? 'Sending Email...' : 'Verify & Submit'}
              </button>
              <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
            </div>

          </form>
        </div>
      )}

      {/* STAFF ASSIGNMENTS MODAL */}
      {showAssignModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleAssignSave} className="auth-form" style={{ width: '100%', maxWidth: '440px', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Assign Team Members
              </h3>
              <button type="button" onClick={() => setShowAssignModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label>Account Manager</label>
              <select className="input-field" value={assignAM} onChange={(e) => setAssignAM(e.target.value)}>
                <option value="">-- Select AM --</option>
                {usersList.filter(u => {
                  const rName = (u.role?.name || '').toLowerCase();
                  return rName.includes('bdm') || rName.includes('business development');
                }).map(u => (
                  <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Service Manager</label>
              <select className="input-field" value={assignSE} onChange={(e) => setAssignSE(e.target.value)}>
                <option value="">-- Select Service Manager --</option>
                {usersList.map(u => (
                  <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button type="submit" className="btn-primary" disabled={submitLoading} style={{ flex: 1, padding: '12px' }}>
                {submitLoading ? 'Saving...' : 'Save Assignments'}
              </button>
              <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
            </div>

          </form>
        </div>
      )}

      {/* VERIFY CLIENT CONFIRMATION POPUP */}
      {showVerifyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ width: '100%', maxWidth: '440px', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>✔</div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Confirm Profile Verification</h3>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
              "Please confirm that all business details, purchased services, and additional service requirements have been verified with the client."
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                onClick={handleVerifyClientSubmit} 
                className="btn-primary" 
                style={{ flex: 1, padding: '12px', background: '#059669', borderColor: '#059669', color: '#ffffff', fontWeight: 700, borderRadius: '8px' }}
                disabled={submitLoading}
              >
                {submitLoading ? 'Sending Email Link...' : 'Verify & Submit'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowVerifyModal(false)} 
                className="btn-secondary" 
                style={{ flex: 1, padding: '12px' }}
                disabled={submitLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SERVICE MODAL */}
      {showAddServiceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleAddServiceSubmit} className="auth-form" style={{ width: '100%', maxWidth: '540px', background: 'white', borderRadius: '16px', padding: '24px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Add New Purchased Service
              </h3>
              <button type="button" onClick={() => setShowAddServiceModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Service Name *</label>
                <select 
                  className="input-field"
                  value={serviceForm.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    let cat = val;
                    let template: any[] = [];
                    if (['Website Development', 'E-Commerce Website', 'WordPress Site Up To 15 Pages'].includes(val)) {
                      cat = 'Website Development';
                      template = WEB_DELIVERABLES_TEMPLATE;
                    } else if (['Digital Marketing', 'SEO', 'Social Media Marketing'].includes(val)) {
                      cat = 'Digital Marketing';
                      template = DM_DELIVERABLES_TEMPLATE;
                    }
                    const totalPrice = template.reduce((acc, curr) => acc + curr.price, 0);
                    setServiceForm({ 
                      ...serviceForm, 
                      name: val, 
                      category: cat,
                      deliverables: template,
                      price: totalPrice
                    });
                  }}
                  required
                >
                  <option value="">-- Select Service --</option>
                  {[
                    'Website Development',
                    'WordPress Site Up To 15 Pages',
                    'E-Commerce Website',
                    'Mobile App Development',
                    'SEO',
                    'Digital Marketing',
                    'Social Media Marketing',
                    'CRM Development',
                    'ERP Development',
                    'Hosting',
                    'Domain Registration',
                    'Maintenance Support'
                  ].map(srv => <option key={srv} value={srv}>{srv}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Service Category *</label>
                <select 
                  className="input-field"
                  value={serviceForm.category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    let template: any[] = [];
                    if (cat === 'Website Development') {
                      template = WEB_DELIVERABLES_TEMPLATE;
                    } else if (cat === 'Digital Marketing') {
                      template = DM_DELIVERABLES_TEMPLATE;
                    }
                    const totalPrice = template.reduce((acc, curr) => acc + curr.price, 0);
                    setServiceForm({ 
                      ...serviceForm, 
                      category: cat,
                      deliverables: template,
                      price: totalPrice
                    });
                  }}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {[
                    'Website Development',
                    'E-Commerce Website',
                    'Mobile App Development',
                    'SEO',
                    'Digital Marketing',
                    'Social Media Marketing',
                    'CRM Development',
                    'ERP Development',
                    'Hosting',
                    'Domain Registration',
                    'Maintenance Support',
                    'Other'
                  ].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Service Amount (Subtotal) *</label>
                <input type="number" className="input-field" value={serviceForm.price || ''} onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })} required />
              </div>

              <div className="form-group">
                <label>Service Start Date *</label>
                <input type="date" className="input-field" value={serviceForm.startDate} onChange={(e) => setServiceForm({ ...serviceForm, startDate: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Service End Date *</label>
                <input type="date" className="input-field" value={serviceForm.endDate} onChange={(e) => setServiceForm({ ...serviceForm, endDate: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Renewal Date</label>
                <input type="date" className="input-field" value={serviceForm.renewalDate} onChange={(e) => setServiceForm({ ...serviceForm, renewalDate: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Assigned Service Team</label>
                <input type="text" className="input-field" placeholder="e.g. Web Dev Team" value={serviceForm.assignedTeam} onChange={(e) => setServiceForm({ ...serviceForm, assignedTeam: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Service Status</label>
                <select className="input-field" value={serviceForm.status} onChange={(e) => setServiceForm({ ...serviceForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Expired">Expired</option>
                  <option value="Pending Renewal">Pending Renewal</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Service Description / Notes</label>
                <textarea className="input-field" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} style={{ height: '70px', resize: 'vertical' }} />
              </div>

              <div style={{ gridColumn: 'span 2', marginTop: '15px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>Service Deliverables & Component Pricing</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      const current = serviceForm.deliverables || [];
                      setServiceForm({
                        ...serviceForm,
                        deliverables: [...current, { key: '', value: '', price: 0 }]
                      });
                    }}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    + Add Deliverable
                  </button>
                </div>

                {(serviceForm.deliverables || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '10px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center' }}>
                    No deliverables specified. Click "+ Add Deliverable" to add.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(serviceForm.deliverables || []).map((d: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          placeholder="Description / Details (e.g. 4 posts/month)" 
                          className="input-field" 
                          value={d.key || ''} 
                          onChange={(e) => {
                            const list = [...serviceForm.deliverables];
                            list[idx].key = e.target.value;
                            setServiceForm({ ...serviceForm, deliverables: list });
                          }}
                          style={{ flex: 2, padding: '8px', fontSize: '12.5px' }}
                          required
                        />
                        <input 
                          type="text" 
                          placeholder="Service Component Name (e.g. Photo Uploads)" 
                          className="input-field" 
                          value={d.value || ''} 
                          onChange={(e) => {
                            const list = [...serviceForm.deliverables];
                            list[idx].value = e.target.value;
                            setServiceForm({ ...serviceForm, deliverables: list });
                          }}
                          style={{ flex: 2, padding: '8px', fontSize: '12.5px' }}
                          required
                        />
                        <input 
                          type="number" 
                          placeholder="Price" 
                          className="input-field" 
                          value={d.price || ''} 
                          onChange={(e) => {
                            const list = [...serviceForm.deliverables];
                            list[idx].price = Number(e.target.value) || 0;
                            setServiceForm({ ...serviceForm, deliverables: list });
                          }}
                          style={{ width: '100px', padding: '8px', fontSize: '12.5px' }}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => {
                            const list = serviceForm.deliverables.filter((_: any, i: number) => i !== idx);
                            setServiceForm({ ...serviceForm, deliverables: list });
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button type="submit" className="btn-primary" disabled={submitLoading} style={{ flex: 1, padding: '12px' }}>
                {submitLoading ? 'Saving...' : 'Add Purchased Service'}
              </button>
              <button type="button" onClick={() => setShowAddServiceModal(false)} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT SERVICE MODAL */}
      {showEditServiceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleEditServiceSubmit} className="auth-form" style={{ width: '100%', maxWidth: '540px', background: 'white', borderRadius: '16px', padding: '24px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Edit Purchased Service Details
              </h3>
              <button type="button" onClick={() => { setShowEditServiceModal(false); setCurrentService(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Service Name *</label>
                <input type="text" className="input-field" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Service Category *</label>
                <select 
                  className="input-field"
                  value={serviceForm.category}
                  onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {[
                    'Website Development',
                    'E-Commerce Website',
                    'Mobile App Development',
                    'SEO',
                    'Digital Marketing',
                    'Social Media Marketing',
                    'CRM Development',
                    'ERP Development',
                    'Hosting',
                    'Domain Registration',
                    'Maintenance Support',
                    'Other'
                  ].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Service Amount (Subtotal) *</label>
                <input type="number" className="input-field" value={serviceForm.price || ''} onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })} required />
              </div>

              <div className="form-group">
                <label>Service Start Date *</label>
                <input type="date" className="input-field" value={serviceForm.startDate} onChange={(e) => setServiceForm({ ...serviceForm, startDate: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Service End Date *</label>
                <input type="date" className="input-field" value={serviceForm.endDate} onChange={(e) => setServiceForm({ ...serviceForm, endDate: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Renewal Date</label>
                <input type="date" className="input-field" value={serviceForm.renewalDate} onChange={(e) => setServiceForm({ ...serviceForm, renewalDate: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Assigned Service Team</label>
                <input type="text" className="input-field" value={serviceForm.assignedTeam} onChange={(e) => setServiceForm({ ...serviceForm, assignedTeam: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Service Status</label>
                <select className="input-field" value={serviceForm.status} onChange={(e) => setServiceForm({ ...serviceForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Expired">Expired</option>
                  <option value="Pending Renewal">Pending Renewal</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Service Description / Notes</label>
                <textarea className="input-field" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} style={{ height: '70px', resize: 'vertical' }} />
              </div>

              <div style={{ gridColumn: 'span 2', marginTop: '15px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>Service Deliverables & Component Pricing</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      const current = serviceForm.deliverables || [];
                      setServiceForm({
                        ...serviceForm,
                        deliverables: [...current, { key: '', value: '', price: 0 }]
                      });
                    }}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    + Add Deliverable
                  </button>
                </div>

                {(serviceForm.deliverables || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '10px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center' }}>
                    No deliverables specified. Click "+ Add Deliverable" to add.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(serviceForm.deliverables || []).map((d: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          placeholder="Description / Details (e.g. 4 posts/month)" 
                          className="input-field" 
                          value={d.key || ''} 
                          onChange={(e) => {
                            const list = [...serviceForm.deliverables];
                            list[idx].key = e.target.value;
                            setServiceForm({ ...serviceForm, deliverables: list });
                          }}
                          style={{ flex: 2, padding: '8px', fontSize: '12.5px' }}
                          required
                        />
                        <input 
                          type="text" 
                          placeholder="Service Component Name (e.g. Photo Uploads)" 
                          className="input-field" 
                          value={d.value || ''} 
                          onChange={(e) => {
                            const list = [...serviceForm.deliverables];
                            list[idx].value = e.target.value;
                            setServiceForm({ ...serviceForm, deliverables: list });
                          }}
                          style={{ flex: 2, padding: '8px', fontSize: '12.5px' }}
                          required
                        />
                        <input 
                          type="number" 
                          placeholder="Price" 
                          className="input-field" 
                          value={d.price || ''} 
                          onChange={(e) => {
                            const list = [...serviceForm.deliverables];
                            list[idx].price = Number(e.target.value) || 0;
                            setServiceForm({ ...serviceForm, deliverables: list });
                          }}
                          style={{ width: '100px', padding: '8px', fontSize: '12.5px' }}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => {
                            const list = serviceForm.deliverables.filter((_: any, i: number) => i !== idx);
                            setServiceForm({ ...serviceForm, deliverables: list });
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button type="submit" className="btn-primary" disabled={submitLoading} style={{ flex: 1, padding: '12px' }}>
                {submitLoading ? 'Saving...' : 'Save Service Details'}
              </button>
              <button type="button" onClick={() => { setShowEditServiceModal(false); setCurrentService(null); }} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD FEATURE MODAL */}
      {showAddFeatureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleAddFeatureSubmit} className="auth-form" style={{ width: '100%', maxWidth: '440px', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Add Custom Feature Requirement
              </h3>
              <button type="button" onClick={() => { setShowAddFeatureModal(false); setCurrentService(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label>Feature Name *</label>
              <input type="text" className="input-field" placeholder="e.g. WhatsApp Integration" value={featureForm.name} onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })} required />
            </div>

            <div className="form-group">
              <label>Estimated Cost (INR)</label>
              <input type="number" className="input-field" value={featureForm.estimatedCost || ''} onChange={(e) => setFeatureForm({ ...featureForm, estimatedCost: Number(e.target.value) })} />
            </div>

            <div className="form-group">
              <label>Feature Status</label>
              <select className="input-field" value={featureForm.status} onChange={(e) => setFeatureForm({ ...featureForm, status: e.target.value })}>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Approval Status</label>
              <select className="input-field" value={featureForm.approvalStatus} onChange={(e) => setFeatureForm({ ...featureForm, approvalStatus: e.target.value })}>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="form-group">
              <label>Description / Notes</label>
              <textarea className="input-field" value={featureForm.description} onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })} style={{ height: '60px', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button type="submit" className="btn-primary" disabled={submitLoading} style={{ flex: 1, padding: '12px' }}>
                {submitLoading ? 'Saving...' : 'Add Feature'}
              </button>
              <button type="button" onClick={() => { setShowAddFeatureModal(false); setCurrentService(null); }} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT FEATURE MODAL */}
      {showEditFeatureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleEditFeatureSubmit} className="auth-form" style={{ width: '100%', maxWidth: '440px', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Edit Feature Details
              </h3>
              <button type="button" onClick={() => { setShowEditFeatureModal(false); setCurrentService(null); setCurrentFeature(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label>Feature Name *</label>
              <input type="text" className="input-field" value={featureForm.name} onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })} required />
            </div>

            <div className="form-group">
              <label>Estimated Cost (INR)</label>
              <input type="number" className="input-field" value={featureForm.estimatedCost || ''} onChange={(e) => setFeatureForm({ ...featureForm, estimatedCost: Number(e.target.value) })} />
            </div>

            <div className="form-group">
              <label>Feature Status</label>
              <select className="input-field" value={featureForm.status} onChange={(e) => setFeatureForm({ ...featureForm, status: e.target.value })}>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Approval Status</label>
              <select className="input-field" value={featureForm.approvalStatus} onChange={(e) => setFeatureForm({ ...featureForm, approvalStatus: e.target.value })}>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="form-group">
              <label>Description / Notes</label>
              <textarea className="input-field" value={featureForm.description} onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })} style={{ height: '60px', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button type="submit" className="btn-primary" disabled={submitLoading} style={{ flex: 1, padding: '12px' }}>
                {submitLoading ? 'Saving...' : 'Save Feature'}
              </button>
              <button type="button" onClick={() => { setShowEditFeatureModal(false); setCurrentService(null); setCurrentFeature(null); }} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CHOOSE TEAM MEMBERS (MULTIPLE SELECTION) MODAL */}
      {showAssignTeamModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleSaveTeamAssignment} className="auth-form" style={{ width: '100%', maxWidth: '580px', background: 'white', borderRadius: '16px', padding: '24px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} color="#2563eb" /> Choose Development Team Members
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Select multiple team members to assign this project for development.
                </p>
              </div>
              <button type="button" onClick={() => setShowAssignTeamModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            {/* Project Status Selector */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Project Status</label>
              <select className="input-field" value={selectedProjectStatus} onChange={(e) => setSelectedProjectStatus(e.target.value)}>
                <option value="Pending Team Members">Pending Team Members</option>
                <option value="Assigned for Development">Assigned for Development</option>
                <option value="In Development">In Development</option>
                <option value="Testing / Review">Testing / Review</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            {/* Search and Selection Counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '32px', marginBottom: 0, fontSize: '13px' }}
                  placeholder="Search team members by name, email, or role..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
                {selectedTeamMemberIds.length} Selected
              </div>
            </div>

            {/* Select All / Clear Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
              <button 
                type="button" 
                onClick={() => {
                  const allFilteredIds = usersList
                    .filter(u => {
                      const rName = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
                      const query = teamSearchQuery.toLowerCase();
                      return u.name.toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query) || rName.includes(query);
                    })
                    .map(u => u._id);
                  setSelectedTeamMemberIds(Array.from(new Set([...selectedTeamMemberIds, ...allFilteredIds])));
                }}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Select All Filtered
              </button>
              <button 
                type="button" 
                onClick={() => setSelectedTeamMemberIds([])}
                style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Deselect All
              </button>
            </div>

            {/* Multi-Select Service Team List */}
            <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(() => {
                const isSalesMember = (u: any) => {
                  const rName = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
                  const uDept = (typeof u.role?.department === 'object' ? u.role?.department?.name : u.department || '').toLowerCase();
                  return ['sales', 'telemarketing', 'tele marketing', 'telecaller', 'tele caller', 'bdm', 'tele sales', 'tme'].some(k => rName.includes(k) || uDept.includes(k));
                };

                const serviceUsers = usersList.filter(u => !isSalesMember(u) && (
                  u.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) || 
                  (u.email || '').toLowerCase().includes(teamSearchQuery.toLowerCase()) || 
                  ((typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase()).includes(teamSearchQuery.toLowerCase())
                ));

                if (serviceUsers.length === 0) {
                  return (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      No service team members found matching "{teamSearchQuery}".
                    </div>
                  );
                }

                return serviceUsers.map((user: any) => {
                  const isChecked = selectedTeamMemberIds.includes(user._id);
                  const roleName = (typeof user.role === 'object' ? user.role?.name : user.role) || 'Staff';
                  return (
                    <div key={user._id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', background: isChecked ? '#eff6ff' : 'white', border: isChecked ? '1.5px solid #93c5fd' : '1px solid #e2e8f0', borderRadius: '8px', transition: 'all 0.15s' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTeamMemberIds([...selectedTeamMemberIds, user._id]);
                            } else {
                              setSelectedTeamMemberIds(selectedTeamMemberIds.filter(id => id !== user._id));
                            }
                          }}
                          style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                        />
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                          <div>
                            <strong style={{ fontSize: '13.5px', color: '#1e293b', display: 'block' }}>{user.name}</strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{user.email}</span>
                          </div>
                          <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                            {roleName}
                          </span>
                        </div>
                      </label>

                      {/* Per-Member Start & End Date Inputs */}
                      {isChecked && (
                        <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed #bfdbfe', display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10.5px', color: '#1e40af', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Member Start Date</label>
                            <input
                              type="date"
                              className="input-field"
                              style={{ padding: '4px 8px', fontSize: '12px', marginBottom: 0, height: '32px' }}
                              value={selectedMemberTimelines[user._id]?.startDate || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedMemberTimelines(prev => ({
                                  ...prev,
                                  [user._id]: { ...(prev[user._id] || { startDate: '', endDate: '' }), startDate: val }
                                }));
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10.5px', color: '#1e40af', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Member End Date</label>
                            <input
                              type="date"
                              className="input-field"
                              style={{ padding: '4px 8px', fontSize: '12px', marginBottom: 0, height: '32px' }}
                              value={selectedMemberTimelines[user._id]?.endDate || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedMemberTimelines(prev => ({
                                  ...prev,
                                  [user._id]: { ...(prev[user._id] || { startDate: '', endDate: '' }), endDate: val }
                                }));
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="submit" className="btn-primary" disabled={submitLoading} style={{ flex: 1, padding: '12px' }}>
                {submitLoading ? 'Saving Assignments...' : `Save & Assign Project (${selectedTeamMemberIds.length} Members)`}
              </button>
              <button type="button" onClick={() => setShowAssignTeamModal(false)} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
