import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, ShieldCheck, CheckSquare, Square, RotateCcw } from 'lucide-react';

export default function MenuPermissionManagement() {
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const menuList = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊', description: 'Main & Employee Dashboard views' },
    { key: 'employees', label: 'Employees', icon: '👥', description: 'Employee Directory & Manage WFH' },
    { key: 'crm', label: 'CRM', icon: '🤝', description: 'Leads & Client Management' },
    { key: 'packages', label: 'Package Management', icon: '📦', description: 'Packages, Proposals, Invoices & Reports' },
    { key: 'attendance', label: 'Attendance', icon: '⏱️', description: 'Clock In/Out & Attendance Logs' },
    { key: 'payroll', label: 'Payroll', icon: '💰', description: 'Salary Slip & CTC Calculation', isHighlight: true },
    { key: 'leaves', label: 'Leave Management', icon: '📅', description: 'Leave Application & Approvals' },
    { key: 'marketing_tracking', label: 'Location Tracking', icon: '📍', description: 'Real-time Field Staff GPS Tracking' },
    { key: 'settings', label: 'Settings', icon: '⚙️', description: 'System Settings & Masters' }
  ];

  const fetchRolesAndPermissions = async () => {
    setLoading(true);
    try {
      const [rolesRes, settingsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/roles'),
        axios.get('http://localhost:5000/api/settings')
      ]);

      const fetchedRoles = rolesRes.data.data || [];
      setAllRoles(fetchedRoles);

      const savedPermsSetting = (settingsRes.data.data || []).find((s: any) => s.key === 'role_menu_permissions')?.value;
      const initialPerms: Record<string, Record<string, boolean>> = savedPermsSetting 
        ? (typeof savedPermsSetting === 'string' ? JSON.parse(savedPermsSetting) : savedPermsSetting) 
        : {};

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesAndPermissions();
  }, []);

  const handleTogglePermission = (roleId: string, menuKey: string) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: {
        ...(prev[roleId] || {}),
        [menuKey]: prev[roleId]?.[menuKey] === false ? true : false
      }
    }));
  };

  const handleToggleRoleColumn = (roleId: string, enable: boolean) => {
    const updated: Record<string, boolean> = {};
    menuList.forEach(m => {
      updated[m.key] = enable;
    });
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: updated
    }));
  };

  const handleToggleMenuRow = (menuKey: string, enable: boolean) => {
    setRolePermissions(prev => {
      const next = { ...prev };
      allRoles.forEach(role => {
        next[role._id] = {
          ...(next[role._id] || {}),
          [menuKey]: enable
        };
      });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('http://localhost:5000/api/settings', {
        key: 'role_menu_permissions',
        value: rolePermissions
      });
      alert('Menu permissions updated successfully!');
      window.dispatchEvent(new CustomEvent('menu-permissions-updated'));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error saving menu permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '30px', fontSize: '15px' }}>Loading menu permissions...</div>;
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} color="#2563eb" />
            <h1 className="page-title" style={{ margin: 0 }}>Menu Permissions</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '6px', margin: 0 }}>
            Configure menu visibility permissions for each role. (Roles in upper heading, Menus on left side).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={fetchRolesAndPermissions}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px' }}
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleSave} 
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}
          >
            <Save size={18} /> {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>

      {/* Main Permissions Matrix Table */}
      <div className="data-table-container" style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <table style={{ minWidth: '1000px', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {/* Top Heading: Roles */}
            <tr style={{ background: '#1e293b', color: '#ffffff' }}>
              <th style={{ textAlign: 'left', padding: '16px 20px', width: '260px', fontSize: '14px', fontWeight: 700, borderRight: '2px solid #334155' }}>
                Menus / Navigation
              </th>
              {allRoles.map((role) => (
                <th key={role._id} style={{ textAlign: 'center', padding: '14px 12px', minWidth: '130px', fontSize: '13.5px', fontWeight: 700, borderRight: '1px solid #334155' }}>
                  <div>{role.name}</div>
                  <div style={{ fontSize: '11px', fontWeight: 400, color: '#94a3b8', marginTop: '3px' }}>
                    {role.department?.name || 'All Depts'}
                  </div>
                  {/* Column Select All / None */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleRoleColumn(role._id, true)}
                      style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
                      title="Check all menus for this role"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleRoleColumn(role._id, false)}
                      style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
                      title="Uncheck all menus for this role"
                    >
                      None
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {menuList.map((menu, idx) => {
              const isHighlight = menu.isHighlight;
              return (
                <tr 
                  key={menu.key} 
                  style={{ 
                    borderBottom: '1px solid #e2e8f0', 
                    background: isHighlight ? '#f0fdf4' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc') 
                  }}
                >
                  {/* Left Side: Menu Item */}
                  <td style={{ padding: '14px 20px', borderRight: '2px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>{menu.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: isHighlight ? '#065f46' : '#1e293b', fontSize: '14px' }}>
                          {menu.label}
                        </div>
                        <div style={{ fontSize: '12px', color: isHighlight ? '#047857' : '#64748b' }}>
                          {menu.description}
                        </div>
                      </div>
                    </div>
                    {/* Row Select All / None */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleMenuRow(menu.key, true)}
                        style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Check All Roles
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleMenuRow(menu.key, false)}
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Uncheck All
                      </button>
                    </div>
                  </td>

                  {/* Under each Role Column: Check / Uncheck Checkbox */}
                  {allRoles.map((role) => {
                    const roleId = role._id;
                    const roleName = (role.name || '').toLowerCase().trim();
                    const isSuperAdmin = roleName === 'super admin' || roleName === 'admin';
                    const isChecked = rolePermissions[roleId]?.[menu.key] !== false;

                    return (
                      <td 
                        key={roleId} 
                        style={{ 
                          textAlign: 'center', 
                          padding: '14px 12px', 
                          borderRight: '1px solid #e2e8f0',
                          background: isChecked ? (isHighlight ? '#dcfce7' : 'transparent') : '#fff1f2'
                        }}
                      >
                        <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => handleTogglePermission(roleId, menu.key)}
                            disabled={isSuperAdmin && (menu.key === 'settings' || menu.key === 'dashboard')}
                            style={{ 
                              width: '20px', 
                              height: '20px', 
                              cursor: 'pointer',
                              accentColor: isHighlight ? '#10b981' : '#2563eb'
                            }} 
                          />
                        </label>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: isChecked ? (isHighlight ? '#047857' : '#2563eb') : '#94a3b8', marginTop: '2px' }}>
                          {isChecked ? 'Visible' : 'Hidden'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Action Footer */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button 
          type="button" 
          className="btn-primary" 
          onClick={handleSave} 
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 600 }}
        >
          <Save size={18} /> {saving ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>
    </div>
  );
}
