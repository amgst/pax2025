import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  notification,
  Table,
  Space,
  Typography,
  Divider,
  Popconfirm,
  Tag,
  Alert,
  Spin, // Import Spin for loading indicator
  Switch, // Import Switch for auto-refresh
  Input, // Keep Input if used elsewhere, or remove if only InputNumber is needed
  InputNumber, // Import InputNumber directly for number input component
  Tooltip // Import Tooltip
} from 'antd';
import {
  GiftOutlined,
  UserOutlined,
  CalculatorOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CrownOutlined,
  HistoryOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import firebaseService from '../services/firebase'; // Import firebaseService

const { Title, Text } = Typography;

const GrandPrize = ({ userData = [] }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyWinner, setDailyWinner] = useState(null); // To display today's winner after selection - now an array
  const [winnerHistory, setWinnerHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isAutoRefreshEnabledGrandPrize, setIsAutoRefreshEnabledGrandPrize] = useState(false); // New state for auto-refresh
  const [numWinnersToPick, setNumWinnersToPick] = useState(1); // State for number of winners to pick
  const [selectedWinnersThisRound, setSelectedWinnersThisRound] = useState([]); // To display multiple winners selected in one go


  // Initialize Firebase (utility function)
  const initFirebase = async () => {
    if (!window.firebase) return null; // Return null if firebase is not loaded
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(window.dgshFirebaseConfig);
    }
    return window.firebase.firestore();
  };

  // Function to load and process entries from userData
  const loadEntries = () => {
    setLoading(true);
    const allEntries = [];
    userData.forEach(user => {
      const drawingEntries = typeof user.drawingEntries === 'number' ? user.drawingEntries : 0;
      const bonusEntries = typeof user.drawingBonusEntries === 'number' ? user.drawingBonusEntries : 0;

      for (let i = 0; i < drawingEntries; i++) {
        allEntries.push({
          key: `${user.id}-scan-${i}`,
          entryNum: allEntries.length + 1,
          name: user.name,
          email: user.email || 'N/A',
          phone: user.phone || 'N/A',
          shopifyId: user.shopifyId || '',
          type: 'Scan',
          userId: user.id
        });
      }
      for (let i = 0; i < bonusEntries; i++) {
        allEntries.push({
          key: `${user.id}-bonus-${i}`,
          entryNum: allEntries.length + 1,
          name: user.name,
          email: user.email || 'N/A',
          phone: user.phone || 'N/A',
          shopifyId: user.shopifyId || '',
          type: 'Bonus',
          userId: user.id
        });
      }
    });
    setEntries(allEntries);
    setLoading(false);
  };


  // Effect to load userData into drawing entries and load winner history
  useEffect(() => {
    loadEntries(); // Load entries when userData changes
    loadWinnerHistory(); // Load winner history on component mount/userData change
  }, [userData]); // Re-run when userData changes


  // Effect for auto-refresh functionality
  useEffect(() => {
    let intervalId;
    if (isAutoRefreshEnabledGrandPrize) {
      // Refresh entries every 2 minutes (120,000 milliseconds)
      intervalId = setInterval(loadEntries, 2 * 60 * 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoRefreshEnabledGrandPrize, userData]); // Depend on auto-refresh state and userData (if userData changes, we might need to re-evaluate entries for auto-refresh)


  const loadWinnerHistory = async () => {
    setHistoryLoading(true);
    try {
      const firestoreDb = await initFirebase();
      if (!firestoreDb) {
        throw new Error('Firebase not initialized');
      }

      const snapshot = await firestoreDb.collection('daily_winners')
        .orderBy('dateTimestamp', 'desc')
        .limit(30)
        .get();

      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        drawDate: doc.data().dateTimestamp?.toDate()?.toLocaleString() || doc.data().date || 'Unknown Date',
        name: doc.data().winner?.displayName || doc.data().winner?.name || 'Anonymous',
        email: doc.data().winner?.email || 'N/A',
        phone: doc.data().winner?.phone || 'N/A', // Ensure phone is extracted
        entryType: doc.data().entryType || 'N/A'
      }));
      setWinnerHistory(history);
    } catch (error) {
      console.error('Error loading winner history:', error);
      notification.error({
        message: 'Error',
        description: error.message || 'Failed to load winner history.'
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  /**
   * Handles the selection and saving of one or more daily winners.
   */
  const handleSelectWinner = async () => {
    if (entries.length === 0) {
      notification.warning({
        message: 'No Entries',
        description: 'There are no entries to select a winner from.'
      });
      return;
    }
    if (numWinnersToPick <= 0) {
      notification.warning({
        message: 'Invalid Number of Winners',
        description: 'Please enter a number greater than 0.'
      });
      return;
    }

    setLoading(true);
    try {
      const firestoreDb = await initFirebase();
      if (!firestoreDb) {
        throw new Error('Firebase not initialized');
      }

      const pastWinnerUserIds = new Set(winnerHistory.map(winner => winner.userId));
      const selectedWinners = [];
      const pickedUserIdsInCurrentBatch = new Set();
      const batch = firestoreDb.batch();

      for (let i = 0; i < numWinnersToPick; i++) {
        let currentEligibleEntries = entries.filter(entry =>
          !pastWinnerUserIds.has(entry.userId) && !pickedUserIdsInCurrentBatch.has(entry.userId)
        );

        if (currentEligibleEntries.length === 0) {
          notification.info({
            message: 'No More Eligible Participants',
            description: `Selected ${selectedWinners.length} winner(s). No more unique eligible participants with entries.`,
            duration: 8
          });
          break; // Stop if no more eligible entries
        }

        const randomIndex = Math.floor(Math.random() * currentEligibleEntries.length);
        const winningEntry = currentEligibleEntries[randomIndex];

        const winnerDataToSave = {
          date: new Date().toDateString(),
          dateTimestamp: window.firebase.firestore.Timestamp.fromDate(new Date()),
          winner: {
            displayName: winningEntry.name,
            email: winningEntry.email,
            phone: winningEntry.phone,
            shopifyId: winningEntry.shopifyId
          },
          userId: winningEntry.userId,
          entryNumber: winningEntry.entryNum,
          totalEntries: entries.length, // Total entries before filtering for eligibility
          entryType: winningEntry.type,
          timestamp: window.firebase.firestore.FieldValue.serverTimestamp()
        };

        const winnerDocRef = firestoreDb.collection('daily_winners').doc(); // Create a new document for each winner
        batch.set(winnerDocRef, winnerDataToSave);

        selectedWinners.push(winningEntry);
        pickedUserIdsInCurrentBatch.add(winningEntry.userId);
      }

      if (selectedWinners.length > 0) {
        await batch.commit();

        setSelectedWinnersThisRound(selectedWinners); // Update state with multiple winners

        notification.success({
          message: `Selected ${selectedWinners.length} Winner(s)!`,
          description: `Congratulations to: ${selectedWinners.map(w => w.name).join(', ')}!`,
          duration: 8
        });

        loadWinnerHistory(); // Reload history to show the newly selected winners
      } else {
        notification.info({
          message: 'No Winners Selected',
          description: 'No new unique eligible participants available or number of winners to pick was 0.',
          duration: 5
        });
      }

    } catch (error) {
      console.error('Error selecting or saving daily winner:', error);
      notification.error({
        message: 'Error Selecting Winner',
        description: error.message || 'Failed to select and save winner.'
      });
    } finally {
      setLoading(false);
    }
  };

  const exportEntriesToCSV = () => {
    if (entries.length === 0) {
      notification.warning({
        message: 'No Data',
        description: 'No drawing entries available to export.'
      });
      return;
    }

    const headers = [
      'Entry #', 'Name', 'Email', 'Phone', 'Shopify ID', 'Entry Type'
    ];

    const csvData = [
      headers.join(','),
      ...entries.map(entry =>
        [
          `"${entry.entryNum}"`,
          `"${entry.name}"`,
          `"${entry.email}"`,
          `"${entry.phone}"`,
          `"${entry.shopifyId || ''}"`,
          `"${entry.type}"`
        ].join(',')
      )
    ].join('\n');

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `grand-prize-entries-export-${dateStr}-${timeStr}.csv`;

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
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
      description: `Exported ${csvData.length} drawing entries to CSV`
    });
  };

  const previewColumns = [
    { title: 'Entry #', dataIndex: 'entryNum', key: 'entryNum', width: 100 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (type) => <Tag color={type === 'Bonus' ? 'orange' : 'blue'}>{type}</Tag> },
  ];

  const historyColumns = [
    { title: 'Draw Date', dataIndex: 'drawDate', key: 'drawDate' },
    { title: 'Winner Name', dataIndex: 'name', key: 'name' },
    { title: 'Winner Email', dataIndex: 'email', key: 'email' },
    { title: 'Winner Phone', dataIndex: 'phone', key: 'phone' }, // New column for winner phone
    { title: 'Entry Type', dataIndex: 'entryType', key: 'entryType' },
  ];

  const stats = useMemo(() => {
    const totalEntries = entries.length;
    const uniqueParticipants = new Set(entries.map(entry => entry.email)).size;
    const avgEntriesPerUser = uniqueParticipants > 0 ? (totalEntries / uniqueParticipants).toFixed(1) : 0;

    return {
      totalEntries,
      uniqueParticipants,
      avgEntriesPerUser
    };
  }, [entries]);

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <GiftOutlined style={{ color: '#eb2f96' }} />
          Grand Prize Drawing Entries
        </Title>
        <Text type="secondary">
          Export drawing entries for the daily $250 gift card giveaway. Each scan = 1 entry, plus bonus entries for reward redemptions.
        </Text>
        <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px', fontStyle: 'italic', color: '#888' }}>
          Note: The same person may appear multiple times in the entries list, as each appearance represents a unique drawing entry (or 'ticket') they've accumulated.
        </Text>
      </Card>

      {/* Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Tooltip title="The total number of entries (tickets) accumulated by all participants for the grand prize drawing. Each scan provides 1 entry, plus bonus entries for reward redemptions.">
              <Statistic
                title="Total Entries"
                value={stats.totalEntries}
                prefix={<CalculatorOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Tooltip title="The total number of unique individuals (based on email address) who have at least one entry in the grand prize drawing.">
              <Statistic
                title="Participants"
                value={stats.uniqueParticipants}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Tooltip title="The average number of grand prize entries each unique participant has accumulated (Total Entries / Unique Participants).">
              <Statistic
                title="Avg Entries/Person"
                value={stats.avgEntriesPerUser}
                precision={1}
                prefix={<CalculatorOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Tooltip>
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          <InputNumber // Changed from Input.Number to InputNumber
            min={1}
            value={numWinnersToPick}
            onChange={setNumWinnersToPick}
            style={{ width: 80, marginRight: 8 }}
            disabled={loading}
            controls={false} // Hide default controls for a cleaner look
          />
          <Button
            type="primary"
            icon={<CrownOutlined />}
            onClick={handleSelectWinner}
            loading={loading}
            disabled={entries.length === 0}
          >
            Select Daily Winner ({numWinnersToPick})
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={exportEntriesToCSV}
            disabled={entries.length === 0}
          >
            Export All Entries (CSV)
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadEntries} // Call loadEntries directly for manual refresh
          >
            Refresh Entries (Manual)
          </Button>
          <Switch
            checked={isAutoRefreshEnabledGrandPrize}
            onChange={checked => setIsAutoRefreshEnabledGrandPrize(checked)}
            checkedChildren="Auto Refresh ON"
            unCheckedChildren="Auto Refresh OFF"
          />
        </Space>
      </Card>

      {/* Daily Winner Display */}
      {selectedWinnersThisRound.length > 0 && ( // Changed from dailyWinner to selectedWinnersThisRound
        <Alert
          message={`Today's Winner(s)! (${selectedWinnersThisRound.length} selected)`}
          description={
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {selectedWinnersThisRound.map((winner, index) => (
                <li key={index} style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  🎉 {winner.name} ({winner.email}) {winner.phone && `(${winner.phone})`} 🎉
                </li>
              ))}
            </ul>
          }
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Preview List */}
      <Card title="Preview (First 10 Entries)" style={{ marginBottom: 24 }}>
        <Table
          dataSource={entries.slice(0, 10)}
          columns={previewColumns}
          loading={loading}
          pagination={false}
          size="small"
          rowKey="key"
        />
        {entries.length > 10 && (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>
            ... showing first 10 entries out of {entries.length} total.
          </Text>
        )}
        {entries.length === 0 && !loading && (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>
            No entries found.
          </Text>
        )}
      </Card>

      {/* Winner History */}
      <Card title="Past Winners History" style={{ marginBottom: 24 }}>
        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
            <p style={{ marginTop: 8 }}>Loading winner history...</p>
          </div>
        ) : winnerHistory.length > 0 ? (
          <Table
            dataSource={winnerHistory} // Display most recent first (already sorted by query)
            columns={historyColumns}
            pagination={{ pageSize: 5 }}
            size="small"
            rowKey="id" // Use Firestore document ID as key
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <HistoryOutlined style={{ fontSize: '32px', color: '#d9d9d9', marginBottom: '8px' }} />
            <Text type="secondary" style={{ display: 'block' }}>No past winners recorded yet.</Text>
          </div>
        )}
        {winnerHistory.length > 0 && (
          <Popconfirm
            title="Are you sure you want to clear all winner history?"
            onConfirm={async () => {
              // Clear history from Firestore
              try {
                const firestoreDb = await initFirebase();
                if (!firestoreDb) {
                  throw new Error('Firebase not initialized');
                }
                const dailyWinnersCollectionRef = firestoreDb.collection('daily_winners');
                const snapshot = await dailyWinnersCollectionRef.get();
                const batch = firestoreDb.batch();
                snapshot.docs.forEach(doc => {
                  batch.delete(doc.ref);
                });
                await batch.commit();
                setWinnerHistory([]); // Clear local state
                notification.info({
                  message: 'History Cleared',
                  description: 'All past winner records have been removed from Firestore.'
                });
              } catch (error) {
                notification.error({
                  message: 'Error Clearing History',
                  description: error.message
                });
              }
            }}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger style={{ marginTop: 16 }}>Clear History</Button>
          </Popconfirm>
        )}
      </Card>
    </div>
  );
};

export default GrandPrize;