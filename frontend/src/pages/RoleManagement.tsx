import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit } from 'lucide-react';

export default function RoleManagement() {
  const [roles, setRoles] = useState<any[]>([]);
  const [userTypes, setUserTypes] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(roles.length / itemsPerPage);
  const displayedRoles = roles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [roles.length, totalPages, currentPage]);
  const [showModal, setShowModal] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', userType: '', department: '' });

  const fetchData = async () => {
    try {
      const [rolesRes, utRes, deptRes] = await Promise.all([
        axios.get('http://localhost:5000/api/roles'),
        axios.get('http://localhost:5000/api/usertypes'),
        axios.get('http://localhost:5000/api/departments')
      ]);
      setRoles(rolesRes.data.data);
      setUserTypes(utRes.data.data);
      setDepartments(deptRes.data.data);
      
      if (utRes.data.data.length > 0 && deptRes.data.data.length > 0) {
        setFormData(prev => ({
          ...prev,
          userType: prev.userType || utRes.data.data[0]._id,
          department: prev.department || deptRes.data.data[0]._id
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoleId) {
        await axios.put(`http://localhost:5000/api/roles/${editingRoleId}`, formData);
      } else {
        await axios.post('http://localhost:5000/api/roles', formData);
      }
      setShowModal(false);
      setEditingRoleId(null);
      setFormData({ name: '', userType: userTypes[0]?._id, department: departments[0]?._id });
      fetchData();
    } catch (err) {
      alert(editingRoleId ? 'Error updating role' : 'Error creating role');
    }
  };

  const handleEditClick = (role: any) => {
    setEditingRoleId(role._id);
    setFormData({
      name: role.name,
      userType: role.userType?._id || role.userType,
      department: role.department?._id || role.department
    });
    setShowModal(true);
  };

  const handleOpenNew = () => {
    setEditingRoleId(null);
    setFormData({ name: '', userType: userTypes[0]?._id, department: departments[0]?._id });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/roles/${id}`);
      fetchData();
    } catch (err) {
      alert('Error deleting role');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Role Management</h1>
        <button className="btn-primary" onClick={handleOpenNew}>
          <Plus size={18} /> Add New Role
        </button>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>Loading roles...</div>
        ) : (
          <>
            <table>
            <thead>
              <tr>
                <th>Role Name</th>
                <th>User Type</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedRoles.map(role => (
                <tr key={role._id}>
                  <td style={{ fontWeight: 500 }}>{role.name}</td>
                  <td><span className="badge badge-blue">{role.userType?.name || 'N/A'}</span></td>
                  <td><span className="badge badge-gray">{role.department?.name || 'N/A'}</span></td>
                  <td>
                    <span className={`badge ${role.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {role.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => handleEditClick(role)}>
                      <Edit size={16} />
                    </button>
                    <button className="btn-danger" style={{ padding: '6px 12px' }} onClick={() => handleDelete(role._id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center' }}>No roles found.</td>
                </tr>
              )}
            </tbody>
          </table>
          {roles.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Showing {Math.min(roles.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(roles.length, currentPage * itemsPerPage)} of {roles.length} entries
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
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingRoleId ? 'Edit Role' : 'Add New Role'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} className="auth-form">
              <div className="form-group">
                <label>Role Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <label>User Type</label>
                <select 
                  className="input-field"
                  value={formData.userType}
                  onChange={e => setFormData({...formData, userType: e.target.value})}
                  required
                >
                  <option value="" disabled>Select User Type</option>
                  {userTypes.map(ut => (
                    <option key={ut._id} value={ut._id}>{ut.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Department</label>
                <select 
                  className="input-field"
                  value={formData.department}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                  required
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map(dept => (
                    <option key={dept._id} value={dept._id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Role</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
