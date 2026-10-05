import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit } from 'lucide-react';

export default function UserTypeManagement() {
  const [userTypes, setUserTypes] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(userTypes.length / itemsPerPage);
  const displayedUserTypes = userTypes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [userTypes.length, totalPages, currentPage]);

  const fetchUserTypes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/usertypes');
      setUserTypes(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUserTypes();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/usertypes/${editingId}`, { name });
      } else {
        await axios.post('http://localhost:5000/api/usertypes', { name });
      }
      setName('');
      setEditingId(null);
      fetchUserTypes();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save User Type');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (ut: any) => {
    setEditingId(ut._id);
    setName(ut.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user type?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/usertypes/${id}`);
      fetchUserTypes();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">User Type Management</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div className="chart-card">
          <h3>{editingId ? 'Edit User Type' : 'Add New User Type'}</h3>
          {error && <div className="error-text">{error}</div>}
          <form onSubmit={handleAdd} className="auth-form">
            <div className="form-group">
              <label>User Type Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Regional Manager"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                <Plus size={18} /> {loading ? 'Saving...' : editingId ? 'Update User Type' : 'Add User Type'}
              </button>
              {editingId && (
                <button type="button" className="btn-secondary" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="data-table-container">
          <table>
            <thead>
              <tr>
                <th>User Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedUserTypes.map((ut: any) => (
                <tr key={ut._id}>
                  <td>{ut.name}</td>
                  <td>
                    <span className={`badge ${ut.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {ut.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleEditClick(ut)} className="btn-secondary" style={{ padding: '6px 12px' }}>
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(ut._id)} className="btn-danger" style={{ padding: '6px 12px' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {userTypes.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center' }}>No user types found.</td>
                </tr>
              )}
            </tbody>
          </table>
          {userTypes.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Showing {Math.min(userTypes.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(userTypes.length, currentPage * itemsPerPage)} of {userTypes.length} entries
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
        </div>
      </div>
    </div>
  );
}
