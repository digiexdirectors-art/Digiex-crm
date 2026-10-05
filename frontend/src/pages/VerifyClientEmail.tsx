import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, AlertCircle, RefreshCw, Building, Mail, Phone, MapPin, Globe, Award, ShieldCheck } from 'lucide-react';

interface VerifiedClient {
  _id: string;
  name: string;
  companyName: string;
  email: string;
  phone?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  country?: string;
  gstNumber?: string;
  panNumber?: string;
  websiteUrl?: string;
  isVerified?: boolean;
  verificationDetails?: {
    verifiedAt: string;
    verifiedBy: string;
  };
}

const VerifyClientEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState<boolean>(true);
  const [success, setSuccess] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [client, setClient] = useState<VerifiedClient | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage('Invalid link. No verification token was provided in the URL.');
      return;
    }

    const verifyToken = async () => {
      try {
        setLoading(true);
        const res = await axios.post('/api/clients/verify-email-link', { token });
        if (res.data.success) {
          setSuccess(true);
          setMessage(res.data.message || 'Profile verified successfully!');
          setClient(res.data.data);
        } else {
          setSuccess(false);
          setMessage(res.data.message || 'Verification failed.');
        }
      } catch (err: any) {
        setSuccess(false);
        setMessage(
          err.response?.data?.message || 
          'The verification link is invalid, expired, or has already been used.'
        );
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #064e3b 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '640px',
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(16px)',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        padding: '36px',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ShieldCheck size={28} color="#059669" />
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              Digiex Web Services
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
            Official Client Business Profile Verification Portal
          </p>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <RefreshCw size={44} className="animate-spin" color="#059669" style={{ margin: '0 auto 20px auto', display: 'block' }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
              Verifying Your Details...
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
              Please wait while we validate your verification token and update your profile status.
            </p>
          </div>
        )}

        {/* SUCCESS STATE */}
        {!loading && success && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: '#ecfdf5',
                border: '2px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)'
              }}>
                <CheckCircle size={40} color="#059669" />
              </div>
              <span style={{
                background: '#d1fae5',
                color: '#065f46',
                border: '1px solid #6ee7b7',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginBottom: '10px'
              }}>
                ✔ Profile Verified Successfully
              </span>
              <h2 style={{ margin: '6px 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                Thank You, {client?.companyName || 'Valued Client'}!
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
                {message}
              </p>
            </div>

            {client && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Verified Business Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13.5px' }}>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Company Name</span>
                    <strong style={{ color: '#1e293b' }}>{client.companyName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Contact Person</span>
                    <strong style={{ color: '#1e293b' }}>{client.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Email Address</span>
                    <span style={{ color: '#1e293b' }}>{client.email}</span>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Mobile Number</span>
                    <span style={{ color: '#1e293b' }}>{client.phone || 'N/A'}</span>
                  </div>
                  {client.gstNumber && (
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>GST Number</span>
                      <span style={{ color: '#1e293b', fontWeight: 600 }}>{client.gstNumber}</span>
                    </div>
                  )}
                  {client.panNumber && (
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>PAN Number</span>
                      <span style={{ color: '#1e293b', fontWeight: 600 }}>{client.panNumber}</span>
                    </div>
                  )}
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Business Address</span>
                    <span style={{ color: '#1e293b' }}>
                      {client.addressLine1 || client.address || 'N/A'}
                      {client.addressLine2 ? `, ${client.addressLine2}` : ''}
                      {client.city ? `, ${client.city}` : ''}
                      {client.state ? `, ${client.state}` : ''}
                      {client.pinCode ? ` - ${client.pinCode}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
              <p style={{ margin: '0 0 4px 0' }}>Our Service Manager will assign team members for your project development.</p>
              <p style={{ margin: 0 }}>Questions? Contact support at <a href="mailto:support@digiexweb.com" style={{ color: '#059669', fontWeight: 600 }}>support@digiexweb.com</a></p>
            </div>
          </div>
        )}

        {/* ERROR / EXPIRED STATE */}
        {!loading && !success && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: '#fef2f2',
              border: '2px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <AlertCircle size={40} color="#dc2626" />
            </div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: 700, color: '#991b1b' }}>
              Verification Link Invalid or Expired
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>
              {message}
            </p>
            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
              Please reach out to our Customer Care team at <a href="mailto:support@digiexweb.com" style={{ color: '#2563eb', fontWeight: 600 }}>support@digiexweb.com</a> to request a fresh verification link.
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default VerifyClientEmail;
