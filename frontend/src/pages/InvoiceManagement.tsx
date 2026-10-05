import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Plus, Edit, Trash2, X, Check, Download, Copy, Eye, Search, 
  TrendingUp, RefreshCw, BarChart2, DollarSign, FileText, 
  Receipt, ShieldAlert, ArrowLeftRight
} from 'lucide-react';

interface InvoiceItem {
  serviceName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

interface EditHistory {
  updatedBy: any;
  updatedByName: string;
  updatedAt: string;
  action: string;
  previousValues: any;
  newValues: any;
}

interface Invoice {
  _id?: string;
  invoiceNumber: string;
  client: any;
  project?: any;
  clientPackage?: any;
  billingCycle?: string;
  clientCompanyName?: string;
  clientGstNumber?: string;
  clientContactPerson?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  clientState?: string;
  clientCountry?: string;
  amount: number;
  discount: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  status: 'Paid' | 'Partially Paid' | 'Pending' | 'Unpaid' | 'Overdue' | 'Cancelled' | 'Refunded';
  paidAmount: number;
  dueAmount: number;
  dueDate: string;
  paymentMethod?: string;
  paymentDate?: string;
  transactionId?: string;
  referenceNumber?: string;
  bankName?: string;
  paymentNotes?: string;
  isRecurring: boolean;
  recurringCycle?: string;
  notes?: string;
  editHistory: EditHistory[];
  payments?: any[];
  items: InvoiceItem[];
  createdAt?: string;
  updatedAt?: string;
}

export default function InvoiceManagement() {
  // System configurations & roles
  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = (loggedInUser.role?.name || '').toLowerCase().trim();
  const userType = (typeof loggedInUser.role?.userType === 'object' ? loggedInUser.role?.userType?.name : loggedInUser.role?.userType || '').toLowerCase().trim();
  
  const isAdmin = ['admin', 'super admin'].includes(userRole) || ['admin', 'super admin'].includes(userType);
  const isAccounts = userRole.includes('account') || userRole.includes('billing') || userRole.includes('finance');
  const isClient = userRole.includes('client');

  // Master Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [serviceDetails, setServiceDetails] = useState<any[]>([]);
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({});

  // Loading States
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Pagination & Search Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // View tabs
  const [activeView, setActiveView] = useState<'list' | 'create' | 'edit'>('list');
  
  // Create / Edit Invoice State
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringCycle, setRecurringCycle] = useState<string>('Monthly');
  const [notes, setNotes] = useState<string>('');
  
