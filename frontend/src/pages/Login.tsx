import { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('DIGIEX WEB SERVICES');
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    axios.get('http://localhost:5000/api/settings')
      .then(res => {
        if (res.data?.success) {
          const settings = res.data.data || [];
          const logoSetting = settings.find((s: any) => s.key === 'company_logo')?.value;
          const nameSetting = settings.find((s: any) => s.key === 'company_name')?.value;
          if (logoSetting) {
            setCompanyLogo(logoSetting.startsWith('http') ? logoSetting : `http://localhost:5000${logoSetting}`);
          }
          if (nameSetting) {
            setCompanyName(nameSetting);
          }
        }
      })
      .catch(err => console.error('Error fetching settings for login page:', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        sessionStorage.removeItem('hasShownPartialReminder');
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60px' }}>
          {!imgFailed ? (
            <img 
              src={companyLogo || 'https://digiexweb.com/assets/img/logo.png'} 
              alt={companyName} 
              className="auth-logo"
              onError={() => {
                if (companyLogo && companyLogo !== 'https://digiexweb.com/assets/img/logo.png') {
                  setCompanyLogo('https://digiexweb.com/assets/img/logo.png');
                } else {
                  setImgFailed(true);
                }
              }}
              style={{ maxHeight: '65px', maxWidth: '240px', objectFit: 'contain', margin: '0 auto' }}
            />
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#1e3a8a', color: '#ffffff', padding: '10px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '18px', letterSpacing: '0.5px', boxShadow: '0 4px 12px rgba(30,58,138,0.2)' }}>
              <Building2 size={24} color="#60a5fa" />
              <span>{companyName}</span>
            </div>
          )}
        </div>

        <h2 className="auth-title">HRMS Login</h2>
        <p className="auth-subtitle">Access your centralized CRM dashboard</p>

        <form className="auth-form" onSubmit={handleLogin}>
          {error && <div className="error-text">{error}</div>}
          
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="admin@digiexweb.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
