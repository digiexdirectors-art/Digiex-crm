import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import axios from 'axios';

const tabs = ['Overview', 'Projects', 'Clients', 'HR', 'Ticket', 'Finance'];

// Mock Data
const pieData = [
  { name: 'Completed', value: 400 },
  { name: 'In Progress', value: 300 },
  { name: 'Pending', value: 300 },
  { name: 'Cancelled', value: 200 },
];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

const barData = [
  { name: 'Jan', amt: 2400 },
  { name: 'Feb', amt: 2210 },
  { name: 'Mar', amt: 2290 },
  { name: 'Apr', amt: 2000 },
  { name: 'May', amt: 2181 },
  { name: 'Jun', amt: 2500 },
];

const areaData = [
  { name: 'Week 1', uv: 4000 },
  { name: 'Week 2', uv: 3000 },
  { name: 'Week 3', uv: 2000 },
  { name: 'Week 4', uv: 2780 },
];

export default function DashboardOverview() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [user, setUser] = useState<any>(null);
  const [clientsCount, setClientsCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [unverifiedCount, setUnverifiedCount] = useState(0);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      setUser(parsed);
    }

    axios.get('http://localhost:5000/api/clients').then(res => {
      if (res.data.success) {
        const list = res.data.data;
        setClientsCount(list.length);
        setVerifiedCount(list.filter((c: any) => c.isVerified).length);
        setUnverifiedCount(list.filter((c: any) => !c.isVerified).length);
      }
    }).catch(err => console.error(err));
  }, []);

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '20px' }}>
        <h1 className="page-title">{user?.role?.name === 'Super Admin' ? 'Super Admin Dashboard' : 'Company Overview'}</h1>
      </div>

      <div className="tabs-container">
        {tabs.map(tab => (
          <button 
            key={tab} 
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <h2 style={{ marginBottom: '20px', color: 'var(--text-color)' }}>{activeTab} Analytics</h2>
        
        {activeTab === 'Clients' ? (
          <div>
            <div className="stats-grid">
              <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                <h3>Total Clients Registered</h3>
                <div className="value">{clientsCount}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Total client portfolio</div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #059669' }}>
                <h3>Verified Clients ✔</h3>
                <div className="value" style={{ color: '#059669' }}>{verifiedCount}</div>
                <div style={{ fontSize: '12px', color: '#059669', marginTop: '6px', fontWeight: 600 }}>Ready for project execution</div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                <h3>Unverified Clients ❌</h3>
                <div className="value" style={{ color: '#ef4444' }}>{unverifiedCount}</div>
                <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px', fontWeight: 600 }}>Awaiting Customer Care verification</div>
              </div>
            </div>
            
            {/* Pie chart of client verification status */}
            <div className="charts-grid" style={{ marginTop: '24px' }}>
              <div className="chart-card">
                <h3>Client Verification Status Distribution</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie 
                        data={[
                          { name: 'Verified', value: verifiedCount },
                          { name: 'Unverified', value: unverifiedCount }
                        ]} 
                        innerRadius={60} 
                        outerRadius={100} 
                        paddingAngle={5} 
                        dataKey="value"
                      >
                        <Cell fill="#059669" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-legend" style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="legend-color" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#059669' }}></div>
                    <span>Verified ({verifiedCount})</span>
                  </div>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="legend-color" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                    <span>Unverified ({unverifiedCount})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Metrics</h3>
                <div className="value">4,521</div>
                <div className="trend positive">+12.5% from last month</div>
              </div>
              <div className="stat-card">
                <h3>Active Entities</h3>
                <div className="value">842</div>
                <div className="trend positive">+5.2% from last month</div>
              </div>
              <div className="stat-card">
                <h3>Pending Tasks</h3>
                <div className="value">142</div>
                <div className="trend negative">-2.1% from last month</div>
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-card">
                <h3>Progress Overview (Bar Chart)</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <RechartsTooltip cursor={{fill: 'rgba(59, 130, 246, 0.05)'}} />
                      <Bar dataKey="amt" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card">
                <h3>Status Distribution (Pie Chart)</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-legend">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="legend-item">
                      <div className="legend-color" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span>{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="chart-card full-width">
                <h3>Regional/Time Progress (Area Chart)</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={areaData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <RechartsTooltip />
                      <Area type="monotone" dataKey="uv" stroke="var(--secondary)" fill="rgba(59, 130, 246, 0.2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
