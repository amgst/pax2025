import React, { useState, useEffect } from 'react';
import { Button, notification } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('dgsh_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        // Check if login is still valid (24 hours)
        const loginTime = new Date(userData.loginTime);
        const now = new Date();
        const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          setUser(userData);
        } else {
          localStorage.removeItem('dgsh_user');
        }
      } catch (error) {
        localStorage.removeItem('dgsh_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    notification.success({
      message: 'Login Successful',
      description: `Welcome back, ${userData.username}!`
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('dgsh_user');
    setUser(null);
    notification.info({
      message: 'Logged Out',
      description: 'You have been successfully logged out.'
    });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: 18 }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1000
      }}>
        <Button
          type="primary"
          danger
          icon={<LogoutOutlined />}
          onClick={handleLogout}
        >
          Logout ({user.username})
        </Button>
      </div>
      <AdminDashboard user={user} />
    </div>
  );
}

export default App;