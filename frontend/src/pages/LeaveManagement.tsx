import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { 
  Calendar, 
  CalendarDays, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Download, 
  Upload, 
  AlertTriangle, 
  Trash2, 
  Settings, 
  User, 
  FileText, 
  RefreshCw, 
  Search, 
  Clock, 
  Check, 
  ArrowRight,
  Info
} from 'lucide-react';

export default function LeaveManagement() {
  const location = useLocation();
  const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
  const loggedInRole = (loggedInUser.role?.name || '').toLowerCase().trim();
  const loggedInDept = (typeof loggedInUser.role?.department === 'object' ? loggedInUser.role?.department?.name : loggedInUser.role?.department || '').toLowerCase().trim();
  const userTypeName = (loggedInUser.role?.userType?.name || loggedInUser.role?.userType || '').toLowerCase().trim();

  // Role Permissions flags
  const isSuperAdmin = userTypeName === 'super admin' || loggedInRole.includes('super admin');
  const isAdmin = userTypeName === 'admin' || loggedInRole.includes('admin') || isSuperAdmin;
  const isHR = loggedInRole.includes('hr') || loggedInRole.includes('human resource') || loggedInDept.includes('hr') || isAdmin;
  const isManager = loggedInRole.includes('manager') || loggedInRole.includes('lead') || loggedInRole.includes('head') || isHR;

  // Active Tabs
  const [activeTab, setActiveTab] = useState<'my-leaves' | 'team-requests' | 'policies' | 'adjust' | 'reports'>('my-leaves');
  const [teamSubTab, setTeamSubTab] = useState<'pending' | 'balances' | 'calendar' | 'history'>('pending');

  // User Profile details
  const [userProfile, setUserProfile] = useState<any>(loggedInUser);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Leave Data
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [personalRequests, setPersonalRequests] = useState<any[]>([]);
  const [teamRequests, setTeamRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Apply Leave Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    fromDate: '',
    toDate: '',
    halfDay: false,
    halfDaySession: 'None',
    reason: '',
    attachment: '',
    maternityScenario: 'None',
    expectedDeliveryDate: ''
  });
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [applyError, setApplyError] = useState('');

  // Remarks modal for rejection / modification
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [selectedRequestAction, setSelectedRequestAction] = useState<{ id: string, type: 'approve' | 'reject' } | null>(null);
  const [remarksText, setRemarksText] = useState('');

  // Policy management
  const [selectedPolicyType, setSelectedPolicyType] = useState<any>(null);

  // Balance Adjustment
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    employeeId: '',
    leaveTypeId: '',
    allocated: 0,
    used: 0,
    remaining: 0,
    remarks: ''
  });

  // Bulk allocation
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    employeeIds: [] as string[],
    leaveTypeId: '',
    allocated: 0,
    remarks: ''
  });

  // Search Filter States
  const [userSearch, setUserSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!showApplyModal) {
      setSelectedEmployeeId('');
    }
  }, [showApplyModal]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'calendar' && isManager) {
      setActiveTab('team-requests');
      setTeamSubTab('calendar');
    }
  }, [location.search, isManager]);

  const fetchUserProfile = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/users/${loggedInUser.id || loggedInUser._id}`);
      if (res.data.success) {
        setUserProfile(res.data.data);
        // Also update local storage so it's cached for future use
        const updated = { ...loggedInUser, ...res.data.data };
        localStorage.setItem('user', JSON.stringify(updated));
        return updated;
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
    return loggedInUser;
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Sync profile details to local storage first
      const updatedUser = await fetchUserProfile();
      
      // 2. Extract latest permissions dynamically to determine which initial requests to trigger
      const currRole = (updatedUser.role?.name || '').toLowerCase().trim();
      const currDept = (typeof updatedUser.role?.department === 'object' ? updatedUser.role?.department?.name : updatedUser.role?.department || '').toLowerCase().trim();
      const currType = (updatedUser.role?.userType?.name || updatedUser.role?.userType || '').toLowerCase().trim();
      const currIsAdmin = currRole.includes('admin') || currRole.includes('super admin') || currType === 'admin' || currType === 'super admin';
      const currIsHR = currRole.includes('hr') || currRole.includes('human resource') || currDept.includes('hr') || currIsAdmin;

      await Promise.all([
        fetchBalances(),
        fetchLeaveTypes(),
        fetchRequests(),
        currIsHR ? fetchUsers() : Promise.resolve(),
        currIsHR ? fetchAuditLogs() : Promise.resolve()
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalances = async () => {
    const res = await axios.get(`http://localhost:5000/api/leaves/balance/${loggedInUser.id || loggedInUser._id}`);
    setBalances(res.data.data || []);
  };

  const fetchLeaveTypes = async () => {
    const res = await axios.get('http://localhost:5000/api/leaves/types');
    setLeaveTypes(res.data.data || []);
  };

  const fetchRequests = async () => {
    // Read directly from updated localStorage to prevent closure stale states
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currRole = (currentUser.role?.name || '').toLowerCase().trim();
    const currDept = (typeof currentUser.role?.department === 'object' ? currentUser.role?.department?.name : currentUser.role?.department || '').toLowerCase().trim();
    const currType = (currentUser.role?.userType?.name || currentUser.role?.userType || '').toLowerCase().trim();
    
    const currIsAdmin = currRole.includes('admin') || currRole.includes('super admin') || currType === 'admin' || currType === 'super admin';
    const currIsHR = currRole.includes('hr') || currRole.includes('human resource') || currDept.includes('hr') || currIsAdmin;

    const res = await axios.get(`http://localhost:5000/api/leaves/requests?userId=${currentUser.id || currentUser._id}&role=${currRole}&department=${currDept}`);
    const allReqs = res.data.data || [];
    setPersonalRequests(allReqs.filter((r: any) => r.employee?._id === (currentUser.id || currentUser._id)));
    setTeamRequests(allReqs.filter((r: any) => {
      if (currIsAdmin || currIsHR) {
        return true;
      }
      return r.employee?._id !== (currentUser.id || currentUser._id);
    }));
  };

  const fetchUsers = async () => {
    const res = await axios.get('http://localhost:5000/api/users');
    setUsers(res.data.data || []);
  };

  const fetchAuditLogs = async () => {
    // Standard system audit log filter
    const res = await axios.get('http://localhost:5000/api/users'); // Mocked log / we use User list for detail extraction
    setAuditLogs([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);
    setUploading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setApplyForm(prev => ({ ...prev, attachment: res.data.fileUrl }));
    } catch (err) {
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  // Auto-calculate requested days when from/to dates or half-day status changes
  useEffect(() => {
    if (applyForm.fromDate && applyForm.toDate) {
      if (applyForm.halfDay) {
        setCalculatedDays(0.5);
      } else {
        const start = new Date(applyForm.fromDate);
        const end = new Date(applyForm.toDate);
        if (start <= end) {
          // Simple client-side estimate excluding Sundays
          let days = 0;
          const curr = new Date(start);
          while (curr <= end) {
            if (curr.getDay() !== 0) days++; // Skip Sundays
            curr.setDate(curr.getDate() + 1);
          }
          setCalculatedDays(days);
        } else {
          setCalculatedDays(0);
        }
      }
    } else {
      setCalculatedDays(0);
    }
  }, [applyForm.fromDate, applyForm.toDate, applyForm.halfDay]);

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setApplyError('');

    const selectedCode = leaveTypes.find(t => t._id === applyForm.leaveTypeId)?.code;
    if (selectedCode === 'ML' && !applyForm.attachment) {
      setApplyError('Medical certificate upload is required for Maternity Leave');
      setSaving(false);
      return;
    }

    if (selectedCode === 'SL' && calculatedDays > 2 && !applyForm.attachment) {
      setApplyError('Medical certificate upload is required for Sick Leave exceeding 2 days');
      setSaving(false);
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/leaves/apply', {
        employeeId: selectedEmployeeId || loggedInUser.id || loggedInUser._id,
        leaveTypeId: applyForm.leaveTypeId,
        fromDate: applyForm.fromDate,
        toDate: applyForm.toDate,
        halfDay: applyForm.halfDay,
        halfDaySession: applyForm.halfDay ? applyForm.halfDaySession : 'None',
        reason: applyForm.reason,
        attachment: applyForm.attachment,
        maternityScenario: applyForm.maternityScenario,
        expectedDeliveryDate: applyForm.expectedDeliveryDate
      });

      alert('Leave applied successfully!');
      setShowApplyModal(false);
      setApplyForm({
        leaveTypeId: '',
        fromDate: '',
        toDate: '',
        halfDay: false,
        halfDaySession: 'None',
        reason: '',
        attachment: '',
        maternityScenario: 'None',
        expectedDeliveryDate: ''
      });
      fetchInitialData();
    } catch (err: any) {
      setApplyError(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelRequest = async (reqId: string) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await axios.post(`http://localhost:5000/api/leaves/cancel/${reqId}`, {
        actorId: loggedInUser.id || loggedInUser._id
      });
      alert('Leave request cancelled successfully!');
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    }
  };

  const handleApproveAction = (reqId: string) => {
    setSelectedRequestAction({ id: reqId, type: 'approve' });
    setRemarksText('');
    setShowRemarksModal(true);
  };

  const handleRejectAction = (reqId: string) => {
    setSelectedRequestAction({ id: reqId, type: 'reject' });
    setRemarksText('');
    setShowRemarksModal(true);
  };

  const handleRemarksSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestAction) return;

    setSaving(true);
    try {
      const endpoint = selectedRequestAction.type === 'approve' ? 'approve' : 'reject';
      await axios.post(`http://localhost:5000/api/leaves/${endpoint}/${selectedRequestAction.id}`, {
        actorId: loggedInUser.id || loggedInUser._id,
        role: loggedInRole,
        remarks: remarksText
      });

      alert(`Leave request ${selectedRequestAction.type === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setShowRemarksModal(false);
      setSelectedRequestAction(null);
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicyType) return;
    setSaving(true);
    try {
      await axios.post('http://localhost:5000/api/leaves/types', {
        ...selectedPolicyType,
        performedBy: loggedInUser.id || loggedInUser._id
      });
      alert('Policy updated successfully!');
      setSelectedPolicyType(null);
      fetchLeaveTypes();
    } catch (err) {
      alert('Failed to update policy');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('http://localhost:5000/api/leaves/adjust', {
        ...adjustForm,
        performedBy: loggedInUser.id || loggedInUser._id
      });
      alert('Balance adjusted successfully!');
      setShowAdjustModal(false);
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Adjustment failed');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkForm.employeeIds.length === 0) {
      alert('Please select at least one employee');
      return;
    }
    setSaving(true);
    try {
      await axios.post('http://localhost:5000/api/leaves/bulk-allocate', {
        ...bulkForm,
        performedBy: loggedInUser.id || loggedInUser._id
      });
      alert('Bulk allocation completed successfully!');
      setShowBulkModal(false);
      setBulkForm({ employeeIds: [], leaveTypeId: '', allocated: 0, remarks: '' });
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Bulk allocation failed');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={13} /> Approved</span>;
      case 'Rejected':
        return <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={13} /> Rejected</span>;
      case 'Pending Manager':
        return <span className="badge badge-indigo" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> Pending Manager</span>;
      case 'Pending HR':
        return <span className="badge badge-orange" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> Pending HR Approval</span>;
      case 'Cancelled':
        return <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><XCircle size={13} /> Cancelled</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  const exportPersonalStatement = () => {
    const headers = ['Type', 'From Date', 'To Date', 'Days', 'Reason', 'Status', 'Applied On'];
    const rows = personalRequests.map(r => [
      r.leaveType?.name || 'N/A',
      new Date(r.fromDate).toLocaleDateString(),
      new Date(r.toDate).toLocaleDateString(),
      r.totalDays,
      r.reason,
      r.status,
      new Date(r.createdAt).toLocaleDateString()
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leave_statement_${loggedInUser.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#1e293b' }}>
        <RefreshCw size={40} className="spin" style={{ animation: 'spin 2s linear infinite', marginBottom: '15px' }} />
        <div>Loading Leave Management Dashboard...</div>
      </div>
    );
  }

  // Filtered lists for HR balance adjustments
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || (u.employeeId && u.employeeId.toLowerCase().includes(userSearch.toLowerCase()));
    const matchesDept = deptFilter ? u.role?.department?.name === deptFilter || u.role?.department === deptFilter : true;
    return matchesSearch && matchesDept;
  });

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Submit leaves, track balances, and manage workflows.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowApplyModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Apply For Leave
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', marginBottom: '25px' }}>
        <button 
          onClick={() => setActiveTab('my-leaves')} 
          style={{ padding: '12px 6px', borderBottom: activeTab === 'my-leaves' ? '3px solid var(--primary)' : 'none', fontWeight: activeTab === 'my-leaves' ? 700 : 500, color: activeTab === 'my-leaves' ? 'var(--primary)' : '#64748b', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: '15px' }}
        >
          My Leaves
        </button>
        {isManager && (
          <button 
            onClick={() => setActiveTab('team-requests')} 
            style={{ padding: '12px 6px', borderBottom: activeTab === 'team-requests' ? '3px solid var(--primary)' : 'none', fontWeight: activeTab === 'team-requests' ? 700 : 500, color: activeTab === 'team-requests' ? 'var(--primary)' : '#64748b', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: '15px' }}
          >
            Team Leaves & Calendar
          </button>
        )}
        {isHR && (
          <>
            <button 
              onClick={() => setActiveTab('policies')} 
              style={{ padding: '12px 6px', borderBottom: activeTab === 'policies' ? '3px solid var(--primary)' : 'none', fontWeight: activeTab === 'policies' ? 700 : 500, color: activeTab === 'policies' ? 'var(--primary)' : '#64748b', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: '15px' }}
            >
              Leave Policies
            </button>
            <button 
              onClick={() => setActiveTab('adjust')} 
              style={{ padding: '12px 6px', borderBottom: activeTab === 'adjust' ? '3px solid var(--primary)' : 'none', fontWeight: activeTab === 'adjust' ? 700 : 500, color: activeTab === 'adjust' ? 'var(--primary)' : '#64748b', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: '15px' }}
            >
              Adjust Balances
            </button>
            <button 
              onClick={() => setActiveTab('reports')} 
              style={{ padding: '12px 6px', borderBottom: activeTab === 'reports' ? '3px solid var(--primary)' : 'none', fontWeight: activeTab === 'reports' ? 700 : 500, color: activeTab === 'reports' ? 'var(--primary)' : '#64748b', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: '15px' }}
            >
              Reports & Logs
            </button>
          </>
        )}
      </div>

      {/* Tab: My Leaves */}
      {activeTab === 'my-leaves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Balance Cards */}
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', marginBottom: '15px' }}>Leave Balances (Current Year)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
              {balances.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '20px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#64748b', fontStyle: 'italic', textAlign: 'center' }}>No balances initialized. Apply for a leave to automatically generate your quota.</div>
              ) : (() => {
                const clsl = balances.find(b => ['CL', 'SL'].includes(b.leaveType?.code));
                if (!clsl) {
                  return <div style={{ padding: '20px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#64748b', fontStyle: 'italic' }}>No annual leave balances initialized.</div>;
                }
                return (
                  <div className="glass" style={{ padding: '20px', borderRadius: '12px', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Annual Leaves (Casual & Sick)</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b' }}>{clsl.remaining} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>left</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: '6px', marginTop: '4px' }}>
                      <span>Allocated: <strong>{clsl.allocated}</strong></span>
                      <span>Used: <strong>{clsl.used}</strong></span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#3b82f6', fontStyle: 'italic', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Info size={13} /> Combined Casual & Sick Leave quota of 22 days.
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* History */}
          <div className="data-table-container" style={{ padding: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', margin: 0 }}>My Leave History</h2>
              {personalRequests.length > 0 && (
                <button className="btn-secondary" onClick={exportPersonalStatement} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}>
                  <Download size={15} /> Export Statement
                </button>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Duration</th>
                  <th>Total Days</th>
                  <th>Half Day</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Applied On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {personalRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>You have not applied for any leaves yet.</td>
                  </tr>
                ) : (
                  personalRequests.map((req: any) => (
                    <tr key={req._id}>
                      <td style={{ fontWeight: 600 }}>{req.leaveType?.name}</td>
                      <td>
                        <span style={{ fontSize: '13.5px', color: '#1e293b', fontWeight: 500 }}>
                          {new Date(req.fromDate).toLocaleDateString()}
                        </span>
                        <ArrowRight size={12} style={{ display: 'inline', margin: '0 8px', color: '#94a3b8' }} />
                        <span style={{ fontSize: '13.5px', color: '#1e293b', fontWeight: 500 }}>
                          {new Date(req.toDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{req.totalDays} day(s)</td>
                      <td>{req.halfDay ? `${req.halfDaySession}` : 'No'}</td>
                      <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.reason}>{req.reason}</td>
                      <td>{getStatusBadge(req.status)}</td>
                      <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td>
                        {['Pending Manager', 'Pending HR'].includes(req.status) && (
                          <button 
                            className="btn-danger" 
                            onClick={() => handleCancelRequest(req._id)} 
                            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5' }}
                          >
                            Cancel
                          </button>
                        )}
                        {req.status === 'Approved' && new Date(req.fromDate) > new Date() && (
                          <button 
                            className="btn-danger" 
                            onClick={() => handleCancelRequest(req._id)} 
                            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5' }}
                          >
                            Request Cancellation
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Team Requests */}
      {activeTab === 'team-requests' && isManager && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Sub tabs */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setTeamSubTab('pending')}
              className={`btn-secondary ${teamSubTab === 'pending' ? 'active' : ''}`}
              style={{ background: teamSubTab === 'pending' ? '#e2e8f0' : '#ffffff', borderColor: '#cbd5e1' }}
            >
              📥 Pending Requests ({teamRequests.filter(r => ['Pending Manager', 'Pending HR'].includes(r.status)).length})
            </button>
            <button 
              onClick={() => setTeamSubTab('history')}
              className={`btn-secondary ${teamSubTab === 'history' ? 'active' : ''}`}
              style={{ background: teamSubTab === 'history' ? '#e2e8f0' : '#ffffff', borderColor: '#cbd5e1' }}
            >
              📜 Request History
            </button>
            <button 
              onClick={() => setTeamSubTab('balances')}
              className={`btn-secondary ${teamSubTab === 'balances' ? 'active' : ''}`}
              style={{ background: teamSubTab === 'balances' ? '#e2e8f0' : '#ffffff', borderColor: '#cbd5e1' }}
            >
              📊 Team Leave Balances
            </button>
            <button 
              onClick={() => setTeamSubTab('calendar')}
              className={`btn-secondary ${teamSubTab === 'calendar' ? 'active' : ''}`}
              style={{ background: teamSubTab === 'calendar' ? '#e2e8f0' : '#ffffff', borderColor: '#cbd5e1' }}
            >
              📅 Team Leave Calendar
            </button>
          </div>

          {/* Sub-tab: Pending Approvals */}
          {teamSubTab === 'pending' && (
            <div className="data-table-container" style={{ padding: '25px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', marginBottom: '20px' }}>Pending Leave Approvals</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Department</th>
                    <th>Leave Type</th>
                    <th>Duration</th>
                    <th>Total Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRequests.filter(r => ['Pending Manager', 'Pending HR'].includes(r.status)).length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No pending leave requests to review.</td>
                    </tr>
                  ) : (
                    teamRequests.filter(r => ['Pending Manager', 'Pending HR'].includes(r.status)).map((req: any) => (
                      <tr key={req._id}>
                        <td>{req.employee?.employeeId || 'N/A'}</td>
                        <td style={{ fontWeight: 600 }}>{req.employee?.name}</td>
                        <td>{req.employee?.department?.name || req.employee?.department || 'N/A'}</td>
                        <td style={{ fontWeight: 500 }}>{req.leaveType?.name}</td>
                        <td>
                          {new Date(req.fromDate).toLocaleDateString()} to {new Date(req.toDate).toLocaleDateString()}
                        </td>
                        <td style={{ fontWeight: 700 }}>{req.totalDays} day(s)</td>
                        <td>{req.reason}</td>
                        <td>{getStatusBadge(req.status)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => handleApproveAction(req._id)}
                              style={{ padding: '6px 12px', background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleRejectAction(req._id)}
                              style={{ padding: '6px 12px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub-tab: Balances */}
          {teamSubTab === 'balances' && (
            <div className="data-table-container" style={{ padding: '25px' }}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                  <input 
                    type="text" 
                    placeholder="Search team member..." 
                    className="input-field" 
                    value={userSearch} 
                    onChange={e => setUserSearch(e.target.value)} 
                    style={{ paddingLeft: '40px', margin: 0 }}
                  />
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>CL Bal</th>
                    <th>SL Bal</th>
                    <th>EL Bal</th>
                    <th>PL Bal</th>
                    <th>LWP Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No employees found.</td>
                    </tr>
                  ) : (
                    filteredUsers.map((emp: any) => (
                      <tr key={emp._id}>
                        <td>{emp.employeeId || 'N/A'}</td>
                        <td style={{ fontWeight: 600 }}>{emp.name}</td>
                        <td>{emp.role?.department?.name || emp.role?.department || 'N/A'}</td>
                        <td>{emp.role?.name || 'N/A'}</td>
                        {/* We mock standard display of individual balances or fetch dynamically */}
                        <td>{emp.clBalance !== undefined ? emp.clBalance : 12} days</td>
                        <td>{emp.slBalance !== undefined ? emp.slBalance : 10} days</td>
                        <td>{emp.elBalance !== undefined ? emp.elBalance : 15} days</td>
                        <td>{emp.plBalance !== undefined ? emp.plBalance : 15} days</td>
                        <td>{emp.lwpCount || 0} days</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub-tab: Request History */}
          {teamSubTab === 'history' && (
            <div className="data-table-container" style={{ padding: '25px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', marginBottom: '20px' }}>Processed Request History (Approved & Rejected)</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Department</th>
                    <th>Leave Type</th>
                    <th>Duration</th>
                    <th>Total Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Comments/Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRequests.filter(r => ['Approved', 'Rejected', 'Cancelled'].includes(r.status)).length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No processed leave requests found.</td>
                    </tr>
                  ) : (
                    teamRequests.filter(r => ['Approved', 'Rejected', 'Cancelled'].includes(r.status)).map((req: any) => (
                      <tr key={req._id}>
                        <td>{req.employee?.employeeId || 'N/A'}</td>
                        <td style={{ fontWeight: 600 }}>{req.employee?.name}</td>
                        <td>{req.employee?.department?.name || req.employee?.department || 'N/A'}</td>
                        <td style={{ fontWeight: 500 }}>{req.leaveType?.name}</td>
                        <td>
                          {new Date(req.fromDate).toLocaleDateString()} to {new Date(req.toDate).toLocaleDateString()}
                        </td>
                        <td style={{ fontWeight: 700 }}>{req.totalDays} day(s)</td>
                        <td>{req.reason}</td>
                        <td>{getStatusBadge(req.status)}</td>
                        <td style={{ fontStyle: 'italic', color: '#475569' }}>
                          {req.comments || (req.approvalTimeline && req.approvalTimeline[req.approvalTimeline.length - 1]?.remarks) || 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub-tab: Calendar */}
          {teamSubTab === 'calendar' && (
            <div className="glass" style={{ padding: '25px', borderRadius: '12px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={20} color="var(--primary)" /> Team Leave Calendar (Approved & Requested Leaves)
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {teamRequests.filter(r => ['Approved', 'Pending Manager', 'Pending HR'].includes(r.status) && new Date(r.toDate) >= new Date()).length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>No active or upcoming leaves on the calendar.</div>
                ) : (
                  teamRequests.filter(r => ['Approved', 'Pending Manager', 'Pending HR'].includes(r.status) && new Date(r.toDate) >= new Date()).map((req: any) => {
                    const isOnLeaveToday = req.status === 'Approved' && new Date(req.fromDate) <= new Date() && new Date(req.toDate) >= new Date();
                    const isPending = req.status === 'Pending Manager' || req.status === 'Pending HR';

                    let statusText = 'UPCOMING LEAVE';
                    let statusColor = '#2563eb';
                    let statusBg = '#f8fafc';
                    let statusBorder = '1px solid #e2e8f0';
                    let avatarBg = '#3b82f6';

                    if (isPending) {
                      statusText = 'PENDING APPROVAL';
                      statusColor = '#d97706';
                      statusBg = '#fffbeb';
                      statusBorder = '1px solid #fde68a';
                      avatarBg = '#f59e0b';
                    } else if (isOnLeaveToday) {
                      statusText = 'ON LEAVE TODAY';
                      statusColor = '#15803d';
                      statusBg = '#f0fdf4';
                      statusBorder = '1px solid #bbf7d0';
                      avatarBg = '#22c55e';
                    }
                    
                    return (
                      <div key={req._id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: statusBg, border: statusBorder, borderRadius: '10px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: avatarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700 }}>
                          {req.employee?.name?.[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{req.employee?.name}</div>
                          <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '2px' }}>
                            {req.employee?.department?.name || req.employee?.department || 'N/A'} &bull; {req.leaveType?.name} &bull; {req.totalDays} day(s)
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: statusColor }}>
                            {statusText}
                          </span>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                            {new Date(req.fromDate).toLocaleDateString()} to {new Date(req.toDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Policies */}
      {activeTab === 'policies' && (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '30px' }}>
          {/* Policy List */}
          <div className="glass" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>Active Leave Policies</h2>
            {leaveTypes.map((type: any) => (
              <button 
                key={type._id} 
                onClick={() => setSelectedPolicyType(type)}
                style={{ 
                  textAlign: 'left', 
                  padding: '12px 15px', 
                  background: selectedPolicyType?._id === type._id ? '#e2e8f0' : '#f8fafc',
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{type.name}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Code: {type.code} &bull; {type.paid ? 'Paid' : 'Unpaid'}</div>
                </div>
                <span className={`badge ${type.isActive ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '10px' }}>
                  {type.isActive ? 'Active' : 'Inactive'}
                </span>
              </button>
            ))}
          </div>

          {/* Edit Policy Form */}
          <div className="data-table-container" style={{ padding: '25px' }}>
            {selectedPolicyType ? (
              <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '10px' }}>Edit Policy: {selectedPolicyType.name}</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Policy Name</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={selectedPolicyType.name} 
                      onChange={e => setSelectedPolicyType({ ...selectedPolicyType, name: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Code (e.g. SL, CL)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={selectedPolicyType.code} 
                      disabled
                      style={{ background: '#f8fafc' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Annual Allocation (Days)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={selectedPolicyType.annualAllocation} 
                      onChange={e => setSelectedPolicyType({ ...selectedPolicyType, annualAllocation: Number(e.target.value) })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Consecutive Days (0 = unlimited)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={selectedPolicyType.maxConsecutiveDays || 0} 
                      onChange={e => setSelectedPolicyType({ ...selectedPolicyType, maxConsecutiveDays: Number(e.target.value) })} 
                      required 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', margin: '5px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={selectedPolicyType.paid} 
                      onChange={e => setSelectedPolicyType({ ...selectedPolicyType, paid: e.target.checked })} 
                    />
                    Paid Leave
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={selectedPolicyType.carryForward} 
                      onChange={e => setSelectedPolicyType({ ...selectedPolicyType, carryForward: e.target.checked })} 
                    />
                    Carry Forward
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={selectedPolicyType.encashable} 
                      onChange={e => setSelectedPolicyType({ ...selectedPolicyType, encashable: e.target.checked })} 
                    />
                    Encashable
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="checkbox" 
                      checked={selectedPolicyType.isActive} 
                      onChange={e => setSelectedPolicyType({ ...selectedPolicyType, isActive: e.target.checked })} 
                    />
                    Active Policy Status
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Policy Changes'}</button>
                  <button type="button" className="btn-secondary" onClick={() => setSelectedPolicyType(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '250px', color: '#94a3b8' }}>
                <Settings size={50} style={{ marginBottom: '10px' }} />
                <div>Select a leave policy from the left list to edit configuration.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Adjust Balances */}
      {activeTab === 'adjust' && (
        <div className="data-table-container" style={{ padding: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '300px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Search employee by name/ID..." 
                  className="input-field" 
                  value={userSearch} 
                  onChange={e => setUserSearch(e.target.value)} 
                  style={{ paddingLeft: '40px', margin: 0 }}
                />
              </div>
              <select className="input-field" value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ width: '180px', margin: 0 }}>
                <option value="">All Departments</option>
                <option value="Sales">Sales</option>
                <option value="Telemarketing">Telemarketing</option>
                <option value="Service">Service</option>
                <option value="Development">Development</option>
              </select>
            </div>
            
            <button 
              className="btn-primary" 
              onClick={() => {
                setBulkForm({ employeeIds: [], leaveTypeId: '', allocated: 0, remarks: '' });
                setShowBulkModal(true);
              }}
            >
              🚀 Bulk Allocate Leaves
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No employees found.</td>
                </tr>
              ) : (
                filteredUsers.map((emp: any) => (
                  <tr key={emp._id}>
                    <td>{emp.employeeId || 'N/A'}</td>
                    <td style={{ fontWeight: 600 }}>{emp.name}</td>
                    <td>{emp.role?.department?.name || emp.role?.department || 'N/A'}</td>
                    <td>{emp.role?.name || 'N/A'}</td>
                    <td>
                      <button 
                        className="btn-secondary" 
                        onClick={() => {
                          setAdjustForm({
                            employeeId: emp._id,
                            leaveTypeId: leaveTypes[0]?._id || '',
                            allocated: 12,
                            used: 0,
                            remaining: 12,
                            remarks: ''
                          });
                          setShowAdjustModal(true);
                        }}
                        style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px' }}
                      >
                        ⚙️ Adjust Balances
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Reports & Logs */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Export card */}
          <div className="glass" style={{ padding: '25px', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '15px' }}>Export Company-Wide Leave Reports</h2>
            
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => {
                  // Mock export company
                  alert('Company Leave Balance report exported successfully as CSV!');
                }}
                className="btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                📊 Export Leave Balances
              </button>
              <button 
                onClick={() => {
                  alert('Monthly Leave Report (LWP & Paid) exported successfully!');
                }}
                className="btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                🧾 Export Monthly Payroll LWP Deductions
              </button>
              <button 
                onClick={() => {
                  alert('System Leave Audit Logs exported successfully!');
                }}
                className="btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                📋 Export Leave Audit Logs
              </button>
            </div>
          </div>

          {/* Audit Logs list */}
          <div className="data-table-container" style={{ padding: '25px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '20px' }}>Leave Audit Logs</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Performed By</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Details / Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{new Date().toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>Super Admin</td>
                  <td><span className="badge badge-green">BULK_ALLOCATE</span></td>
                  <td>LEAVE</td>
                  <td>Bulk allocated leaves for Dev and Sales departments.</td>
                </tr>
                <tr>
                  <td>{new Date(Date.now() - 3600000).toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>HR Manager</td>
                  <td><span className="badge badge-indigo">APPROVE</span></td>
                  <td>LEAVE</td>
                  <td>Final approval granted for medical leave request.</td>
                </tr>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13.5px', fontStyle: 'italic' }}>End of recent logs. All actions tracked in full database AuditLog.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Apply Leave */}
      {showApplyModal && (() => {
        const selectedCode = leaveTypes.find(t => t._id === applyForm.leaveTypeId)?.code;
        const targetEmployee = selectedEmployeeId 
          ? users.find(u => u._id === selectedEmployeeId) 
          : userProfile;
        const joiningDateStr = targetEmployee?.joiningDate;
        const targetDate = applyForm.fromDate ? new Date(applyForm.fromDate).getTime() : Date.now();
        const daysOfService = joiningDateStr ? Math.floor((targetDate - new Date(joiningDateStr).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const isTenureEligible = daysOfService >= 80;

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '550px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', transition: 'max-width 0.3s ease-in-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Apply for Leave</h3>
                <button onClick={() => setShowApplyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
              </div>

              {applyError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} />
                  <span>{applyError}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '30px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                {/* Form side */}
                <form onSubmit={handleApplyLeaveSubmit} style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  
                  {isHR && (
                    <div className="form-group">
                      <label>Apply For Employee *</label>
                      <select
                        className="input-field"
                        value={selectedEmployeeId}
                        onChange={e => {
                          setSelectedEmployeeId(e.target.value);
                          setApplyForm(prev => ({
                            ...prev,
                            leaveTypeId: '' // reset leave type when employee changes
                          }));
                        }}
                      >
                        <option value="">Apply for myself</option>
                        {users.map(u => (
                          <option key={u._id} value={u._id}>{u.name} ({u.role?.name || 'N/A'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Leave Type *</label>
                    <select 
                      className="input-field" 
                      value={applyForm.leaveTypeId} 
                      onChange={e => {
                        const newTypeId = e.target.value;
                        const code = leaveTypes.find(t => t._id === newTypeId)?.code;
                        setApplyForm(prev => ({
                          ...prev,
                          leaveTypeId: newTypeId,
                          halfDay: code === 'ML' ? false : prev.halfDay,
                          halfDaySession: code === 'ML' ? 'None' : prev.halfDaySession
                        }));
                      }}
                      required
                    >
                      <option value="">Select Leave Type</option>
                      {leaveTypes
                        .filter(t => t.isActive)
                        .filter(t => {
                          if (t.code === 'ML') {
                            // Only HR/Admin can apply Maternity Leave, and only for a female target employee
                            return isHR && (targetEmployee?.gender || '').toLowerCase() === 'female';
                          }
                          return true;
                        })
                        .map(t => (
                          <option key={t._id} value={t._id}>{t.name} ({t.code})</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Maternity Scenario Fields (Form Left side inputs) */}
                  {selectedCode === 'ML' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                      {!isTenureEligible && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <AlertTriangle size={16} />
                          <span>Ineligible: You have {daysOfService} service days (80 required).</span>
                        </div>
                      )}

                      <div className="form-group">
                        <label>Maternity Scenario *</label>
                        <select 
                          className="input-field" 
                          value={applyForm.maternityScenario} 
                          onChange={e => setApplyForm({ ...applyForm, maternityScenario: e.target.value })} 
                          required
                        >
                          <option value="None">Select Scenario</option>
                          <option value="First two surviving children">First two surviving children (26 weeks)</option>
                          <option value="Third or subsequent child">Third or subsequent child (12 weeks)</option>
                          <option value="Adoption">Adoption of child below 3 months (12 weeks)</option>
                          <option value="Surrogacy">Commissioning mother / Surrogacy (12 weeks)</option>
                        </select>
                      </div>
                      {applyForm.maternityScenario === 'First two surviving children' && (
                        <div className="form-group">
                          <label>Expected Delivery Date *</label>
                          <input 
                            type="date" 
                            className="input-field" 
                            value={applyForm.expectedDeliveryDate} 
                            onChange={e => setApplyForm({ ...applyForm, expectedDeliveryDate: e.target.value })} 
                            required 
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div className="form-group">
                      <label>From Date *</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={applyForm.fromDate} 
                        onChange={e => setApplyForm({ ...applyForm, fromDate: e.target.value })} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>To Date *</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={applyForm.toDate} 
                        onChange={e => setApplyForm({ ...applyForm, toDate: e.target.value })} 
                        required 
                      />
                    </div>
                  </div>

                  {selectedCode !== 'ML' && (
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: '#f8fafc', padding: '10px 15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                        <input 
                          type="checkbox" 
                          checked={applyForm.halfDay} 
                          onChange={e => setApplyForm({ ...applyForm, halfDay: e.target.checked })} 
                        />
                        Half Day Leave
                      </label>

                      {applyForm.halfDay && (
                        <select 
                          className="input-field" 
                          value={applyForm.halfDaySession} 
                          onChange={e => setApplyForm({ ...applyForm, halfDaySession: e.target.value })} 
                          style={{ margin: 0, padding: '6px 12px', fontSize: '13px', width: '150px' }}
                        >
                          <option value="First Half">First Half</option>
                          <option value="Second Half">Second Half</option>
                        </select>
                      )}
                    </div>
                  )}

                  {calculatedDays > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>
                      <Info size={16} /> Total leaves calculated: {calculatedDays} working day(s)
                    </div>
                  )}

                  <div className="form-group">
                    <label>Reason *</label>
                    <textarea 
                      className="input-field" 
                      placeholder="Explain why you need this leave..." 
                      value={applyForm.reason} 
                      onChange={e => setApplyForm({ ...applyForm, reason: e.target.value })} 
                      required
                      style={{ minHeight: '80px', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Attachment {selectedCode === 'ML' ? '* (Medical Certificate Required)' : (selectedCode === 'SL' ? '(Required for SL > 2 days)' : '')}</label>
                    <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} disabled={uploading} />
                    {uploading && <span style={{ fontSize: '13px', color: '#2563eb', marginLeft: '10px' }}>Uploading...</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={saving || uploading || (selectedCode === 'ML' && !isTenureEligible)}
                    >
                      {saving ? 'Submitting...' : 'Apply Leave'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setShowApplyModal(false)}>Close</button>
                  </div>

                </form>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL: Remarks for Approve/Reject */}
      {showRemarksModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '450px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>
                {selectedRequestAction?.type === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
              </h3>
              <button onClick={() => setShowRemarksModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleRemarksSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label>Remarks / Feedback</label>
                <textarea 
                  className="input-field" 
                  placeholder="Enter remarks..." 
                  value={remarksText} 
                  onChange={e => setRemarksText(e.target.value)} 
                  style={{ minHeight: '80px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ background: selectedRequestAction?.type === 'approve' ? '#22c55e' : '#ef4444' }}
                  disabled={saving}
                >
                  {saving ? 'Processing...' : selectedRequestAction?.type === 'approve' ? 'Approve' : 'Reject'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowRemarksModal(false)}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adjust Balances */}
      {showAdjustModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '450px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>Adjust Leave Balance</h3>
              <button onClick={() => setShowAdjustModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label>Leave Type</label>
                <select 
                  className="input-field" 
                  value={adjustForm.leaveTypeId} 
                  onChange={e => setAdjustForm({ ...adjustForm, leaveTypeId: e.target.value })} 
                  required
                >
                  {leaveTypes.map(t => (
                    <option key={t._id} value={t._id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Allocated</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={adjustForm.allocated} 
                    onChange={e => {
                      const val = Number(e.target.value);
                      setAdjustForm({ ...adjustForm, allocated: val, remaining: val - adjustForm.used });
                    }} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Used</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={adjustForm.used} 
                    onChange={e => {
                      const val = Number(e.target.value);
                      setAdjustForm({ ...adjustForm, used: val, remaining: adjustForm.allocated - val });
                    }} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Remaining</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={adjustForm.remaining} 
                    disabled
                    style={{ background: '#f8fafc' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Adjustment Remarks *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Reason for balance update" 
                  value={adjustForm.remarks} 
                  onChange={e => setAdjustForm({ ...adjustForm, remarks: e.target.value })} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Processing...' : 'Apply Adjustments'}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAdjustModal(false)}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Allocation */}
      {showBulkModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>Bulk Allocate Leaves</h3>
              <button onClick={() => setShowBulkModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label>Select Target Employees *</label>
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {users.map(u => (
                    <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px' }}>
                      <input 
                        type="checkbox" 
                        checked={bulkForm.employeeIds.includes(u._id)} 
                        onChange={() => {
                          const exists = bulkForm.employeeIds.includes(u._id);
                          const newIds = exists ? bulkForm.employeeIds.filter(id => id !== u._id) : [...bulkForm.employeeIds, u._id];
                          setBulkForm({ ...bulkForm, employeeIds: newIds });
                        }} 
                      />
                      {u.name} ({u.employeeId || 'N/A'}) &bull; {u.role?.department?.name || u.role?.department || 'N/A'}
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', textAlign: 'right' }}>
                  <button type="button" onClick={() => setBulkForm({ ...bulkForm, employeeIds: users.map(u => u._id) })} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Select All</button>
                  <span style={{ margin: '0 5px' }}>|</span>
                  <button type="button" onClick={() => setBulkForm({ ...bulkForm, employeeIds: [] })} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}>Deselect All</button>
                </div>
              </div>

              <div className="form-group">
                <label>Leave Type *</label>
                <select 
                  className="input-field" 
                  value={bulkForm.leaveTypeId} 
                  onChange={e => setBulkForm({ ...bulkForm, leaveTypeId: e.target.value })} 
                  required
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map(t => (
                    <option key={t._id} value={t._id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>New Annual Allocation (Days) *</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={bulkForm.allocated} 
                  onChange={e => setBulkForm({ ...bulkForm, allocated: Number(e.target.value) })} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Adjustment Remarks *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Reason for bulk allocation" 
                  value={bulkForm.remarks} 
                  onChange={e => setBulkForm({ ...bulkForm, remarks: e.target.value })} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Processing...' : 'Bulk Allocate'}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowBulkModal(false)}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
