import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit, Search, X, Check, AlertCircle } from 'lucide-react';

export default function ServiceDetailMaster() {
  const [details, setDetails] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search and Filter state
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [service, setService] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [status, setStatus] = useState('Active');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/service-details', {
        params: {
          service: serviceFilter,
          status: statusFilter
        }
      });
      if (res.data.success) {
        setDetails(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch service details');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/services');
      if (res.data.success) {
        const activeServices = res.data.data.filter((s: any) => s.status === 'Active');
        setServices(activeServices);
        if (activeServices.length > 0) {
          setService(activeServices[0]._id);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch services', err);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    fetchDetails();
  }, [serviceFilter, statusFilter]);

  const handleOpenAddModal = () => {
    setEditingId(null);
    if (services.length > 0) {
      setService(services[0]._id);
    } else {
      setService('');
    }
    setName('');
    setPrice(0);
    setStatus('Active');
    setShowModal(true);
  };

  const handleOpenEditModal = (detail: any) => {
    setEditingId(detail._id);
    setService(detail.service?._id || detail.service || '');
    setName(detail.name);
    setPrice(detail.price || 0);
    setStatus(detail.status || 'Active');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!service) {
      setError('Please select a parent service.');
      return;
    }

    const payload = {
      service,
      name,
      price,
      status
    };

    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/service-details/${editingId}`, payload);
      } else {
        await axios.post('http://localhost:5000/api/service-details', payload);
      }
      setShowModal(false);
      fetchDetails();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save service detail');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this service detail?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/service-details/${id}`);
      fetchDetails();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete service detail');
    }
  };

  const toggleStatus = async (detail: any) => {
    const newStatus = detail.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await axios.put(`http://localhost:5000/api/service-details/${detail._id}`, { status: newStatus });
      fetchDetails();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  // Filter client-side by search query (name or service name)
  const filteredDetails = details.filter((d: any) => {
    const s = search.toLowerCase();
    return (
      d.name?.toLowerCase().includes(s) ||
      d.service?.name?.toLowerCase().includes(s)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredDetails.length / itemsPerPage);
  const displayedDetails = filteredDetails.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ padding: '20px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Service Detail Master</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Manage detailed items, sub-services, and specific configurations with individual pricing under each main Service.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}>
          <Plus size={18} /> Add Service Detail
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Filters Card */}
      <div className="chart-card" style={{ padding: '20px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Search Detail</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search by detail name or service..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                style={{ paddingLeft: '36px' }}
              />
              <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Parent Service</label>
            <select className="input-field" value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
              <option value="">All Services</option>
              {services.map((s: any) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Status</label>
            <select className="input-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Details Table */}
      <div className="data-table-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading service details...</div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Parent Service</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Detail Service Name</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Price (Rs.)</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Status</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedDetails.map((detail: any) => (
                  <tr key={detail._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#475569' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: '#eff6ff', color: '#1e40af' }}>
                        {detail.service?.name || 'Unknown Service'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                      {detail.name}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      Rs. {detail.price?.toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <button 
                        onClick={() => toggleStatus(detail)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <span className={`badge ${detail.status === 'Active' ? 'badge-green' : 'badge-gray'}`} style={{ cursor: 'pointer' }}>
                          {detail.status || 'Active'}
                        </span>
                      </button>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleOpenEditModal(detail)} className="btn-secondary" style={{ padding: '8px', borderRadius: '6px' }} title="Edit Detail">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(detail._id)} className="btn-danger" style={{ padding: '8px', borderRadius: '6px' }} title="Delete Detail">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDetails.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No service details found.</td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {filteredDetails.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                  Showing {Math.min(filteredDetails.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredDetails.length, currentPage * itemsPerPage)} of {filteredDetails.length} entries
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    className="btn-secondary" 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button 
                      key={page} 
                      onClick={() => setCurrentPage(page)} 
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '13px', 
                        borderRadius: '6px', 
                        border: '1px solid #e2e8f0', 
                        background: currentPage === page ? '#2563eb' : '#ffffff', 
                        color: currentPage === page ? '#ffffff' : '#475569',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {page}
                    </button>
                  ))}
                  <button 
                    className="btn-secondary" 
                    disabled={currentPage === totalPages} 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '90%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                {editingId ? 'Edit Service Detail' : 'Add New Service Detail'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Parent Service *</label>
                <select className="input-field" value={service} onChange={e => setService(e.target.value)} required>
                  <option value="">Select Service</option>
                  {services.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Detail Service Name *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  placeholder="e.g., Basic WordPress Site of Up To 10 Pages" 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Price (Rs.) *</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={price} 
                      onChange={e => setPrice(Number(e.target.value))} 
                      required 
                      min="0"
                      style={{ paddingLeft: '32px' }}
                    />
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: '#64748b', fontSize: '14px' }}>₹</span>
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Status</label>
                  <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ padding: '10px 20px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={18} /> {editingId ? 'Update Detail' : 'Add Detail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
