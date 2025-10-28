import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  notification,
  Table,
  Progress,
  Tag,
  Space,
  Alert,
  Spin,
  Switch
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  BarChartOutlined,
  TrophyOutlined,
  UserOutlined,
  CalendarOutlined,
  SyncOutlined // Import SyncOutlined for recalculate button
} from '@ant-design/icons';
import firebaseService from '../services/firebase';
import firebase from 'firebase/compat/app';

const QRAnalytics = ({ userData = [] }) => {
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalScans: 0,
    uniqueUsers: 0,
    completionRate: 0,
    avgScansPerUser: 0,
    discoveryAnalytics: {
      boothUsers: 0,
      boothRate: 0,
      floor01Users: 0,
      floor01Rate: 0
    },
    locationPerformance: [],
    qrStatistics: [] // This holds the detailed per-QR code stats
  });
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(false);
  const [recalculatingDiscovery, setRecalculatingDiscovery] = useState(false); // New state for discovery recalculation loading

  const getDb = () => {
    if (!firebaseService.initialized || !firebaseService.db) {
      return null;
    }
    return firebaseService.db;
  };

  /**
   * Loads optimized summary statistics from Firestore.
   * This function attempts to read pre-calculated summary data.
   * @returns {Object | null} Optimized statistics or null if not found/error.
   */
  const loadOptimizedStats = async () => {
    try {
      const firestoreDb = getDb();
      if (!firestoreDb) {
        console.warn('Firebase not initialized for optimized stats.');
        return null;
      }

      const summaryDoc = await firestoreDb.collection('statistics').doc('summary').get();

      if (summaryDoc.exists) {
        const summaryData = summaryDoc.data();
        return {
          totalScans: summaryData.totalScans || 0,
          uniqueUsers: summaryData.uniqueUsers || 0,
          completionRate: summaryData.completionRate || 0,
          avgScansPerUser: summaryData.avgScansPerUser || 0,
        };
      }

      return null;
    } catch (error) {
      console.error('Error loading optimized stats:', error);
      return null;
    }
  };

  /**
   * Calculates real-time statistics directly from the 'users' collection.
   * This is used as a fallback if optimized statistics are not available or for verification.
   * It also calculates `qrStatistics` based on user data if `qr_statistics` collection is empty.
   * @returns {Object} Real-time calculated statistics and detailed QR stats.
   */
  const calculateRealTimeAndDetailedStats = async (usersSnapshot, qrCodesSnapshot) => {
    const uniqueUsers = new Set();
    let totalScansFromUsers = 0;
    let completedUsers = 0;
    const totalPossibleCodes = qrCodesSnapshot.size > 0 ? qrCodesSnapshot.size : 18;

    const scanCountsPerQrCode = {};
    const uniqueUsersPerQrCode = {};
    const lastScannedPerQrCode = {};
    const discoveryScansCount = {}; // For discovery analytics

    qrCodesSnapshot.forEach(doc => {
      const code = doc.id;
      scanCountsPerQrCode[code] = 0;
      uniqueUsersPerQrCode[code] = new Set();
      lastScannedPerQrCode[code] = null;
      discoveryScansCount[code] = 0;
    });

    const getScanCode = (scan) => typeof scan === 'string' ? scan : (scan?.code || null);

    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      const userId = userDoc.id;

      if (userData.scannedCodes && Array.isArray(userData.scannedCodes) && userData.scannedCodes.length > 0) {
        uniqueUsers.add(userId);
        totalScansFromUsers += userData.scannedCodes.length;

        if (userData.scannedCodes.length >= totalPossibleCodes) {
          completedUsers++;
        }

        const firstScan = userData.scannedCodes[0];
        const firstCode = getScanCode(firstScan);
        if (firstCode && discoveryScansCount.hasOwnProperty(firstCode)) {
          discoveryScansCount[firstCode]++;
        }

        userData.scannedCodes.forEach(scan => {
          const code = getScanCode(scan);
          const timestamp = typeof scan === 'object' && scan.timestamp ? scan.timestamp : null;

          if (code && scanCountsPerQrCode.hasOwnProperty(code)) {
            scanCountsPerQrCode[code]++;
            uniqueUsersPerQrCode[code].add(userId);

            if (timestamp && (!lastScannedPerQrCode[code] || timestamp > lastScannedPerQrCode[code])) {
              lastScannedPerQrCode[code] = timestamp;
            }
          }
        });
      }
    });

    const uniqueUserCount = uniqueUsers.size;
    
    const qrStatistics = [];
    let totalScansFromQrStats = 0; // Sum of scans from each QR code's tally
    qrCodesSnapshot.forEach(doc => {
      const qrData = doc.data();
      const code = doc.id;
      const scans = scanCountsPerQrCode[code] || 0;
      const users = uniqueUsersPerQrCode[code].size || 0;
      const lastScanned = lastScannedPerQrCode[code];

      totalScansFromQrStats += scans; // Accumulate total scans from QR stats

      qrStatistics.push({
        code,
        locationNumber: qrData.locationNumber,
        locationName: qrData.locationName || qrData.description || 'Unnamed',
        isActive: qrData.active !== false,
        totalScans: scans,
        uniqueUsers: users,
        lastScanned: lastScanned,
        lastScannedText: lastScanned ? new Date(lastScanned.seconds * 1000).toLocaleString() : 'Never',
        // Discovery metrics added here
        discoveryScans: discoveryScansCount[code] || 0,
        discoveryRate: uniqueUserCount > 0 ? Math.round(((discoveryScansCount[code] || 0) / uniqueUserCount) * 100) : 0,
      });
    });

    qrStatistics.sort((a, b) => (b.totalScans || 0) - (a.totalScans || 0));
    const maxScans = Math.max(...qrStatistics.map(qr => qr.totalScans || 0), 1);
    
    // Add performance based on sorted data
    const finalQrStatistics = qrStatistics.map((qr, index) => ({
      ...qr,
      rank: index + 1,
      performance: Math.round((qr.totalScans / maxScans) * 100)
    }));

    // The 'totalScans' for the summary should be the sum of individual QR code totalScans
    // to align with the table below.
    return {
      totalScans: totalScansFromQrStats, // Use this sum for the summary card
      uniqueUsers: uniqueUserCount,
      completionRate: uniqueUserCount > 0 ? Math.round((completedUsers / uniqueUserCount) * 100) : 0,
      avgScansPerUser: uniqueUserCount > 0 ? (totalScansFromQrStats / uniqueUserCount).toFixed(1) : 0,
      qrStatistics: finalQrStatistics
    };
  };

  // Define loadDiscoveryAnalytics inside the component scope
  const loadDiscoveryAnalytics = async () => {
    try {
      const firestoreDb = await initFirebase();
      if (!firestoreDb) {
        console.warn('Firebase not initialized for discovery analytics.');
        return { boothUsers: 0, boothRate: 0, floor01Users: 0, floor01Rate: 0 };
      }

      const [boothDoc, floor01Doc] = await Promise.all([
        firestoreDb.collection('discovery_analytics').doc('booth').get(),
        firestoreDb.collection('discovery_analytics').doc('floor01').get()
      ]);

      if (!boothDoc.exists) {
        console.warn("Discovery Analytics: 'booth' document does not exist.");
      }
      if (!floor01Doc.exists) {
        console.warn("Discovery Analytics: 'floor01' document does not exist.");
      }

      if (boothDoc.exists && floor01Doc.exists) {
        const boothData = boothDoc.data();
        const floor01Data = floor01Doc.data();

        return {
          boothUsers: boothData.usersVisited || 0,
          boothRate: boothData.discoveryRate || 0,
          floor01Users: floor01Data.usersFound || 0,
          floor01Rate: floor01Data.discoveryRate || 0
        };
      }

      return { boothUsers: 0, boothRate: 0, floor01Users: 0, floor01Rate: 0 };
    } catch (error) {
      console.error('Error loading discovery analytics:', error);
      return { boothUsers: 0, boothRate: 0, floor01Users: 0, floor01Rate: 0 };
    }
  };


  const loadAllAnalyticsData = async () => {
    setLoading(true);
    try {
      const firestoreDb = getDb();
      if (!firestoreDb) throw new Error('Firebase not initialized');

      const [usersSnapshot, qrCodesSnapshot, summaryDoc] = await Promise.all([
        firestoreDb.collection('users').get(),
        firestoreDb.collection('valid_codes').get(),
        firestoreDb.collection('statistics').doc('summary').get()
      ]);

      // Calculate real-time detailed stats regardless, as the table needs it and summary needs latest.
      const { 
        totalScans, 
        uniqueUsers, 
        completionRate, 
        avgScansPerUser, 
        qrStatistics 
      } = await calculateRealTimeAndDetailedStats(usersSnapshot, qrCodesSnapshot);

      const discovery = await loadDiscoveryAnalytics(); // This function is now defined in scope

      setAnalytics({
        totalScans: totalScans || 0, // Use the dynamically calculated totalScans
        uniqueUsers: uniqueUsers || 0,
        completionRate: completionRate || 0,
        avgScansPerUser: avgScansPerUser || 0,
        discoveryAnalytics: discovery,
        qrStatistics: qrStatistics // This is the detailed per-QR data
      });
      
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to load analytics data: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles the recalculation and saving of discovery analytics directly from the dashboard.
   * This replaces the Cloud Function for free-tier compatibility.
   */
  const handleRecalculateDiscoveryAnalytics = async () => {
    setRecalculatingDiscovery(true);
    try {
      const firestoreDb = getDb();
      if (!firestoreDb) throw new Error('Firebase not initialized');

      // Logic from functions/discoveryAnalytics.js
      const usersSnapshot = await firestoreDb.collection('users').get();
      const validCodesSnapshot = await firestoreDb.collection('valid_codes').get();

      if (usersSnapshot.empty || validCodesSnapshot.empty) {
        notification.info({
          message: 'No Data',
          description: 'No user data or valid QR codes found to calculate discovery analytics.'
        });
        setRecalculatingDiscovery(false);
        return;
      }

      const boothQrCodes = new Set();
      const floor01QrCodes = new Set();
      validCodesSnapshot.forEach(doc => {
        const data = doc.data();
        // Ensure consistent logic for identifying booth and floor 01 QRs
        const codeId = doc.id.toLowerCase();
        if (codeId.includes('bth') || (data.locationName && data.locationName.toLowerCase().includes('booth'))) {
          boothQrCodes.add(doc.id);
        } else if (codeId.includes('flr-01') || (data.locationName && data.locationName.toLowerCase().includes('floor 01')) || data.locationNumber === '01') {
          floor01QrCodes.add(doc.id);
        }
      });

      let totalUniqueUsersWithScans = 0;
      let usersScannedBooth = 0;
      let usersScannedFloor01 = 0;

      const getScanCode = (scan) => typeof scan === 'string' ? scan : (scan?.code || null);

      usersSnapshot.forEach(userDoc => {
        const currentUserData = userDoc.data();
        if (currentUserData.scannedCodes && currentUserData.scannedCodes.length > 0) {
          totalUniqueUsersWithScans++;
          const firstCodeOfUser = getScanCode(currentUserData.scannedCodes[0]);
          if (firstCodeOfUser) {
            if (boothQrCodes.has(firstCodeOfUser)) {
              usersScannedBooth++;
            } else if (floor01QrCodes.has(firstCodeOfUser)) {
              usersScannedFloor01++;
            }
          }
        }
      });

      const boothPercentage = totalUniqueUsersWithScans > 0 ? Math.round((usersScannedBooth / totalUniqueUsersWithScans) * 100) : 0;
      const floor01Percentage = totalUniqueUsersWithScans > 0 ? Math.round((usersScannedFloor01 / totalUniqueUsersWithScans) * 100) : 0;

      // Save to Firestore
      const batch = firestoreDb.batch();
      const boothDocRef = firestoreDb.collection('discovery_analytics').doc('booth');
      const floor01DocRef = firestoreDb.collection('discovery_analytics').doc('floor01');

      batch.set(boothDocRef, {
        usersVisited: usersScannedBooth,
        discoveryRate: boothPercentage,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(floor01DocRef, {
        usersFound: usersScannedFloor01,
        discoveryRate: floor01Percentage,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();

      notification.success({
        message: 'Discovery Analytics Recalculated',
        description: 'Discovery analytics have been updated in Firestore.'
      });

      loadAllAnalyticsData(); // Refresh dashboard to show new data

    } catch (error) {
      console.error('Error recalculating discovery analytics:', error);
      notification.error({
        message: 'Error Recalculating Discovery Analytics',
        description: error.message || 'Failed to recalculate discovery analytics.'
      });
    } finally {
      setRecalculatingDiscovery(false);
    }
  };


  useEffect(() => {
    loadAllAnalyticsData();

    let intervalId;
    if (isAutoRefreshEnabled) {
      intervalId = setInterval(loadAllAnalyticsData, 2 * 60 * 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoRefreshEnabled]);

  const exportAnalytics = async () => {
    try {
      const firestoreDb = getDb();
      if (!firestoreDb) throw new Error('Firebase not initialized');

      const [qrCodesSnapshot, usersSnapshot] = await Promise.all([
        firestoreDb.collection('valid_codes').get(),
        firestoreDb.collection('users').get()
      ]);

      const csvData = [];
      const qrCodesMap = new Map();

      qrCodesSnapshot.forEach(doc => {
        const data = doc.data();
        qrCodesMap.set(doc.id, data);
      });

      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const userId = userDoc.id;

        if (userData.scannedCodes && Array.isArray(userData.scannedCodes)) {
          userData.scannedCodes.forEach((scan, index) => {
            const scanCode = typeof scan === 'string' ? scan : (scan?.code || null);
            const scanTimestamp = typeof scan === 'object' && scan.timestamp ? scan.timestamp : null;

            const qrCode = qrCodesMap.get(scanCode) || {};

            csvData.push({
              scanId: `${userId}-${index}`,
              timestamp: scanTimestamp ? new Date(scanTimestamp.seconds * 1000).toISOString() : '',
              qrCode: scanCode || '',
              locationName: qrCode.locationName || qrCode.description || '',
              locationNumber: qrCode.locationNumber || '',
              userId: userId,
              userName: userData.displayName || 'Anonymous',
              userEmail: userData.email || '',
              userPhone: userData.phoneNumber || '',
              isValid: 'Yes'
            });
          });
        }
      });

      const headers = [
        'Scan ID',
        'Timestamp',
        'QR Code',
        'Location Name',
        'Location Number',
        'User ID',
        'User Name',
        'User Email',
        'User Phone',
        'Valid Scan'
      ];

      const csvContent = [
        headers.join(','),
        ...csvData.map(row =>
          headers.map(header => {
            const key = header.toLowerCase().replace(/\s+/g, '').replace('id', 'Id');
            const value = row[key] || '';
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `qr-analytics-export-${dateStr}-${timeStr}.csv`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      notification.success({
        message: 'Export Successful',
        description: `Exported ${csvData.length} scan records to CSV`
      });

    } catch (error) {
      notification.error({
        message: 'Export Failed',
        description: error.message
      });
    }
  };

  const consolidatedColumns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank) => <strong>#{rank}</strong>
    },
    {
      title: 'Location',
      key: 'location',
      render: (_, record) => (
        <div>
          <div>Location {record.locationNumber || '?'} - {record.locationName || 'Unnamed'}</div>
          <Tag size="small">{record.code}</Tag>
        </div>
      )
    },
    {
      title: 'QR Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => (
        <code style={{
          background: '#f5f5f5',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '0.85em'
        }}>
          {code}
        </code>
      )
    },
    {
      title: 'Total Scans',
      dataIndex: 'totalScans',
      key: 'totalScans',
      align: 'center',
      render: (value) => <strong>{value || 0}</strong>
    },
    {
      title: 'Discovery Scans',
      dataIndex: 'discoveryScans',
      key: 'discoveryScans',
      align: 'center',
      render: (value) => <strong>{value || 0}</strong>
    },
    {
      title: 'Discovery Rate',
      dataIndex: 'discoveryRate',
      key: 'discoveryRate',
      align: 'center',
      render: (value) => (
        <Progress
          percent={value}
          size="small"
          strokeColor="#722ed1"
          format={percent => `${percent}%`}
        />
      ),
      sorter: (a, b) => a.discoveryRate - b.discoveryRate,
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: 'Unique Users',
      dataIndex: 'uniqueUsers',
      key: 'uniqueUsers',
      align: 'center'
    },
    {
      title: 'Last Scanned',
      dataIndex: 'lastScannedText',
      key: 'lastScanned',
      width: 150
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      title: 'Performance',
      dataIndex: 'performance',
      key: 'performance',
      render: (value) => (
        <Progress percent={value} size="small" />
      )
    }
  ];

  return (
    <div>
      {/* Summary Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Scans"
              value={analytics.totalScans}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Unique Users"
              value={analytics.uniqueUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Completion Rate"
              value={analytics.completionRate}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg Scans/User"
              value={analytics.avgScansPerUser}
              precision={1}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Discovery Analytics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Booth Visitors"
              value={analytics.discoveryAnalytics.boothUsers}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Booth Discovery Rate"
              value={analytics.discoveryAnalytics.boothRate}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Floor-01 Visitors"
              value={analytics.discoveryAnalytics.floor01Users}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Floor-01 Discovery Rate"
              value={analytics.discoveryAnalytics.floor01Rate}
              suffix="%"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Controls: Refresh Buttons and Auto-Refresh Toggle */}
      <Card style={{ marginBottom: 24 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadAllAnalyticsData}
              loading={loading}
            >
              Refresh Analytics (Manual)
            </Button>
            <Switch
              checked={isAutoRefreshEnabled}
              onChange={checked => setIsAutoRefreshEnabled(checked)}
              checkedChildren="Auto Refresh ON"
              unCheckedChildren="Auto Refresh OFF"
            />
          </Space>
          {/* New button for recalculating Discovery Analytics */}
          <Button
            icon={<SyncOutlined />}
            onClick={handleRecalculateDiscoveryAnalytics}
            loading={recalculatingDiscovery}
            type="default"
          >
            Recalculate Discovery Stats
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={exportAnalytics}
          >
            Export Scan Data
          </Button>
        </Space>
      </Card>

      {/* Consolidated QR Analytics Table */}
      <Card title="QR Analytics">
        <Table
          dataSource={analytics.qrStatistics}
          columns={consolidatedColumns}
          loading={loading}
          pagination={{ pageSize: 15 }}
          size="small"
          rowKey="code"
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default QRAnalytics;