import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Space,
  Tag,
  Avatar,
  Statistic,
  Row,
  Col,
  Progress,
  Badge,
  Select,
  DatePicker,
  notification,
  Typography,
  Alert,
  Layout,
  Menu,
  Drawer,
  Grid,
  Tooltip,
  Switch,
  Popconfirm,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  ReloadOutlined,
  UserOutlined,
  TrophyOutlined,
  GiftOutlined,
  CalendarOutlined,
  DashboardOutlined,
  BarChartOutlined,
  QrcodeOutlined,
  MenuOutlined,
  DeleteOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PercentageOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import firebaseService from '../services/firebase';
import QRAnalytics from './QRAnalytics';
import QRCodeDisplay from './QRCodeDisplay';
import LocationPerformance from './LocationPerformance';
import TierManagement from './TierManagement';
// Removed Prize and About tabs

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Header, Content } = Layout;
const { useBreakpoint } = Grid;


const prizeIcons = {
  'Wheel Spin': '🎡',
  'Holofoil': '✨',
  'OV Pack': '📦',
  'IE Pack': '🥇',
  'Custom Card': '✍️'
};

const parseFirebaseTimestamp = (dataTimestamp) => {
  if (!dataTimestamp) return null;

  if (dataTimestamp.seconds !== undefined) {
    return new Date(dataTimestamp.seconds * 1000);
  }

  if (typeof dataTimestamp.toDate === 'function') {
    return dataTimestamp.toDate();
  }

  if (typeof dataTimestamp === 'object' && dataTimestamp._methodName === 'FieldValue.serverTimestamp') {
    return null;
  }

  const date = new Date(dataTimestamp);
  return isNaN(date.getTime()) ? null : date;
};


const KNOWN_TIERS = [
  { id: 'tier1', name: 'Wheel Spin', required: 1 },
  { id: 'tier3', name: 'Holofoil', required: 3 },
  { id: 'tier6', name: 'OV Pack', required: 6 },
  { id: 'tier12', name: 'IE Pack', required: 12 },
  { id: 'tier18', name: 'Custom Card', required: 18 }
];


const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [userData, setUserData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState(null);
  const [error, setError] = useState(null);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [isAutoRefreshEnabledOverview, setIsAutoRefreshEnabledOverview] = useState(false);
  const [analyticsRefreshTrigger, setAnalyticsRefreshTrigger] = useState(0);

  const [currentPageSize, setCurrentPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);


  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const menuItems = [
    { key: 'overview', icon: <DashboardOutlined />, label: 'Overview' },
    { key: 'users', icon: <UserOutlined />, label: 'Users' },
    { key: 'analytics', icon: <QrcodeOutlined />, label: 'Analytics' },
    { key: 'qr', icon: <QrcodeOutlined />, label: 'QR Codes' },
  ];

  const handleMenuClick = ({ key }) => {
    setActiveTab(key);
    if (isMobile) {
      setMobileMenuVisible(false);
    }
  };

  const MobileMenu = () => (
    <Drawer
      title="Dashboard Menu"
      placement="left"
      onClose={() => setMobileMenuVisible(false)}
      open={mobileMenuVisible}
      width={250}
      styles={{
        body: { padding: 0 }
      }}
    >
      <Menu
        mode="vertical"
        selectedKeys={[activeTab]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ border: 'none', height: '100%' }}
      />
    </Drawer>
  );

  const DesktopHeader = () => (
    <div style={{
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      height: '100%',
      overflow: 'hidden'
    }}>
      <div style={{
        fontWeight: 'bold',
        fontSize: '18px',
        marginRight: '40px',
        color: '#667eea',
        whiteSpace: 'nowrap',
        minWidth: 'fit-content'
      }}>
        Pax Dashboard
      </div>
      <Menu
        mode="horizontal"
        selectedKeys={[activeTab]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          border: 'none',
          flex: 1,
          justifyContent: 'flex-start'
        }}
      />
    </div>
  );

  const MobileHeader = () => (
    <div style={{
      padding: '0 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '100%',
      minHeight: '56px'
    }}>
      <div style={{
        fontWeight: 'bold',
        fontSize: '16px',
        color: '#667eea',
        flex: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        marginRight: '12px'
      }}>
        Pax Dashboard
      </div>
      <Button
        type="text"
        icon={<MenuOutlined />}
        onClick={() => setMobileMenuVisible(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '40px',
          height: '40px'
        }}
      />
    </div>
  );


