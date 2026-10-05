import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import VerifyClientEmail from './pages/VerifyClientEmail';
import axios from 'axios';

// Configure global Axios request interceptor to automatically attach JWT token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Configure global Axios response interceptor to handle token expiration (401)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('hasShownPartialReminder');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
import DashboardLayout from './layouts/DashboardLayout';
import DashboardOverview from './pages/DashboardOverview';
import PrivateDashboard from './pages/PrivateDashboard';
import RoleManagement from './pages/RoleManagement';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import DepartmentManagement from './pages/DepartmentManagement';
import UserTypeManagement from './pages/UserTypeManagement';
import HolidayManagement from './pages/HolidayManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import MyProfile from './pages/MyProfile';
import LeadManagement from './pages/LeadManagement';
import LocationManagement from './pages/LocationManagement';
import MarketingLocationTracking from './pages/MarketingLocationTracking';
import ServiceMaster from './pages/ServiceMaster';
import ServiceDetailMaster from './pages/ServiceDetailMaster';
import PackageManagement from './pages/PackageManagement';
import ServiceCategoryMaster from './pages/ServiceCategoryMaster';
import InvoiceManagement from './pages/InvoiceManagement';
import ClientManagement from './pages/ClientManagement';
import MyProjects from './pages/MyProjects';
import LeaveManagement from './pages/LeaveManagement';
import PayrollManagement from './pages/PayrollManagement';
import MenuPermissionManagement from './pages/MenuPermissionManagement';

const isAdminUser = () => {
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const role = (userObj?.role?.name || '').toLowerCase().trim();
  const userType = (typeof userObj?.role?.userType === 'object' ? userObj?.role?.userType?.name : userObj?.role?.userType || '').toLowerCase().trim();
  return ['admin', 'super admin'].includes(role) || ['admin', 'super admin'].includes(userType);
};

const isEmployeeAccessUser = () => {
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  return !!(userObj && (userObj._id || userObj.id || userObj.email));
};

const AdminRoute = ({ children }: { children: ReactNode }) => {
  return isAdminUser() ? <>{children}</> : <Navigate to="/dashboard/my-dashboard" />;
};

const EmployeeRoute = ({ children }: { children: ReactNode }) => {
  return isEmployeeAccessUser() ? <>{children}</> : <Navigate to="/dashboard/my-dashboard" />;
};

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/verify-client-email" element={<VerifyClientEmail />} />
        
        {/* Protected Dashboard Routes */}
        <Route path="/dashboard" element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" />}>
          <Route path="overview" element={<AdminRoute><DashboardOverview /></AdminRoute>} />
          <Route path="my-dashboard" element={<PrivateDashboard />} />
          <Route path="users" element={<EmployeeRoute><UserManagement /></EmployeeRoute>} />
          <Route path="leads" element={<LeadManagement />} />
          <Route path="services" element={<AdminRoute><ServiceMaster /></AdminRoute>} />
          <Route path="service-details" element={<AdminRoute><ServiceDetailMaster /></AdminRoute>} />
          <Route path="service-categories" element={<AdminRoute><ServiceCategoryMaster /></AdminRoute>} />
          <Route path="packages" element={<PackageManagement />} />
          <Route path="my-profile" element={<MyProfile />} />
          <Route path="attendance" element={<AttendanceManagement />} />
          <Route path="payroll" element={<PayrollManagement />} />
          <Route path="leaves" element={<LeaveManagement />} />
          <Route path="marketing-tracking" element={<AdminRoute><MarketingLocationTracking /></AdminRoute>} />
          <Route path="roles" element={<AdminRoute><RoleManagement /></AdminRoute>} />
          <Route path="departments" element={<AdminRoute><DepartmentManagement /></AdminRoute>} />
          <Route path="locations" element={<AdminRoute><LocationManagement /></AdminRoute>} />
          <Route path="user-types" element={<AdminRoute><UserTypeManagement /></AdminRoute>} />
          <Route path="holidays" element={<AdminRoute><HolidayManagement /></AdminRoute>} />
          <Route path="menu-permissions" element={<AdminRoute><MenuPermissionManagement /></AdminRoute>} />
          <Route path="settings" element={<Settings />} />
          <Route path="invoices" element={<InvoiceManagement />} />
          <Route path="clients" element={<ClientManagement />} />
          <Route path="my-projects" element={<MyProjects />} />
          <Route index element={<Navigate to={isAdminUser() ? 'overview' : 'my-dashboard'} />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
