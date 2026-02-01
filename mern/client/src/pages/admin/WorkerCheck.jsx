import { useState } from 'react';
import { adminApi } from '../../api';
import AdminLayout from '../../components/AdminLayout';
import toast from 'react-hot-toast';
import { 
  Input, Button, Card, Avatar, Typography, Space, Progress, Tag, Descriptions, 
  Empty, Alert, Spin, Popconfirm, Collapse, List
} from 'antd';
import { 
  SearchOutlined, UserOutlined, CheckCircleOutlined, CloseCircleOutlined, 
  ClockCircleOutlined, ReloadOutlined, ExclamationCircleOutlined, 
  SafetyCertificateOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Search } = Input;

const WorkerCheck = () => {
  const [loading, setLoading] = useState(false);
  const [worker, setWorker] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [resetting, setResetting] = useState(null);
  const [sapId, setSapId] = useState('');

  const handleSearch = async (value) => {
    const searchValue = value.trim();
    if (!searchValue) {
      toast.error('SAP дугаар оруулна уу');
      return;
    }

    setLoading(true);
    setWorker(null);
    setEnrollments([]);

    try {
      const res = await adminApi.get(`/workers/check/${searchValue}`);
      setWorker(res.data.worker);
      setEnrollments(res.data.enrollments);
      
      if (res.data.enrollments.length === 0) {
        toast('Энэ ажилтан сургалтанд бүртгэгдээгүй байна', { icon: 'ℹ️' });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Ажилтан олдсонгүй');
      } else {
        toast.error('Алдаа гарлаа');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetEnrollment = async (enrollmentId) => {
    setResetting(enrollmentId);
    try {
      await adminApi.post(`/enrollments/${enrollmentId}/reset`);
      toast.success('Сургалт дахин эхлүүлэхээр тохируулагдлаа');
      const res = await adminApi.get(`/workers/check/${sapId.trim()}`);
      setEnrollments(res.data.enrollments);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Алдаа гарлаа');
    } finally {
      setResetting(null);
    }
  };

  const getStatusInfo = (enrollment) => {
    if (enrollment.isPassed) {
      return { label: 'Дуусгасан', color: 'success', icon: <CheckCircleOutlined /> };
    } else if (enrollment.score !== null && enrollment.score !== undefined && 
               enrollment.score < (enrollment.training?.passingScore || 70)) {
      return { label: 'Тэнцээгүй', color: 'error', icon: <CloseCircleOutlined /> };
    } else if (enrollment.progress > 0) {
      return { label: 'Үзэж байгаа', color: 'processing', icon: <ClockCircleOutlined /> };
    }
    return { label: 'Бүртгэгдсэн', color: 'warning', icon: <ClockCircleOutlined /> };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return dayjs(dateString).format('YYYY-MM-DD HH:mm');
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Title level={3}>Ажилтан шалгах</Title>
          <Text type="secondary">SAP дугаараар ажилтны сургалтын явцыг шалгах</Text>
        </div>

        {/* Search */}
        <Card style={{ marginBottom: 24 }}>
          <Search
            placeholder="SAP дугаар оруулна уу (жишээ: SAP001)"
            enterButton={<><SearchOutlined /> Хайх</>}
            size="large"
            loading={loading}
            value={sapId}
            onChange={(e) => setSapId(e.target.value.toUpperCase())}
            onSearch={handleSearch}
            style={{ maxWidth: 500 }}
          />
        </Card>

        {/* Worker Info */}
        {worker && (
          <Card style={{ marginBottom: 24 }}>
            <Space size={16}>
              <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {worker.lastName?.charAt(0)}. {worker.firstName}
                </Title>
                <Text type="secondary">{worker.sapId}</Text>
                <br />
                <Text type="secondary">
                  {worker.company?.name} • {worker.position || 'Албан тушаал тодорхойгүй'}
                </Text>
              </div>
            </Space>
          </Card>
        )}

        {/* Enrollments */}
        {worker && (
          <Card 
            title={
              <Space>
                <SafetyCertificateOutlined />
                Сургалтууд ({enrollments.length})
              </Space>
            }
          >
            {enrollments.length === 0 ? (
              <Empty description="Сургалтанд бүртгэгдээгүй байна" />
            ) : (
              <List
                dataSource={enrollments}
                renderItem={(enrollment) => {
                  const status = getStatusInfo(enrollment);
                  return (
                    <List.Item style={{ display: 'block', padding: '16px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <Space align="center" style={{ marginBottom: 12 }}>
                            <Text style={{ fontSize: 18, color: status.color === 'success' ? '#52c41a' : status.color === 'error' ? '#ff4d4f' : status.color === 'processing' ? '#1890ff' : '#faad14' }}>
                              {status.icon}
                            </Text>
                            <Text strong style={{ fontSize: 16 }}>
                              {enrollment.training?.title}
                            </Text>
                            <Tag color={status.color} icon={status.icon}>
                              {status.label}
                            </Tag>
                          </Space>

                          {/* Progress */}
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text type="secondary">Явц</Text>
                              <Text strong>{enrollment.progress || 0}%</Text>
                            </div>
                            <Progress 
                              percent={enrollment.progress || 0} 
                              status={enrollment.isPassed ? 'success' : 'active'}
                              showInfo={false}
                              size="small"
                            />
                          </div>

                          {/* Details */}
                          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }}>
                            <Descriptions.Item label="Оноо">
                              {enrollment.score !== null && enrollment.score !== undefined 
                                ? <Text strong>{enrollment.score}%</Text> 
                                : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Оролдлого">
                              {enrollment.attempts || 0}
                            </Descriptions.Item>
                            <Descriptions.Item label="Дуусгасан">
                              {formatDate(enrollment.completedAt)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Тэнцэх оноо">
                              {enrollment.training?.passingScore || 70}%
                            </Descriptions.Item>
                          </Descriptions>

                          {/* Certificate */}
                          {enrollment.certificate && (
                            <Alert
                              type={enrollment.certificate.isExpired ? 'error' : 'success'}
                              icon={enrollment.certificate.isExpired ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
                              title={
                                enrollment.certificate.isExpired 
                                  ? `Гэрчилгээ дууссан: ${formatDate(enrollment.certificate.expiresAt)}`
                                  : `Гэрчилгээ хүчинтэй: ${formatDate(enrollment.certificate.expiresAt)} хүртэл`
                              }
                              style={{ marginTop: 12 }}
                              showIcon
                            />
                          )}
                        </div>

                        {/* Reset Button */}
                        <div style={{ marginLeft: 16 }}>
                          <Popconfirm
                            title="Дахин эхлүүлэх"
                            description="Сургалтыг дахин эхлүүлэх үү?"
                            onConfirm={() => handleResetEnrollment(enrollment._id)}
                            okText="Тийм"
                            cancelText="Үгүй"
                            okButtonProps={{ danger: true }}
                          >
                            <Button 
                              icon={<ReloadOutlined />}
                              loading={resetting === enrollment._id}
                              style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
                            >
                              Дахин эхлүүлэх
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        )}

        {/* Instructions */}
        {!worker && !loading && (
          <Alert
            type="info"
            title="Зааварчилгаа"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>SAP дугаар оруулаад хайх товч дарна уу</li>
                <li>Ажилтны бүх сургалтын явц харагдана</li>
                <li>"Дахин эхлүүлэх" товч дарж сургалтыг шинээр эхлүүлнэ</li>
                <li>Аюулгүй ажиллагааны зөрчил гарсан үед сургалтыг дахин эхлүүлнэ</li>
              </ul>
            }
            showIcon
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default WorkerCheck;
