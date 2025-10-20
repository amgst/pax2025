import React from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  Tag, 
  Button, 
  Badge, 
  Space, 
  Typography 
} from 'antd';
import { 
  TrophyOutlined, 
  UserOutlined, 
  GiftOutlined, 
  CalendarOutlined 
} from '@ant-design/icons';

const { Title, Text } = Typography;

const TierManagement = ({ userData = [] }) => {
  const tierDetails = [
{
      id: 'tier1',
      required: 1,
      name: 'Wheel Spin', // Updated name
      description: 'Come by our booth (#272) to win your first prize!',
      color: '#52c41a',
      icon: '🎡'
    },
    {
      id: 'tier3',
      required: 3,
      name: 'Holofoil', // Updated name
      description: 'Get your copy of CONTRIVED, our convention exclusive holofoil!',
      color: '#1890ff',
      icon: '✨'
    },
    {
      id: 'tier6',
      required: 6,
      name: 'OV Pack', // Updated name
      description: 'Each pack includes 14 assorted game cards and 1 Mystery Holofoil!',
      color: '#faad14',
      icon: '📦'
    },
    {
      id: 'tier12',
      required: 12,
      name: 'IE Pack', 
      description: '7 Mystery Holofoils from our Imaginary Ends expansion!',
      color: '#eb2f96',
      icon: '🥇'
    },
    {
      id: 'tier18', // Updated required value (as per previous turn's discussion for consistency)
      required: 18,
      name: 'Custom Card', // Updated name
      description: 'Doomlings creator Justus Meyer will draw YOU as a Doomling...on an OFFICIAL Doomlings trait card...WITH his autograph!',
      color: '#722ed1',
      icon: '✍️'
    }
  ];

  const getTierStats = (tierId, required) => {
    const eligible = userData.filter(u => u.scannedCodes >= required).length;
    const redeemed = userData.filter(u => u.prizes.find(p => p.id === tierId)?.redeemed).length;
    const pending = eligible - redeemed;
    
    return { eligible, redeemed, pending };
  };

  const stats = {
    averageProgress: userData.length > 0 ? 
      Math.round(userData.reduce((sum, u) => sum + (u.scannedCodes / u.totalCodes * 100), 0) / userData.length) : 0
  };

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <TrophyOutlined style={{ color: '#667eea' }} />
          Tier Management
        </Title>
        <Text type="secondary">
          Scavenger Hunt Reward Tiers & Redemption Status
        </Text>
      </Card>

      <Row gutter={[16, 16]}>
        {tierDetails.map((tier, index) => {
          const tierStats = getTierStats(tier.id, tier.required);
          const eligibilityRate = userData.length > 0 ? Math.round((tierStats.eligible / userData.length) * 100) : 0;
          const redemptionRate = tierStats.eligible > 0 ? Math.round((tierStats.redeemed / tierStats.eligible) * 100) : 0;

          return (
            <Col xs={24} lg={12} xl={8} key={tier.id}>
              <Card
                hoverable
                style={{ 
                  height: '100%',
                  borderLeft: `4px solid ${tier.color}`,
                  position: 'relative'
                }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{tier.icon}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {tier.name}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Requires {tier.required} codes • Tier {index + 1}
                      </Text>
                    </div>
                  </div>
                }
                extra={
                  <Tag color={tier.color} style={{ borderRadius: 12 }}>
                    {tier.required} codes
                  </Tag>
                }
              >
                <div style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: '#666' }}>
                    {tier.description}
                  </Text>
                </div>

                <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Statistic
                      title="Eligible"
                      value={tierStats.eligible}
                      valueStyle={{ fontSize: 18, color: tier.color }}
                    />
                    <Progress
                      percent={eligibilityRate}
                      size="small"
                      strokeColor={tier.color}
                      showInfo={false}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {eligibilityRate}% of users
                    </Text>
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Redeemed"
                      value={tierStats.redeemed}
                      valueStyle={{ fontSize: 18, color: '#52c41a' }}
                    />
                    <Progress
                      percent={redemptionRate}
                      size="small"
                      strokeColor="#52c41a"
                      showInfo={false}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {redemptionRate}% redeemed
                    </Text>
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Pending"
                      value={tierStats.pending}
                      valueStyle={{ 
                        fontSize: 18, 
                        color: tierStats.pending > 0 ? '#faad14' : '#d9d9d9' 
                      }}
                    />
                    <div style={{ height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, marginTop: 8 }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${tierStats.pending > 0 ? Math.min((tierStats.pending / tierStats.eligible) * 100, 100) : 0}%`,
                          backgroundColor: '#faad14',
                          borderRadius: 3
                        }}
                      />
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      awaiting pickup
                    </Text>
                  </Col>
                </Row>


              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="Overall Tier Performance">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={6}>
                <Statistic
                  title="Total Eligible Users"
                  value={userData.filter(u => u.scannedCodes >= 1).length}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Statistic
                  title="Total Redemptions"
                  value={userData.reduce((sum, u) => sum + u.totalRedemptions, 0)}
                  prefix={<GiftOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Statistic
                  title="Pending Pickups"
                  value={tierDetails.reduce((sum, tier) => {
                    const tierStats = getTierStats(tier.id, tier.required);
                    return sum + tierStats.pending;
                  }, 0)}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col xs={24} sm={6}>
                <Statistic
                  title="Average Progress"
                  value={stats.averageProgress}
                  suffix="%"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TierManagement;