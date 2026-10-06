import { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Save, AlertCircle } from 'lucide-react';

export default function MyProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [sameAsCurrentAddress, setSameAsCurrentAddress] = useState(false);
  const [delayedProjects, setDelayedProjects] = useState<any[]>([]);

  const [formData, setFormData] = useState<any>({
    name: '',
    phone: '',
    alternativePhone: '',
    profilePhoto: '',
    currentAddress: '',
    permanentAddress: '',
    socialMediaProfile: '',
    emergencyContact: { name: '', phone: '', relation: '' }
  });

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`/api/users/${currentUser._id || currentUser.id}`);
      const user = res.data.data;
      const isSameAddr = Boolean(user.currentAddress && user.currentAddress === user.permanentAddress);
      setSameAsCurrentAddress(isSameAddr);
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        alternativePhone: user.alternativePhone || '',
        profilePhoto: user.profilePhoto || '',
        currentAddress: user.currentAddress || '',
        permanentAddress: user.permanentAddress || '',
        socialMediaProfile: user.socialMediaProfile || '',
        emergencyContact: {
          name: user.emergencyContact?.name || '',
          phone: user.emergencyContact?.phone || '',
          relation: user.emergencyContact?.relation || ''
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedProjectDelays = async () => {
    try {
      const res = await axios.get('/api/clients/my-projects');
      if (res.data.success) {
        const userId = currentUser._id || currentUser.id;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const delays: any[] = [];
        (res.data.data || []).forEach((p: any) => {
          if (p.projectStatus === 'Completed') return;

          const memberAss = (p.teamAssignments || []).find((ta: any) => String(ta.userId || ta.user?._id || ta.user) === String(userId));
          const memberObj = (p.assignedTeamMembers || []).find((m: any) => String(m._id || m.id) === String(userId));

          const endDateVal = memberAss?.endDate || memberObj?.endDate || p.serviceEndDate;
          if (endDateVal) {
            const endD = new Date(endDateVal);
            endD.setHours(0, 0, 0, 0);

            const diffMs = endD.getTime() - today.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
              const delayDays = Math.abs(diffDays);
              delays.push({
                projectId: p._id,
                companyName: p.companyName || p.name,
                delayDays,
                endDateStr: endD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              });
            }
          }
        });

        setDelayedProjects(delays);
      }
    } catch (err) {
      console.error('Error fetching assigned project delays for profile:', err);
    }
  };

  useEffect(() => {
    if (currentUser._id || currentUser.id) {
      fetchProfile();
      fetchAssignedProjectDelays();
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);
    setUploading(true);
    try {
      const res = await axios.post('/api/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData((prev: any) => ({ ...prev, profilePhoto: res.data.fileUrl }));
    } catch (err) {
      alert('Error uploading photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`/api/users/${currentUser._id || currentUser.id}`, formData);
      alert('Profile updated successfully!');
      
      // Update local storage user just in case name or photo changed
      const updatedUser = { ...currentUser, name: formData.name, profilePhoto: formData.profilePhoto };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Dispatch a custom event or just reload to update avatar in header
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px' }}>Loading Profile...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          My Profile
          {delayedProjects.length > 0 && (
            <span style={{ 
              background: '#fee2e2', 
              color: '#dc2626', 
              border: '2px solid #ef4444', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '12px', 
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              animation: 'pulse 2s infinite'
            }}>
              🔴 RED MARK: {delayedProjects.length} Delayed {delayedProjects.length === 1 ? 'Project' : 'Projects'}
            </span>
          )}
        </h1>
      </div>

      {/* OVERDUE ASSIGNED PROJECT RED ALERT BANNER */}
      {delayedProjects.length > 0 && (
        <div style={{
          background: '#fee2e2',
          border: '2px solid #dc2626',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          maxWidth: '800px',
          margin: '0 auto 24px auto',
          boxShadow: '0 4px 14px rgba(220, 38, 38, 0.18)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#7f1d1d', fontWeight: 800, fontSize: '16px', marginBottom: '12px' }}>
            <AlertCircle size={24} color="#dc2626" />
            <span>🚨 PROJECT DELAY ALERT ({delayedProjects.length})</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {delayedProjects.map((dp, idx) => (
              <div key={dp.projectId || idx} style={{
                background: '#ffffff',
                border: '1px solid #fca5a5',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '15px' }}>{dp.companyName}</div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                    Assigned Deadline: <strong>{dp.endDateStr}</strong>
                  </div>
                </div>
                <div style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  🚨 You are {dp.delayDays} {dp.delayDays === 1 ? 'day' : 'days'} delayed
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="data-table-container" style={{ padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
            {formData.profilePhoto ? (
              <img src={`${formData.profilePhoto}`} alt="avatar" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e2e8f0' }} />
            ) : (
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#f8fafc', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={30} color="#94a3b8" />
              </div>
            )}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Update Profile Photo</label>
              <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} style={{ fontSize: '14px' }} />
              {uploading && <span style={{ fontSize: '14px', color: '#2563eb', marginLeft: '10px' }}>Uploading...</span>}
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '14px' }}>Full Name *</label>
            <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>

          <div className="form-group">
            <label style={{ fontSize: '14px' }}>Phone Number</label>
            <input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>

          <div className="form-group">
            <label style={{ fontSize: '14px' }}>Alternative Phone</label>
            <input type="text" className="input-field" value={formData.alternativePhone} onChange={e => setFormData({...formData, alternativePhone: e.target.value})} />
          </div>

          <div className="form-group">
            <label style={{ fontSize: '14px' }}>Social Media Profile (LinkedIn, etc.)</label>
            <input type="text" className="input-field" value={formData.socialMediaProfile} onChange={e => setFormData({...formData, socialMediaProfile: e.target.value})} />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '14px' }}>Current Address</label>
            <input 
              type="text" 
              className="input-field" 
              value={formData.currentAddress} 
              onChange={e => {
                const val = e.target.value;
                setFormData((prev: any) => ({
                  ...prev,
                  currentAddress: val,
                  permanentAddress: sameAsCurrentAddress ? val : prev.permanentAddress
                }));
              }} 
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '-8px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#475569', fontWeight: 500, userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={sameAsCurrentAddress} 
                onChange={e => {
                  const checked = e.target.checked;
                  setSameAsCurrentAddress(checked);
                  if (checked) {
                    setFormData((prev: any) => ({
                      ...prev,
                      permanentAddress: prev.currentAddress
                    }));
                  }
                }} 
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
              />
              Permanent address is same as current address
            </label>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '14px' }}>Permanent Address</label>
            <input 
              type="text" 
              className="input-field" 
              value={formData.permanentAddress} 
              onChange={e => setFormData({...formData, permanentAddress: e.target.value})} 
              disabled={sameAsCurrentAddress}
              style={{ background: sameAsCurrentAddress ? '#f1f5f9' : '#ffffff' }}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '10px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '15px' }}>Emergency Contact</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '14px' }}>Name</label>
                <input type="text" className="input-field" value={formData.emergencyContact.name} onChange={e => setFormData({...formData, emergencyContact: {...formData.emergencyContact, name: e.target.value}})} />
              </div>
              <div>
                <label style={{ fontSize: '14px' }}>Relation</label>
                <input type="text" className="input-field" value={formData.emergencyContact.relation} onChange={e => setFormData({...formData, emergencyContact: {...formData.emergencyContact, relation: e.target.value}})} />
              </div>
              <div>
                <label style={{ fontSize: '14px' }}>Phone</label>
                <input type="text" className="input-field" value={formData.emergencyContact.phone} onChange={e => setFormData({...formData, emergencyContact: {...formData.emergencyContact, phone: e.target.value}})} />
              </div>
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
            <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }} disabled={saving}>
              <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
