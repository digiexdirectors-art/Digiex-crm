import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function HolidayManagement() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', date: '', description: '', type: 'Public' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(holidays.length / itemsPerPage);
  const displayedHolidays = holidays.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [holidays.length, totalPages, currentPage]);

  const fetchHolidays = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/holidays');
      setHolidays(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleOpenNew = () => {
    setEditingHoliday(null);
    setFormData({ name: '', date: '', description: '', type: 'Public' });
    setShowModal(true);
  };

  const handleEdit = (holiday: any) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      date: new Date(holiday.date).toISOString().split('T')[0],
      description: holiday.description || '',
      type: holiday.type || 'Public'
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingHoliday) {
        await axios.put(`http://localhost:5000/api/holidays/${editingHoliday._id}`, formData);
      } else {
        await axios.post('http://localhost:5000/api/holidays', formData);
      }
      setShowModal(false);
      fetchHolidays();
    } catch (err) {
      alert('Error saving holiday');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/holidays/${id}`);
      fetchHolidays();
    } catch (err) {
      alert('Error deleting holiday');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Holiday Management</h1>
        <button className="btn-primary" onClick={handleOpenNew}>
          <Plus size={18} /> Add Holiday
        </button>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>Loading holidays...</div>
        ) : (
          <>
            <table>
            <thead>
              <tr>
                <th>Holiday Name</th>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedHolidays.map(h => (
                <tr key={h._id}>
                  <td style={{ fontWeight: 600 }}>{h.name}</td>
                  <td>{new Date(h.date).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${h.type === 'Public' ? 'badge-blue' : h.type === 'Company' ? 'badge-green' : 'badge-gray'}`}>
                      {h.type}
                    </span>
                  </td>
                  <td>{h.description || '-'}</td>
                  <td>
                    <button className="btn-secondary" style={{ padding: '6px 12px', marginRight: '8px' }} onClick={() => handleEdit(h)}>
                      <Edit size={16} />
                    </button>
                    <button className="btn-danger" style={{ padding: '6px 12px' }} onClick={() => handleDelete(h._id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center' }}>No holidays found.</td>
                </tr>
              )}
            </tbody>
          </table>
          {holidays.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Showing {Math.min(holidays.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(holidays.length, currentPage * itemsPerPage)} of {holidays.length} entries
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
              <h3>{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="auth-form" style={{ padding: '20px' }}>
              <div className="form-group">
                <label>Holiday Name *</label>
                <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="Public">Public</option>
                  <option value="Company">Company</option>
                  <option value="Optional">Optional</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="input-field" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Holiday</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
