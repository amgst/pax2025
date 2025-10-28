import React from 'react';
import { Card, Typography, Table, Divider } from 'antd'; // Import Divider
import { InfoCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const About = () => {
  // Data for the Reward Tiers table
  const rewardTiersData = [
    { key: '1', scan: '1st Scan', reward: 'Spin the Wheel of Doom', regular: 1, bonus: 0, total: 1 },
    { key: '2', scan: '2nd Scan', reward: '', regular: 1, bonus: 0, total: 2 },
    { key: '3', scan: '3rd Scan', reward: 'Con Exclusive Holofoil', regular: 1, bonus: 2, total: 5 },
    { key: '4', scan: '4th Scan', reward: '', regular: 1, bonus: 0, total: 6 },
    { key: '5', scan: '5th Scan', reward: '', regular: 1, bonus: 0, total: 7 },
    { key: '6', scan: '6th Scan', reward: 'Overlush Mystery Pack', regular: 1, bonus: 7, total: 15 },
    { key: '7', scan: '7th Scan', reward: '', regular: 1, bonus: 0, total: 16 },
    { key: '8th', scan: '8th Scan', reward: '', regular: 1, bonus: 0, total: 17 },
    { key: '9th', scan: '9th Scan', reward: '', regular: 1, bonus: 0, total: 18 },
    { key: '10th', scan: '10th Scan', reward: '', regular: 1, bonus: 0, total: 19 },
    { key: '11th', scan: '11th Scan', reward: '', regular: 1, bonus: 0, total: 20 },
    { key: '12th', scan: '12th Scan', reward: 'Gold Pack', regular: 1, bonus: 14, total: 35 },
    { key: '13th', scan: '13th Scan', reward: '', regular: 1, bonus: 0, total: 36 },
    { key: '14th', scan: '14th Scan', reward: '', regular: 1, bonus: 0, total: 37 },
    { key: '15th', scan: '15th Scan', reward: '', regular: 1, bonus: 0, total: 38 },
    { key: '16th', scan: '16th Scan', reward: '', regular: 1, bonus: 0, total: 39 },
    { key: '17th', scan: '17th Scan', reward: '', regular: 1, bonus: 0, total: 40 },
    { key: '18th', scan: '18th Scan', reward: 'Custom Signed Card', regular: 1, bonus: 34, total: 75 },
  ];

  // Columns for the Reward Tiers table
  const rewardTiersColumns = [
    { title: 'Scan', dataIndex: 'scan', key: 'scan' },
    { title: 'Reward Unlocked', dataIndex: 'reward', key: 'reward' },
    { title: 'Regular Grand Prize Entries', dataIndex: 'regular', key: 'regular', align: 'center' },
    { title: 'Bonus Grand Prize Entries', dataIndex: 'bonus', key: 'bonus', align: 'center' },
    { title: 'Total Grand Prize Entries', dataIndex: 'total', key: 'total', align: 'center' },
  ];

  return (
    <Card>
      <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <InfoCircleOutlined style={{ color: '#667eea' }} />
        About This Project
      </Title>
      <Paragraph type="secondary">
        Information about the Pax2025 Dashboard.
      </Paragraph>

      <Divider />

      <Title level={4}>Project Overview</Title>
      <Paragraph>
        This dashboard provides administrative tools and analytics for Pax2025. It allows administrators to monitor user progress, view QR code analytics, manage reward tiers, and oversee the grand prize drawing.
      </Paragraph>
      <Paragraph>
        The scavenger hunt engages participants by having them scan QR codes located throughout the convention. As they scan more codes, they unlock various reward tiers and accumulate entries for a daily grand prize drawing.
      </Paragraph>

      <Title level={4}>Reward Tier & Grand Prize Entry Breakdown</Title>
      <Paragraph>
        Here is a breakdown of the reward tiers and how many entries in the $250 Daily Grand Prize a hunter earns at every scan:
      </Paragraph>
      <Table
        dataSource={rewardTiersData}
        columns={rewardTiersColumns}
        pagination={false}
        bordered
        size="small"
        summary={pageData => {
          const totalRegular = pageData.reduce((sum, current) => sum + current.regular, 0);
          const totalBonus = pageData.reduce((sum, current) => sum + current.bonus, 0);
          const totalOverall = pageData.reduce((sum, current) => sum + current.total, 0);
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <Text strong>Overall Totals</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="center">
                <Text strong>{totalRegular}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="center">
                <Text strong>{totalBonus}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="center">
                <Text strong>{totalOverall}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          );
        }}
      />

      <Divider />

      <Title level={4}>Data Sources</Title>
      <Paragraph>
        The dashboard pulls data directly from a Firebase Firestore database. Key collections include:
        <ul>
          <li><Text code>users</Text>: Stores individual participant data, including scanned codes, drawing entries, and redemption status.</li>
          <li><Text code>valid_codes</Text>: Contains information about all valid QR codes used in the hunt.</li>
          <li><Text code>daily_winners</Text>: Records historical data for daily grand prize winners.</li>
          <li><Text code>discovery_analytics</Text>: Stores aggregated statistics on how users discover the hunt (e.g., first scan location).</li>
          {/* FIX: Changed to wrap "statistics/summary" correctly in Text components */}
          <li><Text code>statistics</Text>/<Text code>summary</Text>: Contains pre-calculated overall summary statistics for quick dashboard loading.</li>
        </ul>
      </Paragraph>

      <Title level={4}>Development & Support</Title>
      <Paragraph>
        This dashboard is built using React and Ant Design, leveraging Firebase Firestore for its backend. For support or further development, please contact the development team.
      </Paragraph>
    </Card>
  );
};

export default About;
