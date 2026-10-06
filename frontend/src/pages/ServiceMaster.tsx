import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit, Search, X, Check, AlertCircle } from 'lucide-react';

export default function ServiceMaster() {
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search and Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Active');

  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [newDeliverable, setNewDeliverable] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/services', {
        params: {
          search,
          category: categoryFilter,
          status: statusFilter
        }
      });
      if (res.data.success) {
        setServices(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/service-categories');
      if (res.data.success) {
        setCategories(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch service categories', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchServices();
  }, [search, categoryFilter, statusFilter]);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setName('');
    setCategory(categories.find(c => c.status === 'Active')?.name || categories[0]?.name || '');
    setDescription('');
    setStatus('Active');

    setDeliverables([]);
    setNewDeliverable('');
    setInternalNotes('');
    setShowModal(true);
  };

  const handleOpenEditModal = (service: any) => {
    setEditingId(service._id);
    setName(service.name);
    setCategory(service.category);
    setDescription(service.description || '');
    setStatus(service.status || 'Active');

    setDeliverables(service.deliverables || []);
    setNewDeliverable('');
    setInternalNotes(service.internalNotes || '');
    setShowModal(true);
  };

  const handleAddDeliverable = () => {
    if (newDeliverable.trim() && !deliverables.includes(newDeliverable.trim())) {
      setDeliverables([...deliverables, newDeliverable.trim()]);
      setNewDeliverable('');
    }
  };

  const handleRemoveDeliverable = (indexToRemove: number) => {
    setDeliverables(deliverables.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload = {
      name,
      category,
      description,
      status,

      deliverables,
      internalNotes
    };

    try {
      if (editingId) {
        await axios.put(`/api/services/${editingId}`, payload);
      } else {
        await axios.post('/api/services', payload);
      }
      setShowModal(false);
      fetchServices();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save service');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await axios.delete(`/api/services/${id}`);
      fetchServices();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete service');
    }
  };

  const toggleStatus = async (service: any) => {
    const newStatus = service.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await axios.put(`/api/services/${service._id}`, { status: newStatus });
      fetchServices();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(services.length / itemsPerPage);
  const displayedServices = services.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ padding: '20px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Service Master</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Central database of all company services, pricing configurations, and deliverables templates.</p>
        </div>
        <button className="btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}>
          <Plus size={18} /> Add Service
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
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Search Service</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search by code or name..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                style={{ paddingLeft: '36px' }}
              />
              <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Category</label>
            <select className="input-field" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c: any) => (
                <option key={c._id} value={c.name}>{c.name}</option>
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

      {/* Services Table */}
      <div className="data-table-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading services...</div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Code</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Service Name</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Category</th>

                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Status</th>
                  <th style={{ padding: '16px 20px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedServices.map((service: any) => (
                  <tr key={service._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{service.code}</td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#334155' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{service.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{service.description || 'No description'}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#475569' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>
                        {service.category}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <button 
                        onClick={() => toggleStatus(service)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <span className={`badge ${service.status === 'Active' ? 'badge-green' : 'badge-gray'}`} style={{ cursor: 'pointer' }}>
                          {service.status || 'Active'}
                        </span>
                      </button>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleOpenEditModal(service)} className="btn-secondary" style={{ padding: '8px', borderRadius: '6px' }} title="Edit Service">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(service._id)} className="btn-danger" style={{ padding: '8px', borderRadius: '6px' }} title="Delete Service">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No services found.</td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {services.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                  Showing {Math.min(services.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(services.length, currentPage * itemsPerPage)} of {services.length} entries
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
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                {editingId ? 'Edit Service Details' : 'Add New Service'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Service Name *</label>
                  <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., SEO Basic" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Category *</label>
                  <select className="input-field" value={category} onChange={e => setCategory(e.target.value)} required>
                    {categories.filter((c: any) => c.status === 'Active' || c.name === category).map((c: any) => (
                      <option key={c._id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Description</label>
                <textarea className="input-field" value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: '80px', fontFamily: 'inherit' }} placeholder="Short details of the service..." />
              </div>



              {/* Deliverables templates */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#334155' }}>Deliverables Templates</h4>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '-4px 0 12px 0' }}>Configure default deliverable fields that will be filled when packages are created (e.g. "Keywords", "Reels", "Posts").</p>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Monthly Reports" 
                    value={newDeliverable} 
                    onChange={e => setNewDeliverable(e.target.value)} 
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddDeliverable())}
                  />
                  <button type="button" className="btn-secondary" onClick={handleAddDeliverable} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <Plus size={16} /> Add Field
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {deliverables.map((del, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
                      {del}
                      <button type="button" onClick={() => handleRemoveDeliverable(idx)} style={{ border: 'none', background: 'none', color: '#1e40af', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {deliverables.length === 0 && (
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>No deliverables configured yet.</div>
                  )}
                </div>
              </div>

              {/* Status and notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Status</label>
                  <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Internal Notes</label>
                  <input type="text" className="input-field" value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Administrative notes..." />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ padding: '10px 20px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={18} /> {editingId ? 'Update Service' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