const loadUserData = async () => {
  setLoading(true);
  setError(null);

  try {
    const users = await firebaseService.getUsers();

    if (!users || users.length === 0) {
      setUserData([]);
      notification.info({
        message: 'No Data',
        description: 'No users found in the database.'
      });
      return;
    }

    const totalCodes = 18;

    const processedUsers = users.map((user) => {
      const data = user;

      const redemptionStatus = data.redemptionStatus || {};
      const totalRedemptions = Object.values(redemptionStatus)
        .filter(status => status && status.redeemed).length;

      const rawScannedCodes = Array.isArray(data.scannedCodes) ? data.scannedCodes : [];

      const firstScanDateFromUserDoc = parseFirebaseTimestamp(data.createdAt);
      const completionDateFromDocument = parseFirebaseTimestamp(data.completionTime);

      return {
        id: user.id,
        name: (data.firstName && data.lastName) ? `${data.firstName} ${data.lastName}` : data.displayName || data.firstName || 'Anonymous User',
        email: data.email || 'No email provided',
        phone: data.phone || 'No phone',
        createdAt: parseFirebaseTimestamp(data.createdAt),
        scannedCodes: rawScannedCodes.length,
        totalCodes,
        drawingEntries: data.drawingEntries || 0,
        bonusEntries: data.drawingBonusEntries || 0,
        totalRedemptions,
        prizes: KNOWN_TIERS.map(tier => {
          const tierStatus = redemptionStatus[tier.id];
          return {
            id: tier.id,
            name: tier.name,
            required: tier.required,
            unlocked: rawScannedCodes.length >= tier.required,
            redeemed: tierStatus ? tierStatus.redeemed || false : false,
            redeemedAt: tierStatus ? parseFirebaseTimestamp(tierStatus.redeemedTimestamp) : null
          };
        }),
        shopifyId: data.shopifyCustomerId || '',
        lastUpdated: parseFirebaseTimestamp(data.updatedAt),
        firstScanDate: firstScanDateFromUserDoc,
        completionDate: completionDateFromDocument,
      };
    });

    setUserData(processedUsers);
    setAnalyticsRefreshTrigger(prev => prev + 1);

  } catch (error) {
    setError(error.message);
    notification.error({
      message: 'Error Loading Data',
      description: error.message || 'Failed to load user data from Firebase',
      duration: 5
    });
  } finally {
    setLoading(false);
  }
};

