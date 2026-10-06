import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Building, Calendar, CheckCircle2, Clock, Globe, 
  Search, Users, RefreshCw, MessageSquare, Layers, FileText, ChevronRight, AtSign, AlertCircle
} from 'lucide-react';

interface Deliverable {
  key: string;
  value: string;
}

interface Service {
  name: string;
  category?: string;
  deliverables?: Deliverable[];
}

interface Package {
  _id: string;
  packageName: string;
  startDate?: string;
  endDate?: string;
  status: string;
  services: Service[];
}

interface TeamMember {
  _id: string;
  name: string;
  email?: string;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  role?: any;
}

interface TaggedUser {
  _id: string;
  name: string;
  email?: string;
  employeeId?: string;
  role?: any;
}

interface Note {
  _id?: string;
  note: string;
  userName: string;
  date: string;
  taggedUsers?: TaggedUser[];
}

interface Project {
  _id: string;
  name: string;
  companyName: string;
  email?: string;
  phone?: string;
  businessCategory?: string;
  businessType?: string;
  industry?: string;
  websiteUrl?: string;
  projectStatus: string;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  daysRemaining?: number | null;
  serviceStartDate?: string;
  serviceEndDate?: string;
  assignedAccountManager?: TaggedUser;
  assignedServiceManager?: TaggedUser;
  serviceManagers?: TaggedUser[];
  assignedTeamMembers: TeamMember[];
  packages: Package[];
  notes: Note[];
}

export default function MyProjects() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = (user.role?.name || '').toLowerCase();
  const userType = (typeof user.role?.userType === 'object' ? user.role?.userType?.name : user.role?.userType || '').toLowerCase();
  const isAdmin = ['admin', 'super admin'].includes(userRole) || ['admin', 'super admin'].includes(userType);
  const isAccountManager = userRole.includes('account manager') || userRole.includes('bdm');
  const canEditExpiration = isAdmin || isAccountManager;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // New Note state
  const [noteText, setNoteText] = useState('');
  const [selectedTaggedUsers, setSelectedTaggedUsers] = useState<string[]>([]);
  const [submittingNote, setSubmittingNote] = useState(false);

  // Expiration Modal State
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [expirationDateInput, setExpirationDateInput] = useState('');
  const [updatingExpiration, setUpdatingExpiration] = useState(false);

  const handleOpenExpirationModal = (p: Project) => {
    const defaultDate = p.serviceEndDate ? new Date(p.serviceEndDate).toISOString().split('T')[0] : '';
    setExpirationDateInput(defaultDate);
    setShowExpirationModal(true);
  };

  const handleUpdateExpirationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !expirationDateInput) return;

    try {
      setUpdatingExpiration(true);
      const res = await axios.put(`/api/client-packages/update-expiration/${selectedProject._id}`, {
        newExpirationDate: expirationDateInput
      });
      if (res.data.success) {
        setShowExpirationModal(false);
        fetchProjects();
      }
    } catch (err) {
      console.error('Error updating expiration date:', err);
    } finally {
      setUpdatingExpiration(false);
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/clients/my-projects');
      if (res.data.success) {
        setProjects(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching assigned projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    const handleProjectClick = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      
      const query = String(detail).toLowerCase();
      const found = projects.find(p => p._id === detail || p.companyName.toLowerCase().includes(query) || p.name.toLowerCase().includes(query));
      if (found) {
        setSelectedProjectId(found._id);
      }
    };

    window.addEventListener('notification-project-click', handleProjectClick);
    return () => {
      window.removeEventListener('notification-project-click', handleProjectClick);
    };
  }, [projects]);

  useEffect(() => {
    if (projects.length > 0) {
      const savedProjectId = localStorage.getItem('selectProjectId');
      const savedProjectCompany = localStorage.getItem('selectProjectCompany');

      if (savedProjectId) {
        const found = projects.find(p => p._id === savedProjectId);
        if (found) setSelectedProjectId(found._id);
        localStorage.removeItem('selectProjectId');
      } else if (savedProjectCompany) {
        const query = savedProjectCompany.toLowerCase();
        const found = projects.find(p => p.companyName.toLowerCase().includes(query) || p.name.toLowerCase().includes(query));
        if (found) setSelectedProjectId(found._id);
        localStorage.removeItem('selectProjectCompany');
      } else if (!selectedProjectId) {
        setSelectedProjectId(projects[0]._id);
      }
    }
  }, [projects]);

  const toggleTagUser = (userId: string) => {
    if (selectedTaggedUsers.includes(userId)) {
      setSelectedTaggedUsers(selectedTaggedUsers.filter(id => id !== userId));
    } else {
      setSelectedTaggedUsers([...selectedTaggedUsers, userId]);
    }
  };

  const handleAddNote = async (projectId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    try {
      setSubmittingNote(true);
      const res = await axios.post(`/api/clients/${projectId}/notes`, {
        note: noteText,
        taggedUsers: selectedTaggedUsers 
      });
      if (res.data.success) {
        setNoteText('');
        setSelectedTaggedUsers([]);
        fetchProjects();
      }
    } catch (err) {
      console.error('Error adding project note:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    const query = searchQuery.toLowerCase();
    const matchesQuery = 
      p.companyName.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query) ||
      (p.businessCategory || '').toLowerCase().includes(query) ||
      (p.industry || '').toLowerCase().includes(query);

    const matchesStatus = !statusFilter || p.projectStatus === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const selectedProject = projects.find(p => p._id === selectedProjectId) || (filteredProjects.length > 0 ? filteredProjects[0] : null);

  const getDaysRemaining = (endDateStr?: string) => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getMemberDelayInfo = (p: Project) => {
    const currentUserId = user._id || user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (p.projectStatus === 'Completed') return null;

    const memberAss = ((p as any).teamAssignments || []).find((ta: any) => String(ta.userId || ta.user?._id || ta.user) === String(currentUserId));
    const memberObj = (p.assignedTeamMembers || []).find((m: any) => String(m._id || m.id) === String(currentUserId));

    const endDateVal = memberAss?.endDate || memberObj?.endDate || p.serviceEndDate;
    if (!endDateVal) return null;

    const endD = new Date(endDateVal);
    endD.setHours(0, 0, 0, 0);

    const diffMs = endD.getTime() - today.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const delayDays = Math.abs(diffDays);
      return {
        delayDays,
        endDateStr: endD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      };
    }
    return null;
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building size={26} color="var(--primary)" /> Assigned Projects & Deliverables
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            View projects assigned to you for development, service timelines, and client package deliverables.
          </p>
        </div>
        <button 
          onClick={fetchProjects}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '9px 16px' }}
        >
          <RefreshCw size={14} /> Refresh Projects
        </button>
      </div>

      {/* KPI Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="chart-card" style={{ background: 'white', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Total Assigned Projects</span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>{projects.length}</div>
        </div>
        <div className="chart-card" style={{ background: 'white', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>In Development</span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#2563eb', marginTop: '6px' }}>
            {projects.filter(p => p.projectStatus === 'In Development' || p.projectStatus === 'Assigned for Development').length}
          </div>
        </div>
        <div className="chart-card" style={{ background: 'white', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Testing / Review</span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>
            {projects.filter(p => p.projectStatus === 'Testing / Review').length}
          </div>
        </div>
        <div className="chart-card" style={{ background: 'white', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Completed</span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
            {projects.filter(p => p.projectStatus === 'Completed').length}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="chart-card" style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              className="input-field"
              style={{ paddingLeft: '36px', marginBottom: 0 }}
              placeholder="Search projects by client name, company, or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <select 
              className="input-field" 
              style={{ marginBottom: 0 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Project Statuses</option>
              <option value="Assigned for Development">Assigned for Development</option>
              <option value="In Development">In Development</option>
              <option value="Testing / Review">Testing / Review</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      {loading ? (
        <div className="chart-card" style={{ background: 'white', padding: '50px', textAlign: 'center', color: '#64748b', borderRadius: '12px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
          Loading assigned projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="chart-card" style={{ background: 'white', padding: '50px', textAlign: 'center', color: '#64748b', borderRadius: '12px' }}>
          <Building size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>No Assigned Projects Found</h3>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>You have not been assigned to any client development projects yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
          
          {/* Left Column: Projects Directory List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Project List ({filteredProjects.length})
            </h3>

            {filteredProjects.map(p => {
              const isSelected = selectedProject?._id === p._id;
              const daysRem = getDaysRemaining(p.serviceEndDate);
              const memberDelay = getMemberDelayInfo(p);

              return (
                <div 
                  key={p._id}
                  onClick={() => setSelectedProjectId(p._id)}
                  style={{
                    background: isSelected ? '#eff6ff' : 'white',
                    border: isSelected ? '2px solid #2563eb' : (memberDelay ? '1.5px solid #fca5a5' : '1px solid #e2e8f0'),
                    padding: '16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>{p.companyName}</h4>
                    <ChevronRight size={16} color={isSelected ? '#2563eb' : '#94a3b8'} />
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '8px' }}>{p.name}</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '10px', 
                      fontWeight: 700,
                      background: (p.isExpired || p.projectStatus === 'Inactive') ? '#fee2e2' : p.projectStatus === 'Completed' ? '#dcfce7' : p.projectStatus === 'In Development' ? '#dbeafe' : '#f1f5f9',
                      color: (p.isExpired || p.projectStatus === 'Inactive') ? '#dc2626' : p.projectStatus === 'Completed' ? '#15803d' : p.projectStatus === 'In Development' ? '#1d4ed8' : '#475569'
                    }}>
                      {(p.isExpired || p.projectStatus === 'Inactive') ? '🔴 Inactive' : p.projectStatus}
                    </span>
                    {memberDelay ? (
                      <span style={{ 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        fontSize: '10.5px', 
                        fontWeight: 800,
                        background: '#dc2626',
                        color: '#ffffff',
                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        🚨 You are {memberDelay.delayDays} {memberDelay.delayDays === 1 ? 'day' : 'days'} delayed
                      </span>
                    ) : daysRem !== null && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: daysRem <= 30 ? '#dc2626' : '#059669' }}>
                        {daysRem < 0 ? '⛔ Inactive' : daysRem <= 30 ? `⚠️ ${daysRem}d left` : `${daysRem} days left`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Project Workspace */}
          {selectedProject && (() => {
            const selectedMemberDelay = getMemberDelayInfo(selectedProject);
            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 0. MEMBER INDIVIDUAL PROJECT DELAY ALERT BANNER */}
              {selectedMemberDelay && (
                <div style={{ 
                  background: '#fee2e2', 
                  border: '2px solid #dc2626', 
                  color: '#7f1d1d', 
                  padding: '16px 20px', 
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.2)'
                }}>
                  <AlertCircle size={26} color="#dc2626" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#7f1d1d' }}>
                      🚨 ASSIGNED PROJECT DELAY ALERT: YOU ARE {selectedMemberDelay.delayDays} {selectedMemberDelay.delayDays === 1 ? 'DAY' : 'DAYS'} DELAYED!
                    </div>
                    <div style={{ fontSize: '13px', color: '#991b1b', marginTop: '2px', lineHeight: 1.4 }}>
                      Your assigned completion deadline for <strong>{selectedProject.companyName}</strong> was <strong>{selectedMemberDelay.endDateStr}</strong>. You are currently delayed by <strong>{selectedMemberDelay.delayDays} {selectedMemberDelay.delayDays === 1 ? 'day' : 'days'}</strong>. Please prioritize this project and update your deliverables.
                    </div>
                  </div>
                  <div style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '13px',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                  }}>
                    🚨 {selectedMemberDelay.delayDays} {selectedMemberDelay.delayDays === 1 ? 'Day' : 'Days'} Delayed
                  </div>
                </div>
              )}
              
              {/* 1. OVERDUE INACTIVE RED ALERT BANNER */}
              {(selectedProject.isExpired || (selectedProject.daysRemaining !== undefined && selectedProject.daysRemaining !== null && selectedProject.daysRemaining < 0)) && (
                <div style={{ 
                  background: '#fee2e2', 
                  border: '2px solid #dc2626', 
                  color: '#7f1d1d', 
                  padding: '16px 20px', 
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)'
                }}>
                  <AlertCircle size={26} color="#dc2626" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#7f1d1d' }}>
                      ⛔ PROJECT INACTIVE: Service Expiration Date Passed!
                    </div>
                    <div style={{ fontSize: '13px', color: '#991b1b', marginTop: '2px', lineHeight: 1.4 }}>
                      The service for <strong>{selectedProject.companyName}</strong> expired on midnight of{' '}
                      <strong>{selectedProject.serviceEndDate ? new Date(selectedProject.serviceEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</strong>. This project action status is marked as <strong>INACTIVE (Red Alert)</strong> for all assigned team members, Service Manager, and Account Manager.
                    </div>
                  </div>
                  {canEditExpiration && (
                    <button 
                      onClick={() => handleOpenExpirationModal(selectedProject)}
                      className="btn-primary" 
                      style={{ background: '#dc2626', borderColor: '#dc2626', padding: '8px 16px', fontSize: '12.5px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Calendar size={14} /> Update Expiration Date
                    </button>
                  )}
                </div>
              )}

              {/* 2. 1-MONTH PRE-EXPIRATION RED WARNING BANNER */}
              {(!selectedProject.isExpired && selectedProject.daysRemaining !== undefined && selectedProject.daysRemaining !== null && selectedProject.daysRemaining >= 0 && selectedProject.daysRemaining <= 30) && (
                <div style={{ 
                  background: '#fef2f2', 
                  border: '2px solid #ef4444', 
                  color: '#991b1b', 
                  padding: '16px 20px', 
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
                }}>
                  <AlertCircle size={26} color="#dc2626" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#991b1b' }}>
                      🚨 ATTENTION: Project Service Expiring Within 1 Month!
                    </div>
                    <div style={{ fontSize: '13px', color: '#b91c1c', marginTop: '2px', lineHeight: 1.4 }}>
                      The service for <strong>{selectedProject.companyName}</strong> will expire on{' '}
                      <strong>{selectedProject.serviceEndDate ? new Date(selectedProject.serviceEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</strong>{' '}
                      (<strong>{selectedProject.daysRemaining} {selectedProject.daysRemaining === 1 ? 'day' : 'days'} remaining</strong>). Account Manager, Admin, or Super Admin must update expiration date upon deal renewal.
                    </div>
                  </div>
                  {canEditExpiration && (
                    <button 
                      onClick={() => handleOpenExpirationModal(selectedProject)}
                      className="btn-primary" 
                      style={{ background: '#dc2626', borderColor: '#dc2626', padding: '8px 16px', fontSize: '12.5px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Calendar size={14} /> Update Expiration Date
                    </button>
                  )}
                </div>
              )}

              {/* Project Header Card */}
              <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>{selectedProject.companyName}</h2>
                    <div style={{ fontSize: '13.5px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Client Contact: <strong>{selectedProject.name}</strong></span>
                      {selectedProject.websiteUrl && (
                        <>
                          <span>•</span>
                          <a href={selectedProject.websiteUrl.startsWith('http') ? selectedProject.websiteUrl : `https://${selectedProject.websiteUrl}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Globe size={13} /> {selectedProject.websiteUrl}
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ 
                      padding: '6px 14px', 
                      borderRadius: '20px', 
                      fontSize: '12px', 
                      fontWeight: 700,
                      background: (selectedProject.isExpired || selectedProject.projectStatus === 'Inactive') ? '#fee2e2' : '#eff6ff', 
                      color: (selectedProject.isExpired || selectedProject.projectStatus === 'Inactive') ? '#dc2626' : '#1d4ed8', 
                      border: (selectedProject.isExpired || selectedProject.projectStatus === 'Inactive') ? '1px solid #fca5a5' : '1px solid #bfdbfe' 
                    }}>
                      {(selectedProject.isExpired || selectedProject.projectStatus === 'Inactive') ? '⛔ Inactive (Expired)' : selectedProject.projectStatus}
                    </span>
                    {canEditExpiration && (
                      <button 
                        onClick={() => handleOpenExpirationModal(selectedProject)}
                        className="btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Calendar size={14} /> Update Expiration
                      </button>
                    )}
                  </div>
                </div>

                {/* Coordinates & Service Timeline Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  
                  {/* Service Start Date */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} color="#2563eb" /> Service Start Date
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginTop: '6px' }}>
                      {selectedProject.serviceStartDate 
                        ? new Date(selectedProject.serviceStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) 
                        : 'N/A'}
                    </div>
                  </div>

                  {/* Service End Date */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} color="#d97706" /> Service End Date
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginTop: '6px' }}>
                      {selectedProject.serviceEndDate 
                        ? new Date(selectedProject.serviceEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) 
                        : 'N/A'}
                    </div>
                  </div>

                  {/* Category / Industry */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={14} color="#7c3aed" /> Category / Industry
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginTop: '6px' }}>
                      {selectedProject.businessCategory || selectedProject.industry || 'Standard Business'}
                    </div>
                  </div>

                  {/* Service Manager */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} color="#059669" /> Service Manager
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginTop: '6px' }}>
                      {selectedProject.assignedServiceManager?.name || 'Assigned Manager'}
                    </div>
                  </div>

                </div>
              </div>

              {/* Purchased Services & Deliverables Breakdown */}
              <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <CheckCircle2 size={18} color="#059669" /> Client Package & Deliverables Scope
                </h3>

                {(!selectedProject.packages || selectedProject.packages.length === 0) ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                    No specific package deliverables configured for this project.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {selectedProject.packages.map((pkg, idx) => (
                      <div key={pkg._id || idx} style={{ background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                          <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: 800 }}>
                            {pkg.packageName}
                          </h4>
                          <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
                            {pkg.status}
                          </span>
                        </div>

                        {/* Services List Grouped by Service Category */}
                        {(!pkg.services || pkg.services.length === 0) ? (
                          <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Standard service deliverables included.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {pkg.services.map((srv, sIdx) => {
                              const deliverableItems = srv.deliverables || [];
                              return (
                                <div key={sIdx} style={{ background: 'white', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#2563eb', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#2563eb', fontSize: '14px' }}>◆</span> {srv.name} {srv.category && srv.category !== srv.name ? `(${srv.category})` : ''}
                                  </div>

                                  {/* Deliverables Checklist options (without price) */}
                                  {deliverableItems.length === 0 ? (
                                    <div style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic', paddingLeft: '14px' }}>
                                      Standard service details active.
                                    </div>
                                  ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', paddingLeft: '6px' }}>
                                      {deliverableItems.map((del, dIdx) => {
                                        const itemText = typeof del === 'string' ? del : (del.value || del.key);
                                        return (
                                          <div key={dIdx} style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.4 }}>
                                            <span style={{ color: '#10b981', fontWeight: 900, fontSize: '14px', flexShrink: 0 }}>✓</span>
                                            <span>{itemText}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned Development Team Members */}
              <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <Users size={18} color="#2563eb" /> Assigned Development Team Members
                </h3>

                {(!selectedProject.assignedTeamMembers || selectedProject.assignedTeamMembers.length === 0) ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No other team members assigned yet.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {selectedProject.assignedTeamMembers.map((member: any) => {
                      const roleName = (typeof member.role === 'object' ? member.role?.name : member.role) || 'Team Member';
                      return (
                        <div key={member._id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', flexShrink: 0 }}>
                              {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {member.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {member.email || 'N/A'}
                              </div>
                              <span style={{ display: 'inline-block', marginTop: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                                {roleName}
                              </span>
                            </div>
                          </div>

                          {(member.startDate || member.endDate) && (
                            <div style={{ fontSize: '11px', color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 8px', borderRadius: '6px', fontWeight: 600, marginTop: '2px' }}>
                              📅 {member.startDate ? new Date(member.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'} – {member.endDate ? new Date(member.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Internal Project Notes & Updates Thread */}
              <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <MessageSquare size={18} color="#7c3aed" /> Project Development Notes & Updates
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '250px', overflowY: 'auto', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  {(!selectedProject.notes || selectedProject.notes.length === 0) ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px', fontSize: '13px', fontStyle: 'italic' }}>
                      No project updates posted yet.
                    </div>
                  ) : (
                    selectedProject.notes.map((n, idx) => (
                      <div key={n._id || idx} style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                          <strong style={{ color: '#1e293b' }}>{n.userName}</strong>
                          <span style={{ color: '#94a3b8' }}>{new Date(n.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>{n.note}</div>
                        {n.taggedUsers && n.taggedUsers.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Tagged:</span>
                            {n.taggedUsers.map((tu, tuIdx) => {
                              const empStr = tu.employeeId ? ` (${tu.employeeId})` : '';
                              return (
                                <span key={tu._id || tuIdx} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                                  @{tu.name}{empStr}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Tag Taggable Members Section */}
                <div style={{ marginBottom: '12px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AtSign size={14} color="#2563eb" /> Tag Team Members / Service Manager:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Account Manager Option */}
                    {selectedProject.assignedAccountManager && (
                      <button
                        type="button"
                        onClick={() => toggleTagUser(selectedProject.assignedAccountManager!._id)}
                        style={{
                          background: selectedTaggedUsers.includes(selectedProject.assignedAccountManager._id) ? '#2563eb' : 'white',
                          color: selectedTaggedUsers.includes(selectedProject.assignedAccountManager._id) ? 'white' : '#334155',
                          border: selectedTaggedUsers.includes(selectedProject.assignedAccountManager._id) ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        @{selectedProject.assignedAccountManager.name}
                        {selectedProject.assignedAccountManager.employeeId ? ` (${selectedProject.assignedAccountManager.employeeId})` : ''}
                        <span style={{ fontSize: '10px', opacity: 0.8, marginLeft: '2px' }}>(Account Manager)</span>
                      </button>
                    )}

                    {/* Service Manager Options */}
                    {(() => {
                      const smList: TaggedUser[] = [];
                      if (selectedProject.assignedServiceManager?._id) {
                        smList.push(selectedProject.assignedServiceManager);
                      }
                      if (selectedProject.serviceManagers && selectedProject.serviceManagers.length > 0) {
                        selectedProject.serviceManagers.forEach(sm => {
                          if (sm._id && !smList.some(item => item._id === sm._id)) {
                            smList.push(sm);
                          }
                        });
                      }

                      return smList.map(sm => {
                        const isTagged = selectedTaggedUsers.includes(sm._id);
                        const empStr = sm.employeeId ? ` (${sm.employeeId})` : '';
                        return (
                          <button
                            key={sm._id}
                            type="button"
                            onClick={() => toggleTagUser(sm._id)}
                            style={{
                              background: isTagged ? '#2563eb' : 'white',
                              color: isTagged ? 'white' : '#334155',
                              border: isTagged ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                              padding: '4px 10px',
                              borderRadius: '16px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            @{sm.name || 'Service Manager'}{empStr}
                            <span style={{ fontSize: '10px', opacity: 0.8, marginLeft: '2px' }}>(Service Manager)</span>
                          </button>
                        );
                      });
                    })()}

                    {/* Assigned Team Members Options */}
                    {(selectedProject.assignedTeamMembers || []).map(member => {
                      const isTagged = selectedTaggedUsers.includes(member._id);
                      const empStr = member.employeeId ? ` (${member.employeeId})` : '';
                      return (
                        <button
                          key={member._id}
                          type="button"
                          onClick={() => toggleTagUser(member._id)}
                          style={{
                            background: isTagged ? '#2563eb' : 'white',
                            color: isTagged ? 'white' : '#334155',
                            border: isTagged ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                            padding: '4px 10px',
                            borderRadius: '16px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          @{member.name}{empStr}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={(e) => handleAddNote(selectedProject._id, e)} style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Type development status update or internal note..." 
                    value={noteText} 
                    onChange={(e) => setNoteText(e.target.value)} 
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                  <button type="submit" className="btn-primary" disabled={submittingNote || !noteText.trim()} style={{ padding: '8px 20px' }}>
                    {submittingNote ? 'Posting...' : 'Post Update'}
                  </button>
                </form>
              </div>

            </div>
          );
        })()}

        </div>
      )}

      {/* UPDATE EXPIRATION DATE MODAL */}
      {showExpirationModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleUpdateExpirationSubmit} style={{ width: '100%', maxWidth: '460px', background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} color="#dc2626" /> Set / Update Expiration Date
              </h3>
              <button type="button" onClick={() => setShowExpirationModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Service Expiration Date *
              </label>
              <input 
                type="date" 
                className="input-field"
                value={expirationDateInput}
                onChange={(e) => setExpirationDateInput(e.target.value)}
                required
              />
              <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 0 0' }}>
                Only Account Manager, Admin, and Super Admin can set or update project expiration dates upon deal renewal. Setting a future date reactivates the project.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn-primary" disabled={updatingExpiration || !expirationDateInput} style={{ flex: 1, padding: '10px' }}>
                {updatingExpiration ? 'Updating...' : 'Save Expiration Date'}
              </button>
              <button type="button" onClick={() => setShowExpirationModal(false)} className="btn-secondary" style={{ flex: 1, padding: '10px' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