  // Client business details (editable fallback)
  const [clientCompanyName, setClientCompanyName] = useState('');
  const [clientGstNumber, setClientGstNumber] = useState('');
  const [clientContactPerson, setClientContactPerson] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientState, setClientState] = useState('');
  const [clientCountry, setClientCountry] = useState('India');

  // Invoice Items State
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    { serviceName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, amount: 0, gstRate: 18, gstAmount: 0, total: 0 }
  ]);

  // Drawer / View Detail States
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transactionId, setTransactionId] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partially Paid'>('Paid');
  const [chequeAccountNumber, setChequeAccountNumber] = useState('');
  const [chequeIfscNumber, setChequeIfscNumber] = useState('');

  // Error/Success Message
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch Data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [resInvoices, resClients, resServices, resSettings, resDetails] = await Promise.all([
        axios.get('http://localhost:5000/api/invoices'),
        axios.get('http://localhost:5000/api/invoices/clients'),
        axios.get('http://localhost:5000/api/services'),
        axios.get('http://localhost:5000/api/settings'),
        axios.get('http://localhost:5000/api/service-details')
      ]);

      if (resInvoices.data.success) {
        // Enforce role-based viewing
        let filteredInvoices = resInvoices.data.data;
        if (isClient) {
          filteredInvoices = filteredInvoices.filter((inv: any) => 
            inv.clientEmail === loggedInUser.email || 
            (inv.client && (inv.client._id === loggedInUser.client || inv.client === loggedInUser.client))
          );
        }
        setInvoices(filteredInvoices);
      }
      if (resClients.data.success) setClients(resClients.data.data);
      if (resServices.data.success) setServices(resServices.data.data);
      if (resDetails.data.success) setServiceDetails(resDetails.data.data);
      if (resSettings.data.success) {
        const mapped: Record<string, string> = {};
        resSettings.data.data.forEach((s: any) => {
          mapped[s.key] = s.value;
        });
        setSettingsMap(mapped);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to load system invoice data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Show Toast helpers
  const showToast = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 5000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  // Auto populate client business details and services
  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    if (!clientId) {
      clearClientDetails();
      return;
    }

    const clientObj = clients.find(c => c._id === clientId);
    if (clientObj) {
      setClientCompanyName(clientObj.companyName || '');
      setClientContactPerson(clientObj.name || '');
      setClientPhone(clientObj.phone || '');
      setClientEmail(clientObj.email || '');
      setClientAddress(clientObj.address || '');
      setClientState(clientObj.state || 'West Bengal');
      setClientCountry(clientObj.country || 'India');
      
      // Auto-load assigned services or create a template service row
      // We check if the client has active package subscriptions and auto-fill line items
      fetchClientPackageItems(clientId);
    }
  };

  const fetchClientPackageItems = async (clientId: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/client-packages?clientId=${clientId}&status=Active`);
      if (res.data.success && res.data.data.length > 0) {
        const activePkg = res.data.data[0]; // grab the first active package
        const itemsList: InvoiceItem[] = activePkg.services.map((s: any) => {
          const masterSrv = services.find(ms => ms._id === s.serviceId);
          const price = masterSrv?.price || (activePkg.price / activePkg.services.length) || 0;
          let itemDesc = `Service: ${s.name} (${activePkg.billingCycle} Plan)`;
          const serviceId = s.serviceId?._id || s.serviceId;
          const matchedDetails = (activePkg.serviceDetails || []).filter((sd: any) => {
            const sdServiceId = sd.service?._id || sd.service;
            return sdServiceId && serviceId && String(sdServiceId) === String(serviceId);
          });

          if (matchedDetails.length > 0) {
            const detailsText = matchedDetails
              .map((sd: any) => `  • ${sd.name} - INR ${(sd.price || 0).toLocaleString('en-IN')}`)
              .join('\n');
            itemDesc = `${itemDesc}\n${detailsText}`;
          } else if (s.deliverables && s.deliverables.length > 0) {
            const delsText = s.deliverables
              .map((d: any) => {
                const valPart = d.value ? `: ${d.value}` : '';
                return `  • ${d.key || d}${valPart}`;
              })
              .join('\n');
            itemDesc = `${itemDesc}\n${delsText}`;
          }
          return {
            serviceName: s.name,
            description: itemDesc,
            quantity: 1,
            unitPrice: price,
            discount: 0,
            amount: price,
            gstRate: 18,
            gstAmount: Math.round(price * 0.18),
            total: Math.round(price * 1.18)
          };
        });
        setInvoiceItems(itemsList);
      } else {
        // template row
        setInvoiceItems([
          { serviceName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, amount: 0, gstRate: 18, gstAmount: 0, total: 0 }
        ]);
      }
    } catch (err) {
      console.error('Failed to fetch client packages', err);
    }
  };

  const clearClientDetails = () => {
    setClientCompanyName('');
    setClientContactPerson('');
    setClientPhone('');
    setClientEmail('');
    setClientAddress('');
    setClientState('');
    setClientCountry('India');
    setInvoiceItems([
      { serviceName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, amount: 0, gstRate: 18, gstAmount: 0, total: 0 }
    ]);
  };

  // Line Item Grid Manipulation
  const handleItemFieldChange = (index: number, field: keyof InvoiceItem, val: any) => {
    const updated = [...invoiceItems];
    const item = { ...updated[index] };

    if (field === 'serviceName') {
      item.serviceName = val;
      const srvObj = services.find(s => s.name === val);
      if (srvObj) {
        let baseDesc = srvObj.description || `Service: ${srvObj.name}`;
        const matchedDetails = serviceDetails.filter(
          (sd: any) => sd.status === 'Active' && String(sd.service?._id || sd.service) === String(srvObj._id)
        );
        if (matchedDetails.length > 0) {
          const detailsText = matchedDetails
            .map((sd: any) => `  • ${sd.name} - INR ${(sd.price || 0).toLocaleString('en-IN')}`)
            .join('\n');
          baseDesc = `${baseDesc}\n${detailsText}`;
        } else if (srvObj.deliverables && srvObj.deliverables.length > 0) {
          const delsText = srvObj.deliverables
            .map((d: string) => `  • ${d}`)
            .join('\n');
          baseDesc = `${baseDesc}\n${delsText}`;
        }
        item.description = baseDesc;
        item.unitPrice = srvObj.price || 0;
      }
    } else if (field === 'description') {
      item.description = val;
    } else {
      (item as any)[field] = Number(val) || 0;
    }

    // Calculations
    const qty = item.quantity || 1;
    const price = item.unitPrice || 0;
    const disc = item.discount || 0;
    const gstRate = item.gstRate || 18;

    item.amount = (qty * price) - disc;
    item.gstAmount = Math.round(item.amount * (gstRate / 100));
    item.total = item.amount + item.gstAmount;

    updated[index] = item;
    setInvoiceItems(updated);
  };

  const addLineItem = () => {
    setInvoiceItems([
      ...invoiceItems,
      { serviceName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, amount: 0, gstRate: 18, gstAmount: 0, total: 0 }
    ]);
  };

  const removeLineItem = (index: number) => {
    if (invoiceItems.length === 1) return;
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  // Grand Totals Calculation (Dynamic)
  const calcSubtotal = () => invoiceItems.reduce((acc, item) => acc + item.amount, 0);
  const calcDiscount = () => invoiceItems.reduce((acc, item) => acc + item.discount, 0);
  const calcTax = () => invoiceItems.reduce((acc, item) => acc + item.gstAmount, 0);
  const calcGrandTotal = () => invoiceItems.reduce((acc, item) => acc + item.total, 0);

  // Dynamic CGST / SGST / IGST calculation based on Billing State
  const calcDetailedGST = () => {
    const totalTax = calcTax();
    const companyBillingState = settingsMap['address_state'] || 'West Bengal';
    const isSameState = companyBillingState.trim().toLowerCase() === clientState.trim().toLowerCase();

    if (isSameState) {
      const cgst = Math.round(totalTax / 2);
      const sgst = totalTax - cgst;
      return { cgst, sgst, igst: 0 };
    } else {
      return { cgst: 0, sgst: 0, igst: totalTax };
    }
  };

  const { cgst, sgst, igst } = calcDetailedGST();

  // Create Invoice Submission
  const handleCreateOrUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      showToast('error', 'Please select a client.');
      return;
    }
    if (invoiceItems.some(i => !i.description)) {
      showToast('error', 'All line items must have a description.');
      return;
    }

    setSubmitLoading(true);
    const subtotal = calcSubtotal();
    const tax = calcTax();
    const total = calcGrandTotal();

    const payload = {
      client: selectedClient,
      invoiceNumber: invoiceNumber.trim() || undefined,
      dueDate,
      createdAt: invoiceDate ? new Date(invoiceDate) : new Date(),
      isRecurring,
      recurringCycle,
      notes,
      clientCompanyName,
      clientGstNumber,
      clientContactPerson,
      clientPhone,
      clientEmail,
      clientAddress,
      clientState,
      clientCountry,
      amount: subtotal,
      discount: calcDiscount(),
      tax,
      cgst,
      sgst,
      igst,
      total,
      items: invoiceItems,
      // For updates
      action: currentInvoiceId ? 'UPDATED' : 'CREATED'
    };

    try {
      if (currentInvoiceId) {
        await axios.put(`http://localhost:5000/api/invoices/${currentInvoiceId}`, payload);
        showToast('success', 'Invoice updated successfully.');
      } else {
        await axios.post('http://localhost:5000/api/invoices', payload);
        showToast('success', 'Invoice created successfully.');
      }
      resetForm();
      fetchAllData();
      setActiveView('list');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save invoice.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Clone Invoice
  const handleCloneInvoice = async (id: string) => {
    if (!window.confirm('Are you sure you want to clone this invoice? This will generate a new unpaid invoice with a fresh INV number.')) return;
    try {
      const res = await axios.post(`http://localhost:5000/api/invoices/clone/${id}`);
      if (res.data.success) {
        showToast('success', `Invoice cloned successfully. New Invoice: ${res.data.data.invoiceNumber}`);
        fetchAllData();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to clone invoice.');
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice permanently? This cannot be undone.')) return;
    try {
      await axios.delete(`http://localhost:5000/api/invoices/${id}`);
      showToast('success', 'Invoice deleted successfully.');
      fetchAllData();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to delete invoice.');
    }
  };

  // Record Payment Submission
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;

    if (paymentAmount <= 0) {
      showToast('error', 'Please enter a valid payment amount.');
      return;
    }

    if (paymentMethod === 'Cheque') {
      if (!referenceNumber.trim()) {
        showToast('error', 'Please enter Cheque Number in the Reference Number field.');
        return;
      }
      if (!chequeAccountNumber.trim()) {
        showToast('error', 'Please enter the Account Number.');
        return;
      }
      if (!chequeIfscNumber.trim()) {
        showToast('error', 'Please enter the IFSC Number.');
        return;
      }
    }

    try {
      const currentPaid = paymentInvoice.paidAmount || 0;
      const totalCost = paymentInvoice.total || 0;
      const newPaidTotal = currentPaid + paymentAmount;

      let nextStatus = paymentStatus;
      if (newPaidTotal >= totalCost) {
        nextStatus = 'Paid';
      } else if (newPaidTotal > 0) {
        nextStatus = 'Partially Paid';
      }

      let finalNotes = paymentNotes;
      if (paymentMethod === 'Cheque') {
        const chequeExtra = `Account No: ${chequeAccountNumber} | IFSC Code: ${chequeIfscNumber}`;
        finalNotes = finalNotes ? `${finalNotes} | ${chequeExtra}` : chequeExtra;
      }

      const payload = {
        status: nextStatus,
        paidAmount: Math.min(newPaidTotal, totalCost),
        paymentMethod,
        paymentDate: new Date(paymentDate),
        transactionId,
        referenceNumber,
        bankName,
        paymentNotes: finalNotes,
        action: 'PAYMENT_RECORDED'
      };

      await axios.put(`http://localhost:5000/api/invoices/${paymentInvoice._id}`, payload);
      showToast('success', 'Payment recorded successfully.');
      setShowPaymentModal(false);
      setPaymentInvoice(null);
      fetchAllData();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to record payment.');
    }
  };

  const openPaymentModal = (invoice: Invoice) => {
    setPaymentInvoice(invoice);
    setPaymentAmount(invoice.dueAmount || 0);
    setPaymentMethod('Bank Transfer');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setTransactionId('');
    setReferenceNumber('');
    setBankName('');
    setPaymentNotes('');
    setChequeAccountNumber('');
    setChequeIfscNumber('');
    setPaymentStatus('Paid');
    setShowPaymentModal(true);
  };

  // Open Edit Form
  const openEditForm = (invoice: Invoice) => {
    setCurrentInvoiceId(invoice._id || null);
    setSelectedClient(invoice.client?._id || invoice.client || '');
    setInvoiceNumber(invoice.invoiceNumber);
    setInvoiceDate(invoice.createdAt ? invoice.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    setDueDate(invoice.dueDate ? invoice.dueDate.split('T')[0] : '');
    setIsRecurring(invoice.isRecurring || false);
    setRecurringCycle(invoice.recurringCycle || 'Monthly');
    setNotes(invoice.notes || '');

    setClientCompanyName(invoice.clientCompanyName || '');
    setClientGstNumber(invoice.clientGstNumber || '');
    setClientContactPerson(invoice.clientContactPerson || '');
    setClientPhone(invoice.clientPhone || '');
    setClientEmail(invoice.clientEmail || '');
    setClientAddress(invoice.clientAddress || '');
    setClientState(invoice.clientState || '');
    setClientCountry(invoice.clientCountry || 'India');

    setInvoiceItems(invoice.items || []);
    setActiveView('edit');
  };

  const resetForm = () => {
    setCurrentInvoiceId(null);
    setSelectedClient('');
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setIsRecurring(false);
    setRecurringCycle('Monthly');
    setNotes('');
    clearClientDetails();
  };

  // Dynamic professional PDF Generation
  const downloadInvoicePDF = (inv: Invoice) => {
    const doc = new jsPDF();

    // Palette Design

    // Draw header layout borders & backgrounds
    doc.setFillColor(30, 41, 59); // Navy block top bar
    doc.rect(0, 0, 210, 8, 'F');

    // Add Logo or fallback Text on the Left
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text((settingsMap['company_name'] || 'DIGIEX WEB SERVICES PVT LTD').toUpperCase(), 15, 25);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('ISO 9001:2015 Certified Company', 15, 30);

    // Business Details on Right Side
    doc.setTextColor(30, 41, 59); // Slate-800 for high clarity
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    const rightAlignX = 195;
    doc.text(settingsMap['company_name'] || 'DIGIEX WEB SERVICES PVT LTD', rightAlignX, 22, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    
    // Split long company addresses if necessary
    const dynamicAddress = [
      settingsMap['address_line1'],
      settingsMap['address_city'],
      settingsMap['address_state'],
      settingsMap['address_zip'],
      settingsMap['address_country']
    ].filter(Boolean).join(', ');
    const rawAddress = dynamicAddress || settingsMap['company_address'] || 'Sector V, Salt Lake, Kolkata, West Bengal, India';
    const splitCompanyAddr = doc.splitTextToSize(rawAddress, 70);
    
    let currentY = 27;
    splitCompanyAddr.forEach((line: string) => {
      doc.text(line, rightAlignX, currentY, { align: 'right' });
      currentY += 4.5;
    });

    doc.text(`Phone: ${settingsMap['company_phone'] || '+91 98765 43210'}`, rightAlignX, currentY, { align: 'right' });
    doc.text(`Email: ${settingsMap['company_email'] || 'accounts@digiexweb.com'}`, rightAlignX, currentY + 4.5, { align: 'right' });
    
    const companyGstVal = settingsMap['company_gst'] || settingsMap['company_gstin'] || '19AAACD1234F1Z5';
    doc.text(`GSTIN: ${companyGstVal}`, rightAlignX, currentY + 9, { align: 'right' });
    doc.text(`PAN: ${settingsMap['company_pan'] || 'AAACD1234F'}`, rightAlignX, currentY + 13.5, { align: 'right' });

    const lineY = currentY + 19;
    
    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, lineY, 195, lineY);

    const midY = lineY + 6;

    // CLIENT DETAILS (Left Column)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text('BILL TO:', 15, midY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(inv.clientCompanyName || inv.client?.companyName || 'N/A', 15, midY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Attn: ${inv.clientContactPerson || inv.client?.name || 'N/A'}`, 15, midY + 10);
    
    const clientRawAddr = inv.clientAddress || inv.client?.address || 'N/A';
    const splitClientAddr = doc.splitTextToSize(clientRawAddr, 90);
    doc.text(splitClientAddr, 15, midY + 15);
    
    const clientAddrOffset = splitClientAddr.length * 4.5;
    doc.text(`Email: ${inv.clientEmail || inv.client?.email || 'N/A'}`, 15, midY + 15 + clientAddrOffset);
    doc.text(`Phone: ${inv.clientPhone || inv.client?.phone || 'N/A'}`, 15, midY + 20 + clientAddrOffset);
    const getCustomerIdentifications = (invoiceObj: any) => {
      const ids: { label: string; value: string; isVerified?: boolean }[] = [];
      const client = invoiceObj.client || {};
      const lead = invoiceObj.clientPackage?.lead || invoiceObj.clientPackage?.proposal?.leadId || invoiceObj.lead || invoiceObj.proposal?.leadId || {};

      const gst = invoiceObj.clientGstNumber || client.gstNumber || lead.gstNumber || client.gstin || lead.gstin || client.gst || lead.gst || '';
      const isGstVerified = client.isGstVerified || lead.isGstVerified || false;
      if (gst) {
        ids.push({ label: 'GSTIN', value: gst, isVerified: isGstVerified });
      }

      const pan = invoiceObj.clientPanNumber || client.panNumber || lead.panNumber || client.pan || lead.pan || '';
      const isPanVerified = client.isPanVerified || lead.isPanVerified || false;
      if (pan) {
        ids.push({ label: 'PAN', value: pan, isVerified: isPanVerified });
      }

      const cin = invoiceObj.clientCinNumber || client.cinNumber || client.companyRegistrationNumber || lead.cinNumber || lead.companyRegistrationNumber || client.regNumber || lead.regNumber || '';
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

      const kycGstStr = client.kycGst || lead.kycGst || invoiceObj.kycGst || '';
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

    let clientInfoY = midY + 25 + clientAddrOffset;
    doc.text(`State: ${inv.clientState || 'N/A'}`, 15, clientInfoY);
    clientInfoY += 5;

    const customerIds = getCustomerIdentifications(inv);
    if (customerIds.length === 0) {
      doc.text(`GSTIN: N/A`, 15, clientInfoY);
      clientInfoY += 5;
    } else {
      customerIds.forEach((idObj) => {
        doc.text(`${idObj.label}: ${idObj.value}`, 15, clientInfoY);
        if (idObj.isVerified) {
          doc.setTextColor(22, 163, 74);
          doc.text(' [Verified]', 15 + doc.getTextWidth(`${idObj.label}: ${idObj.value}`), clientInfoY);
          doc.setTextColor(80);
        }
        clientInfoY += 5;
      });
    }

    // INVOICE METADATA (Right Column)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(22, 163, 74); // Accent color for status
    doc.text('TAX INVOICE', 130, midY + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`Invoice No:`, 130, midY + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(inv.invoiceNumber, 158, midY + 10);

    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice Date:`, 130, midY + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(inv.createdAt || '').toLocaleDateString('en-IN'), 158, midY + 15);

    doc.setFont('helvetica', 'bold');
    doc.text(`Due Date:`, 130, midY + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(inv.dueDate || '').toLocaleDateString('en-IN'), 158, midY + 20);

    doc.setFont('helvetica', 'bold');
    doc.text(`Status:`, 130, midY + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(inv.status === 'Paid' ? 22 : 220, inv.status === 'Paid' ? 163 : 38, inv.status === 'Paid' ? 74 : 38);
    doc.text(inv.status.toUpperCase(), 158, midY + 25);
    doc.setTextColor(80);

    // Table of Items
    const startTableY = Math.max(midY + 35 + clientAddrOffset, clientInfoY + 4);
    let rowIdx = 1;
    const tableBody: any[] = [];

    (inv.items || []).forEach((item: any) => {
      const lines = (item.description || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
      const detailLines = lines.filter((l: string) => l.startsWith('•') || l.startsWith('-'));
      const parentName = item.serviceName || lines[0] || 'Service';

      // Add parent service row first
      tableBody.push([
        rowIdx++,
        parentName,
        '998314', // Default Hsn/Sac
        item.quantity || 1,
        (item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        `GST ${item.gstRate || 18}%`,
        ((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);

      // Add each detail line as a sub-row (Item column only, other columns blank)
      if (detailLines.length > 0) {
        detailLines.forEach((line: string) => {
          const cleanLine = line.replace(/^[•\-\s]+/, '');
          tableBody.push([
            '', // Blank serial
            `  • ${cleanLine}`,
            '', '', '', '', ''
          ]);
        });
      }
    });

    tableBody.push([
      '', '', '', '', '',
      'Sub Total',
      (inv.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    if (inv.discount > 0) {
      tableBody.push([
        '', '', '', '', '',
        'Discount',
        `-${(inv.discount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      ]);
    }

    if (inv.cgst > 0) {
      tableBody.push([
        '', '', '', '', '',
        'CGST (9%)',
        (inv.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }
    if (inv.sgst > 0) {
      tableBody.push([
        '', '', '', '', '',
        'SGST (9%)',
        (inv.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }
    if (inv.igst > 0) {
      tableBody.push([
        '', '', '', '', '',
        'IGST (18%)',
        (inv.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }
    if (!(inv.cgst > 0 || inv.sgst > 0 || inv.igst > 0) && (inv.tax || 0) > 0) {
      tableBody.push([
        '', '', '', '', '',
        'GST (18%)',
        (inv.tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }

    tableBody.push([
      '', '', '', '', '',
      'Total',
      (inv.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
    ]);

    if (inv.paidAmount > 0) {
      tableBody.push([
        '', '', '', '', '',
        'Amount Paid',
        (inv.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }

    if (inv.dueAmount > 0) {
      tableBody.push([
        '', '', '', '', '',
        'Balance Due',
        (inv.dueAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
      ]);
    }

    autoTable(doc, {
      startY: startTableY,
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

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // BANK & PAYMENT DETAIL BOX (Left Column Align)
    doc.setFillColor(248, 250, 252);
    doc.rect(15, finalY - 3, 95, 42, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, finalY - 3, 95, 42, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Bank Details for Payment:', 18, finalY + 2);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Bank Name: ${settingsMap['bank_name'] || 'HDFC Bank'}`, 18, finalY + 7);
    doc.text(`A/C Name: ${settingsMap['company_name'] || 'Digiex Web Services Pvt Ltd'}`, 18, finalY + 11);
    doc.text(`Account No: ${settingsMap['bank_account_no'] || '50100234567890'}`, 18, finalY + 15);
    doc.text(`IFSC Code: ${settingsMap['bank_ifsc'] || 'HDFC0000123'}`, 18, finalY + 19);
    doc.text(`Branch: ${settingsMap['bank_branch'] || 'Salt Lake Sector V'}`, 18, finalY + 23);
    
    if (inv.paymentMethod) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Paid via: ${inv.paymentMethod} (${inv.transactionId || 'Ref: ' + inv.referenceNumber || 'N/A'})`, 18, finalY + 30);
      doc.text(`Payment Date: ${new Date(inv.paymentDate || '').toLocaleDateString('en-IN')}`, 18, finalY + 34);
    }

    // Build Payment Receipt Details / History
    let paymentsList = [];
    if (inv.payments && inv.payments.length > 0) {
      paymentsList = inv.payments;
    } else if (inv.paidAmount > 0 && inv.paymentMethod) {
      paymentsList = [{
        amountPaid: inv.paidAmount,
        paymentDate: inv.paymentDate || inv.updatedAt || new Date(),
        paymentMethod: inv.paymentMethod,
        referenceNumber: inv.referenceNumber,
        transactionId: inv.transactionId,
        paymentNotes: inv.paymentNotes
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
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
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
      currentYOffset = (doc as any).lastAutoTable?.finalY + 10;
    }

    // SIGNATURES & TERMS
    const tCStart = currentYOffset + 4;
    


    // Digital Signatory section
    doc.setTextColor(50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`For ${(settingsMap['company_name'] || 'DIGIEX WEB SERVICES PVT LTD').toUpperCase()}`, 130, tCStart + 5);
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Digital Signature Approved', 135, tCStart + 18);

    doc.line(130, tCStart + 22, 195, tCStart + 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(50);
    doc.text('Authorized Signatory', 145, tCStart + 26);

    // Footer copyright
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Thank you for your business! This is a system-generated computer tax invoice.', 105, 290, { align: 'center' });

    // Trigger PDF download
    doc.save(`${inv.invoiceNumber}_Invoice.pdf`);
  };

  // Helper to open PDF in a new tab for printing
  const printInvoice = (inv: Invoice) => {
    // Generate invoice and open printable window
    downloadInvoicePDF(inv);
  };

  // KPI Calculations
  const calculatedKPIs = () => {
    const totalCount = invoices.length;
    const paidInvoices = invoices.filter(i => i.status === 'Paid');
    const unpaidInvoices = invoices.filter(i => ['Unpaid', 'Pending'].includes(i.status));
    const partiallyPaid = invoices.filter(i => i.status === 'Partially Paid');
    const overdueInvoices = invoices.filter(i => i.status === 'Overdue' || (i.dueAmount > 0 && new Date(i.dueDate) < new Date() && i.status !== 'Paid'));

    const totalRev = paidInvoices.reduce((acc, curr) => acc + curr.total, 0) + 
                     partiallyPaid.reduce((acc, curr) => acc + curr.paidAmount, 0);

    const outstandingBalance = invoices.reduce((acc, curr) => acc + curr.dueAmount, 0);

    // Calculate GST Collected
    const gstVal = invoices.reduce((acc, curr) => {
      if (curr.status === 'Paid') {
        return acc + curr.tax;
      } else if (curr.status === 'Partially Paid') {
        const ratio = curr.total > 0 ? curr.paidAmount / curr.total : 0;
        return acc + (curr.tax * ratio);
      }
      return acc;
    }, 0);

    return {
      totalCount,
      paidCount: paidInvoices.length,
      unpaidCount: unpaidInvoices.length,
      partiallyPaidCount: partiallyPaid.length,
      overdueCount: overdueInvoices.length,
      totalRev,
      outstandingBalance,
      gstVal
    };
  };

  const kpis = calculatedKPIs();

  // Search, Filters & Sorting logic
  const getFilteredInvoices = () => {
    return invoices.filter(inv => {
      const matchSearch = inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || 
                          (inv.clientCompanyName || '').toLowerCase().includes(search.toLowerCase()) ||
                          (inv.clientContactPerson || '').toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter ? inv.status === statusFilter : true;
      
      const matchClient = clientFilter ? (inv.client?._id === clientFilter || inv.client === clientFilter) : true;
      
      const matchStart = startDateFilter ? new Date(inv.createdAt || '') >= new Date(startDateFilter) : true;
      
      const matchEnd = endDateFilter ? new Date(inv.createdAt || '') <= new Date(endDateFilter) : true;

      return matchSearch && matchStatus && matchClient && matchStart && matchEnd;
    });
  };

  const filteredInvoices = getFilteredInvoices();
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const displayedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="invoice-module-container" style={{ padding: '20px' }}>
      
      {/* Top Breadcrumb & Status Feedbacks */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b' }}>
            {activeView === 'list' ? 'Invoice & Revenue Management' : activeView === 'create' ? 'Create New Tax Invoice' : 'Edit Invoice details'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            Accounts → Invoices
          </p>
        </div>
        
        {/* Navigation actions */}
        <div>
          {activeView === 'list' ? (
            (!isClient) && (
              <button 
                onClick={() => { resetForm(); setActiveView('create'); }}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}
              >
                <Plus size={18} /> Create Invoice
              </button>
            )
          ) : (
            <button 
              onClick={() => { resetForm(); setActiveView('list'); }}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 600 }}
            >
              Cancel & Return
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Alerts */}
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

      {activeView === 'list' && (
        <>
          {/* Glassmorphism Metric Widgets Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            
            {/* Widget 1: Revenue */}
            <div className="chart-card" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Total Revenue</span>
                <TrendingUp size={20} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '10px' }}>INR {kpis.totalRev.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <div style={{ fontSize: '11px', color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>From Paid & Partially Paid Invoices</span>
              </div>
            </div>

            {/* Widget 2: Outstanding */}
            <div className="chart-card" style={{ background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', padding: '20px', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Outstanding Balance</span>
                <DollarSign size={20} color="#f59e0b" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '10px', color: '#1e293b' }}>INR {kpis.outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px' }}>
                Total outstanding due collections
              </div>
            </div>

            {/* Widget 3: GST Collected */}
            <div className="chart-card" style={{ background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', padding: '20px', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Total GST Collected</span>
                <BarChart2 size={20} color="#3b82f6" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '10px', color: '#1e293b' }}>INR {kpis.gstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '6px' }}>
                Calculated on prorated paid portions
              </div>
            </div>

            {/* Widget 4: Counts */}
            <div className="chart-card" style={{ background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', padding: '20px', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Invoice Status</span>
                <Receipt size={20} color="#6366f1" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                <div style={{ background: '#ecfdf5', padding: '6px 10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#059669' }}>{kpis.paidCount}</div>
                  <div style={{ fontSize: '9px', color: '#059669', fontWeight: 600 }}>Paid</div>
                </div>
                <div style={{ background: '#fef2f2', padding: '6px 10px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>{kpis.overdueCount}</div>
                  <div style={{ fontSize: '9px', color: '#dc2626', fontWeight: 600 }}>Overdue</div>
                </div>
              </div>
            </div>

          </div>

          {/* Filters Bar */}
          <div className="chart-card" style={{ padding: '18px', borderRadius: '12px', background: 'white', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', alignItems: 'end' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Search Invoice / Client</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ paddingLeft: '32px', marginBottom: 0 }}
                    placeholder="INV-XXXX or Client Name..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Payment Status</label>
                <select 
                  className="input-field" 
                  style={{ marginBottom: 0 }}
                  value={statusFilter} 
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {(!isClient) && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Filter by Client</label>
                  <select 
                    className="input-field" 
                    style={{ marginBottom: 0 }}
                    value={clientFilter} 
                    onChange={(e) => { setClientFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="">All Clients</option>
                    {clients.map(c => (
                      <option key={c._id} value={c._id}>{c.companyName} ({c.name})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Start Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  style={{ marginBottom: 0 }}
                  value={startDateFilter}
                  onChange={(e) => { setStartDateFilter(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>End Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  style={{ marginBottom: 0 }}
                  value={endDateFilter}
                  onChange={(e) => { setEndDateFilter(e.target.value); setCurrentPage(1); }}
                />
              </div>

            </div>
          </div>

          {/* Invoices Table List */}
          <div className="chart-card" style={{ padding: 0, borderRadius: '12px', overflow: 'hidden', background: 'white' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '16px' }}>Invoice No</th>
                  <th style={{ padding: '16px' }}>Client & Contact</th>
                  <th style={{ padding: '16px' }}>Issue / Due Date</th>
                  <th style={{ padding: '16px' }}>Total Amount</th>
                  <th style={{ padding: '16px' }}>Balance Due</th>
                  <th style={{ padding: '16px' }}>Status</th>
                  <th style={{ padding: '16px' }}>Recurring</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
                      Loading Invoices...
                    </td>
                  </tr>
                ) : displayedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      No invoices found matching current filters.
                    </td>
                  </tr>
                ) : (
                  displayedInvoices.map((inv) => {
                    const isInvoiceOverdue = inv.dueAmount > 0 && new Date(inv.dueDate) < new Date() && inv.status !== 'Paid';
                    return (
                      <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px', fontWeight: 600, color: '#1e293b' }}>
                          {inv.invoiceNumber}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 600, color: '#334155' }}>{inv.clientCompanyName || inv.client?.companyName || 'N/A'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{inv.clientContactPerson || inv.client?.name || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontSize: '13px', color: '#334155' }}>
                            📅 {new Date(inv.createdAt || '').toLocaleDateString('en-IN')}
                          </div>
                          <div style={{ fontSize: '11px', color: isInvoiceOverdue ? '#dc2626' : '#64748b', fontWeight: isInvoiceOverdue ? 600 : 'normal' }}>
                            Due: {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                          </div>
                        </td>
                        <td style={{ padding: '16px', fontWeight: 700, color: '#1e293b' }}>
                          INR {inv.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '16px', fontWeight: 700, color: inv.dueAmount > 0 ? '#dc2626' : '#059669' }}>
                          INR {inv.dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            fontSize: '11px', 
                            fontWeight: 700,
                            background: inv.status === 'Paid' ? '#d1fae5' : inv.status === 'Partially Paid' ? '#cffafe' : isInvoiceOverdue || inv.status === 'Overdue' ? '#fee2e2' : '#fef3c7',
                            color: inv.status === 'Paid' ? '#065f46' : inv.status === 'Partially Paid' ? '#0891b2' : isInvoiceOverdue || inv.status === 'Overdue' ? '#b91c1c' : '#b45309'
                          }}>
                            {isInvoiceOverdue ? 'Overdue' : inv.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          {inv.isRecurring ? (
                            <span style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              🔄 {inv.recurringCycle}
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>One-time</span>
                          )}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              onClick={() => { setSelectedInvoice(inv); setShowDetailModal(true); }}
                              className="btn-secondary" 
                              style={{ padding: '6px', borderRadius: '6px', minWidth: 'auto', background: '#f8fafc' }}
                              title="View Invoice & Audit Log"
                            >
                              <Eye size={16} color="#64748b" />
                            </button>
                            <button 
                              onClick={() => downloadInvoicePDF(inv)}
                              className="btn-secondary" 
                              style={{ padding: '6px', borderRadius: '6px', minWidth: 'auto', background: '#f0fdf4' }}
                              title="Download PDF"
                            >
                              <Download size={16} color="#16a34a" />
                            </button>
                            
                            {/* Actions restricted to Admin, Accounts, Sales */}
                            {!isClient && (
                              <>
                                {(isAdmin || isAccounts) && (
                                  <button 
                                    onClick={() => openEditForm(inv)}
                                    className="btn-secondary" 
                                    style={{ padding: '6px', borderRadius: '6px', minWidth: 'auto', background: '#eff6ff' }}
                                    title="Edit Invoice"
                                  >
                                    <Edit size={16} color="#2563eb" />
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleCloneInvoice(inv._id || '')}
                                  className="btn-secondary" 
                                  style={{ padding: '6px', borderRadius: '6px', minWidth: 'auto', background: '#faf5ff' }}
                                  title="Clone Invoice"
                                >
                                  <Copy size={16} color="#7c3aed" />
                                </button>
                                {(isAdmin || isAccounts) && inv.dueAmount > 0 && (
                                  <button 
                                    onClick={() => openPaymentModal(inv)}
                                    className="btn-secondary" 
                                    style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '12px', background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', fontWeight: 600 }}
                                  >
                                    💳 Pay
                                  </button>
                                )}
                                {(isAdmin || isAccounts) && (
                                  <button 
                                    onClick={() => handleDeleteInvoice(inv._id || '')}
                                    className="btn-secondary" 
                                    style={{ padding: '6px', borderRadius: '6px', minWidth: 'auto', background: '#fff5f5' }}
                                    title="Delete Invoice"
                                  >
                                    <Trash2 size={16} color="#dc2626" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Showing page {currentPage} of {totalPages} ({filteredInvoices.length} invoices total)
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    Previous
                  </button>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* CREATE / EDIT INVOICE VIEW */}
      {(activeView === 'create' || activeView === 'edit') && (
        <form onSubmit={handleCreateOrUpdateInvoice} className="auth-form" style={{ maxWidth: '100%', background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <h2 style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '24px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
            {activeView === 'create' ? 'Create New Tax Invoice' : `Edit Invoice: ${invoiceNumber}`}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            
            <div className="form-group">
              <label>Client Selection *</label>
              <select 
                className="input-field" 
                value={selectedClient} 
                onChange={(e) => handleClientChange(e.target.value)}
                required
              >
                <option value="">-- Choose Client --</option>
                {clients.map(c => (
                  <option key={c._id} value={c._id}>{c.companyName} ({c.name})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Invoice Date *</label>
              <input 
                type="date" 
                className="input-field" 
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Due Date *</label>
              <input 
                type="date" 
                className="input-field" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Custom Invoice Number (Leave empty to auto-generate)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. INV-2026-0001"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                disabled={activeView === 'edit'} // block changes to inv number on edits
              />
            </div>

          </div>

          {/* Client Specific Business Details Box */}
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Client Business Info & Billing Address (Historical capture)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Company Name</label>
                <input type="text" className="input-field" style={{ fontSize: '13px', padding: '8px' }} value={clientCompanyName} onChange={(e) => setClientCompanyName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Contact Person</label>
                <input type="text" className="input-field" style={{ fontSize: '13px', padding: '8px' }} value={clientContactPerson} onChange={(e) => setClientContactPerson(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Phone Number</label>
                <input type="text" className="input-field" style={{ fontSize: '13px', padding: '8px' }} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Email</label>
                <input type="email" className="input-field" style={{ fontSize: '13px', padding: '8px' }} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px', color: '#64748b' }}>GSTIN Number</label>
                <input type="text" className="input-field" style={{ fontSize: '13px', padding: '8px' }} value={clientGstNumber} onChange={(e) => setClientGstNumber(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Billing State</label>
                <input type="text" className="input-field" style={{ fontSize: '13px', padding: '8px' }} placeholder="e.g. West Bengal" value={clientState} onChange={(e) => setClientState(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px', color: '#64748b' }}>Billing Country</label>
                <input type="text" className="input-field" style={{ fontSize: '13px', padding: '8px' }} value={clientCountry} onChange={(e) => setClientCountry(e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
              <label style={{ fontSize: '11px', color: '#64748b' }}>Complete Address</label>
              <textarea rows={2} className="input-field" style={{ fontSize: '13px', padding: '8px' }} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
            </div>
          </div>

          {/* Dynamic Invoice Items Grid */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Line Items (Taxable Services)</h4>
              <button 
                type="button" 
                onClick={addLineItem}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontWeight: 600 }}
              >
                <Plus size={14} /> Add Item Row
              </button>
            </div>

            {invoiceItems.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 0.6fr 1fr 1fr 0.8fr 1fr 0.2fr', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', marginBottom: '10px' }}>
                
                {/* Service Dropdown/Name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>Service Name</label>
                  <select 
                    className="input-field"
                    style={{ fontSize: '12px', padding: '6px', marginBottom: 0 }}
                    value={item.serviceName}
                    onChange={(e) => handleItemFieldChange(idx, 'serviceName', e.target.value)}
                  >
                    <option value="">-- Choose Master Service --</option>
                    {services.map(s => (
                      <option key={s._id} value={s.name}>{s.name}</option>
                    ))}
                    <option value="Custom Service">Custom Service (Type in Description)</option>
                  </select>
                </div>

                {/* Description */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>Description *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ fontSize: '12px', padding: '6px', marginBottom: 0 }}
                    placeholder="Provide details..."
                    value={item.description}
                    onChange={(e) => handleItemFieldChange(idx, 'description', e.target.value)}
                    required
                  />
                </div>

                {/* Quantity */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>Quantity</label>
                  <input 
                    type="number" 
                    min={1}
                    className="input-field" 
                    style={{ fontSize: '12px', padding: '6px', marginBottom: 0 }}
                    value={item.quantity}
                    onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                  />
                </div>

                {/* Unit Price */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>Unit Price (INR)</label>
                  <input 
                    type="number" 
                    min={0}
                    className="input-field" 
                    style={{ fontSize: '12px', padding: '6px', marginBottom: 0 }}
                    value={item.unitPrice}
                    onChange={(e) => handleItemFieldChange(idx, 'unitPrice', e.target.value)}
                  />
                </div>

                {/* Discount */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>Discount (INR)</label>
                  <input 
                    type="number" 
                    min={0}
                    className="input-field" 
                    style={{ fontSize: '12px', padding: '6px', marginBottom: 0 }}
                    value={item.discount}
                    onChange={(e) => handleItemFieldChange(idx, 'discount', e.target.value)}
                  />
                </div>

                {/* GST Rate */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '10px', color: '#64748b' }}>GST %</label>
                  <select 
                    className="input-field" 
                    style={{ fontSize: '12px', padding: '6px', marginBottom: 0 }}
                    value={item.gstRate}
                    onChange={(e) => handleItemFieldChange(idx, 'gstRate', e.target.value)}
                  >
                    <option value={18}>18%</option>
                    <option value={12}>12%</option>
                    <option value={5}>5%</option>
                    <option value={28}>28%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>

                {/* Row Total */}
                <div style={{ textAlign: 'right', paddingRight: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Item Total</div>
                  <strong style={{ fontSize: '13px', color: '#1e293b' }}>INR {item.total.toFixed(2)}</strong>
                </div>

                {/* Row Actions */}
                <div style={{ marginTop: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => removeLineItem(idx)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
                    onMouseOver={e => e.currentTarget.style.color = '#dc2626'}
                    onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
                    title="Remove item"
                  >
                    <X size={18} />
                  </button>
                </div>

              </div>
            ))}
          </div>

          {/* Totals Summary and Invoice Settings Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
            
            {/* Left: Notes & Recurring Automation */}
            <div>
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={14} /> Recurring billing scheduler configuration
                </h4>
                
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isRecurring ? '12px' : 0 }}>
                  <input 
                    type="checkbox" 
                    id="isRecurring" 
                    checked={isRecurring} 
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="isRecurring" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#334155' }}>
                    Enable Recurring Automation for this Invoice series
                  </label>
                </div>

                {isRecurring && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', color: '#64748b' }}>Billing Interval Cycle</label>
                    <select 
                      className="input-field"
                      style={{ fontSize: '13px', padding: '8px', marginBottom: 0 }}
                      value={recurringCycle}
                      onChange={(e) => setRecurringCycle(e.target.value)}
                    >
                      <option value="Monthly">Monthly (+1 Month)</option>
                      <option value="Quarterly">Quarterly (+3 Months)</option>
                      <option value="Half-Yearly">Half-Yearly (+6 Months)</option>
                      <option value="Yearly">Yearly (+1 Year)</option>
                    </select>
                    <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#6366f1' }}>
                      ℹ️ System will automatically generate a new unpaid invoice at the end of each billing cycle date.
                    </p>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Special Terms & Payment Notes (Included in PDF)</label>
                <textarea 
                  rows={3} 
                  className="input-field" 
                  placeholder="Notes shown on invoice..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Right: Calculations Summary Details */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                Summary Calculations
              </h4>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                <span>Subtotal (Excl. Tax)</span>
                <span>INR {calcSubtotal().toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                <span>Total Item Discounts</span>
                <span>- INR {calcDiscount().toFixed(2)}</span>
              </div>
              
              <div style={{ borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                <span>Central GST (CGST)</span>
                <span>INR {cgst.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                <span>State GST (SGST)</span>
                <span>INR {sgst.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                <span>Integrated GST (IGST)</span>
                <span>INR {igst.toFixed(2)}</span>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                <span>Grand Total (Incl. Tax)</span>
                <span>INR {calcGrandTotal().toFixed(2)}</span>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={submitLoading} 
                  style={{ flex: 1, padding: '12px', fontWeight: 700 }}
                >
                  {submitLoading ? 'Saving...' : activeView === 'create' ? 'Create & Publish' : 'Update & Log'}
                </button>
                <button 
                  type="button" 
                  onClick={() => { resetForm(); setActiveView('list'); }}
                  className="btn-secondary" 
                  style={{ padding: '12px', fontWeight: 700 }}
                >
                  Cancel
                </button>
              </div>

            </div>

          </div>

        </form>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && paymentInvoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleRecordPayment} className="auth-form" style={{ width: '100%', maxWidth: '520px', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                Record Payment: {paymentInvoice.invoiceNumber}
              </h3>
              <button 
                type="button" 
                onClick={() => { setShowPaymentModal(false); setPaymentInvoice(null); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Total Invoice Amount</span>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>INR {paymentInvoice.total.toFixed(2)}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Outstanding Due Amount</span>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>INR {paymentInvoice.dueAmount.toFixed(2)}</div>
              </div>
            </div>

            <div className="form-group">
              <label>Amount Collected (INR) *</label>
              <input 
                type="number" 
                min={0.1}
                step="any"
                className="input-field" 
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Payment Method *</label>
                <select className="input-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT / IMPS / RTGS)</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Razorpay">Razorpay Card / Netbanking</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Payment Date *</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={paymentDate} 
                  onChange={(e) => setPaymentDate(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Transaction ID / UPI Ref</label>
                <input type="text" className="input-field" placeholder="e.g. TXN987654..." value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Bank Name (Optional)</label>
                <input type="text" className="input-field" placeholder="e.g. HDFC Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label>Reference Number (Cheque / DD No){paymentMethod === 'Cheque' && ' *'}</label>
              <input type="text" className="input-field" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} required={paymentMethod === 'Cheque'} />
            </div>

            {paymentMethod === 'Cheque' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Account Number *</label>
                  <input type="text" className="input-field" placeholder="Enter account number" value={chequeAccountNumber} onChange={(e) => setChequeAccountNumber(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>IFSC Number *</label>
                  <input type="text" className="input-field" placeholder="Enter IFSC code" value={chequeIfscNumber} onChange={(e) => setChequeIfscNumber(e.target.value)} required />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Payment Notes (Internal Audit Log details)</label>
              <textarea rows={2} className="input-field" placeholder="e.g. Partial advance received..." value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                Save Payment & Record
              </button>
              <button 
                type="button" 
                onClick={() => { setShowPaymentModal(false); setPaymentInvoice(null); }}
                className="btn-secondary" 
                style={{ flex: 1, padding: '12px' }}
              >
                Close
              </button>
            </div>

          </form>
        </div>
      )}

      {/* DETAIL VIEW & AUDIT LOG TIMELINE DRAWER */}
      {showDetailModal && selectedInvoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 }}>
          <div style={{ width: '100%', maxWidth: '680px', height: '100%', background: 'white', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.1)', padding: '24px', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
                  Invoice Details: {selectedInvoice.invoiceNumber}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Created: {new Date(selectedInvoice.createdAt || '').toLocaleString('en-IN')}</span>
              </div>
              <button 
                onClick={() => { setShowDetailModal(false); setSelectedInvoice(null); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Quick Summary card */}
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>CLIENT</span>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>{selectedInvoice.clientCompanyName || 'N/A'}</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>{selectedInvoice.clientContactPerson} ({selectedInvoice.clientEmail})</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>BILLING SUMMARY</span>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>Total: INR {selectedInvoice.total.toFixed(2)}</div>
                <div style={{ fontSize: '12px', color: selectedInvoice.dueAmount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  Balance Due: INR {selectedInvoice.dueAmount.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Print & Download actions */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
              <button 
                onClick={() => downloadInvoicePDF(selectedInvoice)}
                className="btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#16a34a' }}
              >
                <Download size={16} /> Download PDF Invoice
              </button>
              <button 
                onClick={() => printInvoice(selectedInvoice)}
                className="btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <FileText size={16} /> Print/View PDF
              </button>
            </div>

            {/* Invoice Line Items */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Line Items</h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Description</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Unit Price</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.items || []).map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: 600 }}>{item.serviceName}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{item.description}</div>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>INR {item.unitPrice.toFixed(2)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>INR {item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit History Timeline Log */}
            <div>
              <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeftRight size={16} /> Edit History Audit Trail Log
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingLeft: '10px', borderLeft: '2px solid #e2e8f0' }}>
                {(selectedInvoice.editHistory || []).map((history, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    
                    {/* Node Dot */}
                    <div style={{ position: 'absolute', left: '-16px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', border: '2px solid white' }} />

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                          Action: {history.action}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(history.updatedAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                        Performed by: <strong>{history.updatedByName || 'System'}</strong>
                      </div>

                      {/* Display Changed Fields */}
                      {history.previousValues && Object.keys(history.previousValues).length > 0 && (
                        <div style={{ background: 'white', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 600, color: '#475569' }}>Changed Fields:</span>
                          {Object.keys(history.previousValues).map((key) => {
                            const prev = typeof history.previousValues[key] === 'object' ? JSON.stringify(history.previousValues[key]) : history.previousValues[key];
                            const curr = typeof history.newValues[key] === 'object' ? JSON.stringify(history.newValues[key]) : history.newValues[key];
                            return (
                              <div key={key} style={{ display: 'flex', gap: '8px' }}>
                                <span style={{ fontFamily: 'monospace', color: '#4f46e5' }}>{key}:</span>
                                <span style={{ textDecoration: 'line-through', color: '#dc2626' }}>{prev !== undefined ? String(prev) : 'empty'}</span>
                                <span>→</span>
                                <span style={{ color: '#16a34a', fontWeight: 600 }}>{curr !== undefined ? String(curr) : 'empty'}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {history.action === 'CREATED' && history.newValues && (
                        <div style={{ fontSize: '11px', color: '#475569' }}>
                          Invoice published with invoice number: <strong>{history.newValues.invoiceNumber}</strong>, total: <strong>INR {history.newValues.total}</strong>
                        </div>
                      )}

                      {history.action === 'AUTO_GENERATED' && history.newValues && (
                        <div style={{ fontSize: '11px', color: '#475569' }}>
                          Generated via system scheduler from recurring series. Source: <strong>{history.newValues.sourceInvoice}</strong>
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