const handleResetUser = async (userId) => {
  try {
    setLoading(true);
    await firebaseService.resetUserData(userId);
    notification.success({
      message: 'User Data Reset',
      description: 'The user\'s data has been reset successfully.'
    });
    await loadUserData();
  } catch (error) {
    notification.error({
      message: 'Reset Failed',
      description: error.message || 'Could not reset user data. Please try again.'
    });
  } finally {
    setLoading(false);
  }
};


  const handleAnalyticsRecalculated = () => {
    loadUserData();
  };

  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'users' || activeTab === 'tiers' || activeTab === 'tier-mgmt') {
        loadUserData();
    }

    let intervalId;
    if (isAutoRefreshEnabledOverview && activeTab === 'overview') {
      intervalId = setInterval(loadUserData, 2 * 60 * 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoRefreshEnabledOverview, activeTab]);

  const filteredData = useMemo(() => {
    return userData.filter(user => {
      const searchLower = searchText.toLowerCase();
      const matchesSearch = !searchText ||
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.phone.toLowerCase().includes(searchLower) ||
        user.id.toLowerCase().includes(searchLower) ||
        user.shopifyId.toLowerCase().includes(searchLower);

      let matchesStatus = true;
      switch(filterStatus) {
        case 'active':
          matchesStatus = user.scannedCodes > 0;
          break;
        case 'completed':
          matchesStatus = user.scannedCodes >= user.totalCodes;
          break;
        case 'redeemed':
          // Business rule: user is \"redeemed\" if they have any scans
          matchesStatus = user.scannedCodes > 0;
          break;
        case 'inactive':
          matchesStatus = user.scannedCodes === 0;
          break;
        default:
          matchesStatus = true;
      }

      let matchesDate = true;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const userDate = user.createdAt && !isNaN(user.createdAt.getTime()) ? user.createdAt : null;
        matchesDate = userDate && userDate >= dateRange[0].startOf('day').toDate() &&
                     userDate <= dateRange[1].endOf('day').toDate();
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [userData, searchText, filterStatus, dateRange]);

  const stats = useMemo(() => {
    const totalUsers = userData.length;
    const activeUsers = userData.filter(u => u.scannedCodes > 0).length;
    const completedUsers = userData.filter(u => u.scannedCodes >= u.totalCodes).length;
    const totalEntries = userData.reduce((sum, u) => sum + u.drawingEntries + u.bonusEntries, 0);
    const totalRedemptions = userData.reduce((sum, u) => sum + u.totalRedemptions, 0);
    // Business rule: a user is considered \"redeemed\" if they have scanned at least one code
    const usersWithRedemptions = userData.filter(u => u.scannedCodes > 0).length;

    let completedIn5Minutes = 0;

    userData.forEach(user => {
      if (user.scannedCodes >= user.totalCodes && user.firstScanDate && user.completionDate && !isNaN(user.firstScanDate.getTime()) && !isNaN(user.completionDate.getTime())) {
        const diffMs = user.completionDate.getTime() - user.firstScanDate.getTime();
        const diffMinutes = diffMs / (1000 * 60);

        if (diffMinutes <= 5) {
          completedIn5Minutes++;
        }
      }
    });

    const allRedemptionsUsersCount = userData.filter(user => {
      return KNOWN_TIERS.every(tier => {
        const userPrize = user.prizes.find(p => p.id === tier.id);
        return userPrize && userPrize.redeemed;
      });
    }).length;

    // User Engagement Levels
    const engagementStats = {
      bounced: userData.filter(u => u.scannedCodes === 0).length,
      earlyDropoff: userData.filter(u => u.scannedCodes >= 1 && u.scannedCodes <= 5).length,
      moderate: userData.filter(u => u.scannedCodes >= 6 && u.scannedCodes <= 12).length,
      nearComplete: userData.filter(u => u.scannedCodes >= 13 && u.scannedCodes <= 17).length,
      completed: userData.filter(u => u.scannedCodes >= 18).length
    };

    // Prize Redemption Analytics
    const prizeAnalytics = KNOWN_TIERS.map(tier => {
      const unlocked = userData.filter(u => u.prizes.find(p => p.id === tier.id)?.unlocked).length;
      const redeemed = userData.filter(u => u.prizes.find(p => p.id === tier.id)?.redeemed).length;
      
      return {
        name: tier.name,
        required: tier.required,
        unlocked,
        redeemed,
        redemptionRate: unlocked > 0 ? Math.round((redeemed / unlocked) * 100) : 0
      };
    });

    // Completion Time Distribution
    const completedUsersWithTimes = userData.filter(u => 
      u.scannedCodes >= 18 && 
      u.firstScanDate && 
      u.completionDate && 
      !isNaN(u.firstScanDate.getTime()) && 
      !isNaN(u.completionDate.getTime())
    );

    const completionTimeStats = {
      under5min: 0,
      under30min: 0,
      under1hour: 0,
      under6hours: 0,
      over6hours: 0
    };

    completedUsersWithTimes.forEach(user => {
      const diffMinutes = (user.completionDate.getTime() - user.firstScanDate.getTime()) / (1000 * 60);
      
      if (diffMinutes <= 5) completionTimeStats.under5min++;
      else if (diffMinutes <= 30) completionTimeStats.under30min++;
      else if (diffMinutes <= 60) completionTimeStats.under1hour++;
      else if (diffMinutes <= 360) completionTimeStats.under6hours++;
      else completionTimeStats.over6hours++;
    });

    // Suspicious Activity Detection
    const suspiciousActivity = userData.filter(user => {
      if (user.scannedCodes >= 18 && user.firstScanDate && user.completionDate) {
        const diffMinutes = (user.completionDate.getTime() - user.firstScanDate.getTime()) / (1000 * 60);
        if (diffMinutes < 2) return true;
      }
      return false;
    });

    // Data Quality Metrics
    const dataQuality = {
      missingEmail: userData.filter(u => !u.email || u.email === 'No email provided').length,
      missingPhone: userData.filter(u => !u.phone || u.phone === 'No phone').length,
      missingShopifyId: userData.filter(u => !u.shopifyId).length,
      incompleteProfiles: userData.filter(u => 
        (!u.email || u.email === 'No email provided') || 
        (!u.phone || u.phone === 'No phone')
      ).length
    };

    // Peak Activity Hours
    const hourlyActivity = new Array(24).fill(0);
    userData.forEach(user => {
      if (user.createdAt && !isNaN(user.createdAt.getTime())) {
        const hour = user.createdAt.getHours();
        hourlyActivity[hour]++;
      }
    });

    const peakHour = hourlyActivity.indexOf(Math.max(...hourlyActivity));
    const peakHourCount = Math.max(...hourlyActivity);

    return {
      totalUsers,
      activeUsers,
      completedUsers,
      totalEntries,
      totalRedemptions,
      usersWithRedemptions,
      averageProgress: totalUsers > 0 ?
        Math.round(userData.reduce((sum, u) => sum + (u.scannedCodes / u.totalCodes * 100), 0) / totalUsers) : 0,
      completedIn5Minutes,
      allRedemptionsUsersCount,
      engagementStats,
      prizeAnalytics,
      completionTimeStats,
      suspiciousActivity: {
        count: suspiciousActivity.length,
        users: suspiciousActivity
      },
      dataQuality,
      hourlyActivity,
      peakHour,
      peakHourCount,
      bounceRate: totalUsers > 0 ? Math.round((engagementStats.bounced / totalUsers) * 100) : 0,
    };
  }, [userData]);

  const exportToCSV = () => {
    if (filteredData.length === 0) {
      notification.warning({
        message: 'No Data',
        description: 'No data available to export.'
      });
      return;
    }

    const headers = [
      'User ID',
      'Name',
      'Email',
      'Phone',
      'Shopify ID',
      'Created Date',
      'Last Updated',
      'Scanned Codes',
      'Progress %',
      'Drawing Entries',
      'Bonus Entries',
      'Total Entries',
      'Total Redemptions',
      'Wheel Spin Status',
      'Holofoil Status',
      'OV Pack Status',
      'IE Pack Status',
      'Custom Card Status',
      'First Scan Date',
      'Completed (18 Codes) Date'
    ];

    const csvData = [
      headers.join(','),
      ...filteredData.map(user => {
        const progressPercent = Math.round((user.scannedCodes / user.totalCodes) * 100);

        const wheelSpin = user.prizes.find(p => p.name === 'Wheel Spin');
        const holofoil = user.prizes.find(p => p.name === 'Holofoil');
        const ovPack = user.prizes.find(p => p.name === 'OV Pack');
        const iePack = user.prizes.find(p => p.name === 'IE Pack');
        const customCard = user.prizes.find(p => p.name === 'Custom Card');

        const getPrizeStatus = (prize) => {
          if (!prize) return 'Locked';
          if (prize.redeemed) return 'Redeemed';
          if (prize.unlocked) return 'Unlocked';
          return 'Locked';
        };

        const createdAtCsv = user.createdAt === 'Pending Server Timestamp' ? 'Pending Server Timestamp' :
                             (user.createdAt && !isNaN(user.createdAt.getTime()) ? user.createdAt.toLocaleString() : 'N/A');
        const lastUpdatedCsv = user.lastUpdated === 'Pending Server Timestamp' ? 'Pending Server Timestamp' :
                               (user.lastUpdated && !isNaN(user.lastUpdated.getTime()) ? user.lastUpdated.toLocaleString() : 'Never');

        const firstScanDateCsv = user.firstScanDate === 'Pending Server Timestamp' ? 'Pending Server Timestamp' :
                                 (user.firstScanDate && !isNaN(user.firstScanDate.getTime()) ? user.firstScanDate.toLocaleString() : 'N/A');
        const completionDateCsv = user.completionDate === 'Pending Server Timestamp' ? 'Pending Server Timestamp' :
                                  (user.completionDate && !isNaN(user.completionDate.getTime()) ? user.completionDate.toLocaleString() : 'N/A');

        return [
          `"${user.id}"`,
          `"${user.name}"`,
          `"${user.email}"`,
          `"${user.phone}"`,
          `"${user.shopifyId}"`,
          `"${createdAtCsv}"`,
          `"${lastUpdatedCsv}"`,
          user.scannedCodes,
          progressPercent,
          user.drawingEntries,
          user.bonusEntries,
          user.drawingEntries + user.bonusEntries,
          user.totalRedemptions,
          getPrizeStatus(wheelSpin),
          getPrizeStatus(holofoil),
          getPrizeStatus(ovPack),
          getPrizeStatus(iePack),
          getPrizeStatus(customCard),
          `"${firstScanDateCsv}"`,
          `"${completionDateCsv}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dgsh_users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notification.success({
      message: 'Export Successful',
      description: `Exported ${filteredData.length} user records to CSV.`
    });
  };

  const columns = useMemo(() => [
    {
      title: 'S.No.',
      key: 'sno',
      width: 70,
      fixed: 'left',
      render: (text, record, index) => {
        const startIdx = (currentPage - 1) * currentPageSize;
        return startIdx + index + 1;
      },
    },
    {
      title: 'User',
      key: 'user',
      width: 200,
      fixed: 'left',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            icon={<UserOutlined />}
            style={{
              backgroundColor: record.scannedCodes > 0 ? '#1890ff' : '#d9d9d9',
              flexShrink: 0
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>
              {record.name}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email.length > 30 ?
                record.email.replace(/(.{15}).*(@.*)/, '$1...$2') :
                record.email
              }
            </Text>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              ID: {record.id}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 150,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <Text>{record.phone}</Text>
          </div>
          {record.shopifyId && (
            <Tag size="small" color="cyan">
              Shopify: {record.shopifyId.slice(-6)}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => {
        if (!date || isNaN(date.getTime())) {
          return (
            <div style={{ fontSize: 12, color: '#999' }}>
              <div>N/A</div>
              <Text type="secondary">N/A</Text>
            </div>
          );
        }
        const today = new Date();
        const isToday = date.getDate() === today.getDate() &&
                       date.getMonth() === today.getMonth() &&
                       date.getFullYear() === today.getFullYear();

        return (
          <div style={{ fontSize: 12 }}>
            <div>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            {isToday ? (
              <Text type="secondary">Today</Text>
            ) : (
              <Text type="secondary">{date.toLocaleDateString()}</Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'First Scan',
      dataIndex: 'firstScanDate',
      key: 'firstScanDate',
      width: 120,
      render: (date) => {
        if (!date || isNaN(date.getTime())) {
          return (
            <div style={{ fontSize: 12, color: '#999' }}>
              <div>N/A</div>
              <Text type="secondary">N/A</Text>
            </div>
          );
        }
        return (
          <div style={{ fontSize: 12 }}>
            <div>{date.toLocaleDateString()}</div>
            <Text type="secondary">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </div>
        );
      },
      sorter: (a, b) => {
        const dateA = (a.firstScanDate instanceof Date && !isNaN(a.firstScanDate.getTime())) ? a.firstScanDate.getTime() : 0;
        const dateB = (b.firstScanDate instanceof Date && !isNaN(b.firstScanDate.getTime())) ? b.firstScanDate.getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: 'Redemption Status',
      key: 'redemptionStatus',
      width: 150,
      align: 'center',
      render: (_, record) => {
        // Business rule: if user has any scans, they are considered redeemed
        const hasRedemptions = record.scannedCodes > 0;
        return (
          <div style={{ textAlign: 'center' }}>
            <Tag color={hasRedemptions ? 'green' : 'default'}>
              {hasRedemptions ? 'Redeemed' : 'Not Redeemed'}
            </Tag>
            {hasRedemptions && (
              <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
                {record.scannedCodes} {record.scannedCodes === 1 ? 'scan' : 'scans'}
              </div>
            )}
          </div>
        );
      },
      sorter: (a, b) => {
        return a.scannedCodes - b.scannedCodes;
      },
      sortDirections: ['ascend', 'descend'],
    },
    
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="Reset this user's data?"
            description="This will clear scans, entries, redemptions, and dates."
            okText="Reset"
            okType="danger"
            icon={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
            onConfirm={() => handleResetUser(record.id)}
          >
            <Button danger icon={<ReloadOutlined />} loading={loading}>
              Reset
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [currentPage, currentPageSize]);

  const renderUsers = () => (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <UserOutlined style={{ color: '#667eea' }} />
          User Management
        </Title>
        <Text type="secondary">
          Manage and view detailed user information, scan progress, and redemption status
        </Text>
        {userData.length > 0 && (
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Last updated: {new Date().toLocaleString()} • {userData.length} total users
          </Text>
        )}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Input
              placeholder="Search by name, email, phone, or ID..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: '100%' }}
              placeholder="Filter by status"
            >
              <Select.Option value="all">All Users ({userData.length})</Select.Option>
              <Select.Option value="active">Active ({stats.activeUsers})</Select.Option>
              <Select.Option value="completed">Completed ({stats.completedUsers})</Select.Option>
              <Select.Option value="redeemed">Has Redemptions</Select.Option>
              <Select.Option value="inactive">Inactive</Select.Option>
            </Select>
          </Col>
          <Col xs={24} md={10}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadUserData}
                loading={loading}
                type="default"
              >
                Refresh (Manual)
              </Button>
              <Switch
                checked={isAutoRefreshEnabledOverview}
                onChange={checked => setIsAutoRefreshEnabledOverview(checked)}
                checkedChildren="Auto Refresh ON"
                unCheckedChildren="Auto Refresh OFF"
              />
            </Space>
          </Col>
        </Row>

        <Row style={{ marginTop: 16 }}>
          <Col span={24}>
            <Space style={{ float: 'right' }}>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={exportToCSV}
                disabled={filteredData.length === 0}
              >
                Export CSV ({filteredData.length} records)
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{
            total: filteredData.length,
            pageSize: currentPageSize,
            current: currentPage,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
            onChange: (page, pageSize) => {
              setCurrentPage(page);
              setCurrentPageSize(pageSize);
            },
          }}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>
    </div>
  );

  const renderTierStats = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Completion Rate"
              value={Math.round((stats.completedUsers / stats.totalUsers) * 100)}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Average Progress"
                value={stats.averageProgress}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Users Redeemed"
              value={stats.usersWithRedemptions}
              prefix={<GiftOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={24}>
            <Card title="Tier Distribution" extra={<TrophyOutlined />}>
              <Table
                dataSource={[
                  { key: '1', tier: 'Wheel Spin', users: userData.filter(u => u.prizes.find(p => p.name === 'Wheel Spin')?.unlocked).length, color: '#52c41a' },
                  { key: '2', tier: 'Holofoil', users: userData.filter(u => u.prizes.find(p => p.name === 'Holofoil')?.unlocked).length, color: '#1890ff' },
                  { key: '3', tier: 'OV Pack', users: userData.filter(u => u.prizes.find(p => p.name === 'OV Pack')?.unlocked).length, color: '#faad14' },
                  { key: '4', tier: 'IE Pack', users: userData.filter(u => u.prizes.find(p => p.name === 'IE Pack')?.unlocked).length, color: '#eb2f96' },
                  { key: '5', tier: 'Custom Card', users: userData.filter(u => u.prizes.find(p => p.name === 'Custom Card')?.unlocked).length, color: '#722ed1' },
                ]}
                columns={[
                  {
                    title: 'Tier',
                    dataIndex: 'tier',
                    key: 'tier',
                    render: (text, record) => (
                      <Space>
                        <TrophyOutlined style={{ color: record.color }} />
                        <Tag color={record.color}>{text}</Tag>
                      </Space>
                    ),
                  },
                  {
                    title: 'Users Unlocked',
                    dataIndex: 'users',
                    key: 'users',
                  },
                  {
                    title: 'Distribution',
                    dataIndex: 'users',
                    key: 'percentage',
                    render: (users, record) => (
                      <Progress percent={Math.round((users / stats.totalUsers) * 100)} strokeColor={record.color} size="small" />
                    ),
                  },
                ]}
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
          <Col xs={24} lg={24}>
            <LocationPerformance userData={userData} refreshTrigger={analyticsRefreshTrigger} />
          </Col>
        </Row>
      </div>
  );

  const renderOverview = () => (
    <div>
      {error && (
        <Alert
          message="Error Loading Data"
          description={error}
          type="error"
          closable
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" danger onClick={loadUserData}>
              Retry
            </Button>
          }
        />
      )}

      <Card style={{ marginBottom: 24 }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'stretch' : 'flex-start', 
          gap: isMobile ? 16 : 0,
          marginBottom: 16 
        }}>
          <div>
            <Title level={2} style={{ 
              margin: 0, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              fontSize: isMobile ? '18px' : '24px'
            }}>
              <DashboardOutlined style={{ color: '#667eea' }} />
              Pax2025 Analytics Dashboard
            </Title>
            <Text type="secondary">
              Comprehensive analytics and insights for the Pax2025 campaign
            </Text>
            {userData.length > 0 && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Last updated: {new Date().toLocaleString()} • {userData.length} total users
              </Text>
            )}
          </div>
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'center',
            flexWrap: isMobile ? 'wrap' : 'nowrap'
          }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadUserData}
              loading={loading}
              type="default"
              size={isMobile ? 'small' : 'default'}
            >
              Refresh Data
            </Button>
            <Switch
              checked={isAutoRefreshEnabledOverview}
              onChange={checked => setIsAutoRefreshEnabledOverview(checked)}
              checkedChildren="Auto ON"
              unCheckedChildren="Auto OFF"
              size="small"
            />
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Total number of unique users registered in the system.">
              <Statistic
                title="Total Users"
                value={stats.totalUsers}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Number of users who have scanned at least one QR code.">
              <Statistic
                title="Active Users"
                value={stats.activeUsers}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#52c41a' }}
                suffix={`/ ${stats.totalUsers}`}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Number of users who completed all 18 codes within 5 minutes of their first scan.">
              <Statistic
                title="Completed < 5 Mins"
                value={stats.completedIn5Minutes}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Total grand prize entries accumulated by all users (scan entries + bonus entries).">
              <Statistic
                title="Total Entries"
                value={stats.totalEntries}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Number of users who have redeemed at least one prize.">
              <Statistic
                title="Redemptions"
                value={stats.usersWithRedemptions}
                prefix={<GiftOutlined />}
                valueStyle={{ color: '#eb2f96' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Average progress (percentage of codes scanned) across all users.">
              <Statistic
                title="Avg Progress"
                value={stats.averageProgress}
                suffix="%"
                valueStyle={{ color: '#722ed1' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Number of users who have redeemed every available prize tier.">
              <Statistic
                title="All Redemptions"
                value={stats.allRedemptionsUsersCount}
                prefix={<CheckSquareOutlined />}
                valueStyle={{ color: '#90d402' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Users who registered but never scanned a code.">
              <Statistic
                title="Bounce Rate"
                value={stats.bounceRate}
                suffix="%"
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Peak activity hour of the day.">
              <Statistic
                title="Peak Hour"
                value={`${stats.peakHour}:00`}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
                suffix={`(${stats.peakHourCount} users)`}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Users who completed all codes suspiciously fast (under 2 minutes).">
              <Statistic
                title="Suspicious Activity"
                value={stats.suspiciousActivity.count}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: stats.suspiciousActivity.count > 0 ? '#ff4d4f' : '#52c41a' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Tooltip title="Users with incomplete profile information (missing email or phone).">
              <Statistic
                title="Incomplete Profiles"
                value={stats.dataQuality.incompleteProfiles}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#faad14' }}
                suffix={`/ ${stats.totalUsers}`}
              />
            </Tooltip>
          </Card>
        </Col>
      </Row>

      {/* User Journey & Conversion Funnel */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="User Journey Funnel" extra={<PercentageOutlined />}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ 
                  background: 'linear-gradient(90deg, #1890ff 0%, #40a9ff 100%)', 
                  color: 'white', 
                  padding: '16px', 
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.totalUsers}</div>
                  <div>Total Registrations</div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>100%</div>
                </div>
                
                <div style={{ 
                  background: 'linear-gradient(90deg, #52c41a 0%, #73d13d 100%)', 
                  color: 'white', 
                  padding: '16px', 
                  borderRadius: '8px',
                  textAlign: 'center',
                  marginLeft: '10%',
                  width: '90%'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{stats.activeUsers}</div>
                  <div>Started Scanning</div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%
                  </div>
                </div>
                
                <div style={{ 
                  background: 'linear-gradient(90deg, #faad14 0%, #ffc53d 100%)', 
                  color: 'white', 
                  padding: '16px', 
                  borderRadius: '8px',
                  textAlign: 'center',
                  marginLeft: '20%',
                  width: '80%'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{stats.engagementStats.moderate + stats.engagementStats.nearComplete}</div>
                  <div>Moderate to High Engagement</div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    {stats.totalUsers > 0 ? Math.round(((stats.engagementStats.moderate + stats.engagementStats.nearComplete) / stats.totalUsers) * 100) : 0}%
                  </div>
                </div>
                
                <div style={{ 
                  background: 'linear-gradient(90deg, #722ed1 0%, #9254de 100%)', 
                  color: 'white', 
                  padding: '16px', 
                  borderRadius: '8px',
                  textAlign: 'center',
                  marginLeft: '30%',
                  width: '70%'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{stats.completedUsers}</div>
                  <div>Completed All Codes</div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    {stats.totalUsers > 0 ? Math.round((stats.completedUsers / stats.totalUsers) * 100) : 0}%
                  </div>
                </div>
                
                <div style={{ 
                  background: 'linear-gradient(90deg, #eb2f96 0%, #f759ab 100%)', 
                  color: 'white', 
                  padding: '16px', 
                  borderRadius: '8px',
                  textAlign: 'center',
                  marginLeft: '40%',
                  width: '60%'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{stats.usersWithRedemptions}</div>
                  <div>Made Redemptions</div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    {stats.totalUsers > 0 ? Math.round((stats.usersWithRedemptions / stats.totalUsers) * 100) : 0}%
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="Campaign Performance Metrics" extra={<TrophyOutlined />}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" style={{ background: '#f6ffed' }}>
                  <Statistic
                    title="Conversion Rate"
                    value={stats.totalUsers > 0 ? Math.round((stats.completedUsers / stats.totalUsers) * 100) : 0}
                    suffix="%"
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<PercentageOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Registration → Completion
                  </Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: '#fff7e6' }}>
                  <Statistic
                    title="Engagement Rate"
                    value={stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}
                    suffix="%"
                    valueStyle={{ color: '#faad14' }}
                    prefix={<UserOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Registration → First Scan
                  </Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: '#f0f5ff' }}>
                  <Statistic
                    title="Redemption Rate"
                    value={stats.completedUsers > 0 ? Math.round((stats.usersWithRedemptions / stats.completedUsers) * 100) : 0}
                    suffix="%"
                    valueStyle={{ color: '#1890ff' }}
                    prefix={<GiftOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Completion → Redemption
                  </Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: '#f9f0ff' }}>
                  <Statistic
                    title="Quality Score"
                    value={stats.totalUsers > 0 ? Math.round(((stats.totalUsers - stats.dataQuality.incompleteProfiles) / stats.totalUsers) * 100) : 0}
                    suffix="%"
                    valueStyle={{ color: '#722ed1' }}
                    prefix={<CheckSquareOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Complete Profiles
                  </Text>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="User Engagement Funnel" extra={<PercentageOutlined />}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Bounced (0 codes)</span>
                  <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>{stats.engagementStats.bounced} ({Math.round((stats.engagementStats.bounced / stats.totalUsers) * 100)}%)</span>
                </div>
                <Progress percent={Math.round((stats.engagementStats.bounced / stats.totalUsers) * 100)} strokeColor="#ff4d4f" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Early Dropoff (1-5 codes)</span>
                  <span style={{ fontWeight: 'bold', color: '#fa8c16' }}>{stats.engagementStats.earlyDropoff} ({Math.round((stats.engagementStats.earlyDropoff / stats.totalUsers) * 100)}%)</span>
                </div>
                <Progress percent={Math.round((stats.engagementStats.earlyDropoff / stats.totalUsers) * 100)} strokeColor="#fa8c16" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Moderate (6-12 codes)</span>
                  <span style={{ fontWeight: 'bold', color: '#fadb14' }}>{stats.engagementStats.moderate} ({Math.round((stats.engagementStats.moderate / stats.totalUsers) * 100)}%)</span>
                </div>
                <Progress percent={Math.round((stats.engagementStats.moderate / stats.totalUsers) * 100)} strokeColor="#fadb14" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Near Complete (13-17 codes)</span>
                  <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{stats.engagementStats.nearComplete} ({Math.round((stats.engagementStats.nearComplete / stats.totalUsers) * 100)}%)</span>
                </div>
                <Progress percent={Math.round((stats.engagementStats.nearComplete / stats.totalUsers) * 100)} strokeColor="#1890ff" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Completed (18 codes)</span>
                  <span style={{ fontWeight: 'bold', color: '#52c41a' }}>{stats.engagementStats.completed} ({Math.round((stats.engagementStats.completed / stats.totalUsers) * 100)}%)</span>
                </div>
                <Progress percent={Math.round((stats.engagementStats.completed / stats.totalUsers) * 100)} strokeColor="#52c41a" />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Completion Time Distribution" extra={<ClockCircleOutlined />}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Under 5 minutes</span>
                  <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>{stats.completionTimeStats.under5min}</span>
                </div>
                <Progress percent={stats.completedUsers > 0 ? Math.round((stats.completionTimeStats.under5min / stats.completedUsers) * 100) : 0} strokeColor="#ff4d4f" size="small" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>5-30 minutes</span>
                  <span style={{ fontWeight: 'bold', color: '#fa8c16' }}>{stats.completionTimeStats.under30min}</span>
                </div>
                <Progress percent={stats.completedUsers > 0 ? Math.round((stats.completionTimeStats.under30min / stats.completedUsers) * 100) : 0} strokeColor="#fa8c16" size="small" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>30 minutes - 1 hour</span>
                  <span style={{ fontWeight: 'bold', color: '#fadb14' }}>{stats.completionTimeStats.under1hour}</span>
                </div>
                <Progress percent={stats.completedUsers > 0 ? Math.round((stats.completionTimeStats.under1hour / stats.completedUsers) * 100) : 0} strokeColor="#fadb14" size="small" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>1-6 hours</span>
                  <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{stats.completionTimeStats.under6hours}</span>
                </div>
                <Progress percent={stats.completedUsers > 0 ? Math.round((stats.completionTimeStats.under6hours / stats.completedUsers) * 100) : 0} strokeColor="#1890ff" size="small" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>Over 6 hours</span>
                  <span style={{ fontWeight: 'bold', color: '#52c41a' }}>{stats.completionTimeStats.over6hours}</span>
                </div>
                <Progress percent={stats.completedUsers > 0 ? Math.round((stats.completionTimeStats.over6hours / stats.completedUsers) * 100) : 0} strokeColor="#52c41a" size="small" />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Data Quality Overview" extra={<TeamOutlined />}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Missing Email"
                  value={stats.dataQuality.missingEmail}
                  valueStyle={{ color: stats.dataQuality.missingEmail > 0 ? '#ff4d4f' : '#52c41a' }}
                  suffix={`/ ${stats.totalUsers}`}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Missing Phone"
                  value={stats.dataQuality.missingPhone}
                  valueStyle={{ color: stats.dataQuality.missingPhone > 0 ? '#ff4d4f' : '#52c41a' }}
                  suffix={`/ ${stats.totalUsers}`}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Missing Shopify ID"
                  value={stats.dataQuality.missingShopifyId}
                  valueStyle={{ color: stats.dataQuality.missingShopifyId > 0 ? '#faad14' : '#52c41a' }}
                  suffix={`/ ${stats.totalUsers}`}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Complete Profiles"
                  value={stats.totalUsers - stats.dataQuality.incompleteProfiles}
                  valueStyle={{ color: '#52c41a' }}
                  suffix={`/ ${stats.totalUsers}`}
                />
              </Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                Data Quality Score: {stats.totalUsers > 0 ? Math.round(((stats.totalUsers - stats.dataQuality.incompleteProfiles) / stats.totalUsers) * 100) : 0}%
              </Text>
              <Progress 
                percent={stats.totalUsers > 0 ? Math.round(((stats.totalUsers - stats.dataQuality.incompleteProfiles) / stats.totalUsers) * 100) : 0} 
                strokeColor="#52c41a" 
                size="small" 
                style={{ marginTop: 8 }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Suspicious Activity & Quality Issues */}
      {(stats.suspiciousActivity.count > 0 || stats.dataQuality.incompleteProfiles > 0) && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {stats.suspiciousActivity.count > 0 && (
            <Col xs={24} lg={12}>
              <Card title="Suspicious Activity Alert" extra={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}>
                <Alert
                  message={`${stats.suspiciousActivity.count} users completed suspiciously fast`}
                  description="These users completed all 18 codes in under 2 minutes. Review for potential fraud."
                  type="warning"
                  style={{ marginBottom: 16 }}
                />
                <Table
                  dataSource={stats.suspiciousActivity.users.slice(0, 5)}
                  columns={[
                    {
                      title: 'User',
                      key: 'user',
                      render: (_, record) => (
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{record.name}</div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>{record.email}</Text>
                        </div>
                      ),
                    },
                    {
                      title: 'Completion Time',
                      key: 'time',
                      render: (_, record) => {
                        if (record.firstScanDate && record.completionDate) {
                          const diffMs = record.completionDate.getTime() - record.firstScanDate.getTime();
                          const diffSeconds = Math.round(diffMs / 1000);
                          return <Text style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{diffSeconds}s</Text>;
                        }
                        return 'N/A';
                      },
                    },
                  ]}
                  pagination={false}
                  size="small"
                  rowKey="id"
                />
                {stats.suspiciousActivity.count > 5 && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    +{stats.suspiciousActivity.count - 5} more suspicious accounts
                  </Text>
                )}
              </Card>
            </Col>
          )}
          
          <Col xs={24} lg={stats.suspiciousActivity.count > 0 ? 12 : 24}>
            <Card title="Data Quality Issues" extra={<TeamOutlined />}>
              <div style={{ marginBottom: 16 }}>
                <Alert
                  message={`${stats.dataQuality.incompleteProfiles} users have incomplete profiles`}
                  description="Missing email or phone information affects communication capabilities."
                  type="info"
                />
              </div>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#fff2e8', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                      {stats.dataQuality.missingEmail}
                    </div>
                    <div>Missing Email</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#fff2e8', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                      {stats.dataQuality.missingPhone}
                    </div>
                    <div>Missing Phone</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#f6ffed', borderRadius: '8px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                      {stats.totalUsers - stats.dataQuality.incompleteProfiles}
                    </div>
                    <div>Complete Profiles</div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        {isMobile ? <MobileHeader /> : <DesktopHeader />}
      </Header>

      <MobileMenu />
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'tiers' && renderTierStats()}
        {activeTab === 'tier-mgmt' && <TierManagement userData={userData} />}
        {activeTab === 'analytics' && <QRAnalytics userData={userData} onAnalyticsRecalculated={handleAnalyticsRecalculated} />}
        {activeTab === 'qr' && <QRCodeDisplay />}
      {/* Removed Prize and About tabs */}
      </Content>
    </Layout>
  );
};

export default AdminDashboard;