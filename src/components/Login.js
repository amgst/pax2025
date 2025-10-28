import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Alert, 
  Typography, 
  Space,
  Divider 
} from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  LoginOutlined,
  DashboardOutlined 
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '' });

  // Predefined login credentials
  const validCredentials = [
    { username: 'admin', password: 'dgsh2024!', role: 'Admin' }
  ];

  const handleLoginClick = () => {
    if (!form.username || !form.password) {
      setError('Please enter both username and password');
      return;
    }
    handleLogin({ username: form.username, password: form.password });
  };

  const handleLogin = async (values) => {
    setLoading(true);
    setError('');

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { username, password } = values;
    const validUser = validCredentials.find(
      cred => cred.username === username && cred.password === password
    );

    if (validUser) {
      // Store user info in localStorage
      localStorage.setItem('dgsh_user', JSON.stringify({
        username: validUser.username,
        role: validUser.role,
        loginTime: new Date().toISOString()
      }));
      
      onLogin(validUser);
    } else {
      setError('Invalid username or password');
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Card 
        style={{ 
          width: '100%', 
          maxWidth: 400, 
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <DashboardOutlined 
            style={{ 
              fontSize: 48, 
              color: '#667eea', 
              marginBottom: 16 
            }} 
          />
          <Title level={2} style={{ margin: 0, color: '#262626' }}>
            Pax2025 Admin Dashboard
          </Title>
          <Text type="secondary">
            Pax2025 Administration
          </Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Username</Text>
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Enter username"
              value={form.username}
              onChange={(e) => setForm({...form, username: e.target.value})}
              size="large"
              style={{ marginTop: 4 }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <Text strong>Password</Text>
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Enter password"
              value={form.password}
              onChange={(e) => setForm({...form, password: e.target.value})}
              size="large"
              style={{ marginTop: 4 }}
              onPressEnter={handleLoginClick}
            />
          </div>

          <Button
            type="primary"
            loading={loading}
            block
            icon={<LoginOutlined />}
            onClick={handleLoginClick}
            style={{
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              border: 'none',
              height: 45
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </div>

        <Divider />

        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 6 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Admin Credentials:
          </Text>
          <Text code>admin / dgsh2024!</Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;