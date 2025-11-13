import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Card, Row, Col, Button, notification, QRCode, Space, Tag, Alert, Form, Input, Switch, Popconfirm, Dropdown, Modal } from 'antd';
import { QrcodeOutlined, ReloadOutlined, LinkOutlined, DeleteOutlined, PlusOutlined, DownloadOutlined, FileImageOutlined, FilePdfOutlined, EditOutlined } from '@ant-design/icons';
import jsPDF from 'jspdf';
import firebaseService from '../services/firebase';

const QRCodeDisplay = () => {
  const [loading, setLoading] = useState(false);
  const [qrCodes, setQrCodes] = useState([]);
  const [error, setError] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingQR, setEditingQR] = useState(null);

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

  const exportQRCodePNG = (qr) => {
    try {
      const qrUrl = `https://www.doomlings.com/pages/pax2025?code=${qr.code}`;
      
      // Create a temporary container for high-res QR code
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.height = '800px';
      document.body.appendChild(tempDiv);
      
      // Create a temporary React root and render QR code
      const tempRoot = createRoot(tempDiv);
      
      // Render QR code with larger size
      tempRoot.render(
        React.createElement(QRCode, {
          value: qrUrl,
          size: 800
        })
      );
      
      // Wait for canvas to render, then export
      const checkCanvas = setInterval(() => {
        const canvas = tempDiv.querySelector('canvas');
        if (canvas) {
          clearInterval(checkCanvas);
          
          // Create a higher resolution canvas
          const exportSize = 800;
          const exportCanvas = document.createElement('canvas');
          exportCanvas.width = exportSize;
          exportCanvas.height = exportSize;
          const ctx = exportCanvas.getContext('2d');
          
          // Draw the QR code canvas onto export canvas
          ctx.drawImage(canvas, 0, 0, exportSize, exportSize);
          
          exportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const fileName = `QR-${qr.code}-${(qr.name || qr.locationName || 'code').replace(/[^a-z0-9]/gi, '_')}.png`;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // Cleanup
            setTimeout(() => {
              tempRoot.unmount();
              if (document.body.contains(tempDiv)) {
                document.body.removeChild(tempDiv);
              }
            }, 100);
            
            notification.success({
              message: 'QR Code Exported',
              description: `QR code ${qr.code} has been downloaded`
            });
          }, 'image/png');
        }
      }, 100);
      
      // Timeout after 3 seconds
      setTimeout(() => {
        clearInterval(checkCanvas);
        if (document.body.contains(tempDiv)) {
          tempRoot.unmount();
          document.body.removeChild(tempDiv);
          notification.error({
            message: 'Export Failed',
            description: 'Could not generate QR code image. Please try again.'
          });
        }
      }, 3000);
    } catch (error) {
      console.error('Export error:', error);
      notification.error({
        message: 'Export Failed',
        description: error.message || 'Could not export QR code'
      });
    }
  };

  const exportQRCodePDF = (qr) => {
    try {
      const qrUrl = `https://www.doomlings.com/pages/pax2025?code=${qr.code}`;
      
      // Create a temporary container for high-res QR code
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.height = '800px';
      document.body.appendChild(tempDiv);
      
      // Create a temporary React root and render QR code
      const tempRoot = createRoot(tempDiv);
      
      // Render QR code with larger size
      tempRoot.render(
        React.createElement(QRCode, {
          value: qrUrl,
          size: 800
        })
      );
      
      // Wait for canvas to render, then export
      const checkCanvas = setInterval(() => {
        const canvas = tempDiv.querySelector('canvas');
        if (canvas) {
          clearInterval(checkCanvas);
          
          // Convert canvas to image data
          const imageData = canvas.toDataURL('image/png');
          
          // Create PDF
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          
          // Calculate dimensions to center the QR code
          const qrSize = Math.min(pdfWidth - 40, pdfHeight - 80); // Leave margins
          const x = (pdfWidth - qrSize) / 2;
          const y = 30; // Top margin
          
          // Add QR code image to PDF
          pdf.addImage(imageData, 'PNG', x, y, qrSize, qrSize);
          
          // Add QR code information
          pdf.setFontSize(16);
          pdf.text(qr.name || qr.locationName || 'QR Code', pdfWidth / 2, y + qrSize + 15, { align: 'center' });
          
          pdf.setFontSize(12);
          pdf.text(`Code: ${qr.code}`, pdfWidth / 2, y + qrSize + 25, { align: 'center' });
          
          if (qr.description || qr.locationDescription) {
            pdf.setFontSize(10);
            const description = (qr.description || qr.locationDescription).substring(0, 100);
            pdf.text(description, pdfWidth / 2, y + qrSize + 35, { align: 'center', maxWidth: pdfWidth - 40 });
          }
          
          // Save PDF
          const fileName = `QR-${qr.code}-${(qr.name || qr.locationName || 'code').replace(/[^a-z0-9]/gi, '_')}.pdf`;
          pdf.save(fileName);
          
          // Cleanup
          setTimeout(() => {
            tempRoot.unmount();
            if (document.body.contains(tempDiv)) {
              document.body.removeChild(tempDiv);
            }
          }, 100);
          
          notification.success({
            message: 'QR Code Exported',
            description: `QR code ${qr.code} has been exported as PDF`
          });
        }
      }, 100);
      
      // Timeout after 3 seconds
      setTimeout(() => {
        clearInterval(checkCanvas);
        if (document.body.contains(tempDiv)) {
          tempRoot.unmount();
          document.body.removeChild(tempDiv);
          notification.error({
            message: 'Export Failed',
            description: 'Could not generate QR code PDF. Please try again.'
          });
        }
      }, 3000);
    } catch (error) {
      console.error('Export error:', error);
      notification.error({
        message: 'Export Failed',
        description: error.message || 'Could not export QR code as PDF'
      });
    }
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

  const openEditModal = (qr) => {
    setEditingQR(qr);
    editForm.setFieldsValue({
      name: qr.name || qr.locationName || '',
      description: qr.description || qr.locationDescription || '',
      active: qr.active !== false
    });
    setEditModalVisible(true);
  };

  const handleEditQRCode = async (values) => {
    if (!editingQR) return;
    
    try {
      setLoading(true);
      await firebaseService.updateQRCode(editingQR.code, {
        name: values.name?.trim() || '',
        description: values.description?.trim() || '',
        active: values.active
      });
      notification.success({
        message: 'QR Code Updated',
        description: 'QR code has been updated successfully.'
      });
      setEditModalVisible(false);
      setEditingQR(null);
      editForm.resetFields();
      await loadQRCodes();
    } catch (error) {
      notification.error({
        message: 'Update Failed',
        description: error.message || 'Could not update QR code.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditingQR(null);
    editForm.resetFields();
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
                  <Button 
                    key="edit" 
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(qr)}
                    size="small"
                  >
                    Edit
                  </Button>,
                  <Dropdown
                    key="export"
                    menu={{
                      items: [
                        {
                          key: 'png',
                          label: 'Export as PNG',
                          icon: <FileImageOutlined />,
                          onClick: () => exportQRCodePNG(qr)
                        },
                        {
                          key: 'pdf',
                          label: 'Export as PDF',
                          icon: <FilePdfOutlined />,
                          onClick: () => exportQRCodePDF(qr)
                        }
                      ]
                    }}
                    trigger={['click']}
                  >
                    <Button 
                      type="link"
                      icon={<DownloadOutlined />}
                      size="small"
                    >
                      Export
                    </Button>
                  </Dropdown>,
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

      {/* Edit QR Code Modal */}
      <Modal
        title="Edit QR Code"
        open={editModalVisible}
        onCancel={handleCancelEdit}
        onOk={() => editForm.submit()}
        confirmLoading={loading}
        okText="Save"
        cancelText="Cancel"
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditQRCode}
        >
          <Form.Item label="Code">
            <Input disabled value={editingQR?.code} />
          </Form.Item>
          <Form.Item
            label="Name"
            name="name"
          >
            <Input placeholder="Enter QR code name" allowClear />
          </Form.Item>
          <Form.Item
            label="Description"
            name="description"
          >
            <Input.TextArea 
              placeholder="Enter description (optional)" 
              allowClear 
              rows={3}
            />
          </Form.Item>
          <Form.Item
            label="Status"
            name="active"
            valuePropName="checked"
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QRCodeDisplay;