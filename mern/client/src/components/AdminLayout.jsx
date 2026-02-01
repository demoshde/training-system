import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Layout, Menu, Avatar, Dropdown, Button, Typography, theme, Switch, Tooltip } from 'antd';
import {
  DashboardOutlined,
  BankOutlined,
  TeamOutlined,
  BookOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  SearchOutlined,
  NotificationOutlined,
  CommentOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined
} from '@ant-design/icons';
import { useState } from 'react';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const AdminLayout = ({ children, title }) => {
  const { admin, logout } = useAdminAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  const menuItems = [
    { key: '/admin', icon: <DashboardOutlined />, label: 'Хянах самбар' },
    { key: '/admin/check', icon: <SearchOutlined />, label: 'Ажилтан шалгах' },
    ...(admin?.role === 'super_admin' ? [{ key: '/admin/companies', icon: <BankOutlined />, label: 'Компани' }] : []),
    { key: '/admin/workers', icon: <TeamOutlined />, label: 'Ажилтан' },
    { key: '/admin/trainings', icon: <BookOutlined />, label: 'Сургалт' },
    { key: '/admin/enrollments', icon: <FileTextOutlined />, label: 'Бүртгэл' },
    { key: '/admin/news', icon: <NotificationOutlined />, label: 'Мэдээ мэдээлэл' },
    { key: '/admin/polls', icon: <CommentOutlined />, label: 'Санал асуулга' },
    ...(admin?.role === 'super_admin' ? [{ key: '/admin/admins', icon: <SettingOutlined />, label: 'Админ' }] : []),
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: admin?.fullName || 'Админ',
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Гарах',
      danger: true,
      onClick: logout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
        theme="light"
        width={240}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}>
          <Text strong style={{ fontSize: collapsed ? 16 : 20 }}>
            {collapsed ? '🎓' : '🎓 Сургалт'}
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header style={{ 
          padding: '0 24px', 
          background: token.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            {title && <Text strong style={{ fontSize: 18 }}>{title}</Text>}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Tooltip title={isDarkMode ? 'Гэрэлтэй горим' : 'Харанхуй горим'}>
              <Switch
                checked={isDarkMode}
                onChange={toggleDarkMode}
                checkedChildren={<MoonOutlined />}
                unCheckedChildren={<SunOutlined />}
              />
            </Tooltip>
            
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: token.colorPrimary }} />
              <div style={{ lineHeight: 1.2 }}>
                <Text strong style={{ display: 'block', fontSize: 13 }}>{admin?.fullName}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {admin?.role === 'super_admin' ? 'Систем Админ' : admin?.company?.name}
                </Text>
              </div>
            </div>
          </Dropdown>
          </div>
        </Header>
        
        <Content style={{ 
          margin: 24,
          minHeight: 280,
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
