import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, MapPin, X } from 'lucide-react';

export default function LocationManagement() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(locations.length / itemsPerPage);
  const displayedLocations = locations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [locations.length, totalPages, currentPage]);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    status: 'Active'
  });

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/locations');
      setLocations(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/locations/${editingId}`, formData);
      } else {
        await axios.post('http://localhost:5000/api/locations', formData);
      }
      setShowModal(false);
      setFormData({ name: '', address: '', city: '', state: '', country: 'India', status: 'Active' });
      setEditingId(null);
      fetchLocations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving location');
    }
  };

  const handleEdit = (location: any) => {
    setFormData({
      name: location.name,
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      country: location.country || 'India',
      status: location.status || 'Active'
    });
    setEditingId(location._id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/locations/${id}`);
      fetchLocations();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Location Management</h1>
        <button className="btn-primary" onClick={() => {
          setEditingId(null);
          setFormData({ name: '', address: '', city: '', state: '', country: 'India', status: 'Active' });
          setShowModal(true);
        }}>
          <Plus size={16} style={{ marginRight: '8px' }} /> Add Location
        </button>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading locations...</div>
        ) : (
          <>
            <table>
            <thead>
              <tr>
                <th>Location Name</th>
                <th>Address</th>
                <th>City & State</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
               {displayedLocations.map((loc) => (
                <tr key={loc._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <MapPin size={16} color="#64748b" />
                      {loc.name}
                    </div>
                  </td>
                  <td>{loc.address || '-'}</td>
                  <td>
                    {loc.city && loc.state ? `${loc.city}, ${loc.state}` : (loc.city || loc.state || '-')}
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{loc.country}</div>
                  </td>
                  <td>
                    <span className={`badge ${loc.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                      {loc.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button className="btn-icon" onClick={() => handleEdit(loc)}>
                        <Edit2 size={18} color="#3b82f6" />
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(loc._id)}>
                        <Trash2 size={18} color="#ef4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>No locations found</td>
                </tr>
              )}
            </tbody>
          </table>
          {locations.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Showing {Math.min(locations.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(locations.length, currentPage * itemsPerPage)} of {locations.length} entries
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
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Location' : 'Add New Location'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Location Name *</label>
                  <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Head Office, Mumbai Branch" />
                </div>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Address</label>
                  <input type="text" className="input-field" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>City</label>
                    <input type="text" className="input-field" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>State</label>
                    <input type="text" className="input-field" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Country</label>
                    <input type="text" className="input-field" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Status</label>
                    <select className="input-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Location</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
