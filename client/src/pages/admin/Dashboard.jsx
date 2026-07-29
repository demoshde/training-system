import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api';
import { 
  Card, 
  Progress, 
  Table, 
  Spin, 
  Input, 
  Button, 
  Empty, 
  Tag, 
  Typography, 
  Row, 
  Col, 
  Statistic,
  Space,
  Alert
} from 'antd';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  DownloadOutlined,
  SearchOutlined,
  UserOutlined,
  CloseOutlined,
  BookOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// Colors for progress
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'];

const getProgressColor = (percentage) => {
  if (percentage < 30) return '#f5222d';
  if (percentage < 80) return '#faad14';
  return '#52c41a';
};

const Dashboard = () => {
  const [companyProgress, setCompanyProgress] = useState([]);
  const [trainingProgress, setTrainingProgress] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [notEnrolledWorkers, setNotEnrolledWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (selectedCompany && selectedTraining) {
      fetchNotEnrolledWorkers(1);
    }
  }, [selectedCompany, selectedTraining]);

  const fetchDashboardData = async () => {
    try {
      const res = await adminApi.get('/dashboard');
      setCompanyProgress(res.data.companyProgress || []);
      setTrainingProgress(res.data.trainingProgress || []);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotEnrolledWorkers = async (page) => {
    if (!selectedCompany || !selectedTraining) return;
    
    setWorkersLoading(true);
    try {
      const res = await adminApi.get('/dashboard/not-enrolled', {
        params: {
          trainingId: selectedTraining.id,
          companyName: selectedCompany,
          page,
          limit: pagination.limit
        }
      });
      setNotEnrolledWorkers(res.data.workers || []);
      setPagination(res.data.pagination);
    } catch (error) {
      console.error('Not enrolled workers fetch error:', error);
      setNotEnrolledWorkers([]);
    } finally {
      setWorkersLoading(false);
    }
  };

  const handleCompanySelect = (companyName) => {
    if (selectedCompany === companyName) {
      setSelectedCompany(null);
      setSelectedTraining(null);
      setNotEnrolledWorkers([]);
    } else {
      setSelectedCompany(companyName);
      setSelectedTraining(null);
      setNotEnrolledWorkers([]);
    }
  };

  const handleTrainingSelect = (training) => {
    if (selectedTraining?.id === training.id) {
      setSelectedTraining(null);
      setNotEnrolledWorkers([]);
    } else {
      setSelectedTraining(training);
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  };

  const handleExport = async () => {
    if (notEnrolledWorkers.length === 0) return;
    
    try {
      const res = await adminApi.get('/dashboard/not-enrolled', {
        params: {
          trainingId: selectedTraining.id,
          companyName: selectedCompany,
          page: 1,
          limit: 10000
        }
      });
      
      const workers = res.data.workers || [];
      const csvContent = [
        [`Сургалт: ${selectedTraining.title}`],
        [`Компани: ${selectedCompany}`],
        [`Огноо: ${new Date().toLocaleDateString('mn-MN')}`],
        [`Нийт дуусгаагүй: ${workers.length} хүн`],
        [''],
        ['№', 'SAP ID', 'Овог', 'Нэр', 'Албан тушаал'].join(','),
        ...workers.map((w, idx) => [
          idx + 1,
          w.sapId,
          w.lastName,
          w.firstName,
          w.position || ''
        ].join(','))
      ].join('\n');
      
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCompany}_${selectedTraining.title}_not_completed.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const filteredTrainingProgress = selectedCompany
    ? trainingProgress.map(training => {
        const companyData = training.companies?.find(c => c.name === selectedCompany);
        if (companyData) {
          return {
            ...training,
            completed: companyData.completed,
            total: companyData.total,
            percentage: companyData.percentage,
            companies: [companyData]
          };
        }
        return null;
      }).filter(Boolean)
    : trainingProgress;

  const getCompanyProgressForTraining = () => {
    if (!selectedTraining) return companyProgress;
    
    const training = trainingProgress.find(t => t.id === selectedTraining.id);
    if (!training || !training.companies) return companyProgress;
    
    return companyProgress.map(company => {
      const trainingCompanyData = training.companies.find(c => c.name === company.name);
      if (trainingCompanyData) {
        return {
          ...company,
          completed: trainingCompanyData.completed,
          total: trainingCompanyData.total
        };
      }
      return { ...company, completed: 0, total: 0 };
    });
  };

  const displayedCompanyProgress = getCompanyProgressForTraining();

  const workerColumns = [
    {
      title: '№',
      key: 'index',
      width: 60,
      render: (_, __, idx) => (pagination.page - 1) * pagination.limit + idx + 1,
    },
    {
      title: 'SAP ID',
      dataIndex: 'sapId',
      key: 'sapId',
      width: 120,
    },
    {
      title: 'Овог Нэр',
      key: 'name',
      render: (_, record) => `${record.lastName} ${record.firstName}`,
    },
    {
      title: 'Албан тушаал',
      dataIndex: 'position',
      key: 'position',
      render: (text) => text || '-',
    },
  ];

  if (loading) {
    return (
      <AdminLayout title="Хянах самбар">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={selectedTraining ? `Хянах самбар - ${selectedTraining.title}` : "Хянах самбар"}>
      {/* Company Progress Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {displayedCompanyProgress.length === 0 ? (
          <Col span={24}>
            <Empty description="Компанийн мэдээлэл байхгүй" />
          </Col>
        ) : (
          displayedCompanyProgress.map((company, index) => {
            const percentage = company.total > 0 ? Math.round((company.completed / company.total) * 100) : 0;
            const isSelected = selectedCompany === company.name;
            return (
              <Col xs={24} sm={12} lg={6} key={company.name}>
                <Card 
                  hoverable
                  onClick={() => handleCompanySelect(company.name)}
                  style={{ 
                    borderColor: isSelected ? COLORS[index % COLORS.length] : undefined,
                    borderWidth: isSelected ? 2 : 1,
                    boxShadow: isSelected ? `0 0 0 2px ${COLORS[index % COLORS.length]}20` : undefined
                  }}
                  styles={{ body: { padding: 16 } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Progress 
                      type="circle" 
                      percent={percentage} 
                      size={60}
                      strokeColor={COLORS[index % COLORS.length]}
                      format={(p) => <span style={{ fontSize: 14, fontWeight: 600 }}>{p}%</span>}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ display: 'block', marginBottom: 4 }} ellipsis>
                        {company.name}
                      </Text>
                      <Space size={12}>
                        <Text type="success" style={{ fontSize: 12 }}>
                          <CheckCircleOutlined /> {company.completed}
                        </Text>
                        <Text type="warning" style={{ fontSize: 12 }}>
                          <ClockCircleOutlined /> {company.total - company.completed}
                        </Text>
                      </Space>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })
        )}
      </Row>

      {/* Selected Training Detail */}
      {selectedCompany && selectedTraining && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <Space style={{ marginBottom: 8 }}>
                <Tag color="blue">{selectedCompany}</Tag>
                <Tag color={getProgressColor(selectedTraining.percentage) === '#52c41a' ? 'green' : getProgressColor(selectedTraining.percentage) === '#faad14' ? 'gold' : 'red'}>
                  {selectedTraining.percentage}%
                </Tag>
              </Space>
              <Title level={4} style={{ margin: 0 }}>{selectedTraining.title}</Title>
            </div>
            <Space>
              <Statistic 
                title="Дууссан" 
                value={selectedTraining.completed} 
                valueStyle={{ color: '#52c41a', fontSize: 20 }}
                prefix={<CheckCircleOutlined />}
              />
              <Statistic 
                title="Дуусаагүй" 
                value={selectedTraining.total - selectedTraining.completed} 
                valueStyle={{ color: '#faad14', fontSize: 20 }}
                prefix={<ClockCircleOutlined />}
              />
              <Button 
                type="text" 
                icon={<CloseOutlined />} 
                onClick={() => {
                  setSelectedTraining(null);
                  setNotEnrolledWorkers([]);
                }}
              />
            </Space>
          </div>
          
          <Progress 
            percent={selectedTraining.percentage} 
            strokeColor={getProgressColor(selectedTraining.percentage)}
            style={{ marginBottom: 24 }}
          />

          {/* Workers table */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Space>
                <UserOutlined style={{ color: '#f5222d' }} />
                <Text strong>Сургалт дуусгаагүй ажилчид</Text>
                <Tag>{pagination.total} хүн</Tag>
              </Space>
              {pagination.total > 0 && (
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                  Татах (CSV)
                </Button>
              )}
            </div>

            {notEnrolledWorkers.length === 0 && !workersLoading ? (
              <Alert
                title="Бүх ажилчид сургалтыг дуусгасан!"
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
              />
            ) : (
              <Table
                dataSource={notEnrolledWorkers}
                columns={workerColumns}
                rowKey="_id"
                loading={workersLoading}
                pagination={{
                  current: pagination.page,
                  pageSize: pagination.limit,
                  total: pagination.total,
                  onChange: (page) => fetchNotEnrolledWorkers(page),
                  showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}`,
                  showSizeChanger: false,
                }}
                size="small"
              />
            )}
          </div>
        </Card>
      )}

      {/* Training Progress */}
      <Card
        title={
          <Space>
            <BookOutlined style={{ color: '#722ed1' }} />
            <span>Сургалтуудын явц</span>
            {selectedCompany && <Tag color="blue">{selectedCompany}</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Input
              placeholder="Сургалт хайх..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            {selectedCompany && (
              <Button type="link" onClick={() => {
                setSelectedCompany(null);
                setSelectedTraining(null);
                setNotEnrolledWorkers([]);
              }}>
                Бүгдийг харах
              </Button>
            )}
          </Space>
        }
      >
        {selectedTraining && !selectedCompany && (
          <Alert
            title="💡 Дуусгаагүй ажилчдын жагсаалт харахын тулд дээрээс компани сонгоно уу"
            type="info"
            style={{ marginBottom: 16 }}
          />
        )}
        
        {filteredTrainingProgress.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
          <Empty description="Мэдээлэл байхгүй" />
        ) : (
          <Row gutter={[16, 16]}>
            {filteredTrainingProgress
              .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((training) => {
                const isSelected = selectedTraining?.id === training.id;
                return (
                  <Col xs={24} sm={12} lg={6} key={training.id}>
                    <Card
                      hoverable
                      onClick={() => handleTrainingSelect(training)}
                      style={{
                        borderColor: isSelected ? '#1890ff' : undefined,
                        borderWidth: isSelected ? 2 : 1,
                      }}
                      styles={{ body: { padding: 16 } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <Text strong style={{ flex: 1, fontSize: 13 }} ellipsis={{ tooltip: training.title }}>
                          {training.title}
                        </Text>
                        <Text strong style={{ color: getProgressColor(training.percentage), marginLeft: 8 }}>
                          {training.percentage}%
                        </Text>
                      </div>
                      <Progress 
                        percent={training.percentage} 
                        size="small"
                        strokeColor={getProgressColor(training.percentage)}
                        showInfo={false}
                        style={{ marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="success" style={{ fontSize: 12 }}>
                          <CheckCircleOutlined /> {training.completed}
                        </Text>
                        <Text type="warning" style={{ fontSize: 12 }}>
                          <ClockCircleOutlined /> {training.total - training.completed}
                        </Text>
                      </div>
                    </Card>
                  </Col>
                );
              })}
          </Row>
        )}
      </Card>
    </AdminLayout>
  );
};

export default Dashboard;
