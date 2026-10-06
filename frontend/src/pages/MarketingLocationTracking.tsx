import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, Navigation, Eye, X, Activity } from 'lucide-react';

export default function MarketingLocationTracking() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/attendance/marketing-tracking?date=${date}`);
      if (res.data.success) {
        setRecords(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching marketing tracking records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [date]);

  // Load Leaflet dynamically on demand
  useEffect(() => {
    if (!showModal) return;
    
    if ((window as any).L) {
      setMapLoaded(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setMapLoaded(true);
    };
    document.body.appendChild(script);
  }, [showModal]);

  // Render Map when data and leaflet are ready
  useEffect(() => {
    if (!showModal || !mapLoaded || !mapContainerRef.current || !selectedRecord) return;
    const logs = selectedRecord.locationLogs || [];
    if (logs.length === 0) return;

    // Clear previous map instance if it exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const L = (window as any).L;
    if (!L) return;

    // Center map around last known location
    const lastLog = logs[logs.length - 1];
    const map = L.map(mapContainerRef.current).setView([lastLog.lat, lastLog.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const points = logs.map((log: any) => [log.lat, log.lng]);

    // Draw routing line connecting tracking points
    if (points.length > 1) {
      L.polyline(points, { color: '#6366f1', weight: 4, opacity: 0.8 }).addTo(map);
    }

    // Add markers for all points
    logs.forEach((log: any, idx: number) => {
      const isFirst = idx === 0;
      const isLast = idx === logs.length - 1;
      
      const timeStr = new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Highlight start, end, and intermediate points with different colors/popups
      let markerColor = '#94a3b8'; // default intermediate
      if (isFirst) markerColor = '#10b981'; // Green for Start
      if (isLast) markerColor = '#ef4444'; // Red for Last

      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${markerColor}; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      L.marker([log.lat, log.lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
            <strong style="color: ${markerColor}">${isFirst ? 'Start Point (Clock-In)' : (isLast ? 'Last Known Location' : `Tracking Point #${idx + 1}`)}</strong><br/>
            <strong>Time:</strong> ${timeStr}<br/>
            <strong>Address:</strong> ${log.address || 'Captured'}
          </div>
        `);
    });

    // Zoom out/in to fit path bounds
    if (points.length > 0) {
      map.fitBounds(points, { padding: [30, 30] });
    }

    mapInstanceRef.current = map;
  }, [showModal, mapLoaded, selectedRecord]);

  const handleOpenTracking = (rec: any) => {
    setSelectedRecord(rec);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRecord(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-';
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Stats calculation
  const totalEmployees = records.length;
  const activeTracking = records.filter(r => r.clockIn && !r.clockOut).length;
  const totalLogsToday = records.reduce((acc, r) => acc + (r.locationLogs?.length || 0), 0);

  return (
    <div style={{ paddingBottom: '30px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Navigation size={28} color="var(--primary)" /> Marketing Location Tracking
        </h1>
        
        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <Calendar size={18} color="#64748b" />
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
            style={{ border: 'none', outline: 'none', color: '#334155', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Marketing Employees</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginTop: '5px' }}>{totalEmployees}</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '16px', border: '1px solid #bbf7d0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Currently Active Field Tracking</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#15803d', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeTracking} 
            {activeTracking > 0 && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse 1.5s infinite' }}></span>}
          </div>
        </div>
        <div style={{ background: '#eff6ff', padding: '20px', borderRadius: '16px', border: '1px solid #bfdbfe', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Location Logs Today</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1d4ed8', marginTop: '5px' }}>{totalLogsToday}</div>
        </div>
      </div>

      {/* Main Grid / Data Table */}
      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>Loading field location records...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Total logs</th>
                <th>Last Known Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const logs = rec.locationLogs || [];
                const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

                return (
                  <tr key={rec._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {rec.user?.name?.charAt(0) || 'M'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#1e293b' }}>{rec.user?.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{rec.user?.role?.name || 'Marketing'} • {rec.user?.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#334155' }}>{formatTime(rec.clockIn)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#334155' }}>{formatTime(rec.clockOut)}</div>
                    </td>
                    <td>
                      <span className="badge badge-indigo" style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px', fontWeight: 700 }}>
                        {logs.length} entries
                      </span>
                    </td>
                    <td>
                      {lastLog ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '300px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lastLog.address}>
                            📍 {lastLog.address || 'Captured'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {lastLog.lat.toFixed(5)}, {lastLog.lng.toFixed(5)} ({new Date(lastLog.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '13px' }}>No logs yet</span>
                      )}
                    </td>
                    <td>
                      <button 
                        onClick={() => handleOpenTracking(rec)}
                        disabled={logs.length === 0}
                        className="btn-secondary" 
                        style={{ padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: logs.length === 0 ? 'not-allowed' : 'pointer', opacity: logs.length === 0 ? 0.5 : 1 }}
                      >
                        <Eye size={15} /> View Path
                      </button>
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '50px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No field tracking records found for Marketing employees on this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal view map & timeline history */}
      {showModal && selectedRecord && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '950px', width: '90%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={20} color="#6366f1" /> Field Path History: {selectedRecord.user?.name}
                </h2>
                <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Tracking details for {new Date(selectedRecord.date).toLocaleDateString()} • Total {selectedRecord.locationLogs?.length || 0} entries
                </p>
              </div>
              <button 
                onClick={handleCloseModal}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body (Map Left, Timeline Right) */}
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', overflow: 'hidden' }}>
              {/* Map Container */}
              <div style={{ flex: '2', minWidth: '400px', height: '500px', background: '#f8fafc', position: 'relative' }}>
                {!mapLoaded && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', zIndex: 5, color: '#64748b', fontWeight: 600 }}>
                    Loading Interactive Map...
                  </div>
                )}
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}></div>
              </div>

              {/* Timeline Container */}
              <div style={{ flex: '1.2', minWidth: '300px', height: '500px', borderLeft: '1px solid #f1f5f9', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location Timeline Logs</h3>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                  <div style={{ position: 'relative', borderLeft: '2px solid #e2e8f0', marginLeft: '6px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {(selectedRecord.locationLogs || []).map((log: any, idx: number) => {
                      const isFirst = idx === 0;
                      const isLast = idx === (selectedRecord.locationLogs.length - 1);
                      
                      const dateObj = new Date(log.time);
                      const dateStr = dateObj.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
                      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                      let bulletColor = '#cbd5e1';
                      if (isFirst) bulletColor = '#10b981';
                      if (isLast) bulletColor = '#ef4444';

                      // Get PIN Code
                      let pinCode = log.pincode || '';
                      if (!pinCode) {
                        const match = (log.address || '').match(/\b\d{6}\b/);
                        pinCode = match ? match[0] : 'N/A';
                      }

                      return (
                        <div key={idx} style={{ position: 'relative', paddingLeft: '24px' }}>
                          {/* Timeline Node Bullet */}
                          <div style={{ 
                            position: 'absolute', 
                            left: '-7px', 
                            top: '4px', 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: bulletColor,
                            border: '2px solid #fff',
                            boxShadow: '0 0 0 2px ' + bulletColor
                          }}></div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                                {isFirst ? '📍 Clock-In Position' : (isLast ? '📍 Last Known Position' : `Point #${idx + 1}`)}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6366f1', fontFamily: 'monospace', background: '#e0e7ff', padding: '2px 6px', borderRadius: '4px', textAlign: 'right' }}>
                                {dateStr} {timeStr}
                              </span>
                            </div>
                            <span style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.4 }}>
                              {log.address || 'Coordinates registered'}
                            </span>
                            <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, background: '#f0fdf4', color: '#166534', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                PIN: {pinCode}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace' }}>
                                Lat: {log.lat.toFixed(6)}, Lng: {log.lng.toFixed(6)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '15px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{ background: '#0f172a', padding: '8px 24px', borderRadius: '8px' }} onClick={handleCloseModal}>Close History</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
