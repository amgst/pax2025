import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, notification, QRCode, Space, Tag, Alert, Form, Input, Switch, Popconfirm } from 'antd';
import { QrcodeOutlined, ReloadOutlined, LinkOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import firebaseService from '../services/firebase';

const QRCodeDisplay = () => {
  const [loading, setLoading] = useState(false);
  const [qrCodes, setQrCodes] = useState([]);
  const [error, setError] = useState(null);
  const [form] = Form.useForm();

  // Use centralized Firebase service
  const getDb = () => {
    if (!firebaseService.initialized || !firebaseService.db) {
      return null;
    }
    return firebaseService.db;
  };

  const loadQRCodes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const db = getDb();
      if (!db) throw new Error('Firebase not initialized');

      const qrSnapshot = await db.collection('valid_codes').get();
      
      if (qrSnapshot.empty) {
        setQrCodes([]);
        return;
      }
      
      const codes = qrSnapshot.docs.map(doc => ({
        code: doc.id,
        ...doc.data()
      }));

      // Sort by name if available
      codes.sort((a, b) => {
        const nameA = (a.name || a.locationName || '').toString().toLowerCase();
        const nameB = (b.name || b.locationName || '').toString().toLowerCase();
        if (nameA && nameB) return nameA.localeCompare(nameB);
        if (nameA) return -1;
        if (nameB) return 1;
        return (a.code || '').localeCompare(b.code || '');
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
    const testUrl = `https://www.doomlings.com/pages/pax2025?code=${code}`;
    window.open(testUrl, '_blank');
  };

  const copyQRCode = (code) => {
    const qrUrl = `https://www.doomlings.com/pages/pax2025?code=${code}`;
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

  const handleAddQRCode = async (values) => {
    try {
      setLoading(true);
      await firebaseService.addQRCode({
        code: values.code?.trim(),
        name: values.name?.trim(),
        description: values.description?.trim(),
        active: values.active
      });
      notification.success({
        message: 'QR Code Added',
        description: 'New QR code has been added successfully.'
      });
      form.resetFields();
      await loadQRCodes();
    } catch (error) {
      notification.error({
        message: 'Add Failed',
        description: error.message || 'Could not add QR code.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQRCode = async (code) => {
    try {
      setLoading(true);
      await firebaseService.deleteQRCode(code);
      notification.success({
        message: 'QR Code Removed',
        description: 'QR code has been deleted.'
      });
      await loadQRCodes();
    } catch (error) {
      notification.error({
        message: 'Delete Failed',
        description: error.message || 'Could not delete QR code.'
      });
    } finally {
      setLoading(false);
    }
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
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 12 }}>Add a new QR code</h4>
          <Form layout="inline" form={form} onFinish={handleAddQRCode}>
            <Form.Item name="code" rules={[{ required: true, message: 'Code is required' }]}>
              <Input placeholder="Code (document id)" allowClear />
            </Form.Item>
            <Form.Item name="name">
              <Input placeholder="Name" allowClear style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="description">
              <Input placeholder="Description" allowClear style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="active" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={loading}>
                Add QR Code
              </Button>
            </Form.Item>
          </Form>
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
        <div style={{ marginTop: 16 }}>
          <Form layout="inline" form={form} onFinish={handleAddQRCode}>
            <Form.Item name="code" rules={[{ required: true, message: 'Code is required' }]}> 
              <Input placeholder="Code (document id)" allowClear />
            </Form.Item>
            <Form.Item name="name">
              <Input placeholder="Name" allowClear style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="description">
              <Input placeholder="Description" allowClear style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="active" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={loading}>
                Add QR Code
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Card>

      {/* QR Codes Grid */}
      <Row gutter={[16, 16]}>
        {qrCodes.map((qr) => {
          const qrUrl = `https://www.doomlings.com/pages/pax2025?code=${qr.code}`;
          
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={qr.code}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{qr.name || qr.locationName || 'QR Code'}</span>
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
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="Remove this QR code?"
                    okText="Delete"
                    okType="danger"
                    onConfirm={() => handleDeleteQRCode(qr.code)}
                  >
                    <Button type="link" danger icon={<DeleteOutlined />} size="small">
                      Delete
                    </Button>
                  </Popconfirm>
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
                      {qr.name || qr.locationName || qr.description || 'Unnamed'}
                    </div>
                    <Tag 
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      color="blue"
                    >
                      {qr.code}
                    </Tag>
                    {(qr.description || qr.locationDescription) && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        marginTop: '8px',
                        lineHeight: '1.4'
                      }}>
                        {qr.description || qr.locationDescription}
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