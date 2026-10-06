import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Save, Building2, Globe, Mail, Phone, Building, MapPin, Plus, Edit2, Trash2, X, ShieldCheck, CheckSquare, Square, Lock } from 'lucide-react';

export default function Settings() {
  const [searchParams] = useSearchParams();
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = (user?.role?.name || '').toLowerCase().trim();
  // const userDept = (typeof user?.role?.department === 'object' ? user?.role?.department?.name : user?.role?.department || '').toLowerCase().trim();
  const userType = (typeof user?.role?.userType === 'object' ? user?.role?.userType?.name : user?.role?.userType || '').toLowerCase().trim();

  const isAdmin = ['admin', 'super admin'].includes(userRole) || ['admin', 'super admin'].includes(userType);
  
  const hasSubmenuAccess = isAdmin;

  // const isManager = userRole.includes('manager') || userRole.includes('head') || userRole.includes('lead');
  // const isSalesOrTele = ['sales', 'telemarketing', 'telecaller', 'marketing', 'bdm', 'executive'].some(keyword => userRole.includes(keyword) || userDept.includes(keyword));
  const hasLocationAccess = isAdmin;
  const hasCategoryAccess = true;

  const getValidTab = (tabName: string | null) => {
    const validTabs: string[] = [];
    if (hasSubmenuAccess) {
      validTabs.push('company', 'address', 'leaves', 'attendance', 'payment');
    }
    if (hasLocationAccess) {
      validTabs.push('locations');
    }
    if (hasCategoryAccess) {
      validTabs.push('business-categories', 'business-subcategories');
    }
    
    if (validTabs.length === 0) return 'denied';
    
    if (!tabName || !validTabs.includes(tabName)) {
      return validTabs[0];
    }
    return tabName;
  };

  const initialTab = getValidTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    setActiveTab(getValidTab(tab));
  }, [searchParams, hasSubmenuAccess]);

  // Company Settings States
  const [companyName, setCompanyName] = useState('DIGIEX WEB SERVICES');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [companyGst, setCompanyGst] = useState('');

  // Business Address States
  const [addressLine1, setAddressLine1] = useState('Chinar Park');
  const [city, setCity] = useState('Kolkata');
  const [state, setState] = useState('West Bengal');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('India');

  // Leave & Attendance States
  const [confirmationPeriod, setConfirmationPeriod] = useState(3);
  const [annualLeaves, setAnnualLeaves] = useState(22);
  const [maxMonthlyLeaves, setMaxMonthlyLeaves] = useState(2);
  const [gracePeriod, setGracePeriod] = useState(15);
  const [officeIP, setOfficeIP] = useState('');
  const [officeLat, setOfficeLat] = useState(22.6288);
  const [officeLng, setOfficeLng] = useState(88.4357);
  const [officeRadius, setOfficeRadius] = useState(100);

  // Payment Settings States
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [razorpayMode, setRazorpayMode] = useState('test');
  const [ccavenueMerchantId, setCcavenueMerchantId] = useState('');
  const [ccavenueAccessCode, setCcavenueAccessCode] = useState('');
  const [ccavenueWorkingKey, setCcavenueWorkingKey] = useState('');
  const [ccavenueMode, setCcavenueMode] = useState('test');

  // Locations Management states
  const [locations, setLocations] = useState<any[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [locFormData, setLocFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    status: 'Active'
  });

  // Business Categories states
  const [categories, setCategories] = useState<any[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catNameForm, setCatNameForm] = useState('');

  // Business Subcategories states
  const [selectedCatId, setSelectedCatId] = useState('');
  const [showSubcatModal, setShowSubcatModal] = useState(false);
  const [editingSubcatIndex, setEditingSubcatIndex] = useState<number | null>(null);
  const [subcatNameForm, setSubcatNameForm] = useState('');

  // Menu Permissions States
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);

  const fetchRolesAndPermissions = async () => {
    try {
      const [rolesRes, settingsRes] = await Promise.all([
        axios.get('/api/roles'),
        axios.get('/api/settings')
      ]);

      const fetchedRoles = rolesRes.data.data || [];
      setAllRoles(fetchedRoles);

      const savedPermsSetting = (settingsRes.data.data || []).find((s: any) => s.key === 'role_menu_permissions')?.value;
      const initialPerms: Record<string, Record<string, boolean>> = savedPermsSetting ? (typeof savedPermsSetting === 'string' ? JSON.parse(savedPermsSetting) : savedPermsSetting) : {};

      const updatedPerms: Record<string, Record<string, boolean>> = { ...initialPerms };
      fetchedRoles.forEach((role: any) => {
        const roleId = role._id;
        const roleName = (role.name || '').toLowerCase().trim();
        const isAdminRole = roleName === 'admin' || roleName === 'super admin';
        const isHrRole = roleName.includes('hr') || roleName.includes('human resource');

        if (!updatedPerms[roleId]) {
          updatedPerms[roleId] = {
            dashboard: true,
            employees: true,
            crm: true,
            packages: true,
            attendance: true,
            payroll: true,
            leaves: true,
            marketing_tracking: isAdminRole,
            settings: isAdminRole
          };
        }
      });

      setRolePermissions(updatedPerms);
    } catch (err) {
      console.error('Error fetching roles and permissions:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      const data = res.data.data;
      
      const getVal = (key: string) => data.find((s: any) => s.key === key)?.value;

      if (getVal('company_name')) setCompanyName(getVal('company_name'));
      if (getVal('company_email')) setCompanyEmail(getVal('company_email'));
      if (getVal('company_phone')) setCompanyPhone(getVal('company_phone'));
      if (getVal('company_website')) setCompanyWebsite(getVal('company_website'));
      if (getVal('company_logo')) setCompanyLogo(getVal('company_logo'));
      if (getVal('company_gst')) setCompanyGst(getVal('company_gst'));

      if (getVal('address_line1')) setAddressLine1(getVal('address_line1'));
      if (getVal('address_city')) setCity(getVal('address_city'));
      if (getVal('address_state')) setState(getVal('address_state'));
      if (getVal('address_zip')) setZipCode(getVal('address_zip'));
      if (getVal('address_country')) setCountry(getVal('address_country'));

      if (getVal('confirmation_period')) setConfirmationPeriod(Number(getVal('confirmation_period')));
      if (getVal('annual_leaves')) setAnnualLeaves(Number(getVal('annual_leaves')));
      if (getVal('max_monthly_leaves')) setMaxMonthlyLeaves(Number(getVal('max_monthly_leaves')));
      if (getVal('attendance_grace_period')) setGracePeriod(Number(getVal('attendance_grace_period')));
      if (getVal('allowed_office_ip')) setOfficeIP(getVal('allowed_office_ip'));
      if (getVal('office_location_lat')) setOfficeLat(Number(getVal('office_location_lat')));
      if (getVal('office_location_lng')) setOfficeLng(Number(getVal('office_location_lng')));
      if (getVal('office_location_radius')) setOfficeRadius(Number(getVal('office_location_radius')));

      if (getVal('razorpay_key_id')) setRazorpayKeyId(getVal('razorpay_key_id'));
      if (getVal('razorpay_key_secret')) setRazorpayKeySecret(getVal('razorpay_key_secret'));
      if (getVal('razorpay_mode')) setRazorpayMode(getVal('razorpay_mode'));
      if (getVal('ccavenue_merchant_id')) setCcavenueMerchantId(getVal('ccavenue_merchant_id'));
      if (getVal('ccavenue_access_code')) setCcavenueAccessCode(getVal('ccavenue_access_code'));
      if (getVal('ccavenue_working_key')) setCcavenueWorkingKey(getVal('ccavenue_working_key'));
      if (getVal('ccavenue_mode')) setCcavenueMode(getVal('ccavenue_mode'));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Locations APIs
  const fetchLocations = async () => {
    setLocLoading(true);
    try {
      const res = await axios.get('/api/locations');
      setLocations(res.data.data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLocLoading(false);
    }
  };

  const handleLocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLocId) {
        await axios.put(`/api/locations/${editingLocId}`, locFormData);
        alert('Location updated successfully!');
      } else {
        await axios.post('/api/locations', locFormData);
        alert('Location added successfully!');
      }
      setShowLocModal(false);
      setLocFormData({ name: '', address: '', city: '', state: '', country: 'India', status: 'Active' });
      setEditingLocId(null);
      fetchLocations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving location');
    }
  };

  const handleLocEdit = (location: any) => {
    setLocFormData({
      name: location.name,
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      country: location.country || 'India',
      status: location.status || 'Active'
    });
    setEditingLocId(location._id);
    setShowLocModal(true);
  };

  const handleLocDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    try {
      await axios.delete(`/api/locations/${id}`);
      alert('Location deleted successfully!');
      fetchLocations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deleting location');
    }
  };

  // Categories APIs
  const fetchCategories = async () => {
    setCatLoading(true);
    try {
      const res = await axios.get('/api/business-categories');
      setCategories(res.data.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setCatLoading(false);
    }
  };

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameForm.trim()) return;
    try {
      if (editingCatId) {
        await axios.put(`/api/business-categories/${editingCatId}`, { name: catNameForm.trim() });
        alert('Category updated successfully!');
      } else {
        await axios.post('/api/business-categories', { name: catNameForm.trim() });
        alert('Category added successfully!');
      }
      setShowCatModal(false);
      setCatNameForm('');
      setEditingCatId(null);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving category');
    }
  };

  const handleCatEdit = (cat: any) => {
    setCatNameForm(cat.name);
    setEditingCatId(cat._id);
    setShowCatModal(true);
  };

  const handleCatDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category? All its subcategories will be lost.')) return;
    try {
      await axios.delete(`/api/business-categories/${id}`);
      alert('Category deleted successfully!');
      fetchCategories();
      if (selectedCatId === id) setSelectedCatId('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deleting category');
    }
  };

  // Subcategories APIs
  const handleSubcatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subcatNameForm.trim() || !selectedCatId) return;
    
    const cat = categories.find(c => c._id === selectedCatId);
    if (!cat) return;

    let updatedSubcats = [...cat.subcategories];
    
    if (editingSubcatIndex !== null) {
      const exists = updatedSubcats.some((sub, idx) => idx !== editingSubcatIndex && sub.toLowerCase() === subcatNameForm.trim().toLowerCase());
      if (exists) {
        alert('Subcategory already exists');
        return;
      }
      updatedSubcats[editingSubcatIndex] = subcatNameForm.trim();
    } else {
      const exists = updatedSubcats.some(sub => sub.toLowerCase() === subcatNameForm.trim().toLowerCase());
      if (exists) {
        alert('Subcategory already exists');
        return;
      }
      updatedSubcats.push(subcatNameForm.trim());
    }

    try {
      await axios.put(`/api/business-categories/${selectedCatId}`, { subcategories: updatedSubcats });
      alert(editingSubcatIndex !== null ? 'Subcategory updated successfully!' : 'Subcategory added successfully!');
      setShowSubcatModal(false);
      setSubcatNameForm('');
      setEditingSubcatIndex(null);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving subcategory');
    }
  };

  const handleSubcatEdit = (name: string, index: number) => {
    setSubcatNameForm(name);
    setEditingSubcatIndex(index);
    setShowSubcatModal(true);
  };

  const handleSubcatDelete = async (index: number) => {
    if (!window.confirm('Are you sure you want to delete this subcategory?')) return;
    const cat = categories.find(c => c._id === selectedCatId);
    if (!cat) return;

    const updatedSubcats = cat.subcategories.filter((_: any, idx: number) => idx !== index);

    try {
      await axios.put(`/api/business-categories/${selectedCatId}`, { subcategories: updatedSubcats });
      alert('Subcategory deleted successfully!');
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deleting subcategory');
    }
  };

  const handleSaveMenuPermissions = async () => {
    setSavingPermissions(true);
    try {
      await axios.post('/api/settings', {
        key: 'role_menu_permissions',
        value: rolePermissions
      });
      alert('Role menu permissions saved successfully!');
      window.dispatchEvent(new CustomEvent('menu-permissions-updated'));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving menu permissions');
    } finally {
      setSavingPermissions(false);
    }
  };

  const toggleRolePermission = (roleId: string, menuKey: string) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: {
        ...(prev[roleId] || {}),
        [menuKey]: !prev[roleId]?.[menuKey]
      }
    }));
  };

  const toggleAllPermissionsForRole = (roleId: string, enable: boolean) => {
    const menus = ['dashboard', 'employees', 'crm', 'packages', 'attendance', 'payroll', 'leaves', 'marketing_tracking', 'settings'];
    const updated: Record<string, boolean> = {};
    menus.forEach(m => { updated[m] = enable; });
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: updated
    }));
  };

  useEffect(() => {
    fetchSettings();
    fetchLocations();
    fetchCategories();
    fetchRolesAndPermissions();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await axios.post('/api/upload', formData);
      setCompanyLogo(res.data.fileUrl);
    } catch (err) {
      alert('Error uploading logo');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const settingsToSave = [
        { key: 'company_name', value: companyName },
        { key: 'company_email', value: companyEmail },
        { key: 'company_phone', value: companyPhone },
        { key: 'company_website', value: companyWebsite },
        { key: 'company_logo', value: companyLogo },
        { key: 'company_gst', value: companyGst },
        { key: 'address_line1', value: addressLine1 },
        { key: 'address_city', value: city },
        { key: 'address_state', value: state },
        { key: 'address_zip', value: zipCode },
        { key: 'address_country', value: country },
        { key: 'confirmation_period', value: confirmationPeriod },
        { key: 'annual_leaves', value: annualLeaves },
        { key: 'max_monthly_leaves', value: maxMonthlyLeaves },
        { key: 'attendance_grace_period', value: gracePeriod },
        { key: 'allowed_office_ip', value: officeIP },
        { key: 'office_location_lat', value: officeLat },
        { key: 'office_location_lng', value: officeLng },
        { key: 'office_location_radius', value: officeRadius },
        { key: 'razorpay_key_id', value: razorpayKeyId },
        { key: 'razorpay_key_secret', value: razorpayKeySecret },
        { key: 'razorpay_mode', value: razorpayMode },
        { key: 'ccavenue_merchant_id', value: ccavenueMerchantId },
        { key: 'ccavenue_access_code', value: ccavenueAccessCode },
        { key: 'ccavenue_working_key', value: ccavenueWorkingKey },
        { key: 'ccavenue_mode', value: ccavenueMode }
      ];

      await Promise.all(settingsToSave.map(s => axios.post('/api/settings', s)));
      alert('Settings updated successfully');
    } catch (err) {
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  // Pagination limits
  const itemsPerPage = 20;

  // Locations pagination
  const [locPage, setLocPage] = useState(1);
  const totalLocPages = Math.ceil(locations.length / itemsPerPage);
  const displayedLocations = locations.slice((locPage - 1) * itemsPerPage, locPage * itemsPerPage);

  // Categories pagination
  const [catPage, setCatPage] = useState(1);
  const totalCatPages = Math.ceil(categories.length / itemsPerPage);
  const displayedCategories = categories.slice((catPage - 1) * itemsPerPage, catPage * itemsPerPage);

  // Subcategories pagination
  const [subcatPage, setSubcatPage] = useState(1);
  const activeCategoryForSub = categories.find(c => c._id === selectedCatId);
  const subcategoriesList = activeCategoryForSub ? activeCategoryForSub.subcategories : [];
  const totalSubcatPages = Math.ceil(subcategoriesList.length / itemsPerPage);
  const displayedSubcategories = subcategoriesList.slice((subcatPage - 1) * itemsPerPage, subcatPage * itemsPerPage);

  // Reset pagination if lists shrink
  useEffect(() => {
    if (locPage > 1 && locPage > totalLocPages) {
      setLocPage(Math.max(1, totalLocPages));
    }
  }, [locations.length, totalLocPages, locPage]);

  useEffect(() => {
    if (catPage > 1 && catPage > totalCatPages) {
      setCatPage(Math.max(1, totalCatPages));
    }
  }, [categories.length, totalCatPages, catPage]);

  useEffect(() => {
    if (subcatPage > 1 && subcatPage > totalSubcatPages) {
      setSubcatPage(Math.max(1, totalSubcatPages));
    }
  }, [subcategoriesList.length, totalSubcatPages, subcatPage]);

  if (loading) return <div style={{ padding: '30px' }}>Loading configuration...</div>;

  if (activeTab === 'denied') {
    return <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px', fontWeight: 600, color: '#ef4444' }}>Access Denied</div>;
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="page-header">
        <h1 className="page-title">
          {activeTab === 'company' && 'Company Management'}
          {activeTab === 'address' && 'Business Management'}
          {activeTab === 'leaves' && 'Company Leave Rules'}
          {activeTab === 'attendance' && 'Attendance Rules'}
          {activeTab === 'payment' && 'Payment Settings'}
          {activeTab === 'locations' && 'Location Management'}
          {activeTab === 'business-categories' && 'Business Category Management'}
          {activeTab === 'business-subcategories' && 'Business Subcategory Management'}
          {activeTab === 'menu-permissions' && 'Role-Based Menu Visibility Permissions'}
        </h1>
      </div>

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        
        {/* Right Side Body Content (Now Full Width) */}
        <div style={{ flex: 1, background: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          {['company', 'address', 'leaves', 'attendance', 'payment'].includes(activeTab) ? (
            <form onSubmit={handleSaveSettings}>
              
              {activeTab === 'company' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Company Profile</h2>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Manage your company identity and public information.</p>
                  </div>

                  <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                    <div style={{ width: '120px', height: '120px', borderRadius: '16px', background: '#f8fafc', border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                      {companyLogo ? (
                        <img src={`${companyLogo}`} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Building size={40} color="#cbd5e1" />
                      )}
                      {uploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>Up...</div>}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px' }}>Company Logo</label>
                      <input type="file" accept="image/*" onChange={handleFileUpload} style={{ fontSize: '13px' }} />
                      <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Recommended size: 200x200px. Supports PNG, JPG.</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}><Building2 size={16} /> Company Name</label>
                      <input type="text" className="input-field" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}><Mail size={16} /> Company Email</label>
                      <input type="email" className="input-field" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}><Phone size={16} /> Company Phone</label>
                      <input type="text" className="input-field" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}><Globe size={16} /> Company Website</label>
                      <input type="text" className="input-field" value={companyWebsite} onChange={e => setCompanyWebsite(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}><Building2 size={16} /> Company GST Number</label>
                      <input type="text" className="input-field" placeholder="Enter company GSTIN" value={companyGst} onChange={e => setCompanyGst(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'address' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Business Address</h2>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>This information will be displayed on salary slips and official documents.</p>
                  </div>

                  <div style={{ gridTemplateColumns: '1fr', gap: '20px', display: 'grid' }}>
                    <div className="form-group">
                      <label style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Address Line 1</label>
                      <input type="text" className="input-field" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div className="form-group">
                        <label style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>City</label>
                        <input type="text" className="input-field" value={city} onChange={e => setCity(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>State / Province</label>
                        <input type="text" className="input-field" value={state} onChange={e => setState(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>ZIP / Postal Code</label>
                        <input type="text" className="input-field" value={zipCode} onChange={e => setZipCode(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label style={{ marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Country</label>
                        <input type="text" className="input-field" value={country} onChange={e => setCountry(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'leaves' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Leave Configuration</h2>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Define how leaves are accrued and used across the organization.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Confirmation Period (Months)</label>
                      <input type="number" className="input-field" value={confirmationPeriod} onChange={e => setConfirmationPeriod(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Annual Leave Quota (Days)</label>
                      <input type="number" className="input-field" value={annualLeaves} onChange={e => setAnnualLeaves(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Max Monthly Leaves</label>
                      <input type="number" className="input-field" value={maxMonthlyLeaves} onChange={e => setMaxMonthlyLeaves(Number(e.target.value))} />
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Policy Overview</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                      • Leaves available after {confirmationPeriod} months of joining.<br/>
                      • Formula: (Annual Quota / 12) * Months remaining from confirmation.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'attendance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Attendance & Location Rules</h2>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Restrict clock-in based on IP address and geographic location.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Grace Period (Minutes)</label>
                      <input type="number" className="input-field" value={gracePeriod} onChange={e => setGracePeriod(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Allowed Office IP</label>
                      <input type="text" className="input-field" value={officeIP} onChange={e => setOfficeIP(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Office Latitude</label>
                      <input type="number" step="0.0001" className="input-field" value={officeLat} onChange={e => setOfficeLat(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Office Longitude</label>
                      <input type="number" step="0.0001" className="input-field" value={officeLng} onChange={e => setOfficeLng(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                      <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Location Radius (Meters)</label>
                      <input type="number" className="input-field" value={officeRadius} onChange={e => setOfficeRadius(Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'payment' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                     <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Payment Settings</h2>
                     <p style={{ color: '#64748b', fontSize: '14px' }}>Configure payment gateways for test and live transactions.</p>
                  </div>

                  {/* Payment Testing Guide Box */}
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e40af', margin: 0 }}>ℹ️ Payment Integration & Test Mode Guide</h3>
                    <p style={{ fontSize: '13px', color: '#1e3a8a', margin: 0, lineHeight: 1.5 }}>
                      The CRM checkout and invoice payment flows use these settings to authorize transactions. Payments will only be allowed if the corresponding keys are configured below.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '5px' }}>
                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                        <strong style={{ fontSize: '12px', color: '#1e3a8a', display: 'block', marginBottom: '4px' }}>🔑 Razorpay Test Credentials:</strong>
                        <span style={{ fontSize: '11px', color: '#3b82f6', display: 'block', fontFamily: 'monospace' }}>Key ID: rzp_test_XXXXXXXXXXXXXXXX</span>
                        <span style={{ fontSize: '11px', color: '#3b82f6', display: 'block', fontFamily: 'monospace' }}>Key Secret: XXXXXXXXXXXXXXXXXXXXXXXX</span>
                        <span style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginTop: '6px' }}>💳 Test Card: 4111 1111 1111 1111 | Expiry: Future | CVV: 123 | OTP: 123456</span>
                      </div>
                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                        <strong style={{ fontSize: '12px', color: '#1e3a8a', display: 'block', marginBottom: '4px' }}>🔑 CCAvenue Test Credentials:</strong>
                        <span style={{ fontSize: '11px', color: '#3b82f6', display: 'block', fontFamily: 'monospace' }}>Merchant ID: 123456 (numeric)</span>
                        <span style={{ fontSize: '11px', color: '#3b82f6', display: 'block', fontFamily: 'monospace' }}>Access Code: AVXXXXXXXXXXXXXXXX</span>
                        <span style={{ fontSize: '11px', color: '#3b82f6', display: 'block', fontFamily: 'monospace' }}>Working Key: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</span>
                        <span style={{ fontSize: '11px', color: '#4b5563', display: 'block', marginTop: '6px' }}>💳 Test Card: 4111 2222 3333 4444 | Expiry: Future | CVV: 123 | OTP: 123456</span>
                      </div>
                    </div>
                  </div>

                  {/* Razorpay Section */}
                  <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                     <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       💳 Razorpay Gateway Configuration
                     </h3>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                       <div className="form-group" style={{ margin: 0 }}>
                         <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Key ID</label>
                         <input type="text" className="input-field" value={razorpayKeyId} onChange={e => setRazorpayKeyId(e.target.value)} placeholder="rzp_test_..." />
                       </div>
                       <div className="form-group" style={{ margin: 0 }}>
                         <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Key Secret</label>
                         <input type="password" className="input-field" value={razorpayKeySecret} onChange={e => setRazorpayKeySecret(e.target.value)} placeholder="••••••••••••••••" />
                       </div>
                     </div>
                     <div className="form-group" style={{ margin: 0 }}>
                       <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Mode</label>
                       <select className="input-field" value={razorpayMode} onChange={e => setRazorpayMode(e.target.value)} style={{ maxWidth: '200px' }}>
                         <option value="test">Test Mode</option>
                         <option value="live">Live Mode</option>
                       </select>
                     </div>
                  </div>

                  {/* CCAvenue Section */}
                  <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                     <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       💳 CCAvenue Gateway Configuration
                     </h3>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
                       <div className="form-group" style={{ margin: 0 }}>
                         <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Merchant ID</label>
                         <input type="text" className="input-field" value={ccavenueMerchantId} onChange={e => setCcavenueMerchantId(e.target.value)} placeholder="e.g. 123456" />
                       </div>
                       <div className="form-group" style={{ margin: 0 }}>
                         <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Access Code</label>
                         <input type="text" className="input-field" value={ccavenueAccessCode} onChange={e => setCcavenueAccessCode(e.target.value)} placeholder="AV..." />
                       </div>
                       <div className="form-group" style={{ margin: 0 }}>
                         <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Working Key</label>
                         <input type="password" className="input-field" value={ccavenueWorkingKey} onChange={e => setCcavenueWorkingKey(e.target.value)} placeholder="••••••••••••••••" />
                       </div>
                     </div>
                     <div className="form-group" style={{ margin: 0 }}>
                       <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Mode</label>
                       <select className="input-field" value={ccavenueMode} onChange={e => setCcavenueMode(e.target.value)} style={{ maxWidth: '200px' }}>
                         <option value="test">Test Mode</option>
                         <option value="live">Live Mode</option>
                       </select>
                     </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" style={{ padding: '12px 30px', borderRadius: '12px' }} disabled={saving}>
                  <Save size={18} style={{ marginRight: '8px' }} />
                  {saving ? 'Updating...' : 'Save Settings'}
                </button>
              </div>

            </form>
          ) : (
            <>
              {activeTab === 'locations' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Location Management</h2>
                      <p style={{ color: '#64748b', fontSize: '14px' }}>Add and manage locations for your organization.</p>
                    </div>
                    <button 
                      type="button"
                      className="btn-primary" 
                      onClick={() => {
                        setEditingLocId(null);
                        setLocFormData({ name: '', address: '', city: '', state: '', country: 'India', status: 'Active' });
                        setShowLocModal(true);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                    >
                      <Plus size={16} /> Add Location
                    </button>
                  </div>

                  {locLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>Loading locations...</div>
                  ) : (
                    <>
                      <div className="data-table-container">
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
                                  <span className={`badge ${loc.status === 'Active' ? 'badge-green' : 'badge-red'}`}>
                                    {loc.status}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" className="btn-icon" onClick={() => handleLocEdit(loc)}>
                                      <Edit2 size={18} color="#3b82f6" />
                                    </button>
                                    <button type="button" className="btn-icon" onClick={() => handleLocDelete(loc._id)}>
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
                      </div>
                      {locations.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                            Showing {Math.min(locations.length, (locPage - 1) * itemsPerPage + 1)} to {Math.min(locations.length, locPage * itemsPerPage)} of {locations.length} entries
                          </span>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={locPage === 1}
                              onClick={() => setLocPage(prev => Math.max(1, prev - 1))}
                              style={{
                                cursor: locPage === 1 ? 'not-allowed' : 'pointer',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                background: locPage === 1 ? '#f8fafc' : '#ffffff',
                                color: locPage === 1 ? '#cbd5e1' : '#475569',
                                fontSize: '13px',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                              }}
                            >
                              Previous
                            </button>
                            {Array.from({ length: totalLocPages }, (_, idx) => idx + 1).map((pageNum) => (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setLocPage(pageNum)}
                                style={{
                                  cursor: 'pointer',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: locPage === pageNum ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                  background: locPage === pageNum ? '#2563eb' : '#ffffff',
                                  color: locPage === pageNum ? '#ffffff' : '#475569',
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
                              disabled={locPage === totalLocPages}
                              onClick={() => setLocPage(prev => Math.min(totalLocPages, prev + 1))}
                              style={{
                                cursor: locPage === totalLocPages ? 'not-allowed' : 'pointer',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                background: locPage === totalLocPages ? '#f8fafc' : '#ffffff',
                                color: locPage === totalLocPages ? '#cbd5e1' : '#475569',
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

                  {showLocModal && (
                    <div className="modal-overlay" style={{ zIndex: 1100 }}>
                      <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                          <h2>{editingLocId ? 'Edit Location' : 'Add New Location'}</h2>
                          <button type="button" className="close-btn" onClick={() => setShowLocModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleLocSubmit} style={{ padding: '20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Location Name *</label>
                              <input type="text" className="input-field" value={locFormData.name} onChange={e => setLocFormData({...locFormData, name: e.target.value})} required placeholder="e.g. Kolkata, Bhubaneswar" />
                            </div>
                            
                            <div className="form-group" style={{ margin: 0 }}>
                              <label>Address</label>
                              <input type="text" className="input-field" value={locFormData.address} onChange={e => setLocFormData({...locFormData, address: e.target.value})} />
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label>City</label>
                                <input type="text" className="input-field" value={locFormData.city} onChange={e => setLocFormData({...locFormData, city: e.target.value})} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label>State</label>
                                <input type="text" className="input-field" value={locFormData.state} onChange={e => setLocFormData({...locFormData, state: e.target.value})} />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label>Country</label>
                                <input type="text" className="input-field" value={locFormData.country} onChange={e => setLocFormData({...locFormData, country: e.target.value})} />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label>Status</label>
                                <select className="input-field" value={locFormData.status} onChange={e => setLocFormData({...locFormData, status: e.target.value})}>
                                  <option value="Active">Active</option>
                                  <option value="Inactive">Inactive</option>
                                </select>
                              </div>
                            </div>

                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button type="button" className="btn-secondary" onClick={() => setShowLocModal(false)}>Cancel</button>
                            <button type="submit" className="btn-primary">Save Location</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'business-categories' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Business Category Management</h2>
                      <p style={{ color: '#64748b', fontSize: '14px' }}>Add, edit, or delete categories for your lead collection.</p>
                    </div>
                    <button 
                      type="button"
                      className="btn-primary" 
                      onClick={() => {
                        setEditingCatId(null);
                        setCatNameForm('');
                        setShowCatModal(true);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                    >
                      <Plus size={16} /> Add Category
                    </button>
                  </div>

                  {catLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>Loading categories...</div>
                  ) : (
                    <>
                      <div className="data-table-container">
                        <table>
                          <thead>
                            <tr>
                              <th>Category Name</th>
                              <th>Subcategories</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayedCategories.map((cat) => (
                              <tr key={cat._id}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{cat.name}</div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '13px', color: '#475569', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cat.subcategories ? cat.subcategories.join(', ') : ''}>
                                    {cat.subcategories && cat.subcategories.length > 0 ? cat.subcategories.join(', ') : 'No subcategories'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    Count: {cat.subcategories ? cat.subcategories.length : 0}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" className="btn-icon" onClick={() => handleCatEdit(cat)}>
                                      <Edit2 size={18} color="#3b82f6" />
                                    </button>
                                    <button type="button" className="btn-icon" onClick={() => handleCatDelete(cat._id)}>
                                      <Trash2 size={18} color="#ef4444" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {categories.length === 0 && (
                              <tr>
                                <td colSpan={3} style={{ textAlign: 'center', padding: '40px' }}>No categories found</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {categories.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                            Showing {Math.min(categories.length, (catPage - 1) * itemsPerPage + 1)} to {Math.min(categories.length, catPage * itemsPerPage)} of {categories.length} entries
                          </span>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={catPage === 1}
                              onClick={() => setCatPage(prev => Math.max(1, prev - 1))}
                              style={{
                                cursor: catPage === 1 ? 'not-allowed' : 'pointer',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                background: catPage === 1 ? '#f8fafc' : '#ffffff',
                                color: catPage === 1 ? '#cbd5e1' : '#475569',
                                fontSize: '13px',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                              }}
                            >
                              Previous
                            </button>
                            {Array.from({ length: totalCatPages }, (_, idx) => idx + 1).map((pageNum) => (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setCatPage(pageNum)}
                                style={{
                                  cursor: 'pointer',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: catPage === pageNum ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                  background: catPage === pageNum ? '#2563eb' : '#ffffff',
                                  color: catPage === pageNum ? '#ffffff' : '#475569',
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
                              disabled={catPage === totalCatPages}
                              onClick={() => setCatPage(prev => Math.min(totalCatPages, prev + 1))}
                              style={{
                                cursor: catPage === totalCatPages ? 'not-allowed' : 'pointer',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                background: catPage === totalCatPages ? '#f8fafc' : '#ffffff',
                                color: catPage === totalCatPages ? '#cbd5e1' : '#475569',
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

                  {showCatModal && (
                    <div className="modal-overlay" style={{ zIndex: 1100 }}>
                      <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                          <h2>{editingCatId ? 'Edit Category' : 'Add New Category'}</h2>
                          <button type="button" className="close-btn" onClick={() => setShowCatModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCatSubmit} style={{ padding: '20px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Category Name *</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              value={catNameForm} 
                              onChange={e => setCatNameForm(e.target.value)} 
                              required 
                              placeholder="e.g. Doctor, Spa, Academy" 
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button type="button" className="btn-secondary" onClick={() => setShowCatModal(false)}>Cancel</button>
                            <button type="submit" className="btn-primary">Save Category</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'business-subcategories' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Business Subcategory Management</h2>
                      <p style={{ color: '#64748b', fontSize: '14px' }}>Select a category to manage its subcategories.</p>
                    </div>
                    <button 
                      type="button"
                      className="btn-primary" 
                      onClick={() => {
                        if (!selectedCatId) {
                          alert('Please select a category first.');
                          return;
                        }
                        setEditingSubcatIndex(null);
                        setSubcatNameForm('');
                        setShowSubcatModal(true);
                      }}
                      disabled={!selectedCatId}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                    >
                      <Plus size={16} /> Add Subcategory
                    </button>
                  </div>

                  <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontWeight: 600, fontSize: '14px', color: '#475569' }}>Select Category</label>
                    <select 
                      value={selectedCatId} 
                      onChange={e => setSelectedCatId(e.target.value)} 
                      className="input-field"
                      style={{ maxWidth: '300px' }}
                    >
                      <option value="">-- Choose a Category --</option>
                      {categories.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {!selectedCatId ? (
                    <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: '12px', color: '#94a3b8', fontSize: '14px' }}>
                      Please select a category above to view and manage its subcategories.
                    </div>
                  ) : (
                    <>
                      <div className="data-table-container">
                        <table>
                          <thead>
                            <tr>
                              <th>Subcategory Name</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayedSubcategories.map((sub: string, index: number) => {
                              const originalIndex = (subcatPage - 1) * itemsPerPage + index;
                              return (
                                <tr key={originalIndex}>
                                  <td>
                                    <div style={{ fontWeight: 600 }}>{sub}</div>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                      <button type="button" className="btn-icon" onClick={() => handleSubcatEdit(sub, originalIndex)}>
                                        <Edit2 size={18} color="#3b82f6" />
                                      </button>
                                      <button type="button" className="btn-icon" onClick={() => handleSubcatDelete(originalIndex)}>
                                        <Trash2 size={18} color="#ef4444" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {subcategoriesList.length === 0 && (
                              <tr>
                                <td colSpan={2} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No subcategories found in this category. Click "+ Add Subcategory" to add one!</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {subcategoriesList.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                            Showing {Math.min(subcategoriesList.length, (subcatPage - 1) * itemsPerPage + 1)} to {Math.min(subcategoriesList.length, subcatPage * itemsPerPage)} of {subcategoriesList.length} entries
                          </span>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={subcatPage === 1}
                              onClick={() => setSubcatPage(prev => Math.max(1, prev - 1))}
                              style={{
                                cursor: subcatPage === 1 ? 'not-allowed' : 'pointer',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                background: subcatPage === 1 ? '#f8fafc' : '#ffffff',
                                color: subcatPage === 1 ? '#cbd5e1' : '#475569',
                                fontSize: '13px',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                              }}
                            >
                              Previous
                            </button>
                            {Array.from({ length: totalSubcatPages }, (_, idx) => idx + 1).map((pageNum) => (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setSubcatPage(pageNum)}
                                style={{
                                  cursor: 'pointer',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  border: subcatPage === pageNum ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                  background: subcatPage === pageNum ? '#2563eb' : '#ffffff',
                                  color: subcatPage === pageNum ? '#ffffff' : '#475569',
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
                              disabled={subcatPage === totalSubcatPages}
                              onClick={() => setSubcatPage(prev => Math.min(totalSubcatPages, prev + 1))}
                              style={{
                                cursor: subcatPage === totalSubcatPages ? 'not-allowed' : 'pointer',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                background: subcatPage === totalSubcatPages ? '#f8fafc' : '#ffffff',
                                color: subcatPage === totalSubcatPages ? '#cbd5e1' : '#475569',
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

                  {showSubcatModal && (
                    <div className="modal-overlay" style={{ zIndex: 1100 }}>
                      <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                          <h2>{editingSubcatIndex !== null ? 'Edit Subcategory' : 'Add New Subcategory'}</h2>
                          <button type="button" className="close-btn" onClick={() => setShowSubcatModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubcatSubmit} style={{ padding: '20px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Subcategory Name *</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              value={subcatNameForm} 
                              onChange={e => setSubcatNameForm(e.target.value)} 
                              required 
                              placeholder="e.g. Dental clinic, Vedic astrology" 
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button type="button" className="btn-secondary" onClick={() => setShowSubcatModal(false)}>Cancel</button>
                            <button type="submit" className="btn-primary">Save Subcategory</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
