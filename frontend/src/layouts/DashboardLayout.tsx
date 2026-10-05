import { Outlet, NavLink, useLocation, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, Settings as SettingsIcon, LogOut, Building, UserCog, ChevronDown, ChevronUp, Calendar, Bell, MapPin, Package, AlertCircle, X, CalendarDays, DollarSign, Briefcase } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DashboardLayout() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const location = useLocation();
  const navigate = useNavigate();

  const [isDashboardMenuOpen, setIsDashboardMenuOpen] = useState(
    location.pathname.includes('/dashboard/overview') || location.pathname.includes('/dashboard/my-dashboard')
  );
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(
    location.pathname.includes('/dashboard/roles') || 
    location.pathname.includes('/dashboard/departments') || 
    location.pathname.includes('/dashboard/user-types') ||
    location.pathname.includes('/dashboard/holidays') ||
    location.pathname.includes('/dashboard/settings') ||
    location.pathname.includes('/dashboard/menu-permissions') ||
    location.pathname.includes('/dashboard/locations')
  );
  const [isPackageMenuOpen, setIsPackageMenuOpen] = useState(
    location.pathname.includes('/dashboard/packages')
  );

  const [isCrmMenuOpen, setIsCrmMenuOpen] = useState(
    location.pathname.includes('/dashboard/leads') || location.pathname.includes('/dashboard/clients')
  );

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [expiringRenewals, setExpiringRenewals] = useState<any[]>([]);
  
  // Pending Partial Payment Reminder Modal States
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showPartialReminderModal, setShowPartialReminderModal] = useState(false);
  const [duePartialInvoices, setDuePartialInvoices] = useState<any[]>([]);
  const [hasShownPartialReminder, setHasShownPartialReminder] = useState(() => {
    return sessionStorage.getItem('hasShownPartialReminder') === 'true';
  });

  const userId = user.id || user._id || '';
  const roleName = user.role?.name || '';

  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [menuPermissions, setMenuPermissions] = useState<Record<string, boolean>>({
    dashboard: true,
    employees: true,
    crm: true,
    packages: true,
    attendance: true,
    payroll: true,
    leaves: true,
    marketing_tracking: true,
    settings: true
  });

  const fetchExpiringRenewals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/client-packages/expiring-renewals', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data.success) {
        setExpiringRenewals(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching expiring renewals in layout:', err);
    }
  };

  const fetchMenuPermissions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/settings');
      const settings = res.data.data || [];
      const savedLogo = settings.find((s: any) => s.key === 'company_logo')?.value;
      if (savedLogo) {
        const fullLogoUrl = savedLogo.startsWith('http') ? savedLogo : `http://localhost:5000${savedLogo}`;
        setCompanyLogo(fullLogoUrl);
      }

      const savedPermsSetting = settings.find((s: any) => s.key === 'role_menu_permissions')?.value;
      const permsObj = savedPermsSetting ? (typeof savedPermsSetting === 'string' ? JSON.parse(savedPermsSetting) : savedPermsSetting) : {};

      const userRoleId = user.role?._id || user.role;
      const userRoleName = (user.role?.name || user.role || '').toLowerCase().trim();
      const userTypeName = (typeof user.role?.userType === 'object' ? user.role?.userType?.name : user.role?.userType || '').toLowerCase().trim();
      const isAdminUser = ['admin', 'super admin'].includes(userRoleName) || ['admin', 'super admin'].includes(userTypeName);
      const isHrUser = userRoleName.includes('hr') || userRoleName.includes('human resource');

      let currentRolePerms = permsObj[userRoleId];
      if (!currentRolePerms) {
        const matchingKey = Object.keys(permsObj).find(k => k.toLowerCase() === userRoleName);
        if (matchingKey) currentRolePerms = permsObj[matchingKey];
      }

      if (currentRolePerms) {
        if (isAdminUser) {
          currentRolePerms.dashboard = true;
          currentRolePerms.settings = true;
        }
        currentRolePerms.payroll = true;
        setMenuPermissions(currentRolePerms);
      } else {
        setMenuPermissions({
          dashboard: true,
          employees: true,
          crm: true,
          packages: true,
          attendance: true,
          payroll: true,
          leaves: true,
          marketing_tracking: isAdminUser,
          settings: isAdminUser
        });
      }
    } catch (err) {
      console.error('Error fetching menu permissions in layout:', err);
    }
  };

  const fetchNotifications = async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/notifications/${userId}/${roleName}`);
      if (res.data.success) {
        setNotifications(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };
  const fetchSubscriptions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/client-packages');
      if (res.data.success) {
        setSubscriptions(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching subscriptions in layout:', err);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/invoices');
      if (res.data.success) {
        setInvoices(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching invoices in layout:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchSubscriptions();
    fetchExpiringRenewals();
    fetchInvoices();
    fetchMenuPermissions();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchSubscriptions();
      fetchExpiringRenewals();
      fetchInvoices();
      fetchMenuPermissions();
    }, 15000);
    return () => clearInterval(interval);
  }, [userId, roleName]);

  useEffect(() => {
    window.addEventListener('menu-permissions-updated', fetchMenuPermissions);
    return () => window.removeEventListener('menu-permissions-updated', fetchMenuPermissions);
  }, []);

  useEffect(() => {
    const isDashboardPage = ['/dashboard', '/dashboard/', '/dashboard/overview', '/dashboard/my-dashboard'].includes(location.pathname);

    if (invoices.length > 0 && !hasShownPartialReminder && isDashboardPage) {
      const uRole = (user?.role?.name || '').toLowerCase().trim();
      const uType = (typeof user?.role?.userType === 'object' ? user?.role?.userType?.name : user?.role?.userType || '').toLowerCase().trim();
      
      const isAdminUser = ['admin', 'super admin'].includes(uRole) || ['admin', 'super admin'].includes(uType);
      const currentUserIdStr = String(userId);

      const dueInvs = invoices.filter((inv: any) => {
        if (inv.status !== 'Partially Paid') return false;
        if (!isAdminUser) {
          const clientAssignedSalesId = String(inv.client?.assignedSalesExecutive?._id || inv.client?.assignedSalesExecutive || inv.client?.assignedAccountManager?._id || inv.client?.assignedAccountManager || '');
          const pkgAccountManagerId = String(inv.clientPackage?.accountManager?._id || inv.clientPackage?.accountManager || '');
          const leadTelecallerId = String(inv.clientPackage?.lead?.assignedTelecaller?._id || inv.clientPackage?.lead?.assignedTelecaller || '');
          
          return clientAssignedSalesId === currentUserIdStr || pkgAccountManagerId === currentUserIdStr || leadTelecallerId === currentUserIdStr;
        }
        return true;
      });

      if (dueInvs.length > 0) {
        setDuePartialInvoices(dueInvs);
        setShowPartialReminderModal(true);
      }
      setHasShownPartialReminder(true);
      sessionStorage.setItem('hasShownPartialReminder', 'true');
    }
  }, [invoices, userId, user, hasShownPartialReminder, location.pathname]);
  const expiringSoonCount = subscriptions.filter(s => {
    if (s.status !== 'Active') return false;
    if (!s.endDate) return false;
    const expiryDate = new Date(s.endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 && diffDays <= 15;
  }).length;

  // Location tracking logic for Marketing users
  // Haversine formula to calculate distance in meters
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  // Location tracking logic for Marketing users
  useEffect(() => {
    if (!userId) return;

    const lowerRole = roleName.toLowerCase().trim();
    const isMarketingUser = lowerRole.includes('marketing manager') || lowerRole.includes('marketing executive');

    if (!isMarketingUser) return;

    const LOG_INTERVAL = 15 * 60 * 1000; // 15 minutes
    let trackingInterval: any = null;
    let watchId: number | null = null;

    const captureAndSendLocation = async (lat: number, lng: number) => {
      try {
        await axios.post('http://localhost:5000/api/attendance/location-log', {
          userId,
          location: { lat, lng }
        });
        localStorage.setItem('last_location_lat', lat.toString());
        localStorage.setItem('last_location_lng', lng.toString());
        localStorage.setItem('last_location_log_time', Date.now().toString());
        console.log(`Logged location coordinates: ${lat}, ${lng}`);
      } catch (err) {
        console.error('Error logging location:', err);
      }
    };

    const handlePositionChange = async (position: any) => {
      const { latitude, longitude } = position.coords;
      const lastLatStr = localStorage.getItem('last_location_lat');
      const lastLngStr = localStorage.getItem('last_location_lng');

      if (lastLatStr && lastLngStr) {
        const lastLat = parseFloat(lastLatStr);
        const lastLng = parseFloat(lastLngStr);
        const distance = getDistance(latitude, longitude, lastLat, lastLng);

        // If moved less than 200 meters, skip logging to avoid duplication
        if (distance < 200) {
          return;
        }
      }

      // Synchronously set coordinates in localStorage to prevent rapid subsequent GPS events
      // from firing duplicate calls while the asynchronous check is running.
      localStorage.setItem('last_location_lat', latitude.toString());
      localStorage.setItem('last_location_lng', longitude.toString());

      // Check if user is actively clocked in before logging
      try {
        const res = await axios.get(`http://localhost:5000/api/attendance/today/${userId}`);
        const att = res.data.data;
        if (att && att.clockIn && !att.clockOut) {
          await captureAndSendLocation(latitude, longitude);
        }
      } catch (err) {
        console.error('Error checking attendance in watchPosition:', err);
      }
    };

    const checkAndSetupTracking = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/attendance/today/${userId}`);
        const att = res.data.data;
        
        // If user is clocked in and not clocked out
        if (att && att.clockIn && !att.clockOut) {
          // Initialize last logged location in localStorage from database logs
          const logs = att.locationLogs || [];
          const lastLog = logs.length > 0 ? logs[logs.length - 1] : att.clockInLocation;
          if (lastLog && lastLog.lat && lastLog.lng) {
            localStorage.setItem('last_location_lat', lastLog.lat.toString());
            localStorage.setItem('last_location_lng', lastLog.lng.toString());
          }

          // 1. Setup periodic interval (fallback)
          if (!trackingInterval) {
            const lastLogStr = localStorage.getItem('last_location_log_time');
            const lastLogTime = lastLogStr ? parseInt(lastLogStr, 10) : 0;
            const now = Date.now();

            if (now - lastLogTime >= LOG_INTERVAL) {
              navigator.geolocation.getCurrentPosition(async (pos) => {
                await captureAndSendLocation(pos.coords.latitude, pos.coords.longitude);
              }, (err) => console.warn(err), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
            }

            trackingInterval = setInterval(() => {
              navigator.geolocation.getCurrentPosition(async (pos) => {
                await captureAndSendLocation(pos.coords.latitude, pos.coords.longitude);
              }, (err) => console.warn(err), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
            }, LOG_INTERVAL);
            console.log('Location tracking interval started');
          }

          // 2. Setup real-time movement watchPosition
          if (watchId === null && navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
              handlePositionChange,
              (err) => console.warn('watchPosition failed:', err.message),
              { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
            );
            console.log('Real-time GPS movement watcher started');
          }
        } else {
          // Stop tracking if clocked out or not clocked in
          if (trackingInterval) {
            clearInterval(trackingInterval);
            trackingInterval = null;
            console.log('Location tracking interval stopped');
          }
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
            console.log('Real-time GPS movement watcher stopped');
          }
        }
      } catch (err) {
        console.error('Error in location tracking setup:', err);
      }
    };

    checkAndSetupTracking();

    // Setup listeners for attendance updates
    window.addEventListener('attendance-update', checkAndSetupTracking);
    // Periodically sync check (every minute)
    const syncInterval = setInterval(checkAndSetupTracking, 60000);

    return () => {
      if (trackingInterval) clearInterval(trackingInterval);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(syncInterval);
      window.removeEventListener('attendance-update', checkAndSetupTracking);
    };
  }, [userId, roleName]);



  const unreadCount = notifications.filter(n => !n.readBy.includes(userId)).length;

  const handleNotificationClick = async (n: any) => {
    try {
      await axios.put(`http://localhost:5000/api/notifications/read/${n._id}/${userId}`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }

    const titleLower = (n.title || '').toLowerCase();
    const isProjectNote = titleLower.includes('project note') || titleLower.includes('tagged in');

    if (n.clientId) {
      const clientIdStr = typeof n.clientId === 'object' ? n.clientId._id : n.clientId;
      localStorage.setItem('selectProjectId', clientIdStr);
      navigate('/dashboard/my-projects');
      window.dispatchEvent(new CustomEvent('notification-project-click', { detail: clientIdStr }));
    } else if (isProjectNote) {
      // Fallback matching by company name extracted from notification title
      const rawTitle = n.title || '';
      const companyPart = rawTitle.includes(':') ? rawTitle.split(':')[1].trim() : rawTitle;
      if (companyPart) {
        localStorage.setItem('selectProjectCompany', companyPart);
      }
      navigate('/dashboard/my-projects');
      window.dispatchEvent(new CustomEvent('notification-project-click', { detail: companyPart }));
    } else if (n.leadId) {
      const leadIdStr = typeof n.leadId === 'object' ? n.leadId._id : n.leadId;
      localStorage.setItem('editLeadId', leadIdStr);
      navigate('/dashboard/leads');
      window.dispatchEvent(new CustomEvent('notification-lead-click', { detail: leadIdStr }));
    } else if (titleLower.includes('leave') || (n.message || '').toLowerCase().includes('leave')) {
      navigate('/dashboard/leaves?tab=calendar');
    }
    setIsNotificationOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.put(`http://localhost:5000/api/notifications/read-all/${userId}/${roleName}`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const userRole = (user?.role?.name || '').toLowerCase().trim();
  const userDept = (typeof user?.role?.department === 'object' ? user?.role?.department?.name : user?.role?.department || '').toLowerCase().trim();
  const userType = (typeof user?.role?.userType === 'object' ? user?.role?.userType?.name : user?.role?.userType || '').toLowerCase().trim();

  const isHR = userRole.includes('hr') || userRole.includes('human resource') || userDept.includes('hr');
  const isSubAdmin = userType.includes('sub admin') || userRole.includes('sub admin');
  const isAdmin = ['admin', 'super admin'].includes(userRole) || ['admin', 'super admin'].includes(userType);
  const isAdminOrHR = isAdmin || isHR;

  const isBDM = userRole.includes('bdm');
  const isMarketing = userRole.includes('marketing') || userDept.includes('marketing');
  const isTeleSalesManager = userRole.includes('tele sales manager') || userRole.includes('telemarketing manager') || userRole.includes('tele manager') || userRole.includes('tme manager');
  const canAccessPartialMenu = isAdmin || isBDM || isMarketing || isTeleSalesManager;

  const isCustomerCare = userRole.includes('customer care') || userRole.includes('customer support') || userRole.includes('support');
  const hasSubmenuAccess = isAdmin;
  const isRegularEmployee = ['customer care', 'support', 'bdm', 'tele caller', 'telecaller', 'telemarketing', 'service manager'].some(keyword => userRole.includes(keyword));
  const hasEmployeeAccess = true;

  // const isManager = userRole.includes('manager') || userRole.includes('head') || userRole.includes('lead');
  // const isSalesOrTele = ['sales', 'telemarketing', 'telecaller', 'marketing', 'bdm', 'executive'].some(keyword => userRole.includes(keyword) || userDept.includes(keyword));
  const hasLocationAccess = isAdmin;
  const hasCategoryAccess = true;

  const isServiceManager = userRole.includes('service manager');
  const isTeleSalesPerson = ['tele sales', 'tele sales manager', 'tele manager', 'telemarketing', 'telemarketing manager', 'telecaller', 'tele caller', 'tme manager'].some(keyword => userRole.includes(keyword));
  const isTeleCallerOrTeleManager = ['tele caller', 'telecaller', 'tele sales', 'tele sales manager', 'telemarketing', 'telemarketing manager', 'tele manager', 'tme manager'].some(keyword => userRole.includes(keyword));
  const isMarketingPerson = userRole.includes('marketing') || userDept.includes('marketing');
  const hasMyProjectsAccess = !isAdmin && !isTeleCallerOrTeleManager && !isMarketingPerson;

  const hasLeadsAccess = (['admin', 'super admin', 'sub admin', 'tele marketing', 'tele sales manager', 'bdm', 'marketing manager', 'marketing executive', 'sales'].some(role => userRole.includes(role)) || isSubAdmin) && !isHR && !isServiceManager;
  const hasPackageAccess = (isAdmin || isSubAdmin || isBDM || isMarketing || isTeleSalesManager || ['sales', 'telemarketing', 'telecaller'].some(keyword => userRole.includes(keyword))) && !isHR && !isServiceManager && (!isTeleSalesPerson || isTeleSalesManager);
  const hasCrmMenuAccess = hasLeadsAccess || isCustomerCare || isServiceManager;
  const hasMainDashboardAccess = ['admin', 'super admin'].includes(userRole) || ['admin', 'super admin'].includes(userType);
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('hasShownPartialReminder');
    window.location.href = '/login';
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img 
            src={companyLogo || 'https://digiexweb.com/assets/img/logo.png'} 
            alt="Company Logo" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://digiexweb.com/assets/img/logo.png';
            }}
            style={{ maxHeight: '48px', maxWidth: '100%', objectFit: 'contain' }}
          />
        </div>
        
        <div className="sidebar-nav">
          {hasMainDashboardAccess ? (
            <div className="nav-group">
              <div 
                className={`nav-item ${location.pathname.includes('/dashboard/overview') || location.pathname.includes('/dashboard/my-dashboard') ? 'active' : ''}`}
                onClick={() => setIsDashboardMenuOpen(!isDashboardMenuOpen)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <LayoutDashboard size={20} />
                  Dashboard
                </div>
                {isDashboardMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              
              {isDashboardMenuOpen && (
                <div className="submenu" style={{ paddingLeft: '30px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <NavLink to="/dashboard/overview" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                    Main Dashboard
                  </NavLink>
                  <NavLink to="/dashboard/my-dashboard" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                    Dashboard
                  </NavLink>
                </div>
              )}
            </div>
          ) : (
            <NavLink to="/dashboard/my-dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              Dashboard
            </NavLink>
          )}
          {hasMyProjectsAccess && (
            <NavLink to="/dashboard/my-projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Briefcase size={20} />
              My Projects
            </NavLink>
          )}
          {hasEmployeeAccess && (menuPermissions.employees !== false) && (
            <NavLink to="/dashboard/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              {isAdminOrHR ? 'Employees' : 'My Own Profile'}
            </NavLink>
          )}
          {hasCrmMenuAccess && (menuPermissions.crm !== false) && (
            <div className="nav-group">
              <div 
                className={`nav-item ${location.pathname.includes('/dashboard/leads') || location.pathname.includes('/dashboard/clients') ? 'active' : ''}`}
                onClick={() => setIsCrmMenuOpen(!isCrmMenuOpen)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Users size={20} />
                  CRM
                </div>
                {isCrmMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              
              {isCrmMenuOpen && (
                <div className="submenu" style={{ paddingLeft: '30px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {hasLeadsAccess && (
                    <NavLink 
                      to="/dashboard/leads" 
                      className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('reset-lead-view'));
                        navigate('/dashboard/leads');
                      }}
                      style={{ fontSize: '14px', padding: '8px 12px' }}
                    >
                      🎯 Leads
                    </NavLink>
                  )}
                  <NavLink 
                    to="/dashboard/clients" 
                    className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      window.dispatchEvent(new CustomEvent('reset-client-view'));
                      navigate('/dashboard/clients');
                    }}
                    style={{ fontSize: '14px', padding: '8px 12px' }}
                  >
                    🤝 Clients
                  </NavLink>
                </div>
              )}
            </div>
          )}
          {hasPackageAccess && (menuPermissions.packages !== false) && (
            <div className="nav-group">
              <div 
                className={`nav-item ${location.pathname.includes('/dashboard/packages') ? 'active' : ''}`}
                onClick={() => setIsPackageMenuOpen(!isPackageMenuOpen)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={20} />
                  Package Management
                </div>
                {isPackageMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              
              {isPackageMenuOpen && (
                <div className="submenu" style={{ paddingLeft: '30px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <NavLink to="/dashboard/packages?tab=dashboard" className={({ isActive }) => `nav-item submenu-item ${isActive || (location.pathname.includes('/dashboard/packages') && location.search.includes('tab=dashboard')) ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                    📊 Dashboard
                  </NavLink>
                  <NavLink to="/dashboard/packages?tab=packages" className={({ isActive }) => `nav-item submenu-item ${isActive || (location.pathname.includes('/dashboard/packages') && location.search.includes('tab=packages')) ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                    📦 Package Master
                  </NavLink>
                  <NavLink to="/dashboard/packages?tab=builder" className={({ isActive }) => `nav-item submenu-item ${isActive || (location.pathname.includes('/dashboard/packages') && location.search.includes('tab=builder')) ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                    🛠️ Custom Builder
                  </NavLink>
                  <NavLink to="/dashboard/packages?tab=proposals" className={({ isActive }) => `nav-item submenu-item ${isActive || (location.pathname.includes('/dashboard/packages') && location.search.includes('tab=proposals')) ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                    📄 Proposals
                  </NavLink>
                  <NavLink to="/dashboard/packages?tab=subscriptions" className={({ isActive }) => `nav-item submenu-item ${isActive || (location.pathname.includes('/dashboard/packages') && location.search.includes('tab=subscriptions')) ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                    🔄 Deal Close
                  </NavLink>
                  {canAccessPartialMenu && (
                    <NavLink to="/dashboard/packages?tab=partial-payments" className={({ isActive }) => `nav-item submenu-item ${isActive || (location.pathname.includes('/dashboard/packages') && location.search.includes('tab=partial-payments')) ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                      💳 Partial Payment
                    </NavLink>
                  )}
                  <NavLink to="/dashboard/packages?tab=invoices" className={({ isActive }) => `nav-item submenu-item ${isActive || (location.pathname.includes('/dashboard/packages') && location.search.includes('tab=invoices')) ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                    🧾 Invoices
                  </NavLink>
                  <NavLink to="/dashboard/packages?tab=reports" className={({ isActive }) => `nav-item submenu-item ${isActive || (location.pathname.includes('/dashboard/packages') && location.search.includes('tab=reports')) ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                    📈 Reports
                  </NavLink>
                </div>
              )}
            </div>
          )}
          {(menuPermissions.attendance !== false) && (
            <NavLink to="/dashboard/attendance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Calendar size={20} />
              Attendance
            </NavLink>
          )}
          {(menuPermissions.payroll !== false) && (
            <NavLink to="/dashboard/payroll" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <DollarSign size={20} />
              Payroll
            </NavLink>
          )}
          {(menuPermissions.leaves !== false) && (
            <NavLink to="/dashboard/leaves" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <CalendarDays size={20} />
              Leave Management
            </NavLink>
          )}
          {isAdmin && (menuPermissions.marketing_tracking !== false) && (
            <NavLink to="/dashboard/marketing-tracking" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <MapPin size={20} />
              Location Tracking
            </NavLink>
          )}

          {(hasSubmenuAccess || hasLocationAccess || hasCategoryAccess) && (menuPermissions.settings !== false) && !isCustomerCare && !isServiceManager && !isTeleSalesPerson && (
            <div className="nav-group">
              <div 
                className={`nav-item ${isSettingsMenuOpen ? 'active' : ''}`}
                onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <SettingsIcon size={20} />
                  Settings
                </div>
                {isSettingsMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              
              {isSettingsMenuOpen && (
                <div className="submenu" style={{ paddingLeft: '30px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {hasSubmenuAccess && (
                    <>
                      <NavLink to="/dashboard/menu-permissions" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        🔐 Menu Permissions
                      </NavLink>
                      <NavLink to="/dashboard/roles" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        <Shield size={16} style={{ marginRight: '8px' }} /> Roles
                      </NavLink>
                      <NavLink to="/dashboard/departments" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        <Building size={16} style={{ marginRight: '8px' }} /> Departments
                      </NavLink>
                      <NavLink to="/dashboard/user-types" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        <UserCog size={16} style={{ marginRight: '8px' }} /> User Types
                      </NavLink>
                      <NavLink to="/dashboard/holidays" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        📅 Holiday Management
                      </NavLink>
                      <NavLink to="/dashboard/services" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        🛠️ Service Master
                      </NavLink>
                      <NavLink to="/dashboard/service-details" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        📋 Service Detail Master
                      </NavLink>
                      <NavLink to="/dashboard/service-categories" className={({ isActive }) => `nav-item submenu-item ${isActive ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        📁 Service Category Master
                      </NavLink>
                      <NavLink to="/dashboard/settings?tab=company" className={({ isActive }) => `nav-item submenu-item ${isActive || location.search.includes('tab=company') ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        🏢 Company Management
                      </NavLink>
                      <NavLink to="/dashboard/settings?tab=address" className={({ isActive }) => `nav-item submenu-item ${isActive || location.search.includes('tab=address') ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        📍 Business Management
                      </NavLink>
                      <NavLink to="/dashboard/settings?tab=leaves" className={({ isActive }) => `nav-item submenu-item ${isActive || location.search.includes('tab=leaves') ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        📋 Company Leave Rules
                      </NavLink>
                      <NavLink to="/dashboard/settings?tab=attendance" className={({ isActive }) => `nav-item submenu-item ${isActive || location.search.includes('tab=attendance') ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        ⏱️ Attendance Rules
                      </NavLink>
                      <NavLink to="/dashboard/settings?tab=payment" className={({ isActive }) => `nav-item submenu-item ${isActive || location.search.includes('tab=payment') ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        💳 Payment Settings
                      </NavLink>
                    </>
                  )}
                  {hasLocationAccess && (
                    <NavLink to="/dashboard/settings?tab=locations" className={({ isActive }) => `nav-item submenu-item ${isActive || location.search.includes('tab=locations') ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                      📍 Location Management
                    </NavLink>
                  )}
                  {hasCategoryAccess && (
                    <>
                      <NavLink to="/dashboard/settings?tab=business-categories" className={({ isActive }) => `nav-item submenu-item ${isActive || location.search.includes('tab=business-categories') ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        📁 Business Category Management
                      </NavLink>
                      <NavLink to="/dashboard/settings?tab=business-subcategories" className={({ isActive }) => `nav-item submenu-item ${isActive || location.search.includes('tab=business-subcategories') ? 'active' : ''}`} style={{ fontSize: '14px', padding: '8px 12px' }}>
                        📂 Business Subcategory Management
                      </NavLink>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="top-header" style={{ display: 'flex', justifyContent: expiringSoonCount > 0 ? 'space-between' : 'flex-end', alignItems: 'center', gap: '20px' }}>
          {/* 6-Month & 1-Year Client Renewal Red Alert Banner */}
          {expiringRenewals.length > 0 ? (
            <div style={{
              background: '#fef2f2',
              border: '2px solid #ef4444',
              borderRadius: '12px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '75%',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
              marginRight: 'auto',
              overflow: 'hidden'
            }}>
              <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflowX: 'auto', scrollbarWidth: 'thin' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#991b1b', whiteSpace: 'nowrap' }}>
                  🚨 1-Month Renewal Red Alert ({expiringRenewals.length}):
                </span>
                {expiringRenewals.map((item, idx) => (
                  <div key={item._id || idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'white',
                    border: '1px solid #fca5a5',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>👤 {item.clientName}</span>
                    <span style={{ color: '#94a3b8' }}>•</span>
                    <span style={{ fontWeight: 600, color: '#2563eb' }}>📦 {item.packageName}</span>
                    <span style={{ color: '#94a3b8' }}>•</span>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>
                      📅 Last Renewal Date: {new Date(item.lastRenewalDate).toLocaleDateString('en-GB')}
                    </span>
                    <span style={{
                      background: item.isExpired ? '#fee2e2' : '#fef3c7',
                      color: item.isExpired ? '#dc2626' : '#d97706',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700
                    }}>
                      {item.isExpired ? '⛔ Service Off' : `⚠️ ${item.daysRemaining}d remaining`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : expiringSoonCount > 0 ? (
            <Link 
              to="/dashboard/packages?tab=subscriptions" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: '#fee2e2', 
                border: '1px solid #fca5a5', 
                color: '#dc2626', 
                padding: '6px 14px', 
                borderRadius: '20px', 
                fontSize: '13px', 
                fontWeight: 600, 
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.1)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = '#fecaca';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <AlertCircle size={16} color="#dc2626" />
              <span>{expiringSoonCount} Subscription{expiringSoonCount > 1 ? 's' : ''} Expiring Within 15 Days!</span>
            </Link>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>


            {/* Notification Bell */}
            <div className="notification-bell-container" style={{ position: 'relative' }}>
              <div 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)} 
                style={{ cursor: 'pointer', padding: '8px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                <Bell size={20} color="#475569" />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                    {unreadCount}
                  </span>
                )}
              </div>

              {isNotificationOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', width: '320px', zIndex: 1001, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllAsRead} 
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map(n => {
                        const isUnread = !n.readBy.includes(userId);
                        return (
                          <div 
                            key={n._id} 
                            onClick={() => handleNotificationClick(n)}
                            style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isUnread ? '#eff6ff' : 'white', transition: 'background 0.2s', position: 'relative' }}
                            onMouseOver={e => e.currentTarget.style.background = isUnread ? '#dbeafe' : '#f8fafc'}
                            onMouseOut={e => e.currentTarget.style.background = isUnread ? '#eff6ff' : 'white'}
                          >
                            {isUnread && (
                              <span style={{ position: 'absolute', top: '15px', right: '15px', width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%' }}></span>
                            )}
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', paddingRight: '12px' }}>{n.title}</div>
                            <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>{n.message}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
                              {new Date(n.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="user-profile" style={{ position: 'relative' }}>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              >
                <div className="avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {user?.profilePhoto ? (
                    <img src={`http://localhost:5000${user.profilePhoto}`} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.name?.charAt(0) || 'A'
                  )}
                </div>
                <span>{user?.name || 'Admin User'}</span>
                {isProfileMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {isProfileMenuOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '150px', zIndex: 1000, overflow: 'hidden' }}>
                  <Link to="/dashboard/my-profile" onClick={() => setIsProfileMenuOpen(false)} style={{ display: 'block', padding: '10px 15px', textDecoration: 'none', color: '#1e293b', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 500 }}>
                    <UserCog size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} /> My Profile
                  </Link>
                  <div onClick={handleLogout} style={{ display: 'block', padding: '10px 15px', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                    <LogOut size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} /> Logout
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="page-content">
          <Outlet />
        </div>
      </div>

      {/* Pending Partial Payment Reminder Modal */}
      {showPartialReminderModal && duePartialInvoices.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', zIndex: 9999, justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', width: '95%', maxWidth: '650px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ Pending Partial Payment Reminder
              </h3>
              <button onClick={() => setShowPartialReminderModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
              You have <strong>{duePartialInvoices.length}</strong> clients with pending partial payments. Please follow up on these dues.
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569' }}>Client Company</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569' }}>Services</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Due Amount</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569' }}>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {duePartialInvoices.map((inv: any) => (
                    <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>
                        {inv.clientCompanyName || inv.client?.companyName || 'N/A'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>
                        {inv.packageOrService || (inv.items || []).map((item: any) => item.description || item.serviceName).join(', ')}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#ef4444', textAlign: 'right' }}>
                        ₹{inv.dueAmount?.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowPartialReminderModal(false)}
                style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px', cursor: 'pointer' }}
              >
                Close
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => {
                  setShowPartialReminderModal(false);
                  navigate('/dashboard/packages?tab=partial-payments');
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                View in Module
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
