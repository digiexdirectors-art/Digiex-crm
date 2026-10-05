import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, CheckSquare, Bell, Cake, User as UserIcon, CalendarDays, BarChart2, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

export default function PrivateDashboard() {
  const [user, setUser] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [stats, setStats] = useState<any>({ present: 0, absent: 0, late: 0, halfDay: 0 });
  const [timerStr, setTimerStr] = useState('00:00:00');
  const [status, setStatus] = useState('Not Clocked In');
  const [birthdays, setBirthdays] = useState<any>({ today: [], upcoming: [] });
  const [showWishModal, setShowWishModal] = useState(false);
  const [wishRecipient, setWishRecipient] = useState<any>(null);
  const [wishMessage, setWishMessage] = useState('Happy Birthday! 🎂');
  const [receivedWishes, setReceivedWishes] = useState<any[]>([]);
  const [showReceivedPopup, setShowReceivedPopup] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [clientStats, setClientStats] = useState({ total: 0, verified: 0, unverified: 0 });
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('DIGIEX WEB SERVICES');
  const [delayedProjects, setDelayedProjects] = useState<any[]>([]);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      const userId = parsed.id || parsed._id;
      // Optimistically set partial user
      setUser(parsed);
      fetchUserProfile(userId);
      fetchAttendance(userId);
      fetchLeaveBalance(userId);
      fetchStats(userId);
      fetchBirthdays();
      fetchReceivedWishes(userId);
      fetchHolidays();
      fetchAssignedProjectDelays(userId);

      axios.get('http://localhost:5000/api/settings').then(res => {
        if (res.data.success) {
          const settingsMap: any = {};
          (res.data.data || []).forEach((s: any) => { settingsMap[s.key] = s.value; });
          if (settingsMap.company_logo) {
            const logo = settingsMap.company_logo;
            setCompanyLogo(logo.startsWith('http') ? logo : `http://localhost:5000${logo}`);
          }
          if (settingsMap.company_name) setCompanyName(settingsMap.company_name);
        }
      }).catch(err => console.error('Error fetching settings for dashboard', err));

      axios.get('http://localhost:5000/api/clients').then(res => {
        if (res.data.success) {
          const list = res.data.data;
          setClientStats({
            total: list.length,
            verified: list.filter((c: any) => c.isVerified).length,
            unverified: list.filter((c: any) => !c.isVerified).length
          });
        }
      }).catch(err => console.error('Error fetching clients for dashboard', err));
    }
  }, []);

  const fetchLeaveBalance = async (userId: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/leaves/balance/${userId}`);
      if (res.data.success) {
        setLeaveBalance(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching leave balance', err);
    }
  };

  const fetchAssignedProjectDelays = async (userId: string) => {
    try {
      const res = await axios.get('http://localhost:5000/api/clients/my-projects');
      if (res.data.success) {
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
      console.error('Error fetching assigned project delays for dashboard:', err);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/users/${userId}`);
      if (res.data.success) {
        setUser(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching user profile', err);
    }
  };

  const fetchAttendance = async (userId: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/attendance/today/${userId}`);
      setAttendance(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async (userId: string) => {
    try {
      const now = new Date();
      const res = await axios.get(`http://localhost:5000/api/attendance/stats/${userId}?month=${now.getMonth()+1}&year=${now.getFullYear()}`);
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBirthdays = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/users/birthdays');
      if (res.data.success) {
        setBirthdays(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching birthdays', err);
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/holidays');
      if (res.data.success) {
        // filter to upcoming holidays
        const today = new Date();
        today.setHours(0,0,0,0);
        const upcoming = res.data.data.filter((h: any) => new Date(h.date) >= today).slice(0, 5);
        setHolidays(upcoming);
      }
    } catch (err) {
      console.error('Error fetching holidays', err);
    }
  };

  const fetchReceivedWishes = async (userId: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/birthday-wishes/${userId}`);
      if (res.data.success && res.data.data.length > 0) {
        setReceivedWishes(res.data.data);
        setShowReceivedPopup(true);
      }
    } catch (err) {
      console.error('Error fetching wishes', err);
    }
  };

  const handleSendWish = async () => {
    if (!user || !wishRecipient) return;
    try {
      await axios.post('http://localhost:5000/api/birthday-wishes/send', {
        senderId: user._id || user.id,
        receiverId: wishRecipient._id,
        message: wishMessage
      });
      setShowWishModal(false);
      setWishMessage('Happy Birthday! 🎂');
      alert(`Wish sent to ${wishRecipient.name}!`);
    } catch (err) {
      console.error('Error sending wish', err);
      alert('Failed to send wish');
    }
  };

  const handleCloseWishes = async () => {
    if (!user) return;
    try {
      await axios.put(`http://localhost:5000/api/birthday-wishes/read/${user._id || user.id}`);
      setShowReceivedPopup(false);
      setReceivedWishes([]);
    } catch (err) {
      console.error('Error marking wishes as read', err);
    }
  };

  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [clockInError, setClockInError] = useState<string | null>(null);

  useEffect(() => {
    if (!attendance || !attendance.clockIn) {
      setTimerStr('00:00:00');
      setStatus('Not Clocked In');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      let totalMs = 0;

      const sessions = attendance.workSessions || [];
      const breaks = attendance.breaks || [];

      const baseDate = attendance.clockIn ? new Date(attendance.clockIn) : new Date();
      const cutoff9PM = new Date(baseDate);
      cutoff9PM.setHours(21, 0, 0, 0);
      const cutoff9PMMs = cutoff9PM.getTime();
      const endLimit = Math.min(now.getTime(), cutoff9PMMs);

      // 1. Calculate duration from all work sessions today
      if (sessions.length > 0) {
        sessions.forEach((s: any) => {
          const sStart = new Date(s.clockIn).getTime();
          const sEnd = s.clockOut ? new Date(s.clockOut).getTime() : (!attendance.clockOut ? endLimit : sStart);
          if (!isNaN(sStart) && !isNaN(sEnd) && sEnd > sStart) {
            totalMs += (sEnd - sStart);
          }
        });
      } else {
        // Fallback for single-session records
        const start = new Date(attendance.clockIn).getTime();
        const end = attendance.clockOut ? new Date(attendance.clockOut).getTime() : endLimit;
        if (!isNaN(start) && !isNaN(end) && end > start) {
          totalMs = end - start;
        }
      }

      // 2. Check if currently on break
      let onBreak = false;
      if (breaks.length > 0) {
        const lastBreak = breaks[breaks.length - 1];
        if (!lastBreak.end && !attendance.clockOut) {
          onBreak = true;
          const breakStartMs = new Date(lastBreak.start).getTime();
          if (endLimit > breakStartMs) {
            totalMs -= (endLimit - breakStartMs);
          }
        }
      }

      // 3. Subtract all completed break durations
      breaks.forEach((b: any) => {
        if (b.start && b.end) {
          const bStart = new Date(b.start).getTime();
          const bEnd = new Date(b.end).getTime();
          if (!isNaN(bStart) && !isNaN(bEnd) && bEnd > bStart) {
            totalMs -= (bEnd - bStart);
          }
        }
      });

      if (isNaN(totalMs) || totalMs < 0) totalMs = 0;

      if (attendance.clockOut || now.getTime() >= cutoff9PMMs) {
        if (!attendance.clockOut && now.getTime() >= cutoff9PMMs) {
          setStatus('Auto Clocked Out (9 PM)');
        } else {
          setStatus('Clocked Out');
        }
      } else if (onBreak) {
        setStatus('On Break');
      } else {
        setStatus('Working');
      }

      const hrs = Math.floor(totalMs / 3600000);
      const mins = Math.floor((totalMs % 3600000) / 60000);
      const secs = Math.floor((totalMs % 60000) / 1000);
      setTimerStr(`${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [attendance]);

  const handleClockIn = async () => {
    if (!user || isClockingIn) return;
    setIsClockingIn(true);
    setClockInError(null);
    const userId = user._id || user.id;
    
    const getLocationPromise = new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 3000, maximumAge: 60000 }
      );
    });

    const getIpPromise = axios.get('https://api.ipify.org?format=json', { timeout: 2500 })
      .then(res => res.data?.ip || '')
      .catch(() => '');

    try {
      const [location, ip] = await Promise.all([getLocationPromise, getIpPromise]);
      const res = await axios.post('http://localhost:5000/api/attendance/clock-in', { userId, location, ip });
      if (res.data?.success) {
        setAttendance(res.data.data);
        window.dispatchEvent(new Event('attendance-update'));
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Clock-in failed. Unable to start timer at this time.';
      setClockInError(errMsg);
      alert(errMsg);
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    const userId = user._id || user.id;
    try {
      const res = await axios.post('http://localhost:5000/api/attendance/clock-out', { userId });
      if (res.data?.success) {
        setAttendance(res.data.data);
        window.dispatchEvent(new Event('attendance-update'));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Clock-out failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBreakStart = async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    const userId = user._id || user.id;
    try {
      const res = await axios.post('http://localhost:5000/api/attendance/break-start', { userId });
      if (res.data?.success) {
        setAttendance(res.data.data);
        window.dispatchEvent(new Event('attendance-update'));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Start break failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBreakEnd = async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    const userId = user._id || user.id;
    try {
      const res = await axios.post('http://localhost:5000/api/attendance/break-end', { userId });
      if (res.data?.success) {
        setAttendance(res.data.data);
        window.dispatchEvent(new Event('attendance-update'));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Resume work failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      
      {/* OVERDUE ASSIGNED PROJECT RED ALERT BANNER FOR LOGGED-IN EMPLOYEE */}
      {delayedProjects.length > 0 && (
        <div style={{
          background: '#fee2e2',
          border: '2px solid #dc2626',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 4px 14px rgba(220, 38, 38, 0.18)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#7f1d1d', fontWeight: 800, fontSize: '16px', marginBottom: '12px' }}>
            <AlertCircle size={24} color="#dc2626" />
            <span>🚨 ASSIGNED PROJECT DELAY ALERT ({delayedProjects.length})</span>
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
                    Assigned Last Date / Deadline: <strong>{dp.endDateStr}</strong>
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

      {/* Header Section */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        
        {/* Profile Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', flex: '1', minWidth: '300px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', overflow: 'hidden', flexShrink: 0 }}>
              {user?.profilePhoto ? (
                <img src={`http://localhost:5000${user.profilePhoto}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user?.name?.charAt(0) || 'U'
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '24px', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {user?.name || 'Employee Name'}
                    {delayedProjects.length > 0 && (
                      <span style={{ 
                        background: '#fee2e2', 
                        color: '#dc2626', 
                        border: '1.5px solid #ef4444', 
                        padding: '3px 10px', 
                        borderRadius: '16px', 
                        fontSize: '12px', 
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🔴 RED MARK: {delayedProjects.length} Delayed {delayedProjects.length === 1 ? 'Project' : 'Projects'}
                      </span>
                    )}
                  </h1>
                  <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '16px', fontWeight: 500 }}>
                    {user?.role?.name || 'Designation'} {user?.role?.department?.name ? `| ${user.role.department.name}` : ''}
                  </p>
                </div>

                {/* Company Logo Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '8px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <img 
                    src={companyLogo || 'https://digiexweb.com/assets/img/logo.png'} 
                    alt="Company Logo" 
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://digiexweb.com/assets/img/logo.png'; }}
                    style={{ height: '32px', maxWidth: '120px', objectFit: 'contain' }}
                  />
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e3a8a' }}>{companyName}</span>
                </div>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8' }}>
                <UserIcon size={14} /> ID: {user?.employeeId || 'N/A'}
              </div>
            </div>
          </div>

        {/* Attendance Widget */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '30px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', minWidth: '350px' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Today's Time</div>
            <div style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'monospace', color: '#1e293b', margin: '4px 0' }}>{timerStr}</div>
            <div style={{ fontSize: '14px', color: status === 'Working' ? '#10b981' : (status === 'On Break' ? '#f59e0b' : '#64748b'), display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: status === 'Working' ? '#10b981' : (status === 'On Break' ? '#f59e0b' : '#64748b') }}></span>
              {status}
              {attendance?.isLate && <span style={{ background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>Late</span>}
              {attendance?.isWFH && <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>WFH</span>}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {clockInError && (
              <div style={{ fontSize: '12px', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 10px', borderRadius: '8px', textAlign: 'center' }}>
                {clockInError}
              </div>
            )}

            {(!attendance || !attendance.clockIn || attendance.clockOut) && (
              <button 
                className="btn-primary" 
                onClick={handleClockIn} 
                disabled={isClockingIn}
                style={{ 
                  background: isClockingIn ? '#9ca3af' : '#10b981', 
                  borderColor: isClockingIn ? '#9ca3af' : '#10b981', 
                  width: '100%', 
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isClockingIn ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isClockingIn ? 0.8 : 1
                }}
              >
                {isClockingIn ? (
                  <>
                    <span style={{ border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 0.8s linear infinite', display: 'inline-block' }}></span>
                    Starting Timer...
                  </>
                ) : (
                  <>
                    <Clock size={16} /> {attendance?.clockOut ? 'Clock In Again' : 'Clock In'}
                  </>
                )}
              </button>
            )}
            
            {(attendance && attendance.clockIn && !attendance.clockOut) && (
              <>
                {status !== 'On Break' ? (
                  <button className="btn-secondary" onClick={handleBreakStart} disabled={isActionLoading} style={{ color: '#f59e0b', borderColor: '#f59e0b', background: '#fef3c7', width: '100%', padding: '10px' }}>
                    {isActionLoading ? 'Updating...' : 'Start Break'}
                  </button>
                ) : (
                  <button className="btn-secondary" onClick={handleBreakEnd} disabled={isActionLoading} style={{ color: '#10b981', borderColor: '#10b981', background: '#d1fae5', width: '100%', padding: '10px' }}>
                    {isActionLoading ? 'Updating...' : 'Resume Work'}
                  </button>
                )}
                <button className="btn-danger" onClick={handleClockOut} disabled={isActionLoading} style={{ width: '100%', padding: '10px' }}>
                  {isActionLoading ? 'Clocking Out...' : 'Clock Out'}
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Main Grid Body */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        
        {/* Attendance Chart */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-color)' }}>
            <BarChart2 size={20} color="var(--primary)" /> Attendance Overview
          </h3>
          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie 
                  data={[
                    { name: 'Present', value: stats.present },
                    { name: 'Absent', value: stats.absent },
                    { name: 'Late', value: stats.late },
                    { name: 'Half Day', value: stats.halfDay },
                  ]} 
                  innerRadius={60} 
                  outerRadius={80} 
                  paddingAngle={5} 
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { name: 'Present', value: stats.present },
              { name: 'Absent', value: stats.absent },
              { name: 'Late', value: stats.late },
              { name: 'Half Day', value: stats.halfDay },
            ].map((entry, index) => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS[index] }}></span>
                {entry.name}: <strong>{entry.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Chart / Balance */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-color)' }}>
            <CalendarDays size={20} color="var(--primary)" /> Leave Analytics
          </h3>
          
          {leaveBalance && Array.isArray(leaveBalance) ? (() => {
            const clsl = leaveBalance.find((b: any) => ['CL', 'SL'].includes(b.leaveType?.code));
            if (!clsl) {
              return <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>No active leave balances.</div>;
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>Annual Leaves (CL & SL)</span>
                    <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>Shared annual pool of 22 leaves</div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
                    {clsl.remaining} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>/ {clsl.allocated} left</span>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading leave balance...</div>
          )}
        </div>

        {/* Tasks & My Tasks */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-color)' }}>
            <CheckSquare size={20} color="var(--primary)" /> Tasks
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px' }}>My Pending Tasks</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px' }}>Review Q3 Financial Report</span>
                <span style={{ fontSize: '12px', color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>High</span>
              </li>
              <li style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px' }}>Update Team Documentation</span>
                <span style={{ fontSize: '12px', color: '#f59e0b', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px' }}>Medium</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px' }}>Project Tasks</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ padding: '12px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px' }}>UI Design Overhaul (Phase 2)</span>
                <span style={{ fontSize: '12px', color: '#10b981' }}>75%</span>
              </li>
            </ul>
          </div>
        </div>


      </div>

      {/* Secondary Grid Body for Birthdays and Notices */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>

        {/* Birthdays & Shift Schedule */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-color)', fontSize: '18px', fontWeight: 700 }}>
            <Cake size={22} color="#e11d48" /> Birthdays
          </h3>
          
          {birthdays.today.length > 0 ? (
            birthdays.today.map((b: any) => (
              <div key={b._id} style={{ 
                position: 'relative',
                padding: '20px', 
                background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', 
                borderRadius: '20px', 
                border: '1px solid #fda4af', 
                marginBottom: '24px',
                boxShadow: '0 10px 15px -3px rgba(225, 29, 72, 0.1)',
                overflow: 'hidden'
              }}>
                {/* Decorative Elements */}
                <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '40px', opacity: 0.1, transform: 'rotate(15deg)' }}>🎂</div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
                  <div style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: '50%', 
                    background: '#fff', 
                    padding: '3px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 800 }}>
                      {b.profilePhoto ? (
                        <img src={`http://localhost:5000${b.profilePhoto}`} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        b.name?.charAt(0) || 'U'
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#9f1239', marginBottom: '2px' }}>{b.name}</div>
                    <div style={{ fontSize: '13px', color: '#e11d48', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Celebrating Today! <span style={{ animation: 'bounce 1s infinite' }}>🎈</span>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setWishRecipient(b);
                    setShowWishModal(true);
                  }}
                  style={{ 
                    marginTop: '16px', 
                    width: '100%', 
                    padding: '10px', 
                    borderRadius: '12px', 
                    border: 'none', 
                    background: '#e11d48', 
                    color: '#fff', 
                    fontWeight: 600, 
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.2)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Send Best Wishes ✨
                </button>
              </div>
            ))
          ) : (
            <div style={{ 
              fontSize: '14px', 
              color: '#64748b', 
              padding: '24px', 
              background: '#f8fafc', 
              borderRadius: '16px', 
              marginBottom: '24px', 
              textAlign: 'center',
              border: '1px dashed #e2e8f0'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</div>
              No birthdays today. Check back tomorrow!
            </div>
          )}

          {birthdays.upcoming.length > 0 && (
            <div style={{ marginTop: '30px', marginBottom: '30px' }}>
              <div style={{ 
                fontSize: '12px', 
                color: '#94a3b8', 
                fontWeight: 800, 
                textTransform: 'uppercase', 
                marginBottom: '20px', 
                letterSpacing: '1.5px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px' 
              }}>
                <span style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, #e2e8f0)' }}></span>
                Upcoming Celebrations
                <span style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, #e2e8f0)' }}></span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {birthdays.upcoming.map((b: any) => (
                  <div key={b._id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px', 
                    padding: '16px', 
                    borderRadius: '20px', 
                    background: '#fff', 
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateX(5px)';
                    e.currentTarget.style.borderColor = '#fda4af';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.05)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.borderColor = '#f1f5f9';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)';
                  }}
                  >
                    {/* Progress indicator on the left */}
                    <div style={{ 
                      position: 'absolute', 
                      left: 0, 
                      top: 0, 
                      bottom: 0, 
                      width: '4px', 
                      background: 'linear-gradient(to bottom, #fda4af, #f43f5e)',
                      opacity: 0.6
                    }}></div>

                    <div style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '16px', 
                      overflow: 'hidden', 
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
                      border: '2px solid #fff', 
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                      flexShrink: 0
                    }}>
                      {b.profilePhoto ? (
                        <img src={`http://localhost:5000${b.profilePhoto}`} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '18px', fontWeight: 700 }}>
                          {b.name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>{b.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                        <span style={{ color: '#f43f5e', background: '#fff1f2', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 800 }}>
                          {new Date(b.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span>•</span>
                        <span style={{ color: '#94a3b8' }}>Birthday Coming</span>
                      </div>
                    </div>

                    <div style={{ 
                      textAlign: 'right',
                      background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
                      padding: '8px 12px',
                      borderRadius: '14px',
                      border: '1px solid #fee2e2',
                      flexShrink: 0
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#e11d48', lineHeight: 1 }}>{b.daysUntil}</div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', marginTop: '2px' }}>Days</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


        </div>

        {/* Events & Notices */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-color)' }}>
            <Bell size={20} color="var(--primary)" /> Notices & Events
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            {holidays.length > 0 ? holidays.map((holiday) => (
              <div key={holiday._id} style={{ background: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: '12px 16px', borderRadius: '0 8px 8px 0', marginBottom: '12px' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#1e293b' }}>
                  {holiday.name}
                  {holiday.type && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' }}>{holiday.type}</span>}
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{holiday.description || 'Upcoming Holiday'}</p>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>
                    {new Date(holiday.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            )) : (
              <div style={{ 
                fontSize: '14px', 
                color: '#64748b', 
                padding: '24px', 
                background: '#f8fafc', 
                borderRadius: '16px', 
                textAlign: 'center',
                border: '1px dashed #e2e8f0'
              }}>
                No upcoming events or notices.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Send Wish Modal */}
      {showWishModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎈</div>
            <h3 style={{ marginBottom: '8px' }}>Send Birthday Wish</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>To: <strong>{wishRecipient?.name}</strong></p>
            
            <textarea 
              value={wishMessage}
              onChange={(e) => setWishMessage(e.target.value)}
              style={{ 
                width: '100%', 
                height: '100px', 
                padding: '12px', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0', 
                marginBottom: '20px',
                resize: 'none',
                fontFamily: 'inherit'
              }}
              placeholder="Write your message here..."
            />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowWishModal(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1, background: '#e11d48', borderColor: '#e11d48' }} onClick={handleSendWish}>Send Wish ✨</button>
            </div>
          </div>
        </div>
      )}

      {/* Received Wishes Popup */}
      {showReceivedPopup && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-content" style={{ 
            maxWidth: '450px', 
            background: 'linear-gradient(135deg, #fff 0%, #fff1f2 100%)',
            textAlign: 'center',
            padding: '40px'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px', animation: 'bounce 2s infinite' }}>
              {receivedWishes.some(w => w.type === 'thank_you') ? '💝' : '🎂'}
            </div>
            <h2 style={{ color: '#e11d48', marginBottom: '10px' }}>
              {receivedWishes.some(w => w.type === 'thank_you') ? 'Messages for You!' : `Happy Birthday, ${user?.name}!`}
            </h2>
            <p style={{ color: '#64748b', marginBottom: '30px' }}>
              {receivedWishes.some(w => w.type === 'thank_you') 
                ? 'Your teammates responded to your wishes:' 
                : 'Your teammates have sent you some love:'}
            </p>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '30px', padding: '10px' }}>
              {receivedWishes.map((wish: any) => (
                <div key={wish._id} style={{ 
                  background: '#fff', 
                  padding: '16px', 
                  borderRadius: '16px', 
                  marginBottom: '12px', 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '12px',
                  textAlign: 'left',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  borderLeft: wish.type === 'thank_you' ? '4px solid #10b981' : '4px solid #e11d48'
                }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    {wish.sender?.profilePhoto ? (
                      <img src={`http://localhost:5000${wish.sender.profilePhoto}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {wish.sender?.name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {wish.sender?.name} 
                      {wish.type === 'thank_you' && <span style={{ fontSize: '10px', background: '#dcfce7', color: '#16a34a', padding: '2px 6px', borderRadius: '4px' }}>Thank You Note</span>}
                    </div>
                    <div style={{ fontSize: '14px', color: '#475569', marginTop: '4px', fontStyle: 'italic' }}>"{wish.message}"</div>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px' }} onClick={handleCloseWishes}>
              {receivedWishes.some(w => w.type === 'thank_you') ? 'Close' : 'Thanks Everyone! ❤️'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
