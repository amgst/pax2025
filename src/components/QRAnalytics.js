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
  Switch,
  Tooltip // Import Tooltip
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  BarChartOutlined,
  TrophyOutlined,
  UserOutlined,
  CalendarOutlined,
  SyncOutlined
} from '@ant-design/icons';
import firebase from 'firebase/compat/app';
import firebaseService from '../services/firebase';

// Helper to parse various timestamp formats into milliseconds for comparison
const parseAnyTimestampToMs = (timestamp) => {
  if (!timestamp) return 0; // Return 0 for missing/null timestamps

  // If it's already a Firebase Timestamp object
  if (typeof timestamp === 'object' && timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
    return timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1e6);
  }

  // If it's a JavaScript Date object
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  // If it's a string that can be parsed into a Date
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  // Fallback for other unexpected formats
  return 0;
};

// Helper to get the actual Firebase Timestamp object or create one from a Date/string
const getFirebaseTimestamp = (timestamp) => {
  if (!timestamp) {
    return null;
  }

  // If it's already a Firebase Timestamp object
  if (typeof timestamp === 'object' && timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
    return timestamp;
  }

  // If it's a JavaScript Date object
  if (timestamp instanceof Date) {
    return firebase.firestore.Timestamp.fromDate(timestamp);
  }

  // If it's a string, try to parse it
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return firebase.firestore.Timestamp.fromDate(date);
    }
  }

  return null;
};

// Helper to safely get the scan code from a scan entry (can be string or object)
const getScanCode = (scan) => {
  if (typeof scan === 'string') {
    return scan;
  }
  if (typeof scan === 'object' && scan !== null && typeof scan.code === 'string') {
    return scan.code;
  }
  return null;
};


