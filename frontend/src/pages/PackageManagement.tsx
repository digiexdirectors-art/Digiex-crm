import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  Plus, Edit, Trash2, X, Check, Download, Search,
  TrendingUp, Layers, Users, RefreshCw, BarChart2,
  DollarSign, FileText, CheckSquare, Award,
  Send, CreditCard, Package
} from 'lucide-react';

export const isInternationalItem = (item: any): boolean => {
  if (!item) return false;
  if (item.currency === 'USD' || item.isInternational === true || item.currencySymbol === '$') return true;

  const checkStr = (val: any) => {
    if (!val || typeof val !== 'string') return false;
    const lower = val.toLowerCase();
    return (
      lower.includes('international') ||
      lower.includes('intl') ||
      lower.includes('dollar') ||
      lower.includes('usd') ||
      lower.includes('usa') ||
      lower.includes('overseas') ||
      lower.includes('foreign')
    );
  };

  if (checkStr(item.category)) return true;
  if (checkStr(item.name)) return true;
  if (checkStr(item.packageName)) return true;
  if (checkStr(item.packageOrService)) return true;
  if (checkStr(item.title)) return true;
  if (checkStr(item.package?.category)) return true;
  if (checkStr(item.package?.name)) return true;
  if (checkStr(item.clientPackage?.package?.category)) return true;
  if (checkStr(item.clientPackage?.package?.name)) return true;
  if (checkStr(item.serviceCategory)) return true;

  if (checkStr(item.leadLocation)) return true;
  if (checkStr(item.clientLocation)) return true;
  if (checkStr(item.location)) return true;
  if (checkStr(item.country)) return true;
  if (checkStr(item.clientCountry)) return true;
  if (checkStr(item.lead?.location)) return true;
  if (checkStr(item.lead?.country)) return true;
  if (checkStr(item.client?.location)) return true;
  if (checkStr(item.client?.country)) return true;

  if (Array.isArray(item.items)) {
    for (const it of item.items) {
      if (typeof it === 'object') {
        if (checkStr(it.serviceName) || checkStr(it.description)) return true;
      }
    }
  }

  if (Array.isArray(item.services)) {
    for (const s of item.services) {
      if (typeof s === 'object') {
        if (checkStr(s.name) || checkStr(s.category)) return true;
      }
    }
  }

  return false;
};

export default function PackageManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') || 'dashboard') as 'dashboard' | 'packages' | 'builder' | 'proposals' | 'subscriptions' | 'invoices' | 'reports' | 'partial-payments';
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };
  
  // Base master data
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  // Reports Tab States
  const [selectedReportCategory, setSelectedReportCategory] = useState<string>('Call Attends');
  const [reportSearchTerm, setReportSearchTerm] = useState<string>('');
  const [reportDateFilter, setReportDateFilter] = useState<string>('');
  const [reportUserFilter, setReportUserFilter] = useState<string>('');
  const [reportCurrentPage, setReportCurrentPage] = useState<number>(1);
  

  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any | null>(null);
  const [showPartialHistoryModal, setShowPartialHistoryModal] = useState(false);
  const [selectedInvoiceForPartialHistory, setSelectedInvoiceForPartialHistory] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState<string>('Paid');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDetails, setChequeDetails] = useState('');
  const [chequeAccountNumber, setChequeAccountNumber] = useState('');
  const [chequeIfscNumber, setChequeIfscNumber] = useState('');
  const [chequeImage, setChequeImage] = useState('');
  const [uploadingChequeImage, setUploadingChequeImage] = useState(false);
  const [onlineGateway, setOnlineGateway] = useState('Razorpay');
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  
  // Online Gateway simulator states
  const [showOnlineGatewayPopup, setShowOnlineGatewayPopup] = useState(false);
  const [gatewayPaymentStep, setGatewayPaymentStep] = useState<'method' | 'otp' | 'success'>('method');
  const [gatewaySelectedMethod, setGatewaySelectedMethod] = useState<string>('UPI');
  const [gatewayOtp, setGatewayOtp] = useState<string>('');
  const [gatewayCardNumber, setGatewayCardNumber] = useState<string>('');
  const [gatewayCardExpiry, setGatewayCardExpiry] = useState<string>('');
  const [gatewayCardCvv, setGatewayCardCvv] = useState<string>('');
  const [gatewayUpiId, setGatewayUpiId] = useState<string>('');
  const [gatewayNetbank, setGatewayNetbank] = useState<string>('SBI');
  const [generatedTxnId, setGeneratedTxnId] = useState<string>('');

  // Payment settings state & loader
  const [paymentSettings, setPaymentSettings] = useState<{
    razorpayKeyId: string;
    razorpayMode: string;
    ccavenueMerchantId: string;
    ccavenueMode: string;
  } | null>(null);

  const fetchPaymentSettings = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/settings');
      const data = res.data.data;
      const getVal = (key: string) => data.find((s: any) => s.key === key)?.value;
      setPaymentSettings({
        razorpayKeyId: getVal('razorpay_key_id') || '',
        razorpayMode: getVal('razorpay_mode') || 'test',
        ccavenueMerchantId: getVal('ccavenue_merchant_id') || '',
        ccavenueMode: getVal('ccavenue_mode') || 'test'
      });
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  const [cashReceivedBy, setCashReceivedBy] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [note500, setNote500] = useState<number>(0);
  const [note200, setNote200] = useState<number>(0);
  const [note100, setNote100] = useState<number>(0);
  const [note50, setNote50] = useState<number>(0);
  const [note10, setNote10] = useState<number>(0);
  const [paisaAmount, setPaisaAmount] = useState<number>(0);
  const [error, setError] = useState('');

  const resetPaymentModalStates = () => {
    setPaymentAmount(0);
    setPaymentMethod('Cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentStatus('Paid');
    setChequeNumber('');
    setChequeDetails('');
    setChequeAccountNumber('');
    setChequeIfscNumber('');
    setChequeImage('');
    setOnlineGateway('Razorpay');
    setTransactionId('');
    setCashReceivedBy('');
    setCashNotes('');
    setNote500(0);
    setNote200(0);
    setNote100(0);
    setNote50(0);
    setNote10(0);
    setPaisaAmount(0);
    setIsPartialPayment(false);
    setNextPaymentDate('');
    
    // Reset gateway simulator states
    setShowOnlineGatewayPopup(false);
    setGatewayPaymentStep('method');
    setGatewaySelectedMethod('UPI');
    setGatewayOtp('');
    setGatewayCardNumber('');
    setGatewayCardExpiry('');
    setGatewayCardCvv('');
    setGatewayUpiId('');
    setGatewayNetbank('SBI');
    setGeneratedTxnId('');
  };

  // Deal Close (Subscriptions) Filter States
  const [subClientFilter, setSubClientFilter] = useState('');
  const [subStartDateFilter, setSubStartDateFilter] = useState('');
  const [subEndDateFilter, setSubEndDateFilter] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('');
  const [subAccountManagerFilter, setSubAccountManagerFilter] = useState('');
  const [subTelecallerFilter, setSubTelecallerFilter] = useState('');
  const [subPackageFilter, setSubPackageFilter] = useState('');
  const [subBillingCycleFilter, setSubBillingCycleFilter] = useState('');
  const [subMinPriceFilter, setSubMinPriceFilter] = useState('');
  const [subMaxPriceFilter, setSubMaxPriceFilter] = useState('');
  
  // Partial Payment Filter States
  const [partialClientFilter, setPartialClientFilter] = useState('');
  const [partialDateFilter, setPartialDateFilter] = useState('');
  
  // Custom Builder Selected Details State
  const [buildSelectedDetails, setBuildSelectedDetails] = useState<string[]>([]);
  
  const [categories, setCategories] = useState<any[]>([]);

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchData = async () => {
    try {
      const [resServices, resPackages, resProposals, resSubs, resInvoices, resUsers, resLeads, resCategories, resDetails] = await Promise.all([
        axios.get('http://localhost:5000/api/services'),
        axios.get('http://localhost:5000/api/packages'),
        axios.get('http://localhost:5000/api/proposals'),
        axios.get('http://localhost:5000/api/client-packages'),
        axios.get('http://localhost:5000/api/invoices'),
        axios.get('http://localhost:5000/api/users'),
        axios.get('http://localhost:5000/api/leads'),
        axios.get('http://localhost:5000/api/service-categories'),
        axios.get('http://localhost:5000/api/service-details')
      ]);

      if (resServices.data.success) setServices(resServices.data.data);
      if (resPackages.data.success) setPackages(resPackages.data.data);
      if (resProposals.data.success) {
        const sorted = [...resProposals.data.data].sort((a: any, b: any) => {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        setProposals(sorted);
      }
      if (resSubs.data.success) setSubscriptions(resSubs.data.data);
      if (resInvoices.data.success) setInvoices(resInvoices.data.data);
      if (resUsers.data.success) setUsers(resUsers.data.data);
      if (resLeads.data.success) setLeads(resLeads.data.data);
      if (resCategories.data.success) setCategories(resCategories.data.data);
      if (resDetails.data.success) setServiceDetails(resDetails.data.data);
    } catch (err: any) {
      console.error(err.response?.data?.message || 'Failed to fetch data');
    }
  };

  useEffect(() => {
    fetchData();
    fetchPaymentSettings();
  }, [activeTab]);

  useEffect(() => {
    const leadIdParam = searchParams.get('leadId');
    if (leadIdParam) {
      setBuildLeadId(leadIdParam);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('leadId');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = (loggedInUser.role?.name || '').toLowerCase();
  const isSuperAdmin = userRole.includes('super admin');
  const isBdm = userRole.includes('bdm');
  const isRegularAdmin = userRole.includes('admin') && !isSuperAdmin;
  const canEditDueDate = isSuperAdmin || isRegularAdmin || isBdm;
  const isAdmin = userRole.includes('admin') || userRole.includes('super admin');
  const isTeleSales = userRole.includes('tele') || userRole.includes('tme');
  const isMarketingPerson = (userRole.includes('marketing') || userRole.includes('bdm') || userRole.includes('sales')) && !isTeleSales;
  const isSales = isMarketingPerson || isAdmin;
  const isAccounts = userRole.includes('account') || userRole.includes('finance');

  const canAccessPartialPayments = isAdmin || isMarketingPerson || userRole.includes('tele sales manager') || userRole.includes('telemarketing manager') || userRole.includes('tele manager');



  // -------------------------------------------------------------
  // TAB 1: Dashboard Widgets & KPI Calculations
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // Role-based Subscriptions Filtering (Deal Close)
  // -------------------------------------------------------------
  const filteredSubscriptions = subscriptions.filter(sub => {
    // 1. Role-based access check
    const userDept = (typeof loggedInUser.role?.department === 'object' ? loggedInUser.role?.department?.name : loggedInUser.role?.department || '').toLowerCase();
    const isHR = userRole.includes('hr') || userRole.includes('human resource') || userDept.includes('hr');

    if (!isAdmin && !isHR) {
      const currentUserId = loggedInUser.id || loggedInUser._id || '';
      if (!currentUserId) return false;

      const subAccountMgrId = sub.accountManager?._id || sub.accountManager || '';
      const leadSalesId = sub.lead?.assignedSales?._id || sub.lead?.assignedSales || '';
      const leadTelecallerId = sub.lead?.assignedTelecaller?._id || sub.lead?.assignedTelecaller || '';

      const isTeleSales = userRole.includes('tele') || userRole.includes('tme');
      const isMarketingPerson = (userRole.includes('marketing') || userRole.includes('bdm') || userRole.includes('sales')) && !isTeleSales;

      if (isMarketingPerson) {
        if (String(subAccountMgrId) !== String(currentUserId) && String(leadSalesId) !== String(currentUserId)) {
          return false;
        }
      } else if (isTeleSales) {
        const isProfileOwner = String(leadTelecallerId) === String(currentUserId);
        
        const isReportingManager = sub.lead?.assignedTelecaller?.reportingManager && (
          String(sub.lead.assignedTelecaller.reportingManager?._id || sub.lead.assignedTelecaller.reportingManager) === String(currentUserId)
        );
        
        const isDataFeedByMe = sub.lead?.dataFeedBy === loggedInUser.name;
        
        const wasChangedByMe = sub.lead?.appointmentHistory?.some((entry: any) => 
          entry.changedBy && entry.changedBy.includes(loggedInUser.name)
        );

        if (!isProfileOwner && !isReportingManager && !isDataFeedByMe && !wasChangedByMe) {
          return false;
        }
      } else {
        if (String(subAccountMgrId) !== String(currentUserId) && String(leadSalesId) !== String(currentUserId) && String(leadTelecallerId) !== String(currentUserId)) {
          return false;
        }
      }
    }

    // 2. Client Name Filter
    if (subClientFilter.trim()) {
      const query = subClientFilter.toLowerCase();
      const companyName = (sub.client?.companyName || '').toLowerCase();
      const clientName = (sub.client?.name || '').toLowerCase();
      if (!companyName.includes(query) && !clientName.includes(query)) {
        return false;
      }
    }

    // 3. Date Filters
    if (subStartDateFilter) {
      const filterDate = new Date(subStartDateFilter);
      filterDate.setHours(0,0,0,0);
      const subStartDate = new Date(sub.startDate);
      subStartDate.setHours(0,0,0,0);
      if (subStartDate < filterDate) {
        return false;
      }
    }

    if (subEndDateFilter) {
      const filterDate = new Date(subEndDateFilter);
      filterDate.setHours(23,59,59,999);
      const subEndDate = new Date(sub.endDate);
      subEndDate.setHours(0,0,0,0);
      if (subEndDate > filterDate) {
        return false;
      }
    }

    // 4. Status Filter
    if (subStatusFilter) {
      if (sub.status !== subStatusFilter) {
        return false;
      }
    }

    // 5. Account Manager Filter
    if (subAccountManagerFilter) {
      const subAccountMgrId = sub.accountManager?._id || sub.accountManager || '';
      if (String(subAccountMgrId) !== String(subAccountManagerFilter)) {
        return false;
      }
    }

    // 6. Telecaller / Tele Manager Filter
    if (subTelecallerFilter) {
      const leadTelecallerId = sub.lead?.assignedTelecaller?._id || sub.lead?.assignedTelecaller || '';
      if (String(leadTelecallerId) !== String(subTelecallerFilter)) {
        return false;
      }
    }

    // 7. Package Filter
    if (subPackageFilter) {
      const subPackageId = sub.package?._id || sub.package || '';
      if (String(subPackageId) !== String(subPackageFilter)) {
        return false;
      }
    }

    // 8. Billing Cycle Filter
    if (subBillingCycleFilter) {
      if (sub.billingCycle !== subBillingCycleFilter) {
        return false;
      }
    }

    // 9. Min Price Filter
    if (subMinPriceFilter) {
      if ((sub.price || 0) < Number(subMinPriceFilter)) {
        return false;
      }
    }

    // 10. Max Price Filter
    if (subMaxPriceFilter) {
      if ((sub.price || 0) > Number(subMaxPriceFilter)) {
        return false;
      }
    }

    return true;
  });

  const activeSubs = filteredSubscriptions.filter(s => s.status === 'Active');
  const pendingRenewalSubs = filteredSubscriptions.filter(s => s.status === 'Pending Renewal');

  const totalPackageRev = activeSubs.reduce((acc, curr) => acc + (curr.total || 0), 0);
  
  // Calculate MRR based on billing cycle
  const monthlyRecurringRevenue = activeSubs.reduce((acc, curr) => {
    const price = curr.price || 0;
    switch(curr.billingCycle) {
      case 'Monthly': return acc + price;
      case 'Quarterly': return acc + (price / 3);
      case 'Half-Yearly': return acc + (price / 6);
      case 'Yearly': return acc + (price / 12);
      default: return acc;
    }
  }, 0);

  const gstCollected = invoices
    .reduce((acc, curr) => {
      if (curr.status === 'Paid') {
        return acc + (curr.tax || 0);
      } else if (curr.status === 'Partially Paid') {
        const ratio = curr.total > 0 ? (curr.paidAmount || 0) / curr.total : 0;
        return acc + Math.round((curr.tax || 0) * ratio);
      }
      return acc;
    }, 0);

  const renewalDueCount = pendingRenewalSubs.length;

  // -------------------------------------------------------------
  // TAB 2: Package Master Management (CRUD)
  // -------------------------------------------------------------
  const [showPkgModal, setShowPkgModal] = useState(false);
  const [pkgEditingId, setPkgEditingId] = useState<string | null>(null);
  const [pkgMasterFilterType, setPkgMasterFilterType] = useState<string>('All');
  
  const [serviceDetails, setServiceDetails] = useState<any[]>([]);
  const [pkgSelectedDetails, setPkgSelectedDetails] = useState<string[]>([]);
  const [pkgType, setPkgType] = useState<'Normal' | 'Combo'>('Normal');

  const [pkgName, setPkgName] = useState('');
  const [pkgCategories, setPkgCategories] = useState<string[]>([]);
  const [pkgCategory, setPkgCategory] = useState('');
  const [pkgDescription, setPkgDescription] = useState('');
  const [pkgStatus, setPkgStatus] = useState('Active');
  const [pkgSelectedServices, setPkgSelectedServices] = useState<string[]>([]);
  const [pkgMonthly, setPkgMonthly] = useState(0);
  const [pkgQuarterly, setPkgQuarterly] = useState(0);
  const [pkgHalfYearly, setPkgHalfYearly] = useState(0);
  const [pkgYearly, setPkgYearly] = useState(0);
  const [pkgDeliverables, setPkgDeliverables] = useState<any[]>([]); // Array of service-wise deliverable items

  const handleCategoryToggle = (catName: string) => {
    let updated: string[] = [];
    if (pkgCategories.includes(catName)) {
      updated = pkgCategories.filter(c => c !== catName);
    } else {
      updated = [...pkgCategories, catName];
    }
    setPkgCategories(updated);
    setPkgCategory(updated.join(', '));

    // Filter selected services to only keep those whose category is in updated categories
    const validServiceIds = pkgSelectedServices.filter(sId => {
      const sObj = services.find(s => s._id === sId);
      return sObj && updated.includes(sObj.category);
    });
    setPkgSelectedServices(validServiceIds);
  };

  const handlePkgTypeChange = (newType: 'Normal' | 'Combo') => {
    setPkgType(newType);
    if (newType === 'Normal') {
      // For Normal package, enforce single category selection
      const firstCat = pkgCategories[0] || pkgCategory || categories.find(c => c.status === 'Active')?.name || '';
      setPkgCategory(firstCat);
      setPkgCategories(firstCat ? [firstCat] : []);

      const validServiceIds = pkgSelectedServices.filter(sId => {
        const sObj = services.find(s => s._id === sId);
        return sObj && sObj.category === firstCat;
      });
      setPkgSelectedServices(validServiceIds);
    }
  };

  useEffect(() => {
    if (!showPkgModal) return;
    const totalMonthly = serviceDetails
      .filter(d => pkgSelectedDetails.includes(d._id))
      .reduce((sum, d) => sum + (d.price || 0), 0);

    const isOneShotPayment = pkgType === 'Normal';

    if (isOneShotPayment) {
      setPkgMonthly(totalMonthly);
      setPkgQuarterly(0);
      setPkgHalfYearly(0);
      setPkgYearly(0);
    } else {
      // Pre-fill combo package default rates if currently 0
      if (!pkgEditingId && pkgMonthly === 0 && pkgQuarterly === 0) {
        setPkgMonthly(totalMonthly);
        setPkgQuarterly(totalMonthly * 3);
        setPkgHalfYearly(totalMonthly * 6);
        setPkgYearly(totalMonthly * 12);
      }
    }
  }, [pkgSelectedDetails, serviceDetails, showPkgModal, pkgType, pkgEditingId]);

  const handleOpenPkgAddModal = () => {
    setPkgEditingId(null);
    setPkgName('');
    const defaultCat = categories.find(c => c.status === 'Active')?.name || categories[0]?.name || '';
    setPkgCategory(defaultCat);
    setPkgCategories(defaultCat ? [defaultCat] : []);
    setPkgDescription('');
    setPkgStatus('Active');
    setPkgSelectedServices([]);
    setPkgSelectedDetails([]);
    setPkgType('Normal');
    setPkgMonthly(0);
    setPkgQuarterly(0);
    setPkgHalfYearly(0);
    setPkgYearly(0);
    setPkgDeliverables([]);
    setShowPkgModal(true);
  };

  const handleOpenPkgEditModal = (pkg: any) => {
    setPkgEditingId(pkg._id);
    setPkgName(pkg.name);
    const initialCats = pkg.category ? pkg.category.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
    setPkgCategories(initialCats);
    setPkgCategory(pkg.category || '');
    setPkgDescription(pkg.description || '');
    setPkgStatus(pkg.status || 'Active');
    setPkgType(pkg.packageType || 'Normal');
    const serviceIds = (pkg.services || []).map((s: any) => s._id || s);
    setPkgSelectedServices(serviceIds);
    const detailIds = (pkg.serviceDetails || []).map((d: any) => d._id || d);
    setPkgSelectedDetails(detailIds);
    setPkgMonthly(pkg.pricing?.monthly || 0);
    setPkgQuarterly(pkg.pricing?.quarterly || 0);
    setPkgHalfYearly(pkg.pricing?.halfYearly || 0);
    setPkgYearly(pkg.pricing?.yearly || 0);
    setPkgDeliverables(pkg.deliverables || []);
    setShowPkgModal(true);
  };

  const handlePkgServiceToggle = (serviceId: string) => {
    let updatedServices = [...pkgSelectedServices];
    if (updatedServices.includes(serviceId)) {
      updatedServices = updatedServices.filter(id => id !== serviceId);
      setPkgDeliverables(pkgDeliverables.filter(d => d.serviceId !== serviceId));
      // Remove all service details of this service from selected details
      const serviceDetailsToKeep = pkgSelectedDetails.filter(detailId => {
        const detailObj = serviceDetails.find(sd => sd._id === detailId);
        return !detailObj || String(detailObj.service?._id || detailObj.service) !== String(serviceId);
      });
      setPkgSelectedDetails(serviceDetailsToKeep);
    } else {
      updatedServices.push(serviceId);
      const service = services.find(s => s._id === serviceId);
      if (service && service.deliverables) {
        const newDels = {
          serviceId,
          serviceName: service.name,
          items: service.deliverables.map((d: string) => ({ key: d, value: '' }))
        };
        setPkgDeliverables([...pkgDeliverables, newDels]);
      }
    }
    setPkgSelectedServices(updatedServices);
  };

  const handlePkgDetailToggle = (detailId: string) => {
    let updatedDetails = [...pkgSelectedDetails];
    if (updatedDetails.includes(detailId)) {
      updatedDetails = updatedDetails.filter(id => id !== detailId);
    } else {
      updatedDetails.push(detailId);
    }
    setPkgSelectedDetails(updatedDetails);
  };



  const handlePkgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalCategory = pkgCategories.length > 0 ? pkgCategories.join(', ') : pkgCategory;

    const payload = {
      name: pkgName,
      category: finalCategory,
      description: pkgDescription,
      status: pkgStatus,
      services: pkgSelectedServices,
      serviceDetails: pkgSelectedDetails,
      packageType: pkgType,
      pricing: {
        monthly: pkgMonthly,
        quarterly: pkgQuarterly,
        halfYearly: pkgHalfYearly,
        yearly: pkgYearly
      },
      deliverables: pkgDeliverables
    };

    try {
      if (pkgEditingId) {
        await axios.put(`http://localhost:5000/api/packages/${pkgEditingId}`, payload);
      } else {
        await axios.post('http://localhost:5000/api/packages', payload);
      }
      setShowPkgModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save package');
    }
  };

  const handlePkgDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this package?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/packages/${id}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete package');
    }
  };

  // -------------------------------------------------------------
  // TAB 3: Interactive Custom Package Builder
  // -------------------------------------------------------------
  const [buildLeadId, setBuildLeadId] = useState('');
  const [buildPkgType, setBuildPkgType] = useState<'Normal' | 'Combo' | ''>('');
  const [buildSelectedPackages, setBuildSelectedPackages] = useState<string[]>([]);
  const [buildPkgBasePrice, setBuildPkgBasePrice] = useState<number>(0);
  const [buildBillingCycle, setBuildBillingCycle] = useState<'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly'>('Monthly');
  const [buildSelectedServices, setBuildSelectedServices] = useState<string[]>([]);
  const [buildDeliverables, setBuildDeliverables] = useState<any[]>([]);
  const [buildCustomPrices, setBuildCustomPrices] = useState<{[key: string]: number}>({});
  const [buildDiscount, setBuildDiscount] = useState(0);
  const [discountSecretCode, setDiscountSecretCode] = useState('');
  const [isDiscountUnlocked, setIsDiscountUnlocked] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountTypeChoice, setDiscountTypeChoice] = useState<'percentage' | 'fixed'>('percentage');
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [discountErrorMsg, setDiscountErrorMsg] = useState('');
  const [unlockedDiscountType, setUnlockedDiscountType] = useState<'percentage' | 'fixed' | null>(null);
  const [buildDiscountPercent, setBuildDiscountPercent] = useState<number>(0);
  const [buildDiscountFixed, setBuildDiscountFixed] = useState<number>(0);

  const [buildTerms, setBuildTerms] = useState(
    'Payment Terms\n' +
    '1. All invoices must be paid within the due date mentioned on the invoice.\n' +
    '2. Services may be suspended in case of delayed payments.\n' +
    '3. GST and other applicable taxes will be charged extra unless otherwise specified.\n' +
    '4. Advance payments, milestone payments, or recurring subscription fees are non-refundable.'
  );
  
  const handleBuildPkgTypeChange = (type: 'Normal' | 'Combo' | '') => {
    setBuildPkgType(type);
    if (type === 'Normal') {
      setBuildBillingCycle('Yearly');
    } else if (type === 'Combo') {
      setBuildBillingCycle('Monthly');
    }
    setBuildSelectedPackages([]);
    setBuildSelectedServices([]);
    setBuildSelectedDetails([]);
    setBuildDeliverables([]);
    setBuildCustomPrices({});
    setBuildPkgBasePrice(0);
  };

  const handleBuilderPackageToggle = (packageId: string) => {
    let updatedPackages: string[] = [];

    if (buildSelectedPackages.includes(packageId)) {
      // Uncheck if already selected
      updatedPackages = [];
    } else {
      // Select only the clicked package (single selection)
      updatedPackages = [packageId];
    }
    
    setBuildSelectedPackages(updatedPackages);

    if (updatedPackages.length === 0) {
      setBuildSelectedServices([]);
      setBuildSelectedDetails([]);
      setBuildDeliverables([]);
      setBuildCustomPrices({});
      setBuildPkgBasePrice(0);
      return;
    }

    let totalBasePrice = 0;
    const accumulatedServiceIds: string[] = [];
    const accumulatedDetailIds: string[] = [];
    const newDels: any[] = [];
    const prices: {[key: string]: number} = {};

    const cycleKey = buildBillingCycle === 'Half-Yearly' ? 'halfYearly' : buildBillingCycle.toLowerCase();

    updatedPackages.forEach(pkgId => {
      const pkg = packages.find(p => p._id === pkgId);
      if (pkg) {
        const pkgPrice = pkg.pricing?.[cycleKey] || pkg.pricing?.monthly || pkg.price || 0;
        totalBasePrice += pkgPrice;
        
        const serviceIds = (pkg.services || []).map((s: any) => s._id || s);
        serviceIds.forEach((serviceId: string) => {
          if (!accumulatedServiceIds.includes(serviceId)) {
            accumulatedServiceIds.push(serviceId);
          }

          const service = services.find(s => s._id === serviceId);
          if (service) {
            const defaultPrice = service.pricing?.monthly || 0;
            prices[serviceId] = defaultPrice;

            const pkgDel = (pkg.deliverables || []).find((d: any) => String(d.serviceId?._id || d.serviceId) === String(serviceId));
            const existingDel = newDels.find(d => d.serviceId === serviceId);
            
            if (!existingDel) {
              if (pkgDel) {
                newDels.push({
                  serviceId,
                  serviceName: service.name,
                  items: pkgDel.items.map((item: any) => ({ key: item.key, value: item.value }))
                });
              } else if (service.deliverables) {
                newDels.push({
                  serviceId,
                  serviceName: service.name,
                  items: service.deliverables.map((d: string) => ({ key: d, value: '' }))
                });
              }
            }
          }
        });

        const detailIds = (pkg.serviceDetails || []).map((d: any) => d._id || d);
        detailIds.forEach((detailId: string) => {
          if (!accumulatedDetailIds.includes(detailId)) {
            accumulatedDetailIds.push(detailId);
          }
        });
      }
    });

    // Auto-include WordPress Business Website (6a3d1edf3b440131046d5959) if SEO (6a3d1edf3b440131046d5956) is selected
    const seoServiceId = '6a3d1edf3b440131046d5956';
    const webServiceId = '6a3d1edf3b440131046d5959';
    if (accumulatedServiceIds.includes(seoServiceId) && !accumulatedServiceIds.includes(webServiceId)) {
      accumulatedServiceIds.push(webServiceId);
      const webService = services.find(s => s._id === webServiceId);
      if (webService) {
        prices[webServiceId] = webService.pricing?.monthly || 0;
        if (webService.deliverables) {
          newDels.push({
            serviceId: webServiceId,
            serviceName: webService.name,
            items: webService.deliverables.map((d: string) => ({ key: d, value: '' }))
          });
        }
      }
    }

    setBuildPkgBasePrice(totalBasePrice);
    setBuildSelectedServices(accumulatedServiceIds);
    setBuildSelectedDetails(accumulatedDetailIds);
    setBuildDeliverables(newDels);
    setBuildCustomPrices(prices);
  };

  const handleBuilderServiceChange = (serviceId: string) => {
    let updated = [...buildSelectedServices];
    const prices = { ...buildCustomPrices };
    
    if (updated.includes(serviceId)) {
      updated = updated.filter(id => id !== serviceId);
      const sDetails = serviceDetails.filter(d => String(d.service?._id || d.service) === String(serviceId));
      const detailIds = sDetails.map(d => d._id);
      setBuildSelectedDetails(buildSelectedDetails.filter(id => !detailIds.includes(id)));
      setBuildDeliverables(buildDeliverables.filter(d => d.serviceId !== serviceId));
      
      delete prices[serviceId];
    } else {
      updated.push(serviceId);
      const sDetails = serviceDetails.filter(d => d.status === 'Active' && String(d.service?._id || d.service) === String(serviceId));
      const detailIds = sDetails.map(d => d._id);
      setBuildSelectedDetails(prev => Array.from(new Set([...prev, ...detailIds])));
      
      const service = services.find(s => s._id === serviceId);
      if (service && service.deliverables) {
        const newDels = {
          serviceId,
          serviceName: service.name,
          items: service.deliverables.map((d: string) => ({ key: d, value: '' }))
        };
        setBuildDeliverables([...buildDeliverables, newDels]);
      }

      // If active details are checked automatically, custom price should be their sum
      if (sDetails.length > 0) {
        prices[serviceId] = sDetails.reduce((sum, d) => sum + (d.price || 0), 0);
      } else {
        const defaultPrice = service?.pricing?.[buildBillingCycle.toLowerCase() === 'half-yearly' ? 'halfYearly' : buildBillingCycle.toLowerCase()] || 0;
        prices[serviceId] = defaultPrice;
      }
    }
    setBuildCustomPrices(prices);
    setBuildSelectedServices(updated);
    setBuildSelectedPackages([]);
  };

  const handleBuilderDetailChange = (detailId: string, serviceId: string) => {
    let updatedDetails = [...buildSelectedDetails];
    const prices = { ...buildCustomPrices };

    if (updatedDetails.includes(detailId)) {
      updatedDetails = updatedDetails.filter(id => id !== detailId);
    } else {
      updatedDetails.push(detailId);
      if (!buildSelectedServices.includes(serviceId)) {
        setBuildSelectedServices(prev => [...prev, serviceId]);
        const service = services.find(s => s._id === serviceId);
        if (service && service.deliverables) {
          const newDels = {
            serviceId,
            serviceName: service.name,
            items: service.deliverables.map((d: string) => ({ key: d, value: '' }))
          };
          setBuildDeliverables(prev => [...prev, newDels]);
        }
      }
    }
    setBuildSelectedDetails(updatedDetails);
    setBuildSelectedPackages([]);

    // Sum active checked details for the service
    const selectedDetailsForService = serviceDetails.filter(d => {
      const dServiceId = String(d.service?._id || d.service);
      return dServiceId === String(serviceId) && updatedDetails.includes(d._id);
    });

    if (selectedDetailsForService.length > 0) {
      prices[serviceId] = selectedDetailsForService.reduce((sum, d) => sum + (d.price || 0), 0);
    } else {
      prices[serviceId] = 0;
    }
    setBuildCustomPrices(prices);
  };

  const handleBuilderServiceToggle = (serviceId: string) => {
    let updated = [...buildSelectedServices];
    const prices = { ...buildCustomPrices };

    if (updated.includes(serviceId)) {
      updated = updated.filter(id => id !== serviceId);
      setBuildDeliverables(buildDeliverables.filter(d => d.serviceId !== serviceId));
      
      delete prices[serviceId];

      // Deselect all details for this service
      setBuildSelectedDetails(prev => prev.filter(detailId => {
        const dObj = serviceDetails.find(sd => sd._id === detailId);
        const dServiceId = String(dObj?.service?._id || dObj?.service);
        return dServiceId !== String(serviceId);
      }));
    } else {
      updated.push(serviceId);
      const service = services.find(s => s._id === serviceId);
      if (service) {
        // Check if there are any details selected for this service
        const selectedDetailsForService = serviceDetails.filter(d => {
          const dServiceId = String(d.service?._id || d.service);
          return dServiceId === String(serviceId) && buildSelectedDetails.includes(d._id);
        });

        if (selectedDetailsForService.length > 0) {
          prices[serviceId] = selectedDetailsForService.reduce((sum, d) => sum + (d.price || 0), 0);
        } else {
          prices[serviceId] = 0;
        }

        if (service.deliverables) {
          const newDels = {
            serviceId,
            serviceName: service.name,
            items: service.deliverables.map((d: string) => ({ key: d, value: '' }))
          };
          setBuildDeliverables([...buildDeliverables, newDels]);
        }
      }
    }
    setBuildCustomPrices(prices);
    setBuildSelectedServices(updated);
    setBuildSelectedPackages([]);
  };

  const handleBuilderCycleChange = (cycle: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly') => {
    setBuildBillingCycle(cycle);
    // Reset custom prices based on selected cycle prices or selected details
    const prices: {[key: string]: number} = {};
    buildSelectedServices.forEach(serviceId => {
      const selectedDetailsForService = serviceDetails.filter(d => {
        const dServiceId = String(d.service?._id || d.service);
        return dServiceId === String(serviceId) && buildSelectedDetails.includes(d._id);
      });

      if (selectedDetailsForService.length > 0) {
        prices[serviceId] = selectedDetailsForService.reduce((sum, d) => sum + (d.price || 0), 0);
      } else {
        prices[serviceId] = 0;
      }
    });
    setBuildCustomPrices(prices);
  };

  const handleBuilderPriceChange = (serviceId: string, val: number) => {
    setBuildCustomPrices({
      ...buildCustomPrices,
      [serviceId]: val
    });
  };

  const handleBuilderDeliverableChange = (serviceId: string, key: string, val: string) => {
    const updated = buildDeliverables.map(d => {
      if (d.serviceId === serviceId) {
        return {
          ...d,
          items: d.items.map((item: any) => {
            if (item.key === key) return { ...item, value: val };
            return item;
          })
        };
      }
      return d;
    });
    setBuildDeliverables(updated);
  };

  const handleEditDueDate = async (invoice: any) => {
    if (!canEditDueDate) {
      alert("Only authorized roles (Super Admin, Admin, and BDM) can change the due date.");
      return;
    }

    if (!isSuperAdmin) {
      const secret = prompt("Enter Secret Code to edit Due Date:");
      if (!secret) return;
      if (secret !== "DIGIEX2026") {
        alert("Incorrect secret code! Access denied.");
        return;
      }
    }

    const currentDueDate = invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '';
    const newDueDateStr = prompt("Enter new Due Date (YYYY-MM-DD):", currentDueDate);
    if (!newDueDateStr) return;

    const newDate = new Date(newDueDateStr);
    if (isNaN(newDate.getTime())) {
      alert("Invalid date format. Please use YYYY-MM-DD.");
      return;
    }

    try {
      const res = await axios.put(`http://localhost:5000/api/invoices/${invoice._id}`, {
        dueDate: newDate.toISOString(),
        action: 'DUE_DATE_UPDATED'
      });

      if (res.data.success) {
        alert("Due Date updated successfully!");
        fetchData();
      } else {
        alert("Failed to update Due Date.");
      }
    } catch (err) {
      console.error("Error updating invoice due date:", err);
      alert("Error updating Due Date. Please try again.");
    }
  };

  const handleVerifyDiscountCode = (e: React.FormEvent) => {
    e.preventDefault();
    setDiscountErrorMsg('');

    if (discountTypeChoice === 'percentage') {
      if (discountCodeInput.trim() !== 'Per@12345') {
        setDiscountErrorMsg('Invalid security code for Percentage Discount! Code required: Per@12345');
        return;
      }
    } else if (discountTypeChoice === 'fixed') {
      if (discountCodeInput.trim() !== 'Fix@12345') {
        setDiscountErrorMsg('Invalid security code for Fixed Price Discount! Code required: Fix@12345');
        return;
      }
    }

    setUnlockedDiscountType(discountTypeChoice);
    setIsDiscountUnlocked(true);
    setShowDiscountModal(false);
    setDiscountCodeInput('');
    setDiscountErrorMsg('');
  };

  const calculateBuilderTotal = () => {
    const subtotal = buildSelectedPackages.length > 0 ? buildPkgBasePrice : Object.values(buildCustomPrices).reduce((a, b) => a + b, 0);

    let discountVal = 0;
    if (isDiscountUnlocked) {
      if (unlockedDiscountType === 'percentage') {
        discountVal = Math.round(subtotal * (buildDiscountPercent / 100));
      } else if (unlockedDiscountType === 'fixed') {
        discountVal = Math.min(subtotal, Math.max(0, buildDiscountFixed));
      }
    }

    const postDiscount = Math.max(0, subtotal - discountVal);
    const gst = Math.round(postDiscount * 0.18);
    const total = postDiscount + gst;
    return { subtotal, postDiscount, gst, total, discountVal, enforcedPercent: buildDiscountPercent };
  };

  const handleGenerateAndProcessProposal = async (action: 'send' | 'pay') => {
    if (!buildLeadId) {
      alert('Please select a Lead first.');
      return;
    }
    if (buildSelectedServices.length === 0) {
      alert('Please select at least one service.');
      return;
    }

    const lead = leads.find(l => l._id === buildLeadId);
    if (!lead) return;

    const { subtotal, gst, total, discountVal } = calculateBuilderTotal();

    let sumDefaultPrices = 0;
    const isPredefinedSelected = buildSelectedPackages.length > 0;
    if (isPredefinedSelected) {
      sumDefaultPrices = buildSelectedServices.reduce((acc, id) => {
        const s = services.find(serv => serv._id === id);
        return acc + (s?.pricing?.monthly || 0);
      }, 0);
    }

    const customServices = buildSelectedServices.map(id => {
      const s = services.find(serv => serv._id === id);
      const dels = buildDeliverables.find(d => d.serviceId === id)?.items || [];
      
      let finalServicePrice = buildCustomPrices[id] || 0;
      if (isPredefinedSelected) {
        const sMonthly = s?.pricing?.monthly || 0;
        if (sumDefaultPrices > 0) {
          finalServicePrice = Math.round((sMonthly / sumDefaultPrices) * subtotal);
        } else {
          finalServicePrice = Math.round(subtotal / buildSelectedServices.length);
        }
      }

      return {
        serviceId: id,
        name: s?.name || '',
        deliverables: dels,
        price: finalServicePrice
      };
    });

    const proposalPayload = {
      leadId: lead._id,
      clientDetails: {
        name: lead.contactPerson,
        companyName: lead.businessName,
        email: lead.email || 'info@digiexweb.com',
        phone: lead.phone,
        address: lead.address || lead.location
      },
      packageId: buildSelectedPackages.length === 1 ? buildSelectedPackages[0] : null,
      isCustom: buildSelectedPackages.length === 1 ? false : true,
      services: customServices,
      serviceDetails: buildSelectedDetails,
      billingCycle: buildBillingCycle,
      price: subtotal,
      discount: discountVal,
      gstPercentage: 18,
      gstAmount: gst,
      total: total,
      terms: buildTerms,
      status: action === 'pay' ? 'Accepted' : 'Sent'
    };

    try {
      const propRes = await axios.post('http://localhost:5000/api/proposals', proposalPayload);
      if (!propRes.data.success) {
        alert('Failed to save proposal');
        return;
      }

      const proposal = propRes.data.data;

      if (action === 'send') {
        const newEntry = {
          status: 'Proposal Sent',
          remarks: `Proposal #${proposal.proposalNumber} sent by ${loggedInUser.name || 'System'}`,
          changedBy: loggedInUser.name || 'System',
          changedAt: new Date().toISOString()
        };
        const updatedHistory = [newEntry, ...(lead.appointmentHistory || [])];
        await axios.put(`http://localhost:5000/api/leads/${lead._id}`, {
          appointmentHistory: updatedHistory,
          stage: 'Proposal Sent'
        });

        alert('Proposal generated and sent successfully! View it in the Proposals tab.');
        resetBuilderStates();
        setActiveTab('proposals');
        fetchData();
      } else if (action === 'pay') {
        const start = new Date();
        start.setDate(start.getDate() + 7);
        const end = new Date(start);
        end.setFullYear(start.getFullYear() + 1);
        const startDateStr = start.toISOString().split('T')[0];
        const endDateStr = end.toISOString().split('T')[0];

        const managerId = lead?.assignedSales?._id || lead?.assignedSales || loggedInUser._id || loggedInUser.id || users[0]?._id || null;

        const convertPayload = {
          leadId: lead._id,
          proposalId: proposal._id,
          packageId: buildSelectedPackages.length === 1 ? buildSelectedPackages[0] : null,
          customServices,
          startDate: startDateStr,
          endDate: endDateStr,
          billingCycle: buildBillingCycle,
          price: subtotal,
          gstAmount: gst,
          total: total,
          accountManager: managerId,
          serviceDetails: buildSelectedDetails,
          stage: 'Deal Close',
          remarks: `Lead converted to client and package assigned by ${loggedInUser.name || 'System'}.`,
          changedBy: loggedInUser.name || 'System'
        };

        const convRes = await axios.post('http://localhost:5000/api/client-packages/convert-lead', convertPayload);
        if (convRes.data.success) {
          alert('Lead successfully converted to Client. Subscription activated and Invoice generated!');
          
          const invoice = convRes.data.data.invoice;
          invoice.client = convRes.data.data.client;
          resetPaymentModalStates();
          setSelectedInvoiceForPayment(invoice);
          setPaymentStatus('Paid');
          setPaymentMethod('Cash');
          setPaymentDate(new Date().toISOString().split('T')[0]);
          setPaymentAmount(invoice.total);
          setShowPaymentModal(true);

          resetBuilderStates();
          fetchData();
        } else {
          alert('Lead converted, but failed to activate subscription: ' + convRes.data.message);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'An error occurred while processing proposal');
    }
  };

  const handleUnlockDiscountClick = () => {
    const code = prompt('Enter Access Code to unlock discount options:');
    if (code === 'Digiex@0987') {
      setIsDiscountUnlocked(true);
      alert('Discount options unlocked successfully!');
    } else if (code) {
      alert('Invalid Access Code.');
    }
  };

  const loadLeadPreselections = (leadId: string) => {
    if (!leadId) {
      setBuildSelectedPackages([]);
      setBuildSelectedServices([]);
      setBuildSelectedDetails([]);
      setBuildDeliverables([]);
      setBuildCustomPrices({});
      return;
    }

    const leadSubs = subscriptions.filter(sub => {
      const subLeadId = sub.lead?._id || sub.lead;
      return subLeadId && String(subLeadId) === String(leadId);
    });

    const preSelectedPkgs: string[] = [];
    const preSelectedServs: string[] = [];
    const preSelectedDetails: string[] = [];
    const preSelectedCustomPrices: Record<string, number> = {};
    const preSelectedDeliverables: any[] = [];

    leadSubs.forEach(sub => {
      // Pre-select predefined package if any
      const pkgId = sub.packageId?._id || sub.packageId || sub.package?._id || sub.package;
      if (pkgId) {
        const pkgStr = String(pkgId);
        if (!preSelectedPkgs.includes(pkgStr)) {
          preSelectedPkgs.push(pkgStr);
        }

        // Extract services and details from the predefined package itself
        const pkgObj = packages.find(p => String(p._id) === pkgStr);
        if (pkgObj) {
          const pkgServices = pkgObj.services || [];
          pkgServices.forEach((s: any) => {
            const sId = s._id || s;
            if (sId) {
              const sIdStr = String(sId);
              if (!preSelectedServs.includes(sIdStr)) {
                preSelectedServs.push(sIdStr);
              }
              if (!preSelectedCustomPrices[sIdStr]) {
                const sObj = services.find(serv => serv._id === sIdStr);
                preSelectedCustomPrices[sIdStr] = sObj?.pricing?.monthly || 0;
              }
            }
          });

          const pkgDetails = pkgObj.serviceDetails || [];
          pkgDetails.forEach((d: any) => {
            const dId = d._id || d;
            if (dId) {
              const dIdStr = String(dId);
              if (!preSelectedDetails.includes(dIdStr)) {
                preSelectedDetails.push(dIdStr);
              }
            }
          });

          const pkgDels = pkgObj.deliverables || [];
          pkgDels.forEach((d: any) => {
            const sIdStr = String(d.serviceId?._id || d.serviceId);
            if (!preSelectedDeliverables.some(del => del.serviceId === sIdStr)) {
              preSelectedDeliverables.push({
                serviceId: sIdStr,
                serviceName: d.serviceName || '',
                items: d.items || []
              });
            }
          });
        }
      }

      // Extract custom services
      const rawServices = sub.customServices || sub.services || [];
      rawServices.forEach((s: any) => {
        const sId = s.serviceId?._id || s.serviceId || s._id || s;
        if (sId) {
          const sIdStr = String(sId);
          if (!preSelectedServs.includes(sIdStr)) {
            preSelectedServs.push(sIdStr);
          }
          if (s.price !== undefined) {
            preSelectedCustomPrices[sIdStr] = s.price;
          }
          if (s.deliverables) {
            const filteredDels = preSelectedDeliverables.filter(d => d.serviceId !== sIdStr);
            filteredDels.push({
              serviceId: sIdStr,
              serviceName: s.name || '',
              items: s.deliverables
            });
            preSelectedDeliverables.splice(0, preSelectedDeliverables.length, ...filteredDels);
          }
        }
      });

      // Extract service details
      const rawDetails = sub.serviceDetails || [];
      rawDetails.forEach((d: any) => {
        const dId = d.serviceDetailId?._id || d.serviceDetailId || d._id || d;
        if (dId) {
          const dIdStr = String(dId);
          if (!preSelectedDetails.includes(dIdStr)) {
            preSelectedDetails.push(dIdStr);
          }
        }
      });
    });

    setBuildSelectedPackages(preSelectedPkgs);
    setBuildSelectedServices(preSelectedServs);
    setBuildSelectedDetails(preSelectedDetails);
    setBuildDeliverables(preSelectedDeliverables);
    setBuildCustomPrices(preSelectedCustomPrices);
  };

  const handleBuildLeadChange = (leadId: string) => {
    setBuildLeadId(leadId);
    loadLeadPreselections(leadId);
  };

  const resetBuilderStates = () => {
    setBuildLeadId('');
    setBuildPkgType('');
    setBuildSelectedPackages([]);
    setBuildPkgBasePrice(0);
    setBuildSelectedServices([]);
    setBuildDeliverables([]);
    setBuildCustomPrices({});
    setBuildDiscount(0);
    setDiscountSecretCode('');
    setIsDiscountUnlocked(false);
  };

  // -------------------------------------------------------------
  // TAB 4: Proposals Management
  // -------------------------------------------------------------
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedProposalToConvert, setSelectedProposalToConvert] = useState<any>(null);
  const [convertStartDate, setConvertStartDate] = useState('');
  const [convertEndDate, setConvertEndDate] = useState('');
  const [convertAccountManager, setConvertAccountManager] = useState('');

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

  const generatePDFProposal = async (proposal: any) => {
    // 1. Fetch Company Settings
    let companySettings = {
      name: 'Digiex Web Services Pvt Ltd',
      logo: 'https://digiexweb.com/assets/img/logo.png',
      phone: '+91 98765 43210',
      email: 'info@digiexweb.com',
      website: 'www.digiexweb.com',
      address: 'Chinar Park, Kolkata, West Bengal, 700157',
      gst: ''
    };

    try {
      const res = await axios.get('http://localhost:5000/api/settings');
      if (res.data.success && Array.isArray(res.data.data)) {
        const data = res.data.data;
        const getVal = (key: string) => data.find((s: any) => s.key === key)?.value;
        
        companySettings.name = getVal('company_name') || companySettings.name;
        companySettings.phone = getVal('company_phone') || companySettings.phone;
        companySettings.email = getVal('company_email') || companySettings.email;
        companySettings.website = getVal('company_website') || companySettings.website;
        companySettings.gst = getVal('company_gst') || getVal('company_gstin') || '';
        
        const logoPath = getVal('company_logo');
        if (logoPath) {
          companySettings.logo = logoPath.startsWith('http') ? logoPath : `http://localhost:5000${logoPath}`;
        }
        
        const addr = [
          getVal('address_line1'),
          getVal('address_city'),
          getVal('address_state'),
          getVal('address_zip'),
          getVal('address_country')
        ].filter(Boolean).join(', ');
        companySettings.address = getVal('company_address') || addr || companySettings.address;
      }
    } catch (err) {
      console.error('Failed to load company settings:', err);
    }

    const formatProposalDate = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '19th Nov, 2025';
        const day = d.getDate();
        const month = d.toLocaleString('en-US', { month: 'short' });
        const year = d.getFullYear();
        
        const suffix = ["th", "st", "nd", "rd"];
        const v = day % 100;
        const ord = suffix[(v - 20) % 10] || suffix[v] || suffix[0];
        
        return `${day}${ord} ${month}, ${year}`;
      } catch {
        return '19th Nov, 2025';
      }
    };

    const doc = new jsPDF();
    const rightAlignX = 195;
    const logoPng = await loadImageAsPng(companySettings.logo);

    const targetPkgId = proposal.packageId 
      ? (typeof proposal.packageId === 'string' ? proposal.packageId : proposal.packageId._id) 
      : null;
    const pkg = targetPkgId ? packages.find((p: any) => p._id === targetPkgId) : null;

    const categoryName = pkg 
      ? pkg.category 
      : (proposal.services && proposal.services[0] 
          ? (services.find(s => s._id === (proposal.services[0].serviceId?._id || proposal.services[0].serviceId))?.category || 'Business')
          : 'Business');

    const drawPageHeader = (pDoc: typeof doc) => {
      if (logoPng) {
        pDoc.addImage(logoPng, 'PNG', 145, 10, 50, 15);
      } else {
        pDoc.setTextColor(19, 85, 160);
        pDoc.setFontSize(10.5);
        pDoc.setFont('Helvetica', 'bold');
        pDoc.text(companySettings.name, rightAlignX, 20, { align: 'right' });
      }
    };

    // ==========================================
    // PAGE 1: COVER PAGE
    // ==========================================
    
    // 1. Header (Proposed By, Date, Logo, Company GSTIN)
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    doc.text('Proposed By :', 15, 16);
    doc.text('Date :', 70, 16);
    if (companySettings.gst) {
      doc.text('Company GSTIN :', 120, 16);
    }

    doc.setTextColor(19, 85, 160);
    doc.setFontSize(10.5);
    doc.setFont('Helvetica', 'bold');
    doc.text(loggedInUser.name || 'Arup Mondal', 15, 22);
    doc.text(formatProposalDate(proposal.createdAt || new Date()), 70, 22);
    if (companySettings.gst) {
      doc.text(companySettings.gst, 120, 22);
    }

    drawPageHeader(doc);

    // 2. Rounded Dark Blue Banner (Cover Page Body)
    doc.setFillColor(19, 85, 160);
    doc.roundedRect(15, 35, 180, 245, 10, 10, 'F');

    // Title inside Banner
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('Helvetica', 'bold');
    const titleText = `${proposal.clientDetails?.companyName || 'Business'} ${categoryName} Proposal`;
    const splitTitle = doc.splitTextToSize(titleText, 115);
    doc.text(splitTitle, 25, 65);

    // Prepared For Header
    doc.setFontSize(13);
    doc.setFont('Helvetica', 'bold');
    doc.text('Prepared For', 25, 120);

    // Yellow Line
    doc.setFillColor(234, 179, 8);
    doc.rect(25, 124, 30, 1.5, 'F');

    // Muted White Line
    doc.setFillColor(255, 255, 255);
    doc.rect(55, 124.5, 75, 0.5, 'F');

    // Client Details List
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(241, 245, 249);
    doc.text(`Contact: ${proposal.clientDetails?.name || 'N/A'}`, 25, 134);
    doc.text(`Email: ${proposal.clientDetails?.email || 'N/A'}`, 25, 142);
    doc.text(`Phone: ${proposal.clientDetails?.phone || 'N/A'}`, 25, 150);
    
    const splitDesc = doc.splitTextToSize(`Address: ${proposal.clientDetails?.address || 'N/A'}`, 115);
    doc.text(splitDesc, 25, 158);

    let clientGst = proposal.clientDetails?.gstNumber || '';
    let isClientGstVerified = false;
    if (!clientGst && proposal.leadId && typeof proposal.leadId === 'object') {
      clientGst = proposal.leadId.kycGst || '';
      isClientGstVerified = proposal.leadId.isGstVerified || false;
    } else if (proposal.clientDetails?.gstNumber) {
      isClientGstVerified = proposal.leadId?.isGstVerified || proposal.clientDetails?.isGstVerified || false;
    }

    if (clientGst) {
      const addressLines = splitDesc.length;
      const gstY = 158 + (addressLines * 8);
      doc.text(`GSTIN: ${clientGst}`, 25, gstY);
      if (isClientGstVerified) {
        doc.setTextColor(34, 197, 94);
        doc.text(' [Verified]', 25 + doc.getTextWidth(`GSTIN: ${clientGst}`), gstY);
        doc.setTextColor(241, 245, 249);
      }
    }

    // Abstract graphic accent (White lines/circles) on right side of blue card
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.4);
    doc.circle(158, 90, 8);
    doc.circle(142, 115, 5);
    doc.circle(172, 120, 6);
    doc.line(158, 98, 142, 110);
    doc.line(158, 98, 172, 114);
    doc.circle(158, 175, 22);
    doc.line(136, 175, 180, 175);
    doc.line(158, 153, 158, 197);


    doc.addPage();
    drawPageHeader(doc);

    // Double square icon (Yellow and Blue)
    doc.setFillColor(234, 179, 8);
    doc.rect(15, 27, 8, 8, 'F');
    doc.setFillColor(19, 85, 160);
    doc.rect(19, 31, 8, 8, 'F');

    doc.setTextColor(19, 85, 160);
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('About Company', 32, 37);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    const aboutText = "Digiex Web Services is a versatile company offering website development, digital marketing solutions & Social Media management, which is a smart combination in today's online landscape. It's great to hear about your experience working with global clients and our focus on ensuring online visibility for businesses. Staying updated with current trends is crucial in the ever-evolving digital world, so it's excellent that you prioritize this aspect. Moreover, offering services like SEO, SMO, and content marketing demonstrates a comprehensive approach to enhancing a client's online presence. Our emphasis on hard work, dedication, and creativity reflects a commitment to delivering quality results to your clients. Providing user-friendly web design and development services further underscores your dedication to meeting the needs of online businesses. Overall, Digiex Web Services seems well-equipped to assist businesses in navigating the complexities of the digital realm and achieving their online objectives.";
    const splitAbout = doc.splitTextToSize(aboutText, 180);
    doc.text(splitAbout, 15, 48);

    // Objectives Section
    doc.setFillColor(234, 179, 8);
    doc.rect(15, 152, 8, 8, 'F');
    doc.setFillColor(19, 85, 160);
    doc.rect(19, 156, 8, 8, 'F');

    doc.setTextColor(19, 85, 160);
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Objectives:', 32, 162);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    let objY = 173;
    const objPoints = [
      "• Increase online leads (phone / WhatsApp / booking form) by some % (baseline to be defined by client).",
      "• Improve organic search visibility for city + service keywords.",
      "• Deliver self-service portal for customers to view reports, schedules, and invoices.",
      "• Provide robust performance, keeping load speeds under 2 seconds."
    ];
    objPoints.forEach(p => {
      doc.text(p, 18, objY);
      objY += 6;
    });

    // Triangle Page Corner Accent (bottom right)
    doc.setFillColor(19, 85, 160);
    doc.triangle(150, 297, 210, 297, 210, 237, 'F');
    doc.setFillColor(234, 179, 8);
    doc.triangle(148, 297, 150, 297, 210, 235, 'F');

    // ==========================================
    // PAGE 4: SCOPE OF WORK & TABLE
    // ==========================================
    doc.addPage();
    drawPageHeader(doc);

    doc.setFillColor(234, 179, 8);
    doc.rect(15, 27, 8, 8, 'F');
    doc.setFillColor(19, 85, 160);
    doc.rect(19, 31, 8, 8, 'F');

    doc.setTextColor(19, 85, 160);
    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Scope of Work', 32, 37);

    // pkg is already defined at the top

    // Render Category and Package Name
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Category: ${pkg ? pkg.category : 'Custom Services'}`, 15, 46);
    doc.text(`Package / Service: ${pkg ? pkg.name : 'Custom Package'}`, 15, 52);

    // Table Data
    let rowIdx = 1;
    const tableBody: any[] = [];

    (proposal.services || []).forEach((s: any) => {
      let matchedDetails = (proposal.serviceDetails || []).filter((sd: any) => {
        const sdServiceId = sd.service?._id || sd.service;
        const targetServiceId = s.serviceId?._id || s.serviceId;
        return sdServiceId && targetServiceId && String(sdServiceId) === String(targetServiceId);
      });

      if (matchedDetails.length === 0 && proposal.packageId?.serviceDetails) {
        matchedDetails = proposal.packageId.serviceDetails.filter((sd: any) => {
          const sdServiceId = sd.service?._id || sd.service;
          const targetServiceId = s.serviceId?._id || s.serviceId;
          return sdServiceId && targetServiceId && String(sdServiceId) === String(targetServiceId);
        });
      }

      if (matchedDetails.length === 0) {
        matchedDetails = serviceDetails.filter((sd: any) => {
          const sdServiceId = sd.service?._id || sd.service;
          const targetServiceId = s.serviceId?._id || s.serviceId;
          return sd.status === 'Active' && sdServiceId && targetServiceId && String(sdServiceId) === String(targetServiceId);
        });
      }

      // Add parent service row first
      tableBody.push([
        rowIdx++,
        s.name,
        '998314', // Default Hsn/Sac
        1, // Qty/Hrs
        (s.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        'GST 18%',
        (s.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);

      // Add each matched detail as a sub-row (Item column only, other columns blank)
      if (matchedDetails.length > 0) {
        matchedDetails.forEach((sd: any) => {
          tableBody.push([
            '', // Blank serial
            `  • ${sd.name} - INR ${(sd.price || 0).toLocaleString('en-IN')}`,
            '', '', '', '', ''
          ]);
        });
      } else if (s.deliverables && s.deliverables.length > 0) {
        s.deliverables.forEach((d: any) => {
          const valPart = d.value ? `: ${d.value}` : '';
          tableBody.push([
            '',
            `  • ${d.key || d}${valPart}`,
            '', '', '', '', ''
          ]);
        });
      }
    });

    tableBody.push([
      '', '', '', '', '',
      'Sub Total',
      (proposal.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    if (proposal.discount > 0) {
      tableBody.push([
        '', '', '', '', '',
        'Discount',
        `-${(proposal.discount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      ]);
    }

    tableBody.push([
      '', '', '', '', '',
      'GST (18%)',
      (proposal.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    tableBody.push([
      '', '', '', '', '',
      'Total',
      (proposal.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    autoTable(doc, {
      startY: 58,
      head: [['#', 'Item', 'Hsn/Sac', 'Qty/Hrs', 'Unit Price', 'Tax', 'Price (INR)']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        lineWidth: 0.5,
        lineColor: [226, 232, 240]
      },
      bodyStyles: {
        fontSize: 8.5,
        valign: 'middle',
        lineColor: [226, 232, 240],
        lineWidth: 0.5
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70, halign: 'left' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 23, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' }
      },
      didParseCell: (data) => {
        const rawRow = data.row.raw as any;
        if (rawRow && rawRow[0] === '' && rawRow[5] !== '') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 250, 252];
          if (rawRow[5] === 'Total') {
            data.cell.styles.fontSize = 9.5;
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
      }
    });

    // ==========================================
    // PAGE 5: TERMS & CONDITIONS
    // ==========================================
    doc.addPage();
    drawPageHeader(doc);

    doc.setTextColor(19, 85, 160);
    doc.setFontSize(15);
    doc.setFont('Helvetica', 'bold');
    doc.text('Terms & Conditions', 15, 32);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    const splitTerms = doc.splitTextToSize(proposal.terms || 'Standard business terms apply.', 180);
    doc.text(splitTerms, 15, 44);

    // ==========================================
    // FOOTER (Page number and generated info)
    // ==========================================
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      
      // Muted line at bottom
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.5);
      doc.line(15, 280, 195, 280);
      
      doc.text('This is a computer-generated business proposal document.', 15, 285);
      doc.text(`Page ${i} of ${pageCount}`, rightAlignX, 285, { align: 'right' });
    }

    doc.save(`${proposal.proposalNumber}_Proposal.pdf`);
  };

  const generatePDFInvoice = async (invoice: any) => {
    // 1. Fetch Company Settings
    let companySettings = {
      name: 'Digiex Web Services Pvt Ltd',
      logo: 'https://digiexweb.com/assets/img/logo.png',
      phone: '+91 98765 43210',
      email: 'info@digiexweb.com',
      website: 'www.digiexweb.com',
      address: 'Chinar Park, Kolkata, West Bengal, 700157',
      gst: ''
    };

    try {
      const res = await axios.get('http://localhost:5000/api/settings');
      if (res.data.success && Array.isArray(res.data.data)) {
        const data = res.data.data;
        const getVal = (key: string) => data.find((s: any) => s.key === key)?.value;
        
        companySettings.name = getVal('company_name') || companySettings.name;
        companySettings.phone = getVal('company_phone') || companySettings.phone;
        companySettings.email = getVal('company_email') || companySettings.email;
        companySettings.website = getVal('company_website') || companySettings.website;
        companySettings.gst = getVal('company_gst') || getVal('company_gstin') || '';
        
        const logoPath = getVal('company_logo');
        if (logoPath) {
          companySettings.logo = logoPath.startsWith('http') ? logoPath : `http://localhost:5000${logoPath}`;
        }
        
        const addr = [
          getVal('address_line1'),
          getVal('address_city'),
          getVal('address_state'),
          getVal('address_zip'),
          getVal('address_country')
        ].filter(Boolean).join(', ');
        companySettings.address = getVal('company_address') || addr || companySettings.address;
      }
    } catch (err) {
      console.error('Failed to load company settings:', err);
    }

    const doc = new jsPDF();
    
    // Load Logo
    const logoPng = await loadImageAsPng(companySettings.logo);
    if (logoPng) {
      doc.addImage(logoPng, 'PNG', 15, 12, 35, 12);
    } else {
      // Draw placeholder text if logo fails to load
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235);
      doc.text(companySettings.name, 15, 20);
    }

    // Header Right: Company details
    doc.setTextColor(30, 41, 59); // Slate-800 for high clarity
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    
    const rightAlignX = 195;
    doc.text(companySettings.name, rightAlignX, 15, { align: 'right' });
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    
    // Split address into two lines if it's too long
    const splitAddr = doc.splitTextToSize(companySettings.address, 70);
    let currentY = 20;
    splitAddr.forEach((line: string) => {
      doc.text(line, rightAlignX, currentY, { align: 'right' });
      currentY += 4.5;
    });
    
    doc.text(`Phone: ${companySettings.phone}`, rightAlignX, currentY, { align: 'right' });
    doc.text(`Email: ${companySettings.email} | Web: ${companySettings.website}`, rightAlignX, currentY + 4.5, { align: 'right' });
    if (companySettings.gst) {
      doc.text(`GSTIN: ${companySettings.gst}`, rightAlignX, currentY + 9, { align: 'right' });
    }

    const lineY = currentY + (companySettings.gst ? 14 : 9.5);

    // Decorative thin line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, lineY, 195, lineY);

    // Invoice Title
    const titleY = lineY + 10;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.setFont('Helvetica', 'bold');
    doc.text('TAX INVOICE', 15, titleY);

    // Invoice Metadata (Right aligned)
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, rightAlignX, titleY - 2, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, rightAlignX, titleY + 3, { align: 'right' });
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, rightAlignX, titleY + 8, { align: 'right' });
    doc.text(`Status: ${invoice.status}`, rightAlignX, titleY + 13, { align: 'right' });
    if (invoice.paymentMethod) {
      doc.text(`Payment Method: ${invoice.paymentMethod}`, rightAlignX, titleY + 18, { align: 'right' });
    }
    if (invoice.paymentDate) {
      doc.text(`Payment Date: ${new Date(invoice.paymentDate).toLocaleDateString()}`, rightAlignX, titleY + 23, { align: 'right' });
    }

    // Billed To (Left aligned)
    const clientY = titleY + 28;
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Billed To:', 15, clientY);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Contact: ${invoice.client?.name || 'N/A'}`, 15, clientY + 6);
    doc.text(`Company: ${invoice.client?.companyName || 'N/A'}`, 15, clientY + 11);
    doc.text(`Email: ${invoice.client?.email || 'N/A'}`, 15, clientY + 16);
    doc.text(`Phone: ${invoice.client?.phone || 'N/A'}`, 15, clientY + 21);

    const clientAddr = invoice.client?.address || 'N/A';
    const splitClientAddr = doc.splitTextToSize(`Address: ${clientAddr}`, 85);
    let clientAddrY = clientY + 26;
    splitClientAddr.forEach((line: string) => {
      doc.text(line, 15, clientAddrY);
      clientAddrY += 5;
    });

    const getCustomerIdentifications = (inv: any) => {
      const ids: { label: string; value: string; isVerified?: boolean }[] = [];
      const client = inv.client || {};
      const lead = inv.clientPackage?.lead || inv.clientPackage?.proposal?.leadId || inv.lead || inv.proposal?.leadId || {};

      const gst = inv.clientGstNumber || client.gstNumber || lead.gstNumber || client.gstin || lead.gstin || client.gst || lead.gst || '';
      const isGstVerified = client.isGstVerified || lead.isGstVerified || false;
      if (gst) {
        ids.push({ label: 'GSTIN', value: gst, isVerified: isGstVerified });
      }

      const pan = inv.clientPanNumber || client.panNumber || lead.panNumber || client.pan || lead.pan || '';
      const isPanVerified = client.isPanVerified || lead.isPanVerified || false;
      if (pan) {
        ids.push({ label: 'PAN', value: pan, isVerified: isPanVerified });
      }

      const cin = inv.clientCinNumber || client.cinNumber || client.companyRegistrationNumber || lead.cinNumber || lead.companyRegistrationNumber || client.regNumber || lead.regNumber || '';
      if (cin) {
        ids.push({ label: 'CIN/Reg No', value: cin });
      }

      const aadhar = client.aadharNumber || lead.aadharNumber || client.aadhar || lead.aadhar || '';
      if (aadhar) {
        ids.push({ label: 'Aadhar', value: aadhar });
      }

      const tan = client.tanNumber || lead.tanNumber || client.tan || '';
      if (tan) {
        ids.push({ label: 'TAN', value: tan });
      }
      const tin = client.tinNumber || lead.tinNumber || client.tin || '';
      if (tin) {
        ids.push({ label: 'TIN', value: tin });
      }

      const kycGstStr = client.kycGst || lead.kycGst || inv.kycGst || '';
      if (kycGstStr && typeof kycGstStr === 'string') {
        const parts = kycGstStr.split(',');
        parts.forEach((part: string) => {
          const bits = part.split(':').map(b => b.trim());
          if (bits.length >= 2) {
            const type = bits[0];
            const val = bits[1];
            const isVerif = bits[2] === 'Verified';
            if (type && val && !ids.some(i => i.label.toUpperCase() === type.toUpperCase())) {
              ids.push({ label: type, value: val, isVerified: isVerif });
            }
          }
        });
      }

      return ids;
    };

    const customerIds = getCustomerIdentifications(invoice);
    customerIds.forEach((idObj) => {
      doc.text(`${idObj.label}: ${idObj.value}`, 15, clientAddrY);
      if (idObj.isVerified) {
        doc.setTextColor(34, 197, 94);
        doc.text(' [Verified]', 15 + doc.getTextWidth(`${idObj.label}: ${idObj.value}`), clientAddrY);
        doc.setTextColor(71, 85, 105);
      }
      clientAddrY += 5;
    });

    // Service/Package Details (Rendered on the right side next to Billed To)
    const detailsX = 110;
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Service Details:', detailsX, clientY);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Category: ${invoice.category || invoice.clientPackage?.package?.category || 'Website Development'}`, detailsX, clientY + 6);
    
    const servicesText = invoice.packageOrService || invoice.clientPackage?.package?.name || 'Basic';
    const servicesList = servicesText.split(',').map((s: string) => s.trim());
    
    doc.text('Package / Service:', detailsX, clientY + 11);
    let serviceY = clientY + 16;
    servicesList.forEach((s: string) => {
      doc.text(`- ${s}`, detailsX + 2, serviceY);
      serviceY += 5;
    });

    // Items Table
    let rowIdx = 1;
    const tableBody: any[] = [];

    const pkgTypeVal = invoice.packageType || invoice.clientPackage?.packageType || invoice.clientPackage?.package?.packageType || '';
    const pkgOrServiceText = invoice.packageOrService || invoice.clientPackage?.package?.name || '';
    const isComboPackage = 
      pkgTypeVal === 'Combo' || 
      pkgOrServiceText.toLowerCase().includes('combo') || 
      (invoice.category || '').toLowerCase().includes('combo');

    if (isComboPackage) {
      let displayName = pkgOrServiceText || 'Combo Package';
      if (!displayName.toLowerCase().includes('combo')) {
        displayName = `Combo Package - ${displayName}`;
      }
      tableBody.push([
        rowIdx++,
        displayName,
        '998314',
        1,
        (invoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        'GST 18%',
        (invoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    } else if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((item: any) => {
        const lines = (item.description || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
        const parentName = item.serviceName || lines[0] || 'Service';

        tableBody.push([
          rowIdx++,
          parentName,
          '998314',
          item.quantity || 1,
          (item.unitPrice || item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          `GST ${item.gstRate || 18}%`,
          (item.amount || (item.quantity || 1) * (item.unitPrice || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })
        ]);
      });
    } else {
      const displayName = pkgOrServiceText || 'Normal Package / Services';
      tableBody.push([
        rowIdx++,
        displayName,
        '998314',
        1,
        (invoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        'GST 18%',
        (invoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }

    tableBody.push([
      '', '', '', '', '',
      'Sub Total',
      (invoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    if (invoice.discount > 0) {
      tableBody.push([
        '', '', '', '', '',
        'Discount',
        `-${(invoice.discount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      ]);
    }

    if (invoice.cgst > 0) {
      tableBody.push([
        '', '', '', '', '',
        'CGST (9%)',
        (invoice.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }
    if (invoice.sgst > 0) {
      tableBody.push([
        '', '', '', '', '',
        'SGST (9%)',
        (invoice.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }
    if (invoice.igst > 0) {
      tableBody.push([
        '', '', '', '', '',
        'IGST (18%)',
        (invoice.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }
    if (!(invoice.cgst > 0 || invoice.sgst > 0 || invoice.igst > 0) && (invoice.tax || invoice.gstAmount) > 0) {
      tableBody.push([
        '', '', '', '', '',
        'GST (18%)',
        (invoice.tax || invoice.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }

    tableBody.push([
      '', '', '', '', '',
      'Total',
      (invoice.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    if (invoice.paidAmount > 0) {
      tableBody.push([
        '', '', '', '', '',
        'Amount Paid',
        (invoice.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }

    const outstandingBalance = invoice.dueAmount !== undefined ? invoice.dueAmount : (invoice.status === 'Paid' ? 0 : invoice.total);
    if (outstandingBalance > 0) {
      tableBody.push([
        '', '', '', '', '',
        'Balance Due',
        (outstandingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }

    autoTable(doc, {
      startY: Math.max(clientY + 32, clientAddrY + 6, serviceY + 6),
      head: [['#', 'Item', 'Hsn/Sac', 'Qty/Hrs', 'Unit Price', 'Tax', 'Price (INR)']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        lineWidth: 0.5,
        lineColor: [226, 232, 240]
      },
      bodyStyles: {
        fontSize: 8.5,
        valign: 'middle',
        lineColor: [226, 232, 240],
        lineWidth: 0.5
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70, halign: 'left' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 23, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' }
      },
      didParseCell: (data) => {
        const rawRow = data.row.raw as any;
        if (rawRow && rawRow[0] === '' && rawRow[5] !== '') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 250, 252];
          
          if (rawRow[5] === 'Total') {
            data.cell.styles.fontSize = 9.5;
            data.cell.styles.textColor = [15, 23, 42];
          }
          if (rawRow[5] === 'Balance Due') {
            data.cell.styles.textColor = [180, 83, 9];
          }
          if (rawRow[5] === 'Amount Paid') {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      }
    });

    const finalY = ((doc as any).lastAutoTable?.finalY || 140) + 15;

    // Build Payment Receipt Details / History
    let paymentsList = [];
    if (invoice.payments && invoice.payments.length > 0) {
      paymentsList = invoice.payments;
    } else if (invoice.paidAmount > 0 && invoice.paymentMethod) {
      paymentsList = [{
        amountPaid: invoice.paidAmount,
        paymentDate: invoice.paymentDate || invoice.updatedAt || new Date(),
        paymentMethod: invoice.paymentMethod,
        referenceNumber: invoice.referenceNumber,
        transactionId: invoice.transactionId,
        paymentNotes: invoice.paymentNotes
      }];
    }

    const paymentRows = paymentsList.map((p: any) => {
      let detailsText = '';
      if (p.paymentMethod === 'Cash') {
        detailsText = `Received By: ${p.referenceNumber || 'N/A'}`;
        if (p.paymentNotes) {
          const notesPart = p.paymentNotes.split(' | ').find((pt: string) => pt.startsWith('Notes:'));
          if (notesPart) detailsText += ` (${notesPart.replace('Notes:', '').trim()})`;
        }
      } else if (p.paymentMethod === 'Cheque') {
        detailsText = `Cheque No: ${p.referenceNumber || 'N/A'}`;
        if (p.paymentNotes) {
          const bankPart = p.paymentNotes.split(' | ').find((pt: string) => pt.startsWith('Bank:'));
          if (bankPart) detailsText += ` (${bankPart.replace('Bank:', '').trim()})`;
        }
      } else if (p.paymentMethod === 'Online') {
        const gatewayName = p.referenceNumber || 'Online';
        const txnId = p.transactionId || (p.paymentNotes ? p.paymentNotes.match(/Txn ID:\s*([^\s|]+)/)?.[1] : '') || 'N/A';
        const modeMatch = p.paymentNotes ? p.paymentNotes.match(/Mode:\s*([^|]+)/) : null;
        const modeText = modeMatch ? ` (${modeMatch[1].trim()})` : '';
        detailsText = `Gateway: ${gatewayName}${modeText} | Txn ID: ${txnId}`;
      } else {
        detailsText = p.referenceNumber || p.paymentNotes || 'N/A';
      }

      return [
        new Date(p.paymentDate).toLocaleDateString('en-IN'),
        p.paymentMethod,
        detailsText,
        `INR ${p.amountPaid.toLocaleString('en-IN')}`
      ];
    });

    let currentYOffset = finalY + 45;

    if (paymentRows.length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Payment Receipt Details / History:', 15, currentYOffset);

      autoTable(doc, {
        startY: currentYOffset + 4,
        head: [['Payment Date', 'Payment Mode', 'Transaction / Reference Details', 'Amount Paid']],
        body: paymentRows,
        theme: 'striped',
        headStyles: { fillColor: [71, 85, 105], fontSize: 9 },
        bodyStyles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 30 },
          2: { cellWidth: 95 },
          3: { cellWidth: 35 }
        }
      });
      currentYOffset = (doc as any).lastAutoTable?.finalY + 12;
    }



    // Footer Page Number and Disclaimer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      
      // Footer Divider line
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.5);
      doc.line(15, 280, 195, 280);
      
      doc.text('This is a computer-generated official tax invoice.', 15, 285);
      doc.text(`Page ${i} of ${pageCount}`, rightAlignX, 285, { align: 'right' });
    }

    doc.save(`${invoice.invoiceNumber}_Invoice.pdf`);
  };

  const handleOpenConvertModal = (proposal: any) => {
    setSelectedProposalToConvert(proposal);
    setConvertStartDate('');
    setConvertEndDate('');
    setConvertAccountManager('');
    setShowConvertModal(true);
  };

  const handleConvertProposalToClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProposalToConvert) return;

    const payload = {
      leadId: selectedProposalToConvert.leadId?._id || selectedProposalToConvert.leadId,
      proposalId: selectedProposalToConvert._id,
      packageId: selectedProposalToConvert.packageId?._id || selectedProposalToConvert.packageId || null,
      customServices: selectedProposalToConvert.services.map((s: any) => ({
        serviceId: s.serviceId,
        name: s.name,
        price: s.price,
        deliverables: s.deliverables
      })),
      startDate: convertStartDate,
      endDate: convertEndDate,
      billingCycle: selectedProposalToConvert.billingCycle,
      price: selectedProposalToConvert.price,
      gstAmount: selectedProposalToConvert.gstAmount,
      total: selectedProposalToConvert.total,
      accountManager: convertAccountManager,
      serviceDetails: selectedProposalToConvert.serviceDetails ? selectedProposalToConvert.serviceDetails.map((d: any) => d._id || d) : []
    };

    try {
      const res = await axios.post('http://localhost:5000/api/client-packages/convert-lead', payload);
      if (res.data.success) {
        // Accept proposal
        await axios.put(`http://localhost:5000/api/proposals/${selectedProposalToConvert._id}`, { status: 'Accepted' });
        alert('Lead successfully converted to Client. Subscription activated and first Invoice generated!');
        setShowConvertModal(false);
        fetchData();
        setActiveTab('subscriptions');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to convert proposal');
    }
  };

  const handleProposalDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this proposal?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/proposals/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete proposal');
    }
  };

  // -------------------------------------------------------------
  // TAB 5: Subscriptions & Renewals
  // -------------------------------------------------------------
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [subToRenew, setSubToRenew] = useState<any>(null);
  const [renewalEndDate, setRenewalEndDate] = useState('');
  const [renewalCycle, setRenewalCycle] = useState('Monthly');
  const [renewalPrice, setRenewalPrice] = useState(0);

  const handleOpenRenewalModal = (sub: any) => {
    setSubToRenew(sub);
    setRenewalEndDate('');
    setRenewalCycle(sub.billingCycle);
    setRenewalPrice(sub.price);
    setShowRenewalModal(true);
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subToRenew) return;

    const gstAmt = Math.round(renewalPrice * 0.18);
    const totalAmt = renewalPrice + gstAmt;

    const payload = {
      newEndDate: renewalEndDate,
      newBillingCycle: renewalCycle,
      newPrice: renewalPrice,
      newGstAmount: gstAmt,
      newTotal: totalAmt
    };

    try {
      const res = await axios.post(`http://localhost:5000/api/client-packages/${subToRenew._id}/renew`, payload);
      if (res.data.success) {
        alert('Subscription renewed successfully! Renewal invoice has been generated.');
        setShowRenewalModal(false);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to renew subscription');
    }
  };

  const handleCancelSubscription = async (id: string) => {
    if (!window.confirm('Are you sure you want to expire/cancel this subscription?')) return;
    try {
      await axios.put(`http://localhost:5000/api/client-packages/${id}`, { status: 'Expired' });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel subscription');
    }
  };

  // -------------------------------------------------------------
  // TAB 6: Invoice Management
  // -------------------------------------------------------------
  const handleOpenPaymentModal = (invoice: any) => {
    resetPaymentModalStates();
    const outstanding = invoice.dueAmount !== undefined ? invoice.dueAmount : (invoice.status === 'Paid' ? 0 : invoice.total);
    setSelectedInvoiceForPayment(invoice);
    setPaymentAmount(outstanding);
    setPaymentMethod('Cash');
    setPaymentDate(invoice.paymentDate ? new Date(invoice.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setPaymentStatus(outstanding > 0 ? 'Paid' : invoice.status);
    setShowPaymentModal(true);
  };

  const handleOpenPartialPaymentModal = (invoice: any) => {
    setSelectedInvoiceForPartialHistory(invoice);
    setShowPartialHistoryModal(true);
  };

  const handleChequeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);

    setUploadingChequeImage(true);
    try {
      const res = await axios.post('http://localhost:5000/api/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && (res.data.fileUrl || res.data.filePath)) {
        setChequeImage(res.data.fileUrl || res.data.filePath);
        alert('Cheque image uploaded successfully');
      }
    } catch (err) {
      alert('Error uploading cheque image');
    } finally {
      setUploadingChequeImage(false);
    }
  };

  const handleMakePaymentForProposal = async (prop: any) => {
    // 1. If proposal is already Accepted, find the matching invoice and open payment modal
    if (prop.status === 'Accepted') {
      const invoice = invoices.find(inv => {
        const invPropId = inv.clientPackage?.proposal?._id || inv.clientPackage?.proposal;
        return invPropId && String(invPropId) === String(prop._id);
      });
      if (invoice) {
        resetPaymentModalStates();
        const outstanding = invoice.dueAmount !== undefined ? invoice.dueAmount : (invoice.status === 'Paid' ? 0 : invoice.total);
        setSelectedInvoiceForPayment(invoice);
        setPaymentAmount(outstanding);
        setPaymentMethod('Cash');
        setPaymentDate(invoice.paymentDate ? new Date(invoice.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setPaymentStatus(outstanding > 0 ? 'Paid' : invoice.status);
        setShowPaymentModal(true);
      } else {
        alert('No invoice found for this accepted proposal.');
      }
      return;
    }

    // 2. If proposal is Sent (not accepted), perform lead conversion automatically first, then open payment modal!
    if (!window.confirm('This will convert the lead to client and generate the invoice. Proceed to payment?')) return;

    try {
      const start = new Date();
      start.setDate(start.getDate() + 7);
      const end = new Date(start);
      end.setFullYear(start.getFullYear() + 1);
      const startDateStr = start.toISOString().split('T')[0];
      const endDateStr = end.toISOString().split('T')[0];

      const propLead = prop.leadId || {};
      const leadSalesId = propLead.assignedSales?._id || propLead.assignedSales || null;
      const managerId = leadSalesId || loggedInUser._id || loggedInUser.id || users[0]?._id || null;

      const convertPayload = {
        leadId: prop.leadId?._id || prop.leadId,
        proposalId: prop._id,
        packageId: prop.packageId?._id || prop.packageId || null,
        customServices: prop.services.map((s: any) => ({
          serviceId: s.serviceId,
          name: s.name,
          price: s.price,
          deliverables: s.deliverables
        })),
        startDate: startDateStr,
        endDate: endDateStr,
        billingCycle: prop.billingCycle,
        price: prop.price,
        gstAmount: prop.gstAmount,
        total: prop.total,
        accountManager: managerId,
        serviceDetails: prop.serviceDetails ? prop.serviceDetails.map((d: any) => d._id || d) : [],
        stage: 'Deal Close',
        remarks: `Lead converted to client and package assigned by ${loggedInUser.name || 'System'}.`,
        changedBy: loggedInUser.name || 'System'
      };

      const convRes = await axios.post('http://localhost:5000/api/client-packages/convert-lead', convertPayload);
      if (convRes.data.success) {
        // Accept proposal
        await axios.put(`http://localhost:5000/api/proposals/${prop._id}`, { status: 'Accepted' });
        
        const invoice = convRes.data.data.invoice;
        invoice.client = convRes.data.data.client;
        resetPaymentModalStates();
        setSelectedInvoiceForPayment(invoice);
        setPaymentAmount(invoice.total);
        setPaymentMethod('Cash');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentStatus('Paid');
        setShowPaymentModal(true);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to initiate payment conversion');
    }
  };

  const handleSubmitInvoicePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    if (paymentMethod === 'Cash') {
      const denomTotal = (note500 * 500) + (note200 * 200) + (note100 * 100) + (note50 * 50) + (note10 * 10) + paisaAmount;
      if (denomTotal > 0 && denomTotal !== paymentAmount) {
        if (!window.confirm(`Warning: The total value of entered denominations (₹${denomTotal.toLocaleString()}) does not match the payment amount (₹${paymentAmount.toLocaleString()}). Do you still want to proceed?`)) {
          return;
        }
      }
    }

    if (paymentMethod === 'Cheque') {
      if (!chequeNumber.trim()) {
        alert('Please enter the Cheque Number.');
        return;
      }
      if (!chequeDetails.trim()) {
        alert('Please enter the Cheque Details (Bank/Branch).');
        return;
      }
      if (!chequeAccountNumber.trim()) {
        alert('Please enter the Account Number.');
        return;
      }
      if (!chequeIfscNumber.trim()) {
        alert('Please enter the IFSC Number.');
        return;
      }
    }

    const outstanding = selectedInvoiceForPayment.dueAmount !== undefined 
      ? selectedInvoiceForPayment.dueAmount 
      : (selectedInvoiceForPayment.status === 'Paid' ? 0 : selectedInvoiceForPayment.total);

    if (isPartialPayment) {
      const isFirstPayment = (selectedInvoiceForPayment.paidAmount || 0) === 0;
      const minFirstPayment = Math.min(12000, outstanding);
      if (isFirstPayment && paymentAmount < minFirstPayment) {
        alert(`Minimum first payment amount for partial payment is ₹${minFirstPayment.toLocaleString()}.`);
        setPaymentAmount(minFirstPayment);
        return;
      }
      if (!nextPaymentDate) {
        alert('Please specify the date for the next payment.');
        return;
      }
    }

    let payload: any = {
      action: 'PAYMENT_RECORDED',
      status: paymentStatus,
      paymentMethod,
      paymentDate
    };

    if (paymentStatus === 'Paid' || paymentStatus === 'Partially Paid') {
      let finalPaymentAmount = paymentAmount;
      if (paymentStatus === 'Paid') {
        finalPaymentAmount = outstanding;
      }

      if (finalPaymentAmount <= 0) {
        alert("Payment amount must be greater than zero");
        return;
      }
      if (finalPaymentAmount > outstanding) {
        alert(`Payment amount cannot exceed the outstanding balance of ₹${outstanding.toLocaleString()}`);
        return;
      }

      const newPaidAmount = (selectedInvoiceForPayment.paidAmount || 0) + finalPaymentAmount;
      const newDueAmount = selectedInvoiceForPayment.total - newPaidAmount;
      
      payload.paidAmount = newPaidAmount;
      payload.dueAmount = newDueAmount;
      payload.status = newDueAmount <= 0 ? 'Paid' : 'Partially Paid';
    } else {
      payload.paidAmount = selectedInvoiceForPayment.paidAmount || 0;
      payload.dueAmount = selectedInvoiceForPayment.dueAmount !== undefined ? selectedInvoiceForPayment.dueAmount : selectedInvoiceForPayment.total;
    }

    if (paymentMethod === 'Cash') {
      payload.referenceNumber = cashReceivedBy;
      const denomStr = `Denominations: [500x${note500}, 200x${note200}, 100x${note100}, 50x${note50}, 10x${note10}, Coins/Paisa: ₹${paisaAmount}]`;
      payload.paymentNotes = `Cash Received By: ${cashReceivedBy || 'N/A'}${cashNotes ? ` | Notes: ${cashNotes}` : ''} | ${denomStr}`;
    } else if (paymentMethod === 'Cheque') {
      payload.referenceNumber = chequeNumber;
      payload.bankName = chequeDetails;
      payload.paymentNotes = `Cheque No: ${chequeNumber} | Bank: ${chequeDetails} | Account No: ${chequeAccountNumber} | IFSC Code: ${chequeIfscNumber} | Image: ${chequeImage || 'None'}`;
    } else if (paymentMethod === 'Online') {
      payload.referenceNumber = onlineGateway;
      payload.transactionId = transactionId;
      const subMethodDetails = gatewaySelectedMethod === 'Netbanking' 
        ? `Netbanking (${gatewayNetbank})` 
        : gatewaySelectedMethod;
      payload.paymentNotes = `Gateway: ${onlineGateway} | Mode: ${subMethodDetails} | Txn ID: ${transactionId || 'N/A'}`;
    }

    if (isPartialPayment) {
      const notes = [];
      if (payload.paymentNotes) notes.push(payload.paymentNotes);
      notes.push(`[Partial Payment] Next payment date: ${nextPaymentDate}`);
      payload.paymentNotes = notes.join(' | ');
      payload.dueDate = nextPaymentDate;
    }

    try {
      const response = await axios.put(`http://localhost:5000/api/invoices/${selectedInvoiceForPayment._id}`, payload);
      alert(`Invoice status and payment options updated successfully!`);
      resetPaymentModalStates();
      setShowPaymentModal(false);
      fetchData();
      if (response.data.success && response.data.data) {
        generatePDFInvoice(response.data.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update invoice payment options');
    }
  };

  const handleCancelInvoice = async (invoice: any) => {
    if (!window.confirm(`Cancel invoice ${invoice.invoiceNumber}?`)) return;
    try {
      await axios.put(`http://localhost:5000/api/invoices/${invoice._id}`, { status: 'Cancelled' });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel invoice');
    }
  };

  // -------------------------------------------------------------
  // UI Render
  // -------------------------------------------------------------
  return (
    <div style={{ padding: '20px' }}>
      {/* Top Title & Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Package & Inventory Management</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Manage agency services, bundle packages, build custom estimates, track proposal approvals, subscriptions, and billing invoices.</p>
      </div>

      {error && (
        <div style={{ padding: '12px 20px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
        </div>
      )}

      {/* Tabs list hidden - navigated via sidebar */}

      {/* Content wrapper */}
      <div>
        
        {/* ========================================== */}
        {/* TAB 1: Dashboard View                      */}
        {/* ========================================== */}
        {activeTab === 'dashboard' && (
          <div>
            {/* KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div className="chart-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ background: '#eff6ff', color: '#2563eb', padding: '12px', borderRadius: '10px' }}><Layers size={24} /></div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TOTAL SERVICES</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>{services.length}</div>
                </div>
              </div>

              <div className="chart-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ background: '#f5f3ff', color: '#7c3aed', padding: '12px', borderRadius: '10px' }}><CheckSquare size={24} /></div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TOTAL PACKAGES</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>{packages.length}</div>
                </div>
              </div>

              <div className="chart-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ background: '#ecfdf5', color: '#10b981', padding: '12px', borderRadius: '10px' }}><Users size={24} /></div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>ACTIVE PLANS</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>{activeSubs.length}</div>
                </div>
              </div>

              <div className="chart-card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ background: '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '10px' }}><RefreshCw size={24} /></div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>RENEWALS DUE</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>{renewalDueCount}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div className="chart-card" style={{ padding: '24px', borderRadius: '12px', background: '#2563eb', color: '#ffffff', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, opacity: 0.8 }}>MONTHLY RECURRING REVENUE (MRR)</span>
                  <TrendingUp size={20} style={{ opacity: 0.8 }} />
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '12px' }}>₹{Math.round(monthlyRecurringRevenue).toLocaleString('en-IN')}</div>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.8 }}>Normalized monthly package subscription income from all active clients.</p>
              </div>

              <div className="chart-card" style={{ padding: '24px', borderRadius: '12px', background: '#0f172a', color: '#ffffff', boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, opacity: 0.8 }}>ACTIVE PACKAGE VALUE</span>
                  <Award size={20} style={{ opacity: 0.8 }} />
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '12px' }}>₹{totalPackageRev.toLocaleString('en-IN')}</div>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.8 }}>Total aggregate value of active client packages including GST.</p>
              </div>

              <div className="chart-card" style={{ padding: '24px', borderRadius: '12px', background: '#10b981', color: '#ffffff', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, opacity: 0.8 }}>GST TAX COLLECTED</span>
                  <DollarSign size={20} style={{ opacity: 0.8 }} />
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '12px' }}>₹{gstCollected.toLocaleString('en-IN')}</div>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.8 }}>Total GST collected from all paid package subscription invoices.</p>
              </div>
            </div>

            {/* Expired and Alerts list */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              <div className="chart-card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Active Packages Summary</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ paddingBottom: '12px', fontWeight: 600 }}>Client</th>
                      <th style={{ paddingBottom: '12px', fontWeight: 600 }}>Package</th>
                      <th style={{ paddingBottom: '12px', fontWeight: 600 }}>End Date</th>
                      <th style={{ paddingBottom: '12px', fontWeight: 600 }}>Manager</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSubs.slice(0, 5).map(sub => (
                      <tr key={sub._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 0', fontWeight: 600, color: '#1e293b' }}>{sub.client?.companyName}</td>
                        <td style={{ padding: '12px 0', color: '#475569' }}>{sub.package?.name || 'Custom Package'}</td>
                        <td style={{ padding: '12px 0', color: '#ef4444', fontWeight: 600 }}>{new Date(sub.endDate).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 0', color: '#64748b' }}>
                          {(() => {
                            const isAMAdmin = sub.accountManager?.role?.name?.toLowerCase().includes('admin');
                            if (isAMAdmin) {
                              return sub.lead?.assignedSales?.name || sub.accountManager?.name || 'Unassigned';
                            }
                            return sub.accountManager?.name || sub.lead?.assignedSales?.name || 'Unassigned';
                          })()}
                        </td>
                      </tr>
                    ))}
                    {activeSubs.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>No active subscription packages found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="chart-card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Upcoming Renewals</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingRenewalSubs.concat(activeSubs).slice(0, 4).map(sub => {
                    const daysLeft = Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={sub._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', border: '1px solid #f1f5f9', background: daysLeft <= 7 ? '#fef2f2' : '#f8fafc' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{sub.client?.companyName}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{sub.package?.name || 'Custom'}</div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: daysLeft <= 7 ? '#ef4444' : '#2563eb' }}>
                          {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                        </span>
                      </div>
                    );
                  })}
                  {activeSubs.length === 0 && pendingRenewalSubs.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px 0' }}>No pending renewals.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: Package Master List & Form           */}
        {/* ========================================== */}
        {activeTab === 'packages' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Package Master</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }}>Package Type:</label>
                  <select 
                    className="input-field" 
                    value={pkgMasterFilterType} 
                    onChange={e => setPkgMasterFilterType(e.target.value)}
                    style={{ width: '180px', padding: '6px 12px', fontSize: '13px', margin: 0 }}
                  >
                    <option value="All">All Package Types</option>
                    <option value="Normal">Normal Package</option>
                    <option value="Combo">Combo Package</option>
                  </select>
                </div>
                {isAdmin && (
                  <button className="btn-primary" onClick={handleOpenPkgAddModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Create Package
                  </button>
                )}
              </div>
            </div>

            {(() => {
              const filteredMasterPackages = packages.filter(pkg => {
                if (pkgMasterFilterType === 'Normal') return pkg.packageType !== 'Combo';
                if (pkgMasterFilterType === 'Combo') return pkg.packageType === 'Combo';
                return true;
              });

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {filteredMasterPackages.map(pkg => (
                    <div key={pkg._id} className="chart-card" style={{ display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: '#eff6ff', color: '#2563eb' }}>{pkg.category}</span>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: pkg.packageType === 'Combo' ? '#fef3c7' : '#f1f5f9', color: pkg.packageType === 'Combo' ? '#92400e' : '#475569' }}>
                              {pkg.packageType === 'Combo' ? 'Combo Package' : 'Normal Package'}
                            </span>
                          </div>
                          <h3 style={{ margin: '8px 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{pkg.name}</h3>
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Code: {pkg.code}</div>
                        </div>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button onClick={() => handleOpenPkgEditModal(pkg)} className="btn-secondary" style={{ padding: '6px', borderRadius: '6px' }}><Edit size={14} /></button>
                            <button onClick={() => handlePkgDelete(pkg._id)} className="btn-danger" style={{ padding: '6px', borderRadius: '6px' }}><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                      
                      <p style={{ color: '#64748b', fontSize: '13px', marginTop: '12px', flexGrow: 1 }}>{pkg.description || 'No description provided.'}</p>
                      
                      {/* Services list tags */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '15px 0' }}>
                        {(pkg.services || []).map((s: any) => (
                          <span key={s._id} style={{ fontSize: '11px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>{s.name}</span>
                        ))}
                      </div>

                      {/* Pricing summaries */}
                      {(() => {
                        const cardMonthly = pkg.pricing?.monthly || 0;
                    const isCardOneShot = pkg.packageType !== 'Combo';
                    const isIntl = isInternationalItem(pkg);
                    const sym = isIntl ? '$' : '₹';
                    const taxLabel = isIntl ? 'Tax' : 'GST';

                    if (isCardOneShot) {
                      return (
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>One-Time Price (Incl. {taxLabel}):</span>
                          <strong style={{ color: '#1e293b' }}>{sym}{Math.round(cardMonthly * 1.18).toLocaleString()}</strong>
                        </div>
                      );
                    }

                    return (
                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                        <div><span style={{ color: '#94a3b8' }}>Monthly:</span> <strong style={{ color: '#1e293b' }}>{sym}{cardMonthly.toLocaleString()}</strong></div>
                        <div><span style={{ color: '#94a3b8' }}>Quarterly:</span> <strong style={{ color: '#1e293b' }}>{sym}{(pkg.pricing?.quarterly || 0).toLocaleString()}</strong></div>
                        <div><span style={{ color: '#94a3b8' }}>Half-Yearly:</span> <strong style={{ color: '#1e293b' }}>{sym}{(pkg.pricing?.halfYearly || 0).toLocaleString()}</strong></div>
                        <div><span style={{ color: '#94a3b8' }}>Yearly:</span> <strong style={{ color: '#1e293b' }}>{sym}{(pkg.pricing?.yearly || 0).toLocaleString()}</strong></div>
                      </div>
                    );
                  })()}
                </div>
              ))}
              {filteredMasterPackages.length === 0 && (
                <div style={{ textAlign: 'center', gridColumn: '1 / -1', color: '#64748b', padding: '40px' }}>
                  No {pkgMasterFilterType !== 'All' ? `${pkgMasterFilterType} ` : ''}packages found.
                </div>
              )}
            </div>
          );
        })()}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: Custom Package Builder             */}
        {/* ========================================== */}
        {activeTab === 'builder' && (
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
            {/* Left side configurations */}
            <div className="chart-card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>1. Configure Package Details</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: buildPkgType === 'Combo' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Select Lead *</label>
                  <select className="input-field" value={buildLeadId} onChange={e => handleBuildLeadChange(e.target.value)}>
                    <option value="">Choose Lead</option>
                    {leads.map(l => (
                      <option key={l._id} value={l._id}>{l.businessName} ({l.contactPerson})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Package Type *</label>
                  <select className="input-field" value={buildPkgType} onChange={e => handleBuildPkgTypeChange(e.target.value as any)}>
                    <option value="">Choose Package Type</option>
                    <option value="Normal">Normal Package (One-Time)</option>
                    <option value="Combo">Combo Package (Recurring)</option>
                  </select>
                </div>
                {buildPkgType === 'Combo' && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Billing Cycle *</label>
                    <select 
                      className="input-field" 
                      value={buildBillingCycle} 
                      onChange={e => {
                        const newCycle = e.target.value as any;
                        setBuildBillingCycle(newCycle);
                        if (buildSelectedPackages.length > 0) {
                          handleBuilderPackageToggle(buildSelectedPackages[0]);
                        }
                      }}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Predefined Package Selection Cards (Shows when Package Type is chosen) */}
              {/* If Combo Package is chosen */}
              {buildPkgType === 'Combo' && (
                <>
                  {/* Predefined Combo Package Selection Cards */}
                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>
                      Choose Predefined Combo Package *
                    </label>
                    {(() => {
                      const pkgsToDisplay = packages.filter(p => p.packageType === 'Combo');

                      if (pkgsToDisplay.length === 0) {
                        return <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>No predefined combo packages found. Please create a Combo Package in Package Master.</div>;
                      }

                      const selLead = leads.find(l => String(l._id) === String(buildLeadId));

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '12px' }}>
                          {pkgsToDisplay.map(pkg => {
                            const isSelected = buildSelectedPackages.includes(pkg._id);
                            const isIntl = isInternationalItem(selLead) || isInternationalItem(pkg);
                            const sym = isIntl ? '$' : '₹';
                            const cycleKey = buildBillingCycle === 'Half-Yearly' ? 'halfYearly' : buildBillingCycle.toLowerCase();
                            const cardPrice = pkg.pricing?.[cycleKey] || pkg.pricing?.monthly || pkg.price || 0;

                            return (
                              <div
                                key={pkg._id}
                                onClick={() => handleBuilderPackageToggle(pkg._id)}
                                style={{
                                  padding: '12px',
                                  borderRadius: '10px',
                                  border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                  background: isSelected ? '#eff6ff' : '#ffffff',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '8px', background: '#e0f2fe', color: '#0369a1', marginBottom: '4px' }}>
                                      {pkg.category}
                                    </span>
                                    <div style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? '#1d4ed8' : '#1e293b' }}>
                                      {pkg.name}
                                    </div>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleBuilderPackageToggle(pkg._id);
                                    }}
                                    style={{ cursor: 'pointer', marginTop: '2px' }}
                                  />
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', marginTop: '8px' }}>
                                  {buildBillingCycle}: {sym}{cardPrice.toLocaleString()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Included Package Services/Details without Price */}
                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>
                      2. Package Included Details (What you get in this package)
                    </label>
                    {buildSelectedPackages.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                        Select a Combo Package above to view included services and features.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {services.filter(s => buildSelectedServices.includes(s._id)).map(s => {
                          const serviceDetailsList = serviceDetails.filter(
                            d => d.status === 'Active' && String(d.service?._id || d.service) === String(s._id) && (buildSelectedDetails.length === 0 || buildSelectedDetails.includes(d._id))
                          );

                          return (
                            <div key={s._id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#f8fafc' }}>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span> {s.name}
                              </div>

                              {serviceDetailsList.length > 0 && (
                                <div style={{ marginTop: '8px', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {serviceDetailsList.map(d => (
                                    <div key={d._id} style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ color: '#2563eb', fontSize: '10px' }}>●</span>
                                      <span>{d.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* If Normal Package is chosen */}
              {buildPkgType === 'Normal' && (
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>2. Select Services & Pricing Details *</label>
                  {(() => {
                    const activeServices = services.filter(s => s.status === 'Active');
                    if (activeServices.length === 0) {
                      return <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>No active services found</div>;
                    }
                    const selLead = leads.find(l => String(l._id) === String(buildLeadId));

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {activeServices.map(s => {
                          const isServiceSelected = buildSelectedServices.includes(s._id);
                          const serviceDetailsList = serviceDetails.filter(
                            d => d.status === 'Active' && String(d.service?._id || d.service) === String(s._id)
                          );
                          
                          return (
                            <div key={s._id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: isServiceSelected ? '#f8fafc' : '#ffffff' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                                <input type="checkbox" checked={isServiceSelected} onChange={() => handleBuilderServiceToggle(s._id)} />
                                <span>{s.name}</span>
                              </label>

                              {/* If service is selected, display service details with checkboxes and prices */}
                              {isServiceSelected && (
                                <div style={{ marginTop: '10px', paddingLeft: '24px', borderLeft: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Choose Service Details / Pricing Items:</div>
                                  {serviceDetailsList.length === 0 ? (
                                    <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>No details found for this service.</div>
                                  ) : (
                                    serviceDetailsList.map(d => {
                                      const isDetailSelected = buildSelectedDetails.includes(d._id);
                                      const detailIntl = isInternationalItem(selLead);
                                      const sym = detailIntl ? '$' : '₹';
                                      return (
                                        <label key={d._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #f1f5f9', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: isDetailSelected ? '#eff6ff' : '#ffffff', borderColor: isDetailSelected ? '#bfdbfe' : '#f1f5f9' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input type="checkbox" checked={isDetailSelected} onChange={() => handleBuilderDetailChange(d._id, s._id)} />
                                            <span style={{ color: '#334155' }}>{d.name}</span>
                                          </div>
                                          <span style={{ fontWeight: 700, color: '#2563eb' }}>{sym}{(d.price || 0).toLocaleString()}</span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Right side summary calculator */}
            <div>
              <div className="chart-card" style={{ padding: '24px', borderRadius: '12px', background: '#0f172a', color: '#ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', position: 'sticky', top: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>Estimate Summary</h3>
                
                {(buildSelectedServices.length === 0 && buildSelectedPackages.length === 0) ? (
                  <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>Select services or package to compute pricing.</div>
                ) : (
                  (() => {
                    const { subtotal, postDiscount, gst, total, discountVal, enforcedPercent } = calculateBuilderTotal();
                    const hasDiscountAccess = isDiscountUnlocked;
                    const selLead = leads.find(l => String(l._id) === String(buildLeadId));
                    const selServices = services.filter(s => buildSelectedServices.includes(s._id));
                    const selPkgs = packages.filter(p => buildSelectedPackages.includes(p._id));
                    const isBuilderIntl = buildPkgType === 'Combo'
                      ? (isInternationalItem(selLead) || selServices.some(s => isInternationalItem(s)) || selPkgs.some(p => isInternationalItem(p)))
                      : isInternationalItem(selLead);
                    const builderSymbol = isBuilderIntl ? '$' : '₹';
                    const taxLabel = isBuilderIntl ? 'Tax (18%):' : 'GST (18%):';

                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>
                          <span>Actual Service Price:</span>
                          <span>{builderSymbol}{subtotal.toLocaleString()}</span>
                        </div>

                        {/* If Discount Code Verified & Unlocked */}
                        {isDiscountUnlocked && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>
                            <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                              {unlockedDiscountType === 'percentage' ? 'Select Discount (%):' : 'Fixed Discount Amount:'}
                            </span>
                            {unlockedDiscountType === 'percentage' ? (
                              <select 
                                className="input-field" 
                                value={buildDiscountPercent} 
                                onChange={e => setBuildDiscountPercent(Number(e.target.value))}
                                style={{ width: '110px', padding: '4px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', margin: 0 }}
                              >
                                <option value={0} style={{ color: '#0f172a', background: '#ffffff' }}>0%</option>
                                <option value={5} style={{ color: '#0f172a', background: '#ffffff' }}>5%</option>
                                <option value={10} style={{ color: '#0f172a', background: '#ffffff' }}>10%</option>
                                <option value={15} style={{ color: '#0f172a', background: '#ffffff' }}>15%</option>
                                <option value={20} style={{ color: '#0f172a', background: '#ffffff' }}>20%</option>
                                <option value={25} style={{ color: '#0f172a', background: '#ffffff' }}>25%</option>
                                <option value={30} style={{ color: '#0f172a', background: '#ffffff' }}>30%</option>
                                <option value={50} style={{ color: '#0f172a', background: '#ffffff' }}>50%</option>
                              </select>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#cbd5e1', fontSize: '12px' }}>{builderSymbol}</span>
                                <input 
                                  type="number" 
                                  className="input-field" 
                                  placeholder="0"
                                  value={buildDiscountFixed || ''} 
                                  onChange={e => setBuildDiscountFixed(Math.max(0, Number(e.target.value)))}
                                  style={{ width: '100px', padding: '4px 8px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', margin: 0 }}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {discountVal > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ef4444', marginBottom: '8px' }}>
                            <span>Discount {unlockedDiscountType === 'percentage' ? `(${buildDiscountPercent}%)` : ''}:</span>
                            <span>-{builderSymbol}{discountVal.toLocaleString()}</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>
                          <span>{taxLabel}</span>
                          <span>{builderSymbol}{gst.toLocaleString()}</span>
                        </div>

                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '15px 0' }}></div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, color: 'white' }}>
                          <span>Grand Total:</span>
                          <span>{builderSymbol}{total.toLocaleString()}</span>
                        </div>

                        <div className="form-group" style={{ marginTop: '20px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Terms & Conditions</label>
                          <textarea 
                            className="input-field" 
                            value={buildTerms} 
                            onChange={e => setBuildTerms(e.target.value)} 
                            style={{ minHeight: '60px', fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px' }}>
                          <button 
                            onClick={() => handleGenerateAndProcessProposal('send')} 
                            className="btn-secondary" 
                            style={{ 
                              padding: '12px 16px', 
                              fontWeight: 700, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              gap: '6px', 
                              borderRadius: '8px', 
                              border: '1px solid rgba(255,255,255,0.2)', 
                              background: 'rgba(255,255,255,0.05)', 
                              color: '#f8fafc',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              fontSize: '13px'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            }}
                          >
                            <Send size={16} /> Save & Send
                          </button>
                          <button 
                            onClick={() => handleGenerateAndProcessProposal('pay')} 
                            style={{ 
                              padding: '12px 16px', 
                              fontWeight: 700, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              gap: '6px', 
                              borderRadius: '8px', 
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
                              border: 'none', 
                              color: 'white',
                              cursor: 'pointer',
                              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)',
                              transition: 'all 0.2s ease-in-out',
                              fontSize: '13px'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(37, 99, 235, 0.3), 0 4px 6px -1px rgba(37, 99, 235, 0.15)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)';
                            }}
                          >
                            <CreditCard size={16} /> Make Payment
                          </button>
                        </div>
                        
                        <div style={{ marginTop: '20px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                          {!isDiscountUnlocked ? (
                            <button 
                              type="button" 
                              onClick={() => { setShowDiscountModal(true); setDiscountErrorMsg(''); setDiscountCodeInput(''); }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: '12px', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              ** apply discount applicable for special cases
                            </button>
                          ) : (
                            <span style={{ color: '#34d399', fontWeight: 600 }}>
                              ✓ Special Discount ({unlockedDiscountType === 'percentage' ? 'Percentage' : 'Fixed Price'}) Applied
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: Proposals                           */}
        {/* ========================================== */}
        {activeTab === 'proposals' && (
          <div className="data-table-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Proposal #</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Client / Lead Company</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Services</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Total Amount</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Status</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((prop: any) => {
                  const linkedInv = invoices.find(inv => {
                    const invPropId = inv.clientPackage?.proposal?._id || inv.clientPackage?.proposal;
                    return invPropId && String(invPropId) === String(prop._id);
                  });
                  const isFullyPaid = linkedInv && (linkedInv.status === 'Paid' || linkedInv.dueAmount <= 0);
                  const isPropIntl = isInternationalItem(prop);
                  const propSym = isPropIntl ? '$' : '₹';
                  const tooltipText = isFullyPaid 
                    ? (linkedInv.payments && linkedInv.payments.length > 0
                        ? linkedInv.payments.map((p: any) => `${new Date(p.paymentDate).toLocaleDateString('en-IN')}: ${isPropIntl ? '$' : 'INR '}${p.amountPaid.toLocaleString('en-IN')}`).join('\n')
                        : (linkedInv.paymentDate ? `${new Date(linkedInv.paymentDate).toLocaleDateString('en-IN')}: ${isPropIntl ? '$' : 'INR '}${linkedInv.paidAmount.toLocaleString('en-IN')}` : 'Payment recorded'))
                    : '';

                  return (
                    <tr key={prop._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{prop.proposalNumber}</td>
                    <td style={{ padding: '16px 20px', fontSize: '14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{prop.clientDetails?.companyName}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{prop.clientDetails?.name} | {prop.clientDetails?.email}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                      {(prop.services || []).map((s: any) => s.name).join(', ')}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{propSym}{prop.total.toLocaleString()}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className={`badge ${prop.status === 'Accepted' ? 'badge-green' : prop.status === 'Sent' ? 'badge-blue' : prop.status === 'Rejected' ? 'badge-red' : 'badge-gray'}`}>
                        {prop.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => generatePDFProposal(prop)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} title="Download PDF">
                          <Download size={14} /> PDF
                        </button>
                        {isFullyPaid ? (
                          <button 
                            style={{ 
                              padding: '8px 14px', 
                              fontSize: '12px', 
                              fontWeight: 600,
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              background: '#f0fdf4',
                              color: '#16a34a',
                              border: '1px solid #bbf7d0',
                              borderRadius: '8px',
                              cursor: 'default',
                              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                            }}
                            title={tooltipText}
                          >
                            <Check size={14} /> Payment done
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleMakePaymentForProposal(prop)} 
                            style={{ 
                              padding: '8px 14px', 
                              fontSize: '12px', 
                              fontWeight: 600,
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)',
                              transition: 'all 0.2s ease-in-out'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(37, 99, 235, 0.3), 0 4px 6px -1px rgba(37, 99, 235, 0.15)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)';
                            }}
                            title="Make Payment"
                          >
                            <CreditCard size={14} /> Make Payment
                          </button>
                        )}
                        {prop.status !== 'Accepted' && isSales && (
                          <button onClick={() => handleOpenConvertModal(prop)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Accept & Convert
                          </button>
                        )}
                        <button onClick={() => handleProposalDelete(prop._id)} className="btn-danger" style={{ padding: '8px' }} title="Delete Proposal"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )})}
                {proposals.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No proposals found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 5: Deal Close (Subscriptions)            */}
        {/* ========================================== */}
        {activeTab === 'subscriptions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Filter Bar */}
            <div className="chart-card" style={{ padding: '20px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Search Client</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Search by client or company..." 
                    value={subClientFilter} 
                    onChange={e => setSubClientFilter(e.target.value)} 
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>From Start Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={subStartDateFilter} 
                    onChange={e => setSubStartDateFilter(e.target.value)} 
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>To End Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={subEndDateFilter} 
                    onChange={e => setSubEndDateFilter(e.target.value)} 
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Status</label>
                  <select 
                    className="input-field" 
                    value={subStatusFilter} 
                    onChange={e => setSubStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Pending Renewal">Pending Renewal</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Account Manager</label>
                  <select 
                    className="input-field" 
                    value={subAccountManagerFilter} 
                    onChange={e => setSubAccountManagerFilter(e.target.value)}
                  >
                    <option value="">All Managers</option>
                    {users.filter(u => {
                      const rName = (u.role?.name || '').toLowerCase();
                      return rName.includes('sales') || rName.includes('bdm') || rName.includes('marketing') || rName.includes('manager');
                    }).map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role?.name || 'N/A'})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Tele Manager / Telecaller</label>
                  <select 
                    className="input-field" 
                    value={subTelecallerFilter} 
                    onChange={e => setSubTelecallerFilter(e.target.value)}
                  >
                    <option value="">All Tele Managers</option>
                    {users.filter(u => {
                      const rName = (u.role?.name || '').toLowerCase();
                      return rName.includes('tele') || rName.includes('tme') || rName.includes('caller');
                    }).map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role?.name || 'N/A'})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Package</label>
                  <select 
                    className="input-field" 
                    value={subPackageFilter} 
                    onChange={e => setSubPackageFilter(e.target.value)}
                  >
                    <option value="">All Packages</option>
                    {packages.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Billing Cycle</label>
                  <select 
                    className="input-field" 
                    value={subBillingCycleFilter} 
                    onChange={e => setSubBillingCycleFilter(e.target.value)}
                  >
                    <option value="">All Cycles</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Min Deal Value (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="Min value..." 
                    value={subMinPriceFilter} 
                    onChange={e => setSubMinPriceFilter(e.target.value)} 
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Max Deal Value (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="Max value..." 
                    value={subMaxPriceFilter} 
                    onChange={e => setSubMaxPriceFilter(e.target.value)} 
                  />
                </div>

                <button
                  onClick={() => {
                    setSubClientFilter('');
                    setSubStartDateFilter('');
                    setSubEndDateFilter('');
                    setSubStatusFilter('');
                    setSubAccountManagerFilter('');
                    setSubTelecallerFilter('');
                    setSubPackageFilter('');
                    setSubBillingCycleFilter('');
                    setSubMinPriceFilter('');
                    setSubMaxPriceFilter('');
                  }}
                  className="btn-secondary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    alignSelf: 'end',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'background 0.2s'
                  }}
                >
                  🧹 Clear Filters
                </button>
              </div>
            </div>

            <div className="data-table-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Client</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Package / Services</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Price (Excl GST)</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Payment Date</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Due Date</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Status</th>
                    <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((sub: any) => {
                    const subInvoice = invoices.find((inv: any) => 
                      inv.clientPackage?._id === sub._id || inv.clientPackage === sub._id
                    );
                    const hasPartial = subInvoice?.status === 'Partially Paid';
                    const paymentDateVal = subInvoice?.paymentDate 
                      ? new Date(subInvoice.paymentDate).toLocaleDateString() 
                      : new Date(sub.startDate).toLocaleDateString();
                    
                    const dueDateVal = hasPartial && subInvoice?.dueDate
                      ? new Date(subInvoice.dueDate).toLocaleDateString()
                      : '-';

                    return (
                      <tr key={sub._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px 20px', fontSize: '14px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{sub.client?.companyName}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Mgr: {(() => {
                              const isAMAdmin = sub.accountManager?.role?.name?.toLowerCase().includes('admin');
                              if (isAMAdmin) {
                                return sub.lead?.assignedSales?.name || sub.accountManager?.name || 'Unassigned';
                              }
                              return sub.accountManager?.name || sub.lead?.assignedSales?.name || 'Unassigned';
                            })()}
                          </div>
                          {sub.lead?.assignedTelecaller?.name && (
                            <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                              📞 Tele: {sub.lead.assignedTelecaller.name}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#334155' }}>
                          <div style={{ fontWeight: 600 }}>{sub.package?.name || 'Custom Package'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {(sub.services || []).map((s: any) => s.name).join(', ')}
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>₹{sub.price.toLocaleString()}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#475569' }}>{paymentDateVal}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: hasPartial ? '#ef4444' : '#475569' }}>
                          {dueDateVal}
                          {canEditDueDate && subInvoice && (
                            <span 
                              onClick={() => handleEditDueDate(subInvoice)}
                              style={{ 
                                marginLeft: '6px', 
                                cursor: 'pointer', 
                                color: '#3b82f6', 
                                fontSize: '12px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Edit Due Date"
                            >
                              ✏️
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span className={`badge ${sub.status === 'Active' ? 'badge-green' : sub.status === 'Pending Renewal' ? 'badge-orange' : 'badge-red'}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                            {hasPartial && subInvoice && (
                              <button 
                                onClick={() => handleOpenPaymentModal(subInvoice)} 
                                className="btn-primary" 
                                style={{ padding: '6px 12px', fontSize: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)' }}
                              >
                                Record Payment
                              </button>
                            )}
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                              Expires: {(() => {
                                const baseDate = subInvoice?.paymentDate || sub.startDate;
                                if (!baseDate) return 'N/A';
                                const start = new Date(baseDate);
                                if (subInvoice?.paymentDate) {
                                  start.setDate(start.getDate() + 7);
                                }
                                const exp = new Date(start);
                                const isPartial = subInvoice?.status === 'Partially Paid';
                                if (isPartial) {
                                  exp.setMonth(start.getMonth() + 6);
                                } else {
                                  exp.setFullYear(start.getFullYear() + 1);
                                }
                                return exp.toLocaleDateString();
                              })()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSubscriptions.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No deal close records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 5.5: Partial Payments                   */}
        {/* ========================================== */}
        {activeTab === 'partial-payments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {!canAccessPartialPayments ? (
              <div style={{ padding: '40px', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b' }}>
                <h3>Access Denied</h3>
                <p>You do not have permission to access the Partial Payments module.</p>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="chart-card" style={{ padding: '20px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Search Client</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Search by client or company..." 
                        value={partialClientFilter} 
                        onChange={e => setPartialClientFilter(e.target.value)} 
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Due Date</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={partialDateFilter} 
                        onChange={e => setPartialDateFilter(e.target.value)} 
                      />
                    </div>

                    <button 
                      onClick={() => {
                        setPartialClientFilter('');
                        setPartialDateFilter('');
                      }}
                      className="btn-secondary"
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        alignSelf: 'end',
                        height: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'background 0.2s'
                      }}
                    >
                      🧹 Clear Filters
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="data-table-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Client Company</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Package / Services</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Total Value (Incl. GST)</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Total Paid</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Due Balance</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Previous Paid Date</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Partial Payment Date</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = invoices.filter((inv: any) => {
                          if (inv.status !== 'Partially Paid') return false;

                          // Filter list so BDM, Marketing, and Tele Sales users only see their assigned clients
                          const isSalesOrBDM = ['bdm', 'marketing', 'tele sales manager', 'tele sales', 'sales executive', 'marketing manager', 'tele marketing', 'tele marketing executive', 'telecaller', 'telecaller executive'].includes(userRole) || userRole.includes('tele') || userRole.includes('tme') || userRole.includes('caller');
                          if (isSalesOrBDM) {
                            const clientAssignedSalesId = String(inv.client?.assignedSalesExecutive?._id || inv.client?.assignedSalesExecutive || inv.client?.assignedAccountManager?._id || inv.client?.assignedAccountManager || '');
                            const pkgAccountManagerId = String(inv.clientPackage?.accountManager?._id || inv.clientPackage?.accountManager || '');
                            const leadTelecallerId = String(inv.clientPackage?.lead?.assignedTelecaller?._id || inv.clientPackage?.lead?.assignedTelecaller || '');
                            const currentUserIdStr = String(loggedInUser._id || loggedInUser.id || '');
                            
                            if (clientAssignedSalesId !== currentUserIdStr && pkgAccountManagerId !== currentUserIdStr && leadTelecallerId !== currentUserIdStr) {
                              return false;
                            }
                          }

                          if (partialClientFilter) {
                            const name = (inv.clientCompanyName || inv.client?.companyName || '').toLowerCase();
                            if (!name.includes(partialClientFilter.toLowerCase())) return false;
                          }

                          if (partialDateFilter && inv.dueDate) {
                            const invDateStr = new Date(inv.dueDate).toISOString().split('T')[0];
                            if (invDateStr !== partialDateFilter) return false;
                          }

                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                No partial payment records found.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((inv: any) => {
                          const lastPayment = inv.payments && inv.payments.length > 0 ? inv.payments[inv.payments.length - 1] : null;
                          const prevPaidDate = lastPayment 
                            ? new Date(lastPayment.paymentDate).toLocaleDateString() 
                            : (inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString() : '-');
                          
                          const partialPaymentDate = inv.dueDate 
                            ? new Date(inv.dueDate).toLocaleDateString() 
                            : '-';

                          return (
                            <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                                {inv.clientCompanyName || inv.client?.companyName || 'N/A'}
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '14px', color: '#334155' }}>
                                <div style={{ fontWeight: 600 }}>{inv.packageOrService || 'Custom Package'}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                  {(inv.items || []).map((item: any) => item.description || item.serviceName).join(', ')}
                                </div>
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                ₹{inv.total?.toLocaleString() || '0'}
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#10b981' }}>
                                ₹{inv.paidAmount?.toLocaleString() || '0'}
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
                                ₹{inv.dueAmount?.toLocaleString() || '0'}
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '14px', color: '#475569' }}>
                                {prevPaidDate}
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
                                {partialPaymentDate}
                              </td>
                              <td style={{ padding: '16px 20px' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <button 
                                    onClick={() => handleOpenPaymentModal(inv)} 
                                    className="btn-primary" 
                                    style={{ padding: '6px 12px', fontSize: '12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                  >
                                    <DollarSign size={14} /> Make Payment
                                  </button>
                                  <button 
                                    onClick={() => handleOpenPartialPaymentModal(inv)} 
                                    className="btn-secondary" 
                                    style={{ padding: '6px 12px', fontSize: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                  >
                                    View History
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 6: Invoices                            */}
        {/* ========================================== */}
        {activeTab === 'invoices' && (
          <div className="data-table-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Invoice Number</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Client Company</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Subtotal</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>GST Tax</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Grand Total</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Due Date</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Status</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                      {inv.client?.companyName || 'Unknown Client'}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#475569' }}>₹{inv.amount.toLocaleString()}</td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#475569' }}>₹{(inv.tax || 0).toLocaleString()}</td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#0f172a' }}>
                      <div style={{ fontWeight: 600 }}>₹{inv.total.toLocaleString()}</div>
                      {(inv.status === 'Partially Paid' || (inv.paidAmount !== undefined && inv.paidAmount > 0)) && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          <span style={{ color: '#16a34a' }}>Paid: ₹{(inv.paidAmount || 0).toLocaleString()}</span>
                          {((inv.dueAmount !== undefined ? inv.dueAmount : inv.total - (inv.paidAmount || 0)) > 0) && (
                            <span style={{ marginLeft: '8px', color: '#b45309' }}>
                              Due: ₹{(inv.dueAmount !== undefined ? inv.dueAmount : inv.total - (inv.paidAmount || 0)).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#ef4444', fontWeight: 600 }}>
                      {new Date(inv.dueDate).toLocaleDateString()}
                      {canEditDueDate && (
                        <span 
                          onClick={() => handleEditDueDate(inv)}
                          style={{ 
                            marginLeft: '6px', 
                            cursor: 'pointer', 
                            color: '#3b82f6', 
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          title="Edit Due Date"
                        >
                          ✏️
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className={`badge ${
                        inv.status === 'Paid' ? 'badge-green' : 
                        inv.status === 'Partially Paid' ? 'badge-orange' : 
                        inv.status === 'Pending' ? 'badge-yellow' : 
                        inv.status === 'Cancelled' ? 'badge-gray' : 
                        'badge-red'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(inv.status === 'Pending' || inv.status === 'Partially Paid') && (isAccounts || isAdmin) && (
                          <button onClick={() => handleOpenPaymentModal(inv)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderColor: '#86efac', color: '#15803d' }}>
                            Record Payment
                          </button>
                        )}
                        <button onClick={() => generatePDFInvoice(inv)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Download size={12} /> PDF
                        </button>
                        {(inv.status === 'Pending' || inv.status === 'Partially Paid') && (isAccounts || isAdmin) && (
                          <button onClick={() => handleCancelInvoice(inv)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', color: '#94a3b8' }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No invoices found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 7: Reports Listing                     */}
        {/* ========================================== */}
        {activeTab === 'reports' && (() => {
          const reportCategoryOptions = [
            { key: 'Call Attends', label: 'Call Attends', icon: '📞' },
            { key: 'Appointment Fixed', label: 'Appointment Fixed', icon: '📅' },
            { key: 'Deal Own', label: 'Deal Own', icon: '🏆' },
            { key: 'Follow Ups', label: 'Follow Ups', icon: '🔄' },
            { key: 'Proposal Sent', label: 'Proposal Sent', icon: '📄' },
            { key: 'Meeting Cancelled', label: 'Meeting Cancelled', icon: '❌' }
          ];

          // Helper matcher for each option
          const isCategoryMatch = (lead: any, catKey: string) => {
            const stage = (lead.stage || '').toLowerCase();
            if (catKey === 'Call Attends') {
              return stage.includes('telecalling') || stage.includes('call') || stage.includes('busy') || stage.includes('reschedule') || (lead.assignedTelecaller && !stage.includes('appointment fixed') && !stage.includes('deal'));
            }
            if (catKey === 'Appointment Fixed') {
              return stage.includes('appointment fixed') || stage.includes('appointment fit') || (lead.appointmentHistory && lead.appointmentHistory.some((a: any) => (a.status || '').toLowerCase().includes('appointment fixed')));
            }
            if (catKey === 'Deal Own' || catKey === 'Deal Won') {
              return stage.includes('deal won') || stage.includes('deal close') || stage.includes('deal') || stage.includes('won');
            }
            if (catKey === 'Follow Ups') {
              return stage.includes('follow-up') || stage.includes('followup') || stage.includes('follow up') || stage.includes('call back') || stage.includes('decision pending') || stage.includes('another visit required');
            }
            if (catKey === 'Proposal Sent') {
              return stage.includes('proposal sent') || stage.includes('proposal requested') || stage.includes('proposal');
            }
            if (catKey === 'Meeting Cancelled') {
              return stage.includes('meeting cancelled') || stage.includes('cancelled');
            }
            return false;
          };

          // Filter leads based on selected category, search, date, and user filter
          const filteredReportLeads = leads.filter((lead: any) => {
            if (!isCategoryMatch(lead, selectedReportCategory)) return false;

            if (reportSearchTerm) {
              const term = reportSearchTerm.toLowerCase();
              const bName = (lead.businessName || '').toLowerCase();
              const dId = (lead.dataId || '').toLowerCase();
              const contact = (lead.contactPerson || '').toLowerCase();
              const phone = (lead.phone || '').toLowerCase();
              const loc = (lead.location || '').toLowerCase();
              if (!bName.includes(term) && !dId.includes(term) && !contact.includes(term) && !phone.includes(term) && !loc.includes(term)) {
                return false;
              }
            }

            if (reportDateFilter && lead.createdAt) {
              const leadDate = new Date(lead.createdAt).toISOString().split('T')[0];
              if (leadDate !== reportDateFilter) return false;
            }

            if (reportUserFilter) {
              const teleId = String(lead.assignedTelecaller?._id || lead.assignedTelecaller || '');
              const salesId = String(lead.assignedSales?._id || lead.assignedSales || '');
              if (teleId !== reportUserFilter && salesId !== reportUserFilter) return false;
            }

            return true;
          });

          // Pagination
          const itemsPerPage = 15;
          const totalReportPages = Math.ceil(filteredReportLeads.length / itemsPerPage) || 1;
          const displayedReportLeads = filteredReportLeads.slice((reportCurrentPage - 1) * itemsPerPage, reportCurrentPage * itemsPerPage);

          const handleExportExcel = () => {
            if (filteredReportLeads.length === 0) {
              alert(`No data available for ${selectedReportCategory} to export.`);
              return;
            }

            const exportRows = filteredReportLeads.map((r: any) => ({
              'Data ID': r.dataId || 'N/A',
              'Business Name': r.businessName || 'N/A',
              'Contact Person': r.contactPerson || 'N/A',
              'Phone': r.phone || 'N/A',
              'Location': r.location || 'N/A',
              'Stage / Category': r.stage || 'Data',
              'Assigned TME': r.assignedTelecaller?.name || 'Unassigned',
              'Assigned BDM': r.assignedSales?.name || 'Unassigned',
              'Value (₹)': r.value || 0,
              'Date': r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportRows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, `${selectedReportCategory} Report`);
            XLSX.writeFile(workbook, `${selectedReportCategory.replace(/\s+/g, '_')}_Report.xlsx`);
          };

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Header Purple Banner */}
              <div style={{ 
                background: 'linear-gradient(135deg, #6b21a8 0%, #7e22ce 100%)', 
                padding: '20px 28px', 
                borderRadius: '16px', 
                color: '#ffffff', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                boxShadow: '0 8px 20px rgba(126, 34, 206, 0.25)' 
              }}>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>📊 Reports</span>
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                    Centralized CRM Report & Analytics Dashboard
                  </div>
                </div>

                <button 
                  onClick={handleExportExcel}
                  className="btn-primary" 
                  disabled={filteredReportLeads.length === 0}
                  style={{ 
                    background: '#ffffff', 
                    color: '#6b21a8', 
                    border: 'none', 
                    padding: '10px 20px', 
                    borderRadius: '10px', 
                    fontWeight: 700, 
                    fontSize: '13.5px',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    cursor: filteredReportLeads.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                  }}
                >
                  <Download size={16} /> Export {selectedReportCategory} Report (.xlsx)
                </button>
              </div>

              {/* Main Report Listing Box (matching user's uploaded mockup) */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '16px', 
                padding: '36px 28px', 
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                maxWidth: '850px',
                margin: '0 auto',
                width: '100%'
              }}>
                <h2 style={{ 
                  textAlign: 'center', 
                  fontSize: '24px', 
                  fontWeight: 800, 
                  color: '#1e293b', 
                  marginBottom: '28px',
                  letterSpacing: '0.3px'
                }}>
                  Report Listing
                </h2>

                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  background: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  {reportCategoryOptions.map((cat, idx) => {
                    const isSelected = selectedReportCategory === cat.key;
                    const categoryCount = leads.filter(l => isCategoryMatch(l, cat.key)).length;

                    return (
                      <div 
                        key={cat.key}
                        onClick={() => {
                          setSelectedReportCategory(cat.key);
                          setReportCurrentPage(1);
                        }}
                        style={{
                          padding: '18px 24px',
                          background: isSelected ? '#f5f3ff' : '#ffffff',
                          borderBottom: idx < reportCategoryOptions.length - 1 ? '1px solid #e2e8f0' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={e => {
                          if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseOut={e => {
                          if (!isSelected) e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                          <span style={{ 
                            fontSize: '15px', 
                            fontWeight: isSelected ? 800 : 600, 
                            color: isSelected ? '#6b21a8' : '#334155' 
                          }}>
                            {cat.label}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: isSelected ? '#6b21a8' : '#64748b',
                            background: isSelected ? '#edd8ff' : '#f1f5f9',
                            padding: '4px 12px',
                            borderRadius: '20px'
                          }}>
                            {categoryCount} {categoryCount === 1 ? 'record' : 'records'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Table Section ("in which part how many data we have?") */}
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Data Breakdown: <span style={{ color: '#7e22ce' }}>{selectedReportCategory}</span>
                      <span style={{ fontSize: '13px', background: '#f3e8ff', color: '#6b21a8', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
                        {filteredReportLeads.length} Items Total
                      </span>
                    </h3>
                  </div>

                  {/* Filter Toolbar */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Search Business / Data ID..." 
                        value={reportSearchTerm} 
                        onChange={e => { setReportSearchTerm(e.target.value); setReportCurrentPage(1); }}
                        style={{ paddingLeft: '32px', fontSize: '13px', width: '220px', height: '38px' }}
                      />
                      <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '12px' }} />
                    </div>

                    <input 
                      type="date" 
                      className="input-field" 
                      value={reportDateFilter} 
                      onChange={e => { setReportDateFilter(e.target.value); setReportCurrentPage(1); }}
                      style={{ fontSize: '13px', width: '150px', height: '38px' }}
                    />

                    <select 
                      className="input-field" 
                      value={reportUserFilter}
                      onChange={e => { setReportUserFilter(e.target.value); setReportCurrentPage(1); }}
                      style={{ fontSize: '13px', width: '170px', height: '38px' }}
                    >
                      <option value="">All Team Members</option>
                      {users.map((u: any) => (
                        <option key={u._id} value={u._id}>{u.name} ({u.role?.name || 'User'})</option>
                      ))}
                    </select>

                    {(reportSearchTerm || reportDateFilter || reportUserFilter) && (
                      <button 
                        onClick={() => {
                          setReportSearchTerm('');
                          setReportDateFilter('');
                          setReportUserFilter('');
                          setReportCurrentPage(1);
                        }}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', height: '38px', borderRadius: '8px' }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>

                {/* Table displaying records */}
                <div className="data-table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Data ID</th>
                        <th style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Business Name</th>
                        <th style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Contact Person</th>
                        <th style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Location</th>
                        <th style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Category / Stage</th>
                        <th style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Assigned TME</th>
                        <th style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Assigned BDM</th>
                        <th style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedReportLeads.map((record: any) => (
                        <tr key={record._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>
                            {record.dataId || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '13.5px', fontWeight: 600, color: '#334155' }}>
                            {record.businessName}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{record.contactPerson}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{record.phone}</div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                            {record.location}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span className="badge" style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', fontWeight: 700, fontSize: '11.5px' }}>
                              {record.stage || 'Data'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
                            {record.assignedTelecaller?.name || 'Unassigned'}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
                            {record.assignedSales?.name || 'Unassigned'}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '12.5px', color: '#64748b' }}>
                            {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}

                      {filteredReportLeads.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                            No data records found for <strong>{selectedReportCategory}</strong> matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredReportLeads.length > itemsPerPage && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '10px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                      Showing {(reportCurrentPage - 1) * itemsPerPage + 1} to {Math.min(filteredReportLeads.length, reportCurrentPage * itemsPerPage)} of {filteredReportLeads.length} entries
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        disabled={reportCurrentPage === 1}
                        onClick={() => setReportCurrentPage(prev => Math.max(1, prev - 1))}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '12px', cursor: reportCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
                      >
                        Prev
                      </button>
                      <span style={{ padding: '4px 10px', fontSize: '13px', fontWeight: 700, color: '#6b21a8' }}>
                        Page {reportCurrentPage} of {totalReportPages}
                      </span>
                      <button
                        disabled={reportCurrentPage === totalReportPages}
                        onClick={() => setReportCurrentPage(prev => Math.min(totalReportPages, prev + 1))}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '12px', cursor: reportCurrentPage === totalReportPages ? 'not-allowed' : 'pointer' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          );
        })()}
      </div>

      {/* Package Master Form Modal */}
      {showPkgModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                {pkgEditingId ? 'Edit Package' : 'Create Package'}
              </h3>
              <button onClick={() => setShowPkgModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePkgSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Package Name *</label>
                  <input type="text" className="input-field" value={pkgName} onChange={e => setPkgName(e.target.value)} required placeholder="e.g. Starter Package" />
                </div>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Package Type *</label>
                  <select className="input-field" value={pkgType} onChange={e => handlePkgTypeChange(e.target.value as any)} required>
                    <option value="Normal">Normal Package</option>
                    <option value="Combo">Combo Package</option>
                  </select>
                </div>

                {pkgType === 'Normal' ? (
                  /* Single Category selection for Normal Package */
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Category *</label>
                    <select 
                      className="input-field" 
                      value={pkgCategory} 
                      onChange={e => {
                        const newCat = e.target.value;
                        setPkgCategory(newCat);
                        setPkgCategories(newCat ? [newCat] : []);
                        const validServiceIds = pkgSelectedServices.filter(sId => {
                          const sObj = services.find(s => s._id === sId);
                          return sObj && sObj.category === newCat;
                        });
                        setPkgSelectedServices(validServiceIds);
                      }} 
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.filter((c: any) => c.status === 'Active' || c.name === pkgCategory).map((c: any) => (
                        <option key={c._id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  /* Multiple Category selection for Combo Package */
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Category * (Select Multiple)</label>
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px', background: 'white', minHeight: '38px', maxHeight: '110px', overflowY: 'auto' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {categories.filter((c: any) => c.status === 'Active' || pkgCategories.includes(c.name)).map((c: any) => {
                          const isCatSelected = pkgCategories.includes(c.name);
                          return (
                            <label 
                              key={c._id}
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                padding: '4px 10px', 
                                borderRadius: '6px', 
                                fontSize: '12px', 
                                fontWeight: 600, 
                                background: isCatSelected ? '#eff6ff' : '#f8fafc', 
                                color: isCatSelected ? '#2563eb' : '#475569', 
                                border: `1px solid ${isCatSelected ? '#2563eb' : '#cbd5e1'}`,
                                cursor: 'pointer',
                                userSelect: 'none'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isCatSelected}
                                onChange={() => handleCategoryToggle(c.name)}
                                style={{ cursor: 'pointer' }}
                              />
                              {c.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Description</label>
                <textarea className="input-field" value={pkgDescription} onChange={e => setPkgDescription(e.target.value)} style={{ minHeight: '60px' }} placeholder="Provide brief summary of package scope..." />
              </div>

              {/* Checkbox list of Services */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>Add Services to Package *</label>
                {pkgCategories.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic', padding: '10px 0' }}>Please select at least one Service Category above.</div>
                ) : (
                  (() => {
                    const categoryServices = services.filter(s => s.status === 'Active' && pkgCategories.includes(s.category));
                    if (categoryServices.length === 0) {
                      return <div style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic', padding: '10px 0' }}>No active services found in the selected categories.</div>;
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {categoryServices.map(s => {
                          const isServiceSelected = pkgSelectedServices.includes(s._id);
                          const serviceDetailsList = serviceDetails.filter(
                            d => d.status === 'Active' && String(d.service?._id || d.service) === String(s._id)
                          );
                          
                          return (
                            <div key={s._id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: isServiceSelected ? '#f8fafc' : '#ffffff' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                                <input type="checkbox" checked={isServiceSelected} onChange={() => handlePkgServiceToggle(s._id)} />
                                <span>{s.name}</span>
                              </label>

                              {/* If service is selected, display service details with checkboxes and prices */}
                              {isServiceSelected && (
                                <div style={{ marginTop: '10px', paddingLeft: '24px', borderLeft: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Choose Service Details / Pricing Items:</div>
                                  {serviceDetailsList.length === 0 ? (
                                    <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>No details found for this service.</div>
                                  ) : (
                                    serviceDetailsList.map(d => {
                                      const isDetailSelected = pkgSelectedDetails.includes(d._id);
                                      return (
                                        <label key={d._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #f1f5f9', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: isDetailSelected ? '#eff6ff' : '#ffffff', borderColor: isDetailSelected ? '#bfdbfe' : '#f1f5f9' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input type="checkbox" checked={isDetailSelected} onChange={() => handlePkgDetailToggle(d._id)} />
                                            <span style={{ color: '#334155' }}>{d.name}</span>
                                          </div>
                                          <span style={{ fontWeight: 700, color: '#2563eb' }}>₹{(d.price || 0).toLocaleString()}</span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>



              {/* Package pricing configs (calculated billing plans) */}
              {(() => {
                const isOneShot = pkgType === 'Normal';

                if (isOneShot) {
                  return (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 700, color: '#334155', fontSize: '14px' }}>Total Package Price</span>
                        <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '18px' }}>₹{pkgMonthly.toLocaleString()}</span>
                      </div>
                      
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#475569' }}>One-Shot Payment details (including 18% GST)</h4>
                      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#64748b' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Base Price:</span> <span style={{ fontWeight: 600 }}>₹{pkgMonthly.toLocaleString()}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>GST (18%):</span> <span style={{ fontWeight: 600 }}>₹{Math.round(pkgMonthly * 0.18).toLocaleString()}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '4px', color: '#0f172a', fontWeight: 700, fontSize: '13px' }}><span>Total Payable:</span> <span>₹{Math.round(pkgMonthly * 1.18).toLocaleString()}</span></div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px', background: '#f8fafc' }}>
                    <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#334155', fontSize: '14px' }}>Combo Package Rates Configuration</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Enter 4 rates for Monthly, Quarterly, Half-Yearly, and Yearly billing cycles.</p>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      
                      {/* Monthly Plan Input */}
                      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                        <label style={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', marginBottom: '6px', display: 'block' }}>Monthly Rate (₹) *</label>
                        <input
                          type="number"
                          className="input-field"
                          value={pkgMonthly}
                          onChange={e => setPkgMonthly(Number(e.target.value))}
                          placeholder="Monthly Rate"
                          required
                          style={{ fontSize: '13px', margin: 0 }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          Incl GST: ₹{Math.round(pkgMonthly * 1.18).toLocaleString()}
                        </div>
                      </div>

                      {/* Quarterly Plan Input */}
                      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', margin: 0 }}>Quarterly Rate (₹) *</label>
                          <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>+15 Days Bonus</span>
                        </div>
                        <input
                          type="number"
                          className="input-field"
                          value={pkgQuarterly}
                          onChange={e => setPkgQuarterly(Number(e.target.value))}
                          placeholder="Quarterly Rate"
                          required
                          style={{ fontSize: '13px', margin: 0 }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          Incl GST: ₹{Math.round(pkgQuarterly * 1.18).toLocaleString()}
                        </div>
                      </div>

                      {/* Half-Yearly Plan Input */}
                      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', margin: 0 }}>Half-Yearly Rate (₹) *</label>
                          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>+1 Month Free</span>
                        </div>
                        <input
                          type="number"
                          className="input-field"
                          value={pkgHalfYearly}
                          onChange={e => setPkgHalfYearly(Number(e.target.value))}
                          placeholder="Half-Yearly Rate"
                          required
                          style={{ fontSize: '13px', margin: 0 }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          Incl GST: ₹{Math.round(pkgHalfYearly * 1.18).toLocaleString()}
                        </div>
                      </div>

                      {/* Yearly Plan Input */}
                      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', margin: 0 }}>Yearly Rate (₹) *</label>
                          <span style={{ background: '#fef9c3', color: '#a16207', fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>+2 Months Free</span>
                        </div>
                        <input
                          type="number"
                          className="input-field"
                          value={pkgYearly}
                          onChange={e => setPkgYearly(Number(e.target.value))}
                          placeholder="Yearly Rate"
                          required
                          style={{ fontSize: '13px', margin: 0 }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          Incl GST: ₹{Math.round(pkgYearly * 1.18).toLocaleString()}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Status</label>
                <select className="input-field" value={pkgStatus} onChange={e => setPkgStatus(e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPkgModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {pkgEditingId ? 'Update Package' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accept & Convert Proposal Modal */}
      {showConvertModal && selectedProposalToConvert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Convert Proposal to Subscription</h3>
              <button onClick={() => setShowConvertModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleConvertProposalToClient} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '13px' }}>
                <div><strong>Client Company:</strong> {selectedProposalToConvert.clientDetails?.companyName}</div>
                <div style={{ marginTop: '4px' }}><strong>Billing Plan:</strong> {selectedProposalToConvert.billingCycle}</div>
                <div style={{ marginTop: '4px' }}><strong>Amount (Incl GST):</strong> ₹{selectedProposalToConvert.total.toLocaleString()}</div>
              </div>

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
                <button type="button" className="btn-secondary" onClick={() => setShowConvertModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={16} /> Activate Subscription</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Renewal Modal */}
      {showRenewalModal && subToRenew && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Renew Package Subscription</h3>
              <button onClick={() => setShowRenewalModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleRenewalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '13px' }}>
                <div><strong>Client Company:</strong> {subToRenew.client?.companyName}</div>
                <div style={{ marginTop: '4px' }}><strong>Active Period:</strong> {new Date(subToRenew.startDate).toLocaleDateString()} to {new Date(subToRenew.endDate).toLocaleDateString()}</div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Billing Cycle *</label>
                <select className="input-field" value={renewalCycle} onChange={e => setRenewalCycle(e.target.value)}>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Half-Yearly">Half-Yearly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Renew Subtotal Price (INR) *</label>
                <input type="number" className="input-field" value={renewalPrice} onChange={e => setRenewalPrice(Number(e.target.value))} required />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>New End Date (Next Renewal Date) *</label>
                <input type="date" className="input-field" value={renewalEndDate} onChange={e => setRenewalEndDate(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowRenewalModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={16} /> Process Renewal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Invoice Payment Modal */}
      {showPaymentModal && selectedInvoiceForPayment && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Record Payment - {selectedInvoiceForPayment.invoiceNumber}</h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmitInvoicePayment} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {(() => {
                const outstanding = selectedInvoiceForPayment.dueAmount !== undefined 
                  ? selectedInvoiceForPayment.dueAmount 
                  : (selectedInvoiceForPayment.status === 'Paid' ? 0 : selectedInvoiceForPayment.total);
                return (
                  <>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Client Company:</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedInvoiceForPayment.clientCompanyName || selectedInvoiceForPayment.client?.companyName || 'Unknown Client'}</span>
                      </div>
                      
                      <div style={{ height: '1px', background: '#e2e8f0', margin: '6px 0' }}></div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Actual Amount:</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>₹{(selectedInvoiceForPayment.amount || 0).toLocaleString()}</span>
                      </div>
                      
                      {selectedInvoiceForPayment.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                          <span>Discount:</span>
                          <span style={{ fontWeight: 600 }}>-₹{(selectedInvoiceForPayment.discount || 0).toLocaleString()}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>GST Value (18%):</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>₹{(selectedInvoiceForPayment.tax || 0).toLocaleString()}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>Invoice Total:</span>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>₹{selectedInvoiceForPayment.total.toLocaleString()}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                        <span>Already Paid:</span>
                        <span style={{ fontWeight: 600 }}>₹{(selectedInvoiceForPayment.paidAmount || 0).toLocaleString()}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '4px', color: '#b45309' }}>
                        <span style={{ fontWeight: 700 }}>Outstanding Balance:</span>
                        <span style={{ fontWeight: 700 }}>₹{outstanding.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Payment Method *</label>
                      <select 
                        className="input-field" 
                        value={paymentMethod} 
                        onChange={e => {
                          const val = e.target.value;
                          setPaymentMethod(val);
                          if (val === 'Online') {
                            setOnlineGateway('Razorpay');
                          }
                        }} 
                        required
                      >
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Online">Online</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Payment Date *</label>
                      <input type="date" className="input-field" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required />
                    </div>

                    {paymentMethod === 'Cash' && (
                      <>
                        <div className="form-group">
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Received By / Depositor Name</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Enter name of person who received/deposited" 
                            value={cashReceivedBy} 
                            onChange={e => setCashReceivedBy(e.target.value)} 
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Cash Notes / Remarks</label>
                          <textarea 
                            className="input-field" 
                            placeholder="Additional details about the cash payment..." 
                            value={cashNotes} 
                            onChange={e => setCashNotes(e.target.value)} 
                            style={{ minHeight: '60px' }}
                          />
                        </div>
                      </>
                    )}

                    {paymentMethod === 'Cheque' && (
                      <>
                        <div className="form-group">
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Cheque Number *</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Enter cheque number" 
                            value={chequeNumber} 
                            onChange={e => setChequeNumber(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Bank / Branch Details *</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Enter bank and branch details" 
                            value={chequeDetails} 
                            onChange={e => setChequeDetails(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Account Number *</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Enter account number" 
                            value={chequeAccountNumber} 
                            onChange={e => setChequeAccountNumber(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>IFSC Number *</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Enter IFSC code" 
                            value={chequeIfscNumber} 
                            onChange={e => setChequeIfscNumber(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Upload Cheque Image</label>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="input-field" 
                            onChange={handleChequeImageUpload} 
                          />
                          {uploadingChequeImage && (
                            <p style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>Uploading cheque image...</p>
                          )}
                          {chequeImage && (
                            <div style={{ marginTop: '10px' }}>
                              <p style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 600, color: '#475569' }}>Uploaded Cheque:</p>
                              <img 
                                src={`http://localhost:5000${chequeImage}`} 
                                alt="Cheque Preview" 
                                style={{ width: '100%', maxHeight: '150px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {outstanding > 0 && (
                      <div style={{ padding: '14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', marginTop: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: '#92400e', fontSize: '13px' }}>
                          <input 
                            type="checkbox" 
                            checked={isPartialPayment} 
                            onChange={e => {
                              const checked = e.target.checked;
                              setIsPartialPayment(checked);
                              const isFirstPayment = (selectedInvoiceForPayment.paidAmount || 0) === 0;
                              if (checked) {
                                setPaymentStatus('Partially Paid');
                                const minAmount = isFirstPayment ? Math.min(outstanding, 12000) : Math.min(outstanding, 1);
                                setPaymentAmount(minAmount);
                              } else {
                                setPaymentStatus('Paid');
                                setPaymentAmount(outstanding);
                              }
                            }}
                          />
                          Allow Partial Payment
                        </label>
                        {isPartialPayment && (
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <p style={{ margin: 0, fontSize: '11px', color: '#b45309', lineHeight: '1.4' }}>
                              {(selectedInvoiceForPayment.paidAmount || 0) === 0 ? (
                                `⚠️ Minimum first installment is fixed at ₹${Math.min(12000, outstanding).toLocaleString()} (you can increase the amount, but cannot decrease below ₹${Math.min(12000, outstanding).toLocaleString()}).`
                              ) : (
                                `⚠️ Enter partial payment amount. Marketing can schedule the date when the rest will be paid.`
                              )}
                            </p>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: 600, color: '#b45309', marginBottom: '4px', display: 'block' }}>Next Payment Date *</label>
                              <input 
                                type="date" 
                                className="input-field" 
                                value={nextPaymentDate} 
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setNextPaymentDate(e.target.value)} 
                                required 
                                style={{ borderColor: '#fcd34d' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="form-group" style={{ marginTop: '10px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Payment Amount (INR) *</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="number" 
                          className="input-field" 
                          value={paymentAmount || ''} 
                          onChange={e => {
                            const rawVal = e.target.value;
                            if (rawVal === '') {
                              setPaymentAmount(0);
                              return;
                            }
                            const val = Math.min(Number(rawVal), outstanding);
                            setPaymentAmount(val);
                            setPaymentStatus(val >= outstanding ? 'Paid' : 'Partially Paid');
                          }} 
                          onKeyDown={e => {
                            const isFirstPayment = (selectedInvoiceForPayment.paidAmount || 0) === 0;
                            const minFirst = Math.min(12000, outstanding);
                            if (isPartialPayment && isFirstPayment && e.key === 'ArrowDown' && paymentAmount <= minFirst) {
                              e.preventDefault();
                              alert(`Minimum first payment amount for partial payment is ₹${minFirst.toLocaleString()}.`);
                            }
                          }}
                          onBlur={() => {
                            const isFirstPayment = (selectedInvoiceForPayment.paidAmount || 0) === 0;
                            const minFirst = Math.min(12000, outstanding);
                            if (isPartialPayment && isFirstPayment && paymentAmount < minFirst) {
                              alert(`Minimum first payment amount for partial payment is ₹${minFirst.toLocaleString()}.`);
                              setPaymentAmount(minFirst);
                              setPaymentStatus('Partially Paid');
                            }
                          }}
                          required 
                          disabled={!isPartialPayment}
                          style={{ background: !isPartialPayment ? '#f8fafc' : 'white' }}
                          min={isPartialPayment ? ((selectedInvoiceForPayment.paidAmount || 0) === 0 ? Math.min(12000, outstanding) : 1) : 1}
                          placeholder="Enter amount to pay"
                        />
                        {isPartialPayment && (
                          <button 
                            type="button" 
                            className="btn-secondary" 
                            style={{ whiteSpace: 'nowrap', padding: '10px 14px' }}
                            onClick={() => {
                              setPaymentAmount(outstanding);
                              setPaymentStatus('Paid');
                              setIsPartialPayment(false);
                              setNextPaymentDate('');
                            }}
                          >
                            Pay Full
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        Remaining Balance: ₹{(outstanding - paymentAmount).toLocaleString()}
                      </p>
                    </div>

                    {paymentMethod === 'Online' && (
                      <>
                        <div className="form-group" style={{ marginTop: '10px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Choose Payment Gateway *</label>
                          <div style={{ display: 'flex', gap: '20px', marginTop: '4px', marginBottom: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                              <input 
                                type="radio" 
                                name="onlineGateway" 
                                value="Razorpay" 
                                checked={onlineGateway === 'Razorpay'} 
                                onChange={e => setOnlineGateway(e.target.value)} 
                              />
                              Razorpay
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                              <input 
                                type="radio" 
                                name="onlineGateway" 
                                value="CCAvenue" 
                                checked={onlineGateway === 'CCAvenue'} 
                                onChange={e => setOnlineGateway(e.target.value)} 
                              />
                              CCAvenue
                            </label>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setGatewayPaymentStep('method');
                            setGatewayOtp('');
                            setGatewayCardNumber('');
                            setGatewayCardExpiry('');
                            setGatewayCardCvv('');
                            setGatewayUpiId('');
                            setGatewayNetbank('SBI');
                            setGeneratedTxnId('');
                            fetchPaymentSettings();
                            setShowOnlineGatewayPopup(true);
                          }}
                          className="btn-primary"
                          style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '13px',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            background: onlineGateway === 'Razorpay' 
                              ? 'linear-gradient(135deg, #0b2265 0%, #153a99 100%)' 
                              : 'linear-gradient(135deg, #a00606 0%, #d32f2f 100%)',
                            color: '#ffffff',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            marginTop: '5px',
                            marginBottom: '12px'
                          }}
                        >
                          <CreditCard size={15} /> Click to pay via {onlineGateway}
                        </button>
                        <div className="form-group">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }}>Transaction ID / Reference Number</label>
                            <button
                              type="button"
                              onClick={() => {
                                setGatewayPaymentStep('method');
                                setGatewayOtp('');
                                setGatewayCardNumber('');
                                setGatewayCardExpiry('');
                                setGatewayCardCvv('');
                                setGatewayUpiId('');
                                setGatewayNetbank('SBI');
                                setGeneratedTxnId('');
                                fetchPaymentSettings();
                                setShowOnlineGatewayPopup(true);
                              }}
                              style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                            >
                              Open {onlineGateway} Portal
                            </button>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder="Enter online transaction reference number" 
                              value={transactionId} 
                              onChange={e => setTransactionId(e.target.value)} 
                              style={{ paddingRight: transactionId ? '110px' : '12px' }}
                            />
                            {transactionId && (
                              <span style={{ position: 'absolute', right: '12px', fontSize: '11px', fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                <Check size={12} /> Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginTop: '10px' }}>
                      <span style={{ color: '#64748b' }}>Status After Payment:</span>
                      <span className={`badge ${paymentStatus === 'Paid' ? 'badge-green' : 'badge-blue'}`}>
                        {paymentStatus}
                      </span>
                    </div>
                  </>
                );
              })()}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={16} /> Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPartialHistoryModal && selectedInvoiceForPartialHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ width: '100%', maxWidth: '640px', background: 'white', borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Partial Payment Details ({selectedInvoiceForPartialHistory.clientCompanyName})
              </h3>
              <button onClick={() => setShowPartialHistoryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
              
              {/* Payment Info Card */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Total Deal Value (Incl. GST)</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>₹{selectedInvoiceForPartialHistory.total.toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Total Paid Amount</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>₹{(selectedInvoiceForPartialHistory.paidAmount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Remaining Due Balance</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: selectedInvoiceForPartialHistory.dueAmount > 0 ? '#ef4444' : '#10b981' }}>
                    ₹{(selectedInvoiceForPartialHistory.dueAmount !== undefined ? selectedInvoiceForPartialHistory.dueAmount : selectedInvoiceForPartialHistory.total).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Next Payment Due Date</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>
                    {selectedInvoiceForPartialHistory.dueDate ? new Date(selectedInvoiceForPartialHistory.dueDate).toLocaleDateString() : '-'}
                  </span>
                </div>
              </div>

              {/* Installments History */}
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600, color: '#475569' }}>Installments Paid History</h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Date</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Amount</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Method</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Notes/Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoiceForPartialHistory.payments || []).map((p: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{new Date(p.paymentDate).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>₹{p.amountPaid.toLocaleString()}</td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>{p.paymentMethod}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '12px' }}>
                          {p.referenceNumber && <div>Ref: {p.referenceNumber}</div>}
                          {p.recordedBy && <div>Recorded by: {p.recordedBy}</div>}
                        </td>
                      </tr>
                    ))}
                    {(!selectedInvoiceForPartialHistory.payments || selectedInvoiceForPartialHistory.payments.length === 0) && (
                      <tr>
                        <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                          No payment installment history records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowPartialHistoryModal(false)}>Close</button>
              {selectedInvoiceForPartialHistory.status !== 'Paid' && selectedInvoiceForPartialHistory.dueAmount > 0 && (
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}
                  onClick={() => {
                    setShowPartialHistoryModal(false);
                    handleOpenPaymentModal(selectedInvoiceForPartialHistory);
                  }}
                >
                  <DollarSign size={16} /> Make Payment
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {showOnlineGatewayPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10005 }}>
          {onlineGateway === 'Razorpay' ? (
            /* Razorpay Simulator UI */
            <div style={{ background: '#ffffff', borderRadius: '12px', width: '380px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #0b2265 0%, #153a99 100%)', padding: '24px 20px', color: '#ffffff', position: 'relative' }}>
                <button type="button" onClick={() => setShowOnlineGatewayPopup(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer' }}><X size={18} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ background: '#2563eb', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: '#fff' }}>R</span>
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>razorpay</span>
                </div>
                <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                  Secure Checkout {paymentSettings ? `(${paymentSettings.razorpayMode.toUpperCase()} MODE)` : ''}
                </div>
                {paymentSettings && (
                  <div style={{ fontSize: '10px', color: '#93c5fd', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px' }}>
                    Key ID: <span style={{ fontFamily: 'monospace' }}>{paymentSettings.razorpayKeyId || 'Not Configured'}</span>
                  </div>
                )}
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#93c5fd' }}>DIGIEX-HRMS CRM</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#e0f2fe' }}>Subscription Payment</div>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>₹{paymentAmount.toLocaleString()}</div>
                </div>
              </div>
              
              {/* Body */}
              <div style={{ padding: '20px', flex: 1, minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {gatewayPaymentStep === 'method' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Select Payment Option</div>
                    
                    {/* UPI Option */}
                    <div 
                      onClick={() => setGatewaySelectedMethod('UPI')}
                      style={{ border: `1px solid ${gatewaySelectedMethod === 'UPI' ? '#3b82f6' : '#e2e8f0'}`, background: gatewaySelectedMethod === 'UPI' ? '#f0f7ff' : '#ffffff', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}
                    >
                      <input type="radio" checked={gatewaySelectedMethod === 'UPI'} onChange={() => {}} style={{ pointerEvents: 'none' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>UPI (Google Pay, PhonePe, Paytm)</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Pay instantly using your UPI ID</span>
                      </div>
                    </div>

                    {/* Card Option */}
                    <div 
                      onClick={() => setGatewaySelectedMethod('Card')}
                      style={{ border: `1px solid ${gatewaySelectedMethod === 'Card' ? '#3b82f6' : '#e2e8f0'}`, background: gatewaySelectedMethod === 'Card' ? '#f0f7ff' : '#ffffff', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}
                    >
                      <input type="radio" checked={gatewaySelectedMethod === 'Card'} onChange={() => {}} style={{ pointerEvents: 'none' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>Credit or Debit Card</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Visa, Mastercard, RuPay, Maestro</span>
                      </div>
                    </div>

                    {/* Netbanking Option */}
                    <div 
                      onClick={() => setGatewaySelectedMethod('Netbanking')}
                      style={{ border: `1px solid ${gatewaySelectedMethod === 'Netbanking' ? '#3b82f6' : '#e2e8f0'}`, background: gatewaySelectedMethod === 'Netbanking' ? '#f0f7ff' : '#ffffff', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}
                    >
                      <input type="radio" checked={gatewaySelectedMethod === 'Netbanking'} onChange={() => {}} style={{ pointerEvents: 'none' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>Netbanking</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>All major Indian banks available</span>
                      </div>
                    </div>

                    {/* Method details fields */}
                    {gatewaySelectedMethod === 'UPI' && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Enter UPI ID *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. mobile@upi" 
                          className="input-field" 
                          value={gatewayUpiId}
                          onChange={e => setGatewayUpiId(e.target.value)}
                          style={{ padding: '8px', fontSize: '13px' }}
                        />
                      </div>
                    )}

                    {gatewaySelectedMethod === 'Card' && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Card Number *</label>
                          <input 
                            type="text" 
                            placeholder="4111 2222 3333 4444" 
                            className="input-field" 
                            value={gatewayCardNumber}
                            onChange={e => setGatewayCardNumber(e.target.value)}
                            style={{ padding: '8px', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Expiry Date *</label>
                            <input 
                              type="text" 
                              placeholder="MM/YY" 
                              className="input-field" 
                              value={gatewayCardExpiry}
                              onChange={e => setGatewayCardExpiry(e.target.value)}
                              style={{ padding: '8px', fontSize: '13px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>CVV *</label>
                            <input 
                              type="password" 
                              placeholder="123" 
                              maxLength={3}
                              className="input-field" 
                              value={gatewayCardCvv}
                              onChange={e => setGatewayCardCvv(e.target.value)}
                              style={{ padding: '8px', fontSize: '13px' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {gatewaySelectedMethod === 'Netbanking' && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Select Bank *</label>
                        <select 
                          className="input-field"
                          value={gatewayNetbank}
                          onChange={e => setGatewayNetbank(e.target.value)}
                          style={{ padding: '8px', fontSize: '13px' }}
                        >
                          <option value="SBI">State Bank of India (SBI)</option>
                          <option value="HDFC">HDFC Bank</option>
                          <option value="ICICI">ICICI Bank</option>
                          <option value="AXIS">Axis Bank</option>
                          <option value="KOTAK">Kotak Mahindra Bank</option>
                        </select>
                      </div>
                    )}
                    
                    {paymentSettings?.razorpayKeyId ? (
                      <>
                        {paymentSettings.razorpayMode === 'test' && (
                          <div style={{ fontSize: '12px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', textAlign: 'left' }}>
                            🟡 <strong>Test Mode Active:</strong> Use any valid test credentials to proceed with simulated transaction.
                          </div>
                        )}
                        {paymentSettings.razorpayMode === 'live' && (
                          <div style={{ fontSize: '12px', color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', textAlign: 'left' }}>
                            🟢 <strong>Live Mode Active:</strong> Real transaction processing will be initiated.
                          </div>
                        )}
                        <button 
                          type="button" 
                          onClick={() => setGatewayPaymentStep('otp')}
                          style={{ background: '#3399cc', color: '#fff', border: 'none', borderRadius: '6px', padding: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 0.2s' }}
                        >
                          Pay ₹{paymentAmount.toLocaleString()}
                        </button>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600, margin: '0 0 10px 0' }}>
                          ⚠️ Razorpay Gateway is not configured in settings.
                        </p>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                          Please navigate to Settings → Payment Settings and add your Key ID and Secret first.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {gatewayPaymentStep === 'otp' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>OTP Verification</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>We have sent a verification code to ending with ******8901</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', margin: '15px 0' }}>
                      <input 
                        type="text" 
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        className="input-field"
                        value={gatewayOtp}
                        onChange={e => setGatewayOtp(e.target.value)}
                        style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '18px', fontWeight: 700, width: '180px', padding: '10px' }}
                      />
                      <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 500, background: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>
                        Demo Code: 123456
                      </span>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => {
                        if (!gatewayOtp || gatewayOtp.length < 4) {
                          alert('Please enter a valid OTP.');
                          return;
                        }
                        const mockTxn = `pay_RZP_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                        setGeneratedTxnId(mockTxn);
                        setGatewayPaymentStep('success');
                        
                        setTimeout(() => {
                          setTransactionId(mockTxn);
                          setShowOnlineGatewayPopup(false);
                        }, 1800);
                      }}
                      style={{ background: '#3399cc', color: '#fff', border: 'none', borderRadius: '6px', padding: '12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      Verify & Pay
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => setGatewayPaymentStep('method')}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Cancel & Go Back
                    </button>
                  </div>
                )}

                {gatewayPaymentStep === 'success' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '30px 10px', textAlign: 'center' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
                      <Check size={36} />
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>Payment Successful</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Transaction ID: {generatedTxnId}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px' }}>
                      Redirecting back to your payment popup...
                    </div>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div style={{ background: '#f8fafc', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', fontSize: '10px', color: '#94a3b8' }}>
                <span>Powered by Razorpay</span>
                <span>PCI-DSS Compliant</span>
              </div>
            </div>
          ) : (
            /* CCAvenue Simulator UI */
            <div style={{ background: '#ffffff', borderRadius: '8px', width: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', border: '1px solid #b5b5b5', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
              {/* Red line at top */}
              <div style={{ height: '4px', background: '#a00606' }}></div>
              
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                <button type="button" onClick={() => setShowOnlineGatewayPopup(false)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}><X size={18} /></button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#a00606', letterSpacing: '-0.5px' }}>CCAvenue</span>
                  <span style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>
                    Secure Payment Gateway {paymentSettings ? `(${paymentSettings.ccavenueMode.toUpperCase()} MODE)` : ''}
                  </span>
                  {paymentSettings && (
                    <span style={{ fontSize: '9px', color: '#777', marginTop: '2px' }}>
                      Merchant ID: {paymentSettings.ccavenueMerchantId || 'Not Configured'}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: '#777' }}>Total Charge:</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>INR {paymentAmount.toLocaleString()}</div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '20px', flex: 1, minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fcfcfc' }}>
                {gatewayPaymentStep === 'method' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #ddd', paddingBottom: '6px' }}>BILLING INFORMATION & PAYMENT OPTION</div>
                    
                    {/* Method Radio Selection */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '5px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#333', cursor: 'pointer', padding: '8px', border: `1px solid ${gatewaySelectedMethod === 'UPI' ? '#a00606' : '#ddd'}`, background: '#fff', borderRadius: '4px' }}>
                        <input type="radio" checked={gatewaySelectedMethod === 'UPI'} onChange={() => setGatewaySelectedMethod('UPI')} />
                        UPI
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#333', cursor: 'pointer', padding: '8px', border: `1px solid ${gatewaySelectedMethod === 'Card' ? '#a00606' : '#ddd'}`, background: '#fff', borderRadius: '4px' }}>
                        <input type="radio" checked={gatewaySelectedMethod === 'Card'} onChange={() => setGatewaySelectedMethod('Card')} />
                        Credit / Debit Card
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#333', cursor: 'pointer', padding: '8px', border: `1px solid ${gatewaySelectedMethod === 'Netbanking' ? '#a00606' : '#ddd'}`, background: '#fff', borderRadius: '4px', gridColumn: 'span 2' }}>
                        <input type="radio" checked={gatewaySelectedMethod === 'Netbanking'} onChange={() => setGatewaySelectedMethod('Netbanking')} />
                        Netbanking (SBI, HDFC, ICICI, etc.)
                      </label>
                    </div>

                    {/* Method Inputs */}
                    {gatewaySelectedMethod === 'UPI' && (
                      <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', marginTop: '5px' }}>
                        <label style={{ fontSize: '11px', color: '#444', display: 'block', marginBottom: '4px' }}>UPI Virtual Payment Address (VPA) *</label>
                        <input 
                          type="text" 
                          placeholder="username@bank" 
                          className="input-field" 
                          value={gatewayUpiId}
                          onChange={e => setGatewayUpiId(e.target.value)}
                          style={{ padding: '8px', fontSize: '12px', background: '#fff', border: '1px solid #ccc' }}
                        />
                      </div>
                    )}

                    {gatewaySelectedMethod === 'Card' && (
                      <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#444', display: 'block', marginBottom: '4px' }}>Card Number *</label>
                          <input 
                            type="text" 
                            placeholder="xxxx xxxx xxxx xxxx" 
                            className="input-field" 
                            value={gatewayCardNumber}
                            onChange={e => setGatewayCardNumber(e.target.value)}
                            style={{ padding: '8px', fontSize: '12px', background: '#fff', border: '1px solid #ccc' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: '#444', display: 'block', marginBottom: '4px' }}>Expiration *</label>
                            <input 
                              type="text" 
                              placeholder="MM/YY" 
                              className="input-field" 
                              value={gatewayCardExpiry}
                              onChange={e => setGatewayCardExpiry(e.target.value)}
                              style={{ padding: '8px', fontSize: '12px', background: '#fff', border: '1px solid #ccc' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: '#444', display: 'block', marginBottom: '4px' }}>CVV/CVC *</label>
                            <input 
                              type="password" 
                              maxLength={3}
                              placeholder="123" 
                              className="input-field" 
                              value={gatewayCardCvv}
                              onChange={e => setGatewayCardCvv(e.target.value)}
                              style={{ padding: '8px', fontSize: '12px', background: '#fff', border: '1px solid #ccc' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {gatewaySelectedMethod === 'Netbanking' && (
                      <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', marginTop: '5px' }}>
                        <label style={{ fontSize: '11px', color: '#444', display: 'block', marginBottom: '4px' }}>Select Bank *</label>
                        <select 
                          className="input-field"
                          value={gatewayNetbank}
                          onChange={e => setGatewayNetbank(e.target.value)}
                          style={{ padding: '8px', fontSize: '12px', background: '#fff', border: '1px solid #ccc' }}
                        >
                          <option value="SBI">State Bank of India (SBI)</option>
                          <option value="HDFC">HDFC Bank</option>
                          <option value="ICICI">ICICI Bank</option>
                          <option value="AXIS">Axis Bank</option>
                          <option value="PNB">Punjab National Bank</option>
                        </select>
                      </div>
                    )}

                    {paymentSettings?.ccavenueMerchantId ? (
                      <>
                        {paymentSettings.ccavenueMode === 'test' && (
                          <div style={{ fontSize: '11px', color: '#854d0e', background: '#fef9c3', border: '1px solid #fef08a', padding: '6px 10px', borderRadius: '4px', marginBottom: '8px', textAlign: 'left' }}>
                            ⚠️ <strong>Test Mode Active:</strong> Use any valid test credentials to proceed with simulated transaction.
                          </div>
                        )}
                        {paymentSettings.ccavenueMode === 'live' && (
                          <div style={{ fontSize: '11px', color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '6px 10px', borderRadius: '4px', marginBottom: '8px', textAlign: 'left' }}>
                            🟢 <strong>Live Mode Active:</strong> Real transaction processing will be initiated.
                          </div>
                        )}
                        <button 
                          type="button" 
                          onClick={() => setGatewayPaymentStep('otp')}
                          style={{ background: '#a00606', color: '#fff', border: 'none', borderRadius: '4px', padding: '12px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', marginTop: '10px', textTransform: 'uppercase', transition: 'background 0.2s' }}
                        >
                          Make Payment
                        </button>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '15px 0' }}>
                        <p style={{ fontSize: '12px', color: '#a00606', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                          ⚠️ CCAvenue Gateway is not configured in settings.
                        </p>
                        <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>
                          Please navigate to Settings → Payment Settings and add your Merchant ID and Access Code first.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {gatewayPaymentStep === 'otp' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>SECURE OTP VERIFICATION</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
                      An OTP has been sent to your mobile number registered with the bank.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', margin: '15px 0' }}>
                      <input 
                        type="text" 
                        maxLength={6}
                        placeholder="Enter OTP"
                        className="input-field"
                        value={gatewayOtp}
                        onChange={e => setGatewayOtp(e.target.value)}
                        style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '16px', fontWeight: 'bold', width: '160px', padding: '8px', border: '1px solid #999' }}
                      />
                      <span style={{ fontSize: '11px', color: '#a00606', fontWeight: 'bold', background: '#ffebeb', padding: '3px 8px', borderRadius: '4px' }}>
                        OTP: 123456
                      </span>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => {
                        if (!gatewayOtp || gatewayOtp.length < 4) {
                          alert('Please enter a valid OTP.');
                          return;
                        }
                        const mockTxn = `TXN_CCA_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                        setGeneratedTxnId(mockTxn);
                        setGatewayPaymentStep('success');
                        
                        setTimeout(() => {
                          setTransactionId(mockTxn);
                          setShowOnlineGatewayPopup(false);
                        }, 1800);
                      }}
                      style={{ background: '#a00606', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', textTransform: 'uppercase' }}
                    >
                      Submit OTP
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => setGatewayPaymentStep('method')}
                      style={{ background: 'none', border: 'none', color: '#888', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Cancel Payment
                    </button>
                  </div>
                )}

                {gatewayPaymentStep === 'success' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '30px 10px', textAlign: 'center' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#e1f5fe', border: '2px solid #03a9f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#03a9f4' }}>
                      <Check size={28} />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#03a9f4' }}>CCAvenue Authorization Success</div>
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>Reference No: {generatedTxnId}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '15px' }}>
                      Returning back to DIGIEX-HRMS...
                    </div>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div style={{ background: '#eeeeee', padding: '10px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderTop: '1px solid #ddd', fontSize: '9px', color: '#777' }}>
                <span>128-bit SSL Secure Payment Gateway Connection</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Special Discount Unlock Modal */}
      {showDiscountModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10005 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '90%', maxWidth: '450px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Apply Special Discount</h3>
              <button onClick={() => { setShowDiscountModal(false); setDiscountErrorMsg(''); setDiscountCodeInput(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleVerifyDiscountCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>Select Discount Type *</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>
                    <input 
                      type="radio" 
                      name="discountTypeRadio" 
                      checked={discountTypeChoice === 'percentage'} 
                      onChange={() => { setDiscountTypeChoice('percentage'); setDiscountErrorMsg(''); }}
                    />
                    Discount in Percentage
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>
                    <input 
                      type="radio" 
                      name="discountTypeRadio" 
                      checked={discountTypeChoice === 'fixed'} 
                      onChange={() => { setDiscountTypeChoice('fixed'); setDiscountErrorMsg(''); }}
                    />
                    Fixed Price Discount
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Security Code *</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder={discountTypeChoice === 'percentage' ? 'Enter code for Percentage (Per@12345)' : 'Enter code for Fixed (Fix@12345)'}
                  value={discountCodeInput} 
                  onChange={e => setDiscountCodeInput(e.target.value)} 
                  required 
                />
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  {discountTypeChoice === 'percentage' ? 'Security Code: Per@12345' : 'Security Code: Fix@12345'}
                </div>
              </div>

              {discountErrorMsg && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                  {discountErrorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => { setShowDiscountModal(false); setDiscountErrorMsg(''); setDiscountCodeInput(''); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Verify & Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
