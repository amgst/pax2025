import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, notification, QRCode, Space, Tag, Alert } from 'antd';
import { QrcodeOutlined, ReloadOutlined, LinkOutlined } from '@ant-design/icons';

const QRCodeDisplay = () => {
  const [loading, setLoading] = useState(false);
  const [qrCodes, setQrCodes] = useState([]);
  const [error, setError] = useState(null);

  // Initialize Firebase
  const initFirebase = async () => {
    if (!window.firebase) return false;
    
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(window.dgshFirebaseConfig);
    }
    
    return window.firebase.firestore();
  };

  const loadQRCodes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const db = await initFirebase();
      if (!db) {
        throw new Error('Firebase not initialized');
      }

      const qrSnapshot = await db.collection('valid_codes').get();
      
      if (qrSnapshot.empty) {
        setQrCodes([]);
        return;
      }
      
      const codes = qrSnapshot.docs.map(doc => ({
        code: doc.id,
        ...doc.data()
      }));

      // Sort by location number if available
      codes.sort((a, b) => {
        const numA = parseInt(a.locationNumber) || 999;
        const numB = parseInt(b.locationNumber) || 999;
        return numA - numB;
      });

      setQrCodes(codes);
      
    } catch (error) {
      console.error('Error loading QR codes:', error);
      setError(error.message);
      notification.error({
        message: 'Error',
        description: 'Failed to load QR codes: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const testQRCode = (code) => {
    const testUrl = `https://doomlings.com/pages/scavenger-hunt?code=${code}`;
    window.open(testUrl, '_blank');
  };

  const copyQRCode = (code) => {
    const qrUrl = `https://doomlings.com/pages/scavenger-hunt?code=${code}`;
    navigator.clipboard.writeText(qrUrl).then(() => {
      notification.success({
        message: 'Copied!',
        description: 'QR code URL copied to clipboard'
      });
    }).catch(() => {
      notification.error({
        message: 'Copy Failed',
        description: 'Could not copy to clipboard'
      });
    });
  };

  useEffect(() => {
    loadQRCodes();
  }, []);

  if (error) {
    return (
      <Alert
        message="Error Loading QR Codes"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" danger onClick={loadQRCodes}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!loading && qrCodes.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <QrcodeOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <h3>No QR Codes Found</h3>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            No QR codes are currently available in the system.
          </p>
          <Button icon={<ReloadOutlined />} onClick={loadQRCodes}>
            Refresh
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Header Controls */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Scavenger Hunt QR Codes</h3>
            <p style={{ margin: 0, color: '#666' }}>
              {qrCodes.length} QR codes available
            </p>
          </div>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadQRCodes}
            loading={loading}
          >
            Refresh QR Codes
          </Button>
        </div>
      </Card>

      {/* QR Codes Grid */}
      <Row gutter={[16, 16]}>
        {qrCodes.map((qr) => {
          const qrUrl = `https://www.doomlings.com/pages/scavenger-hunt?code=${qr.code}`;
          
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={qr.code}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Location {qr.locationNumber || '?'}</span>
                    <QrcodeOutlined />
                  </div>
                }
                extra={
                  <Tag color={qr.active !== false ? 'green' : 'red'}>
                    {qr.active !== false ? 'Active' : 'Inactive'}
                  </Tag>
                }
                actions={[
                  <Button 
                    key="test" 
                    type="link" 
                    icon={<LinkOutlined />}
                    onClick={() => testQRCode(qr.code)}
                    size="small"
                  >
                    Test
                  </Button>,
                  <Button 
                    key="copy" 
                    type="link"
                    onClick={() => copyQRCode(qr.code)}
                    size="small"
                  >
                    Copy URL
                  </Button>
                ]}
                size="small"
              >
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <QRCode 
                    value={qrUrl}
                    size={140}
                    style={{ marginBottom: '12px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 6, fontSize: '14px' }}>
                      {qr.locationName || qr.description || 'Unnamed Location'}
                    </div>
                    <Tag 
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      color="blue"
                    >
                      {qr.code}
                    </Tag>
                    {qr.locationDescription && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        marginTop: '8px',
                        lineHeight: '1.4'
                      }}>
                        {qr.locationDescription}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <ReloadOutlined spin style={{ fontSize: '24px', color: '#1890ff' }} />
          <p style={{ marginTop: '16px', color: '#666' }}>Loading QR codes...</p>
        </div>
      )}
    </div>
  );
};

export default QRCodeDisplay;