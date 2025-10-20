import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Progress, Tag, Statistic, Alert, Spin, Tooltip } from 'antd'; // Import Tooltip
import { TrophyOutlined, EnvironmentOutlined } from '@ant-design/icons';

const LocationPerformance = ({ userData = [], refreshTrigger }) => { // Added refreshTrigger prop
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState([]);
  const [error, setError] = useState(null);

  // Initialize Firebase
  const initFirebase = async () => {
    if (!window.firebase) return false;
    
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(window.dgshFirebaseConfig);
    }
    
    return window.firebase.firestore();
  };

  const loadLocationPerformance = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const db = await initFirebase();
      if (!db) {
        throw new Error('Firebase not initialized');
      }

      const qrStatsSnapshot = await db.collection('qr_statistics').get();
      
      if (qrStatsSnapshot.empty) {
        setLocationData([]);
        return;
      }
      
      const qrStats = [];
      qrStatsSnapshot.forEach(doc => {
        qrStats.push({ code: doc.id, ...doc.data() });
      });
      
      // Calculate performance metrics
      const maxScans = Math.max(...qrStats.map(qr => qr.totalScans || 0), 1);
      const totalScans = qrStats.reduce((sum, qr) => sum + (qr.totalScans || 0), 0);
      const avgScans = totalScans / qrStats.length;
      
      // Sort by performance and add rankings
      qrStats.sort((a, b) => (b.totalScans || 0) - (a.totalScans || 0));
      
      const processedData = qrStats.map((qr, index) => {
        const scans = qr.totalScans || 0;
        const users = qr.uniqueUsers || 0;
        const performancePercent = Math.round((scans / maxScans) * 100);
        
        // Determine performance category
        let performanceCategory = 'low';
        let performanceColor = '#ff4d4f';
        
        if (scans >= avgScans * 1.5) {
          performanceCategory = 'high';
          performanceColor = '#52c41a';
        } else if (scans >= avgScans * 0.8) {
          performanceCategory = 'medium';
          performanceColor = '#faad14';
        }
        
        // Rank classification
        let rankClass = '';
        if (index < 2) rankClass = 'top';
        else if (index >= qrStats.length - 2) rankClass = 'bottom';
        
        return {
          ...qr,
          rank: index + 1,
          scans,
          users,
          performancePercent,
          performanceCategory,
          performanceColor,
          rankClass,
          efficiency: users > 0 ? (scans / users).toFixed(1) : 0,
          lastScannedText: qr.lastScanned && qr.lastScanned.seconds !== undefined // Updated
            ? new Date(qr.lastScanned.seconds * 1000).toLocaleDateString()
            : 'Timestamp Missing' // Updated
        };
      });
      
      setLocationData(processedData);
      
    } catch (error) {
      console.error('Error loading location performance:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocationPerformance();
  }, [refreshTrigger]); // Add refreshTrigger to dependency array

  if (error) {
    return (
      <Alert
        message="Error Loading Performance Data"
        description={error}
        type="error"
        showIcon
      />
    );
  }

  if (loading) {
    return (
      <Card title="Location Performance" extra={<TrophyOutlined />}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px', color: '#666' }}>Loading performance data...</p>
        </div>
      </Card>
    );
  }

  if (locationData.length === 0) {
    return (
      <Card title="Location Performance" extra={<TrophyOutlined />}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <EnvironmentOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <h4>No Performance Data</h4>
          <p style={{ color: '#666' }}>
            Run the statistics population script to see performance data
          </p>
        </div>
      </Card>
    );
  }

  // Calculate summary statistics
  const topPerformer = locationData[0];
  const totalLocations = locationData.length;
  const activeLocations = locationData.filter(loc => loc.isActive).length;
  const avgPerformance = Math.round(
    locationData.reduce((sum, loc) => sum + loc.performancePercent, 0) / totalLocations
  );

  return (
    <div>
      {/* Summary Statistics */}
<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
 <Col span={12}>
    <Row gutter={[16, 16]}>
     <Col xs={24} sm={12} lg={8}>
       <Card>
         <Tooltip title="Total number of unique physical locations with a QR code.">
           <Statistic
             title="Total Locations"
             value={totalLocations}
             prefix={<EnvironmentOutlined />}
             valueStyle={{ color: '#1890ff' }}
           />
         </Tooltip>
       </Card>
     </Col>
     <Col xs={24} sm={12} lg={8}>
       <Card>
         <Tooltip title="Number of locations that have been scanned at least once.">
           <Statistic
             title="Active Locations"
             value={activeLocations}
             suffix={`/ ${totalLocations}`}
             valueStyle={{ color: '#52c41a' }}
           />
         </Tooltip>
       </Card>
     </Col>
    </Row>
 </Col>
 <Col span={12}>
   {topPerformer && (
     <Card 
       title="🏆 Top Performing Location"
       headStyle={{ backgroundColor: '#f6ffed', borderBottom: '1px solid #b7eb8f' }}
     >
       <Row gutter={16} align="middle">
         <Col span={8}>
           <div style={{ textAlign: 'center' }}>
             <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
               #{topPerformer.rank}
             </div>
             <div style={{ fontSize: '16px', fontWeight: 500 }}>
               Location {topPerformer.locationNumber}
             </div>
             <div style={{ color: '#666' }}>
               {topPerformer.locationName || 'Unnamed'}
             </div>
           </div>
         </Col>
         <Col span={8}>
           <Tooltip title="Total number of times this specific location's QR code has been scanned.">
             <Statistic
               title="Total Scans"
               value={topPerformer.scans}
               valueStyle={{ color: '#52c41a' }}
             />
           </Tooltip>
         </Col>
         <Col span={8}>
           <Tooltip title="Number of unique users who have scanned this specific location's QR code.">
             <Statistic
               title="Unique Users"
               value={topPerformer.users}
               valueStyle={{ color: '#52c41a' }}
             />
           </Tooltip>
         </Col>
       </Row>
     </Card>
   )}
 </Col>
</Row>

      {/* Performance Grid */}
      <Card title="All Locations Performance">
        <Row gutter={[16, 16]}>
          {locationData.map((location) => (
            <Col xs={24} sm={12} lg={8} key={location.code}>
              <Card
                size="small"
                style={{
                  borderLeft: `4px solid ${location.performanceColor}`,
                  height: '100%'
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 500, fontSize: '14px' }}>
                      Location {location.locationNumber || '?'}
                    </div>
                    <Tag 
                      color={
                        location.rankClass === 'top' ? 'green' : 
                        location.rankClass === 'bottom' ? 'red' : 'orange'
                      }
                      style={{ fontSize: '11px' }}
                    >
                      #{location.rank}
                    </Tag>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
                    {location.locationName || 'Unnamed'}
                  </div>
                  <Tag size="small" style={{ marginTop: 4, fontSize: '10px' }}>
                    {location.code}
                  </Tag>
                </div>

                <Row gutter={8} style={{ marginBottom: 12 }}>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold', 
                        color: location.performanceColor 
                      }}>
                        {location.scans}
                      </div>
                      <div style={{ fontSize: '10px', color: '#999' }}>SCANS</div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
                        {location.users}
                      </div>
                      <div style={{ fontSize: '10px', color: '#999' }}>USERS</div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
                        {location.efficiency}
                      </div>
                      <div style={{ fontSize: '10px', color: '#999' }}>RATIO</div>
                    </div>
                  </Col>
                </Row>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '11px',
                    marginBottom: 4
                  }}>
                    <span>Performance</span>
                    <span>{location.performancePercent}%</span>
                  </div>
                  <Progress 
                    percent={location.performancePercent} 
                    strokeColor={location.performanceColor}
                    size="small"
                    showInfo={false}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag 
                    color={location.isActive ? 'green' : 'red'} 
                    style={{ fontSize: '10px', margin: 0 }}
                  >
                    {location.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                  <div style={{ fontSize: '10px', color: '#999' }}>
                    Last: {location.lastScannedText}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Performance Summary */}
      <Card title="Performance Summary" style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {locationData.filter(loc => loc.performanceCategory === 'high').length}
              </div>
              <div style={{ color: '#666' }}>High Performers</div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                {locationData.filter(loc => loc.performanceCategory === 'medium').length}
              </div>
              <div style={{ color: '#666' }}>Medium Performers</div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                {locationData.filter(loc => loc.performanceCategory === 'low').length}
              </div>
              <div style={{ color: '#666' }}>Low Performers</div>
            </div>
          </Col>
        </Row>
        
        <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <Tooltip title="The average performance percentage across all locations, indicating overall scan activity relative to the top performer.">
            <Statistic
              title="Average Performance"
              value={avgPerformance}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Tooltip>
        </div>
      </Card>
    </div>
  );
};

export default LocationPerformance;