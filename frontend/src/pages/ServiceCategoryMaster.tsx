import { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Edit } from 'lucide-react';

export default function ServiceCategoryMaster() {
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Active');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/service-categories');
      if (res.data.success) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editingId) {
        await axios.put(`/api/service-categories/${editingId}`, { name: name.trim(), status });
      } else {
        await axios.post('/api/service-categories', { name: name.trim(), status });
      }
      setName('');
      setStatus('Active');
      setEditingId(null);
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save service category');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (cat: any) => {
    setEditingId(cat._id);
    setName(cat.name);
    setStatus(cat.status || 'Active');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setStatus('Active');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await axios.delete(`/api/service-categories/${id}`);
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete service category');
    }
  };

  const toggleStatus = async (cat: any) => {
    const newStatus = cat.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await axios.put(`/api/service-categories/${cat._id}`, { status: newStatus });
      fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(categories.length / itemsPerPage);
  const displayedCategories = categories.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ padding: '20px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Service Category Master</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Manage service categories which are dynamically loaded in dropdowns across packages and services.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Form Card */}
        <div className="chart-card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0', alignSelf: 'start' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
            {editingId ? 'Edit Service Category' : 'Add New Category'}
          </h3>
          {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
          
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Category Name *</label>
              <input 
                type="text" 
                className="input-field" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Artificial Intelligence"
                required
              />
            </div>
            
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Status</label>
              <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Saving...' : editingId ? 'Update Category' : 'Add Category'}
              </button>
              {editingId && (
                <button type="button" className="btn-secondary" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Categories Table */}
        <div className="data-table-container" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Category Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedCategories.map((cat: any) => (
                <tr key={cat._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{cat.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => toggleStatus(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <span className={`badge ${cat.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>
                        {cat.status || 'Active'}
                      </span>
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleEditClick(cat)} className="btn-secondary" style={{ padding: '6px 10px', borderRadius: '4px' }}>
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(cat._id)} className="btn-danger" style={{ padding: '6px 10px', borderRadius: '4px' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No service categories found.</td>
                </tr>
              )}
            </tbody>
          </table>

          {categories.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                Showing {Math.min(categories.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(categories.length, currentPage * itemsPerPage)} of {categories.length} entries
              </span>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button className="btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: '4px 8px', fontSize: '12px' }}>Previous</button>
                <button className="btn-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ padding: '4px 8px', fontSize: '12px' }}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
