import { useState, useEffect } from 'react';
import axios from 'axios';
import { MapPin, Monitor, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AttendanceManagement() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(attendance.length / itemsPerPage);
  const displayedAttendance = attendance.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [attendance.length, totalPages, currentPage]);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Case-insensitive role, department, and userType check supporting "Human Resource" and "HR"
  const userRole = (currentUser?.role?.name || '').toLowerCase().trim();
  const userDept = (typeof currentUser?.role?.department === 'object' ? currentUser?.role?.department?.name : currentUser?.role?.department || '').toLowerCase().trim();
  const userType = (typeof currentUser?.role?.userType === 'object' ? currentUser?.role?.userType?.name : currentUser?.role?.userType || '').toLowerCase().trim();

  const isAdmin = ['admin', 'super admin'].includes(userRole) || ['admin', 'super admin'].includes(userType);
  const isHR = userRole.includes('hr') || userRole.includes('human resource') || userDept.includes('hr') || userDept.includes('human resource');
  
  const hasSubmenuAccess = isAdmin || isHR;
  
  const [filters, setFilters] = useState({ 
    filterType: 'month',
    date: new Date().toISOString().split('T')[0], 
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    user: hasSubmenuAccess ? '' : (currentUser._id || currentUser.id || '') 
  });

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let url = `http://localhost:5000/api/attendance?`;
      if (filters.filterType === 'month') {
         url += `month=${filters.month}`;
      } else {
         url += `date=${filters.date}`;
      }
      if (filters.user) {
         url += `&user=${filters.user}`;
      }
      const res = await axios.get(url);
      setAttendance(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasSubmenuAccess) {
      axios.get('http://localhost:5000/api/users')
        .then(res => setUsersList(res.data.data))
        .catch(err => console.error(err));
    }
  }, [hasSubmenuAccess]);

  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchAttendance();
  }, [filters.date, filters.month, filters.filterType, filters.user]);

  const exportToExcel = () => {
    if (attendance.length === 0) return;

    if (hasSubmenuAccess && filters.filterType === 'month' && !filters.user) {
      // Generate Monthly Summary Matrix for all employees
      const [year, month] = filters.month.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      
      const employeeMap: any = {};
      
      attendance.forEach(record => {
        const empId = record.user?._id;
        if (!empId) return;
        
        if (!employeeMap[empId]) {
          employeeMap[empId] = {
            'Employee Name': record.user?.name || '',
            'Employee ID': record.user?.employeeId || '',
            'Total P': 0,
            'Total LP': 0,
            'Total HD': 0,
            'Total A': 0
          };
          for (let i = 1; i <= daysInMonth; i++) {
            employeeMap[empId][i.toString()] = '-';
          }
        }
        
        const day = new Date(record.date).getDate().toString();
        const isNoClockIn = !record.clockIn && (!record.workSessions || record.workSessions.length === 0);
        let status = record.status;
        if (isNoClockIn && status !== 'Leave' && status !== 'LWP') {
          status = 'Absent';
        }
        if (!status) status = 'A';

        let shortStatus = status;
        if (status === 'Full-Day' || status === 'Present') shortStatus = 'P';
        if (status === 'Half-Day') shortStatus = 'HD';
        if (status === 'Absent' || status === 'A') shortStatus = 'A';
        
        employeeMap[empId][day] = shortStatus;
        
        if (shortStatus === 'P') employeeMap[empId]['Total P']++;
        if (shortStatus === 'LP') {
           employeeMap[empId]['Total P']++;
           employeeMap[empId]['Total LP']++;
        }
        if (shortStatus === 'HD') employeeMap[empId]['Total HD']++;
        if (shortStatus === 'A') employeeMap[empId]['Total A']++;
      });
      
      const rows = Object.values(employeeMap);
      rows.sort((a: any, b: any) => a['Employee Name'].localeCompare(b['Employee Name']));
      
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Attendance");
      XLSX.writeFile(workbook, `All_Employees_Attendance_${filters.month}.xlsx`);
      return;
    }

    // Default individual/daily export
    let employeeName = '';
    if (filters.user) {
      const selectedUser = usersList.find(u => u._id === filters.user);
      if (selectedUser) employeeName = selectedUser.name.replace(/[^a-z0-9]/gi, '_') + '_';
      else {
        const firstRecord = attendance.find(r => r.user?._id === filters.user);
        if (firstRecord && firstRecord.user) employeeName = firstRecord.user.name.replace(/[^a-z0-9]/gi, '_') + '_';
      }
    } else {
      const uniqueUsers = new Set(attendance.map(a => a.user?._id));
      if (uniqueUsers.size === 1 && attendance[0].user) {
        employeeName = attendance[0].user.name.replace(/[^a-z0-9]/gi, '_') + '_';
      }
    }
    
    if (!employeeName && !hasSubmenuAccess) {
      employeeName = (currentUser?.name || '').replace(/[^a-z0-9]/gi, '_') + '_';
    }

    const reportPeriod = filters.filterType === 'month' ? filters.month : filters.date;
    const fileName = `${employeeName}Attendance_Report_${reportPeriod}.xlsx`;

    let sortedAttendance = [...attendance];
    sortedAttendance.sort((a: any, b: any) => {
      const nameA = a.user?.name || '';
      const nameB = b.user?.name || '';
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const rows = sortedAttendance.map(record => {
      const isNoClockIn = !record.clockIn && (!record.workSessions || record.workSessions.length === 0);
      let status = record.status;
      if (isNoClockIn && status !== 'Leave' && status !== 'LWP') {
        status = 'Absent';
      }
      return {
        'Employee Name': record.user?.name || '',
        'Employee ID': record.user?.employeeId || '',
        'Date': new Date(record.date).toLocaleDateString(),
        'Clock In': record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : '-',
        'Clock Out': record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '-',
        'Work Hours': record.totalHours || 0,
        'Status': status || '-',
        'Mode': record.isWFH ? 'Remote' : 'Office'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
    
    XLSX.writeFile(workbook, fileName);
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Attendance Management</h1>
      </div>

      <div className="data-table-container" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Filter By</label>
            <select className="input-field" value={filters.filterType} onChange={e => setFilters({...filters, filterType: e.target.value})}>
              <option value="date">Daily</option>
              <option value="month">Monthly</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{filters.filterType === 'month' ? 'Select Month' : 'Select Date'}</label>
            {filters.filterType === 'month' ? (
              <input 
                type="month" 
                className="input-field" 
                value={filters.month} 
                onChange={e => setFilters({...filters, month: e.target.value})} 
              />
            ) : (
              <input 
                type="date" 
                className="input-field" 
                value={filters.date} 
                onChange={e => setFilters({...filters, date: e.target.value})} 
              />
            )}
          </div>
          {hasSubmenuAccess && (
            <div className="form-group" style={{ margin: 0, flex: 2 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Select Employee</label>
              <select 
                className="input-field" 
                value={filters.user}
                onChange={e => setFilters({...filters, user: e.target.value})}
              >
                <option value="">All Employees</option>
                {usersList.map((u: any) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.employeeId})</option>
                ))}
              </select>
            </div>
          )}
          <button className="btn-secondary" style={{ marginTop: '22px' }} onClick={fetchAttendance}>
            Refresh
          </button>
          <button className="btn-primary" style={{ marginTop: '22px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={exportToExcel} disabled={attendance.length === 0}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading attendance records...</div>
        ) : (
          <>
            <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Work Hours</th>
                <th>Breaks</th>
                <th>Status</th>
                <th>Mode/IP</th>
              </tr>
            </thead>
            <tbody>
              {displayedAttendance.map((record: any) => {
                const breakCount = record.breaks?.length || 0;
                const breakDurationMs = record.breaks?.reduce((acc: number, b: any) => {
                  if (b.start && b.end) return acc + (new Date(b.end).getTime() - new Date(b.start).getTime());
                  return acc;
                }, 0) || 0;
                const breakHours = parseFloat((breakDurationMs / 3600000).toFixed(2));

                const recordDate = record.clockIn ? new Date(record.clockIn) : new Date(record.date);
                const cutoff9PM = new Date(recordDate);
                cutoff9PM.setHours(21, 0, 0, 0);
                const cutoff9PMMs = cutoff9PM.getTime();
                const isPast9PM = nowTick > cutoff9PMMs;

                const isNoClockIn = !record.clockIn && (!record.workSessions || record.workSessions.length === 0 || !record.workSessions.some((s: any) => s.clockIn));
                let displayStatus = record.status;
                if (isNoClockIn && displayStatus !== 'Leave' && displayStatus !== 'LWP') {
                  displayStatus = 'Absent';
                }

                const isPresentStatus = ['Full-Day', 'Present', 'P', 'LP'].includes(displayStatus);
                const isAbsentStatus = ['Absent', 'A'].includes(displayStatus);
                const isHalfDayStatus = ['Half-Day', 'HD'].includes(displayStatus);

                const badgeBg = isPresentStatus ? '#ecfdf5' : (isAbsentStatus ? '#fef2f2' : (isHalfDayStatus ? '#fffbeb' : '#eff6ff'));
                const badgeColor = isPresentStatus ? '#059669' : (isAbsentStatus ? '#dc2626' : (isHalfDayStatus ? '#d97706' : '#1d4ed8'));
                const badgeBorder = isPresentStatus ? '#a7f3d0' : (isAbsentStatus ? '#fecaca' : (isHalfDayStatus ? '#fde68a' : '#bfdbfe'));

                let badgeLabel = displayStatus;
                if (displayStatus === 'Present' || displayStatus === 'Full-Day') badgeLabel = 'P';
                if (displayStatus === 'Absent') badgeLabel = 'A';
                if (displayStatus === 'Half-Day') badgeLabel = 'HD';

                return (
                  <tr key={record._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{new Date(record.date).toLocaleDateString()}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{record.user?.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{record.user?.employeeId}</div>
                    </td>
                    <td>
                      {record.workSessions && record.workSessions.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {record.workSessions.map((s: any, idx: number) => (
                            <div key={idx} style={{ fontSize: '13px' }}>
                              {formatTime(s.clockIn)}
                              {idx === 0 && record.isLate && <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 700, marginLeft: '4px' }}>● LATE</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <div>{formatTime(record.clockIn)}</div>
                          {record.isLate && <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>● LATE</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      {record.workSessions && record.workSessions.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {record.workSessions.map((s: any, idx: number) => (
                            <div key={idx} style={{ fontSize: '13px' }}>
                              {s.clockOut ? formatTime(s.clockOut) : (isPast9PM ? formatTime(cutoff9PM.toISOString()) : <span style={{ color: '#10b981', fontWeight: 600 }}>Active</span>)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div>{record.clockOut ? formatTime(record.clockOut) : (record.clockIn && isPast9PM ? formatTime(cutoff9PM.toISOString()) : '-')}</div>
                      )}
                    </td>
                    <td>
                      {(() => {
                        let totalMs = 0;
                        const sessions = record.workSessions || [];
                        const breaks = record.breaks || [];

                        const endLimit = Math.min(nowTick, cutoff9PMMs);

                        if (sessions.length > 0) {
                          sessions.forEach((s: any) => {
                            const sStart = new Date(s.clockIn).getTime();
                            const sEnd = s.clockOut ? new Date(s.clockOut).getTime() : (!record.clockOut ? endLimit : sStart);
                            if (!isNaN(sStart) && !isNaN(sEnd) && sEnd > sStart) {
                              totalMs += (sEnd - sStart);
                            }
                          });
                        } else if (record.clockIn) {
                          const start = new Date(record.clockIn).getTime();
                          const end = record.clockOut ? new Date(record.clockOut).getTime() : endLimit;
                          if (!isNaN(start) && !isNaN(end) && end > start) {
                            totalMs = end - start;
                          }
                        }

                        breaks.forEach((b: any) => {
                          if (b.start && b.end) {
                            const bStart = new Date(b.start).getTime();
                            const bEnd = new Date(b.end).getTime();
                            if (!isNaN(bStart) && !isNaN(bEnd) && bEnd > bStart) {
                              totalMs -= (bEnd - bStart);
                            }
                          }
                        });

                        if (totalMs < 0) totalMs = 0;
                        
                        const h = Math.floor(totalMs / 3600000);
                        const m = Math.floor((totalMs % 3600000) / 60000);
                        const s = Math.floor((totalMs % 60000) / 1000);

                        let formattedTime = '-';
                        if (totalMs > 0) {
                          if (h > 0) {
                            formattedTime = `${h}h ${m}m ${s}s`;
                          } else {
                            formattedTime = `${m}m ${s}s`;
                          }
                        }

                        const decimalHrs = parseFloat((totalMs / 3600000).toFixed(2));
                        const sessionCount = sessions.length;

                        return (
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontFamily: 'monospace', fontSize: '13px' }}>
                              {formattedTime !== '-' ? formattedTime : (record.totalHours ? `${record.totalHours} hrs` : '-')}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {decimalHrs > 0 ? `${decimalHrs} hrs` : ''} {sessionCount > 1 ? `(${sessionCount} Sessions)` : ''}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      {(() => {
                        const breaks = record.breaks || [];
                        if (breaks.length === 0) {
                          return <span style={{ color: '#94a3b8', fontSize: '13px' }}>0 breaks</span>;
                        }

                        const formatBreakDuration = (ms: number) => {
                          if (isNaN(ms) || ms <= 0) return '0s';
                          const bh = Math.floor(ms / 3600000);
                          const bm = Math.floor((ms % 3600000) / 60000);
                          const bs = Math.floor((ms % 60000) / 1000);
                          if (bh > 0) return `${bh}h ${bm}m ${bs}s`;
                          if (bm > 0) return `${bm}m ${bs}s`;
                          return `${bs}s`;
                        };

                        let totalBreakMs = 0;

                        return (
                          <div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                              {breaks.map((b: any, idx: number) => {
                                const bStart = new Date(b.start).getTime();
                                const bEnd = b.end ? new Date(b.end).getTime() : nowTick;
                                const bDurationMs = (!isNaN(bStart) && !isNaN(bEnd) && bEnd > bStart) ? (bEnd - bStart) : 0;
                                totalBreakMs += bDurationMs;
                                const isOngoing = !b.end;

                                return (
                                  <div key={idx} style={{ color: isOngoing ? '#d97706' : '#334155', fontWeight: isOngoing ? 700 : 500 }}>
                                    Break {idx + 1}: {formatBreakDuration(bDurationMs)} {isOngoing ? '🟡 (Active)' : ''}
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '4px', borderTop: breaks.length > 1 ? '1px dashed #e2e8f0' : 'none', paddingTop: breaks.length > 1 ? '3px' : 0 }}>
                              Total: {formatBreakDuration(totalBreakMs)}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <span className={`badge`} style={{ 
                        backgroundColor: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeBorder}`
                      }}>
                        {badgeLabel}
                      </span>
                      {record.isEarlyLeave && record.clockOut && <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>Early Leave</div>}
                    </td>
                     <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        {record.isWFH ? <Monitor size={14} color="#059669" /> : <MapPin size={14} color="#3b82f6" />}
                        <span>{record.isWFH ? 'Remote' : 'Office'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{record.clockInIP || 'N/A'}</div>
                    </td>

                  </tr>
                );
              })}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No attendance records found for this date.</td>
                </tr>
              )}
            </tbody>
          </table>
          {attendance.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 24px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                Showing {Math.min(attendance.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(attendance.length, currentPage * itemsPerPage)} of {attendance.length} entries
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
    </div>
  );
}