const QRAnalytics = ({ userData = [], onAnalyticsRecalculated }) => {
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
    qrStatistics: []
  });
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(false);
  const [recalculatingAnalytics, setRecalculatingAnalytics] = useState(false);

  /**
   * Calculates real-time statistics directly from the 'users' collection.
   * @returns {Object} Real-time calculated statistics and detailed QR stats.
   */
  const calculateRealTimeAndDetailedStats = async (usersSnapshot, qrCodesSnapshot) => {
    const uniqueUsers = new Set();
    let totalScansFromUsers = 0;
    let completedUsers = 0; // This variable is correctly defined here
    const totalPossibleCodes = 18; // Standardized to 18 for completion rate consistency

    const scanCountsPerQrCode = {};
    const uniqueUsersPerQrCode = {};
    const lastScannedPerQrCode = {}; // Stores Firebase Timestamp objects
    const discoveryScansCount = {};

    qrCodesSnapshot.forEach(doc => {
      const code = doc.id;
      scanCountsPerQrCode[code] = 0;
      uniqueUsersPerQrCode[code] = new Set();
      lastScannedPerQrCode[code] = null;
      discoveryScansCount[code] = 0;
    });

    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      const userId = userDoc.id;

      if (userData.scannedCodes && Array.isArray(userData.scannedCodes) && userData.scannedCodes.length > 0) {
        uniqueUsers.add(userId);
        totalScansFromUsers += userData.scannedCodes.length;

        if (userData.scannedCodes.length >= totalPossibleCodes) {
          completedUsers++; // Used here
        }

        const firstScan = userData.scannedCodes[0];
        const firstCode = getScanCode(firstScan);
        if (firstCode && discoveryScansCount.hasOwnProperty(firstCode)) {
          discoveryScansCount[firstCode]++;
        }

        userData.scannedCodes.forEach(scan => {
          const code = getScanCode(scan);
          // Attempt to get timestamp from scan object, or fallback to user's updatedAt
          const rawTimestamp = (typeof scan === 'object' && scan.timestamp) ? scan.timestamp : userData.updatedAt;
          
          const currentScanMs = parseAnyTimestampToMs(rawTimestamp);
          const lastScannedMs = parseAnyTimestampToMs(lastScannedPerQrCode[code]);

          if (code && scanCountsPerQrCode.hasOwnProperty(code)) {
            scanCountsPerQrCode[code]++;
            uniqueUsersPerQrCode[code].add(userId);

            // Update lastScanned if current scan is newer
            if (currentScanMs > lastScannedMs) {
              lastScannedPerQrCode[code] = getFirebaseTimestamp(rawTimestamp); // Store as Firebase Timestamp
            }
          }
        });
      }
    });

    const uniqueUserCount = uniqueUsers.size;
    
    const qrStatistics = [];
    let totalScansFromQrStats = 0;
    qrCodesSnapshot.forEach(doc => {
      const qrData = doc.data();
      const code = doc.id;
      const scans = scanCountsPerQrCode[code] || 0;
      const users = uniqueUsersPerQrCode[code].size || 0;
      const lastScanned = lastScannedPerQrCode[code]; // This is already a Firebase Timestamp or null

      totalScansFromQrStats += scans;

      qrStatistics.push({
        code,
        locationNumber: qrData.locationNumber,
        locationName: qrData.locationName || qrData.description || 'Unnamed',
        isActive: qrData.active !== false,
        totalScans: scans,
        uniqueUsers: users,
        lastScanned: lastScanned, // Store the Firebase Timestamp object directly
        lastScannedText: lastScanned && lastScanned.seconds !== undefined ? new Date(lastScanned.seconds * 1000).toLocaleString() : 'Timestamp Missing',
        discoveryScans: discoveryScansCount[code] || 0,
        discoveryRate: uniqueUserCount > 0 ? Math.round(((discoveryScansCount[code] || 0) / uniqueUserCount) * 100) : 0,
      });
    });

    qrStatistics.sort((a, b) => (b.totalScans || 0) - (a.totalScans || 0));
    const maxScans = Math.max(...qrStatistics.map(qr => qr.totalScans || 0), 1);
    
    const finalQrStatistics = qrStatistics.map((qr, index) => ({
      ...qr,
      rank: index + 1,
      performance: Math.round((qr.totalScans / maxScans) * 100)
    }));

    return {
      totalScans: totalScansFromQrStats,
      uniqueUsers: uniqueUserCount,
      completionRate: uniqueUserCount > 0 ? Math.round((completedUsers / uniqueUserCount) * 100) : 0, // Used here
      avgScansPerUser: uniqueUserCount > 0 ? (totalScansFromQrStats / uniqueUserCount).toFixed(1) : 0,
      qrStatistics: finalQrStatistics
    };
  };

  const loadDiscoveryAnalytics = async () => {
    try {
      const firestoreDb = firebaseService.db;
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
      const firestoreDb = firebaseService.db;
      if (!firestoreDb) {
        throw new Error('Firebase not initialized');
      }

      const [usersSnapshot, qrCodesSnapshot] = await Promise.all([
        firestoreDb.collection('users').get(),
        firestoreDb.collection('valid_codes').get()
      ]);

      const { 
        totalScans, 
        uniqueUsers, 
        completionRate, 
        avgScansPerUser, 
        qrStatistics 
      } = await calculateRealTimeAndDetailedStats(usersSnapshot, qrCodesSnapshot);

      const discovery = await loadDiscoveryAnalytics();

      setAnalytics({
        totalScans: totalScans || 0,
        uniqueUsers: uniqueUsers || 0,
        completionRate: completionRate || 0,
        avgScansPerUser: avgScansPerUser || 0,
        discoveryAnalytics: discovery,
        qrStatistics: qrStatistics
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
   * Handles the comprehensive recalculation and saving of all aggregated analytics data.
   */
  const recalculateAndSaveAllAggregatedData = async () => {
    setRecalculatingAnalytics(true);
    try {
      const firestoreDb = firebaseService.db;
      if (!firestoreDb) {
        throw new Error('Firebase not initialized');
      }

      const usersSnapshot = await firestoreDb.collection('users').get();
      const validCodesSnapshot = await firestoreDb.collection('valid_codes').get();

      if (usersSnapshot.empty || validCodesSnapshot.empty) {
        notification.info({
          message: 'No Data',
          description: 'No user data or valid QR codes found to calculate analytics.'
        });
        setRecalculatingAnalytics(false);
        return;
      }

      const totalPossibleCodes = 18; // Standardized to 18 for completion rate consistency

      // --- 1. Calculate overall stats and per-QR stats ---
      const uniqueUsersSet = new Set();
      let totalScansAggregate = 0;
      let completedUsersCount = 0;
      const scanCountsPerQrCode = {};
      const uniqueUsersPerQrCode = {};
      const lastScannedPerQrCode = {}; // Stores Firebase Timestamp objects
      const discoveryScansCount = {};

      validCodesSnapshot.forEach(doc => {
        const code = doc.id;
        scanCountsPerQrCode[code] = 0;
        uniqueUsersPerQrCode[code] = new Set();
        lastScannedPerQrCode[code] = null;
        discoveryScansCount[code] = 0;
      });

      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const userId = userDoc.id;

        if (userData.scannedCodes && Array.isArray(userData.scannedCodes) && userData.scannedCodes.length > 0) {
          uniqueUsersSet.add(userId);
          totalScansAggregate += userData.scannedCodes.length;

          if (userData.scannedCodes.length >= totalPossibleCodes) {
            completedUsersCount++;
          }

          const firstScan = userData.scannedCodes[0];
          const firstCode = getScanCode(firstScan);
          if (firstCode && discoveryScansCount.hasOwnProperty(firstCode)) {
            discoveryScansCount[firstCode]++;
          }

          userData.scannedCodes.forEach(scan => {
            const code = getScanCode(scan);
            // Attempt to get timestamp from scan object, or fallback to user's updatedAt
            const rawTimestamp = (typeof scan === 'object' && scan.timestamp) ? scan.timestamp : userData.updatedAt;
            const currentScanMs = parseAnyTimestampToMs(rawTimestamp);
            const lastScannedMs = parseAnyTimestampToMs(lastScannedPerQrCode[code]);

            if (code && scanCountsPerQrCode.hasOwnProperty(code)) {
              scanCountsPerQrCode[code]++;
              uniqueUsersPerQrCode[code].add(userId);

              // Update lastScanned if current scan is newer
              if (currentScanMs > lastScannedMs) {
                lastScannedPerQrCode[code] = getFirebaseTimestamp(rawTimestamp); // Store as Firebase Timestamp
              }
            }
          });
        }
      });

      const finalUniqueUserCount = uniqueUsersSet.size;
      const finalCompletionRate = finalUniqueUserCount > 0 ? Math.round((completedUsersCount / finalUniqueUserCount) * 100) : 0;
      const finalAvgScansPerUser = finalUniqueUserCount > 0 ? (totalScansAggregate / finalUniqueUserCount).toFixed(1) : 0;

      // --- 2. Prepare QR statistics for saving ---
      const qrStatsToSave = [];
      validCodesSnapshot.forEach(doc => {
        const qrData = doc.data();
        const code = doc.id;
        qrStatsToSave.push({
          code,
          locationNumber: qrData.locationNumber,
          locationName: qrData.locationName || qrData.description || 'Unnamed',
          isActive: qrData.active !== false,
          totalScans: scanCountsPerQrCode[code] || 0,
          uniqueUsers: uniqueUsersPerQrCode[code].size || 0,
          lastScanned: lastScannedPerQrCode[code] || null, // This should be a Firebase Timestamp or null
        });
      });

      // --- 3. Prepare Discovery Analytics for saving ---
      const boothQrCodes = new Set();
      const floor01QrCodes = new Set();
      validCodesSnapshot.forEach(doc => {
        const data = doc.data();
        const codeId = doc.id.toLowerCase();
        if (codeId.includes('bth') || (data.locationName && data.locationName.toLowerCase().includes('booth'))) {
          boothQrCodes.add(doc.id);
        } else if (codeId.includes('flr-01') || (data.locationName && data.locationName.toLowerCase().includes('floor 01')) || data.locationNumber === '01') {
          floor01QrCodes.add(doc.id);
        }
      });

      let usersScannedBooth = 0;
      let usersScannedFloor01 = 0;
      usersSnapshot.forEach(userDoc => {
        const currentUserData = userDoc.data();
        if (currentUserData.scannedCodes && currentUserData.scannedCodes.length > 0) {
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

      const finalBoothPercentage = finalUniqueUserCount > 0 ? Math.round((usersScannedBooth / finalUniqueUserCount) * 100) : 0;
      const finalFloor01Percentage = finalUniqueUserCount > 0 ? Math.round((usersScannedFloor01 / finalUniqueUserCount) * 100) : 0;

      // --- 4. Perform Batch Writes to Firestore ---
      const batch = firestoreDb.batch();

      // Update summary statistics
      const summaryDocRef = firestoreDb.collection('statistics').doc('summary');
      batch.set(summaryDocRef, {
        totalScans: totalScansAggregate,
        uniqueUsers: finalUniqueUserCount,
        completionRate: finalCompletionRate,
        avgScansPerUser: finalAvgScansPerUser,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Update qr_statistics for each QR code
      qrStatsToSave.forEach(qr => {
        const qrStatDocRef = firestoreDb.collection('qr_statistics').doc(qr.code);
        batch.set(qrStatDocRef, {
          totalScans: qr.totalScans,
          uniqueUsers: qr.uniqueUsers,
          lastScanned: qr.lastScanned, // Save the Firebase Timestamp object directly
          locationName: qr.locationName,
          locationNumber: qr.locationNumber,
          isActive: qr.isActive,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      // Update discovery analytics
      const boothDocRef = firestoreDb.collection('discovery_analytics').doc('booth');
      const floor01DocRef = firestoreDb.collection('discovery_analytics').doc('floor01');

      batch.set(floor01DocRef, {
        usersFound: usersScannedFloor01,
        discoveryRate: finalFloor01Percentage,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(boothDocRef, {
        usersVisited: usersScannedBooth,
        discoveryRate: finalBoothPercentage,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });


      await batch.commit();

      notification.success({
        message: 'All Analytics Recalculated',
        description: 'All dashboard analytics data has been updated in Firestore.'
      });

      loadAllAnalyticsData(); // Refresh QRAnalytics tab's own data
      if (onAnalyticsRecalculated) { // Call the callback if provided
        onAnalyticsRecalculated();
      }

    } catch (error) {
      console.error('Error recalculating all analytics:', error);
      notification.error({
        message: 'Error Recalculating All Analytics',
        description: error.message || 'Failed to recalculate all analytics.'
      });
    } finally {
      setRecalculatingAnalytics(false);
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
      const firestoreDb = firebaseService.db;
      if (!firestoreDb) {
        throw new Error('Firebase not initialized');
      }

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
            const scanCode = getScanCode(scan);
            // Use scan.timestamp if available, otherwise fallback to user.updatedAt
            const scanTimestamp = (typeof scan === 'object' && scan.timestamp) ? scan.timestamp : userData.updatedAt;

            const qrCode = qrCodesMap.get(scanCode) || {};

            csvData.push({
              scanId: `${userId}-${index}`,
              timestamp: scanTimestamp && scanTimestamp.seconds !== undefined ? new Date(scanTimestamp.seconds * 1000).toISOString() : '',
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
      align: 'center',
      sorter: (a, b) => a.uniqueUsers - b.uniqueUsers, // Added sorting for Unique Users
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: 'Last Scanned',
      dataIndex: 'lastScannedText',
      key: 'lastScanned',
      width: 150,
      sorter: (a, b) => { // Added sorting for Last Scanned
        const dateA = parseAnyTimestampToMs(a.lastScanned);
        const dateB = parseAnyTimestampToMs(b.lastScanned);
        return dateA - dateB;
      },
      sortDirections: ['ascend', 'descend'],
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
            <Tooltip title="Total number of times any QR code has been scanned by any user.">
              <Statistic
                title="Total Scans"
                value={analytics.totalScans}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Number of distinct users who have scanned at least one QR code.">
              <Statistic
                title="Unique Users"
                value={analytics.uniqueUsers}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Percentage of unique users who have scanned all 18 unique QR codes.">
              <Statistic
                title="Completion Rate"
                value={analytics.completionRate}
                suffix="%"
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Average number of QR codes scanned per unique user (Total Scans / Unique Users).">
              <Statistic
                title="Avg Scans/User"
                value={analytics.avgScansPerUser}
                precision={1}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#eb2f96' }}
              />
            </Tooltip>
          </Card>
        </Col>
      </Row>

      {/* Discovery Analytics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Number of unique users whose first scanned QR code was identified as being at the 'Booth' location.">
              <Statistic
                title="Booth Visitors"
                value={analytics.discoveryAnalytics.boothUsers}
                valueStyle={{ color: '#722ed1' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Percentage of total unique users whose first scan was at the 'Booth' location.">
              <Statistic
                title="Booth Discovery Rate"
                value={analytics.discoveryAnalytics.boothRate}
                suffix="%"
                valueStyle={{ color: '#722ed1' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Number of unique users whose first scanned QR code was identified as being at the 'Floor-01' location.">
              <Statistic
                title="Floor-01 Visitors"
                value={analytics.discoveryAnalytics.floor01Users}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Percentage of total unique users whose first scan was at the 'Floor-01' location.">
              <Statistic
                title="Floor-01 Discovery Rate"
                value={analytics.discoveryAnalytics.floor01Rate}
                suffix="%"
                valueStyle={{ color: '#13c2c2' }}
              />
            </Tooltip>
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
          {/* Button to trigger comprehensive recalculation */}
          <Button
            icon={<SyncOutlined />}
            onClick={recalculateAndSaveAllAggregatedData}
            loading={recalculatingAnalytics}
            type="default"
          >
            Recalculate All Analytics Data
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
          pagination={false} // Removed pagination
          size="small"
          rowKey="code"
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default QRAnalytics;
