import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { adminApi } from '../../api';
import toast from 'react-hot-toast';
import {
  Table, Button, Tabs, Tag, Space, Empty, Typography, Popconfirm, Tooltip, Badge, Switch, theme
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, ReloadOutlined, 
  InboxOutlined, CheckCircleOutlined, StopOutlined, FileTextOutlined, QuestionCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const Trainings = () => {
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const isSuperAdmin = admin?.role === 'super_admin';
  const { token } = theme.useToken();
  const [trainings, setTrainings] = useState([]);
  const [trashedTrainings, setTrashedTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('active');

  useEffect(() => {
    fetchTrainings();
    fetchTrashedTrainings();
  }, []);

  const fetchTrainings = async () => {
    try {
      const res = await adminApi.get('/trainings');
      setTrainings(res.data);
    } catch (error) {
      toast.error('Сургалтын мэдээлэл татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrashedTrainings = async () => {
    try {
      const res = await adminApi.get('/trainings?deleted=true');
      setTrashedTrainings(res.data);
    } catch (error) {
      console.error('Fetch trashed trainings error:', error);
    }
  };

  const handleDelete = async (training) => {
    try {
      await adminApi.delete(`/trainings/${training._id}`);
      toast.success('Сургалт хогийн саванд хийгдлээ');
      fetchTrainings();
      fetchTrashedTrainings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Устгахад алдаа гарлаа');
    }
  };

  const handleRestore = async (training) => {
    try {
      await adminApi.post(`/trainings/${training._id}/restore`);
      toast.success('Сургалт сэргээгдлээ');
      fetchTrainings();
      fetchTrashedTrainings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Сэргээхэд алдаа гарлаа');
    }
  };

  const handlePermanentDelete = async (training) => {
    try {
      await adminApi.delete(`/trainings/${training._id}/permanent`);
      toast.success('Сургалт бүрмөсөн устгагдлаа');
      fetchTrashedTrainings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Устгахад алдаа гарлаа');
    }
  };

  const toggleActive = async (training) => {
    try {
      await adminApi.put(`/trainings/${training._id}`, {
        ...training,
        isActive: !training.isActive
      });
      toast.success(`Сургалт ${!training.isActive ? 'идэвхжүүллээ' : 'идэвхгүй болголоо'}`);
      fetchTrainings();
    } catch (error) {
      toast.error('Алдаа гарлаа');
    }
  };

  const handleDuplicate = async (training) => {
    try {
      const duplicatePattern = new RegExp(`^${training.title} \\(duplicate(\\d+)\\)$`);
      let maxNumber = 0;
      
      trainings.forEach(t => {
        const match = t.title.match(duplicatePattern);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNumber) maxNumber = num;
        }
      });
      
      const newTitle = `${training.title} (duplicate${maxNumber + 1})`;
      
      // Deep copy slides (remove _id fields)
      const duplicatedSlides = (training.slides || []).map(slide => {
        const { _id, ...slideData } = slide;
        return slideData;
      });
      
      // Deep copy questions and options (remove _id fields)
      const duplicatedQuestions = (training.questions || []).map(question => {
        const { _id, ...questionData } = question;
        return {
          ...questionData,
          options: (question.options || []).map(option => {
            const { _id, ...optionData } = option;
            return optionData;
          })
        };
      });
      
      const duplicateData = {
        title: newTitle,
        description: training.description || '',
        passingScore: training.passingScore || 70,
        validityPeriod: training.validityPeriod || 0,
        isMandatory: training.isMandatory || false,
        isActive: true,
        slides: duplicatedSlides,
        questions: duplicatedQuestions
      };
      
      await adminApi.post('/trainings', duplicateData);
      toast.success(`Сургалт хуулагдлаа: ${newTitle}`);
      fetchTrainings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Хуулахад алдаа гарлаа');
    }
  };

  const columns = [
    {
      title: 'Сургалтын нэр',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div>
          <Text strong>{title}</Text>
          {record.isMandatory && (
            <Tag color="red" style={{ marginLeft: 8 }}>⚠️ Заавал</Tag>
          )}
          {record.description && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                {record.description.substring(0, 60)}{record.description.length > 60 ? '...' : ''}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Тэнцэх оноо',
      dataIndex: 'passingScore',
      key: 'passingScore',
      width: 100,
      align: 'center',
      render: (score) => <Tag color="blue">{score}%</Tag>,
    },
    {
      title: 'Хүчинтэй хугацаа',
      dataIndex: 'validityPeriod',
      key: 'validityPeriod',
      width: 120,
      align: 'center',
      render: (period) => period ? `${period} сар` : <Text type="secondary">Хугацаагүй</Text>,
    },
    {
      title: <><FileTextOutlined /> Слайд</>,
      key: 'slides',
      width: 80,
      align: 'center',
      render: (_, record) => record.slides?.length || 0,
    },
    {
      title: <><QuestionCircleOutlined /> Асуулт</>,
      key: 'questions',
      width: 80,
      align: 'center',
      render: (_, record) => record.questions?.length || 0,
    },
    {
      title: 'Төлөв',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'center',
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={() => toggleActive(record)}
          checkedChildren="Идэвхтэй"
          unCheckedChildren="Идэвхгүй"
          disabled={!isSuperAdmin}
        />
      ),
    },
    ...(isSuperAdmin ? [{
      title: 'Үйлдэл',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="Сургалт хуулах"
            description={`"${record.title}" сургалтыг хуулах уу?`}
            onConfirm={() => handleDuplicate(record)}
            okText="Хуулах"
            cancelText="Цуцлах"
          >
            <Tooltip title="Хуулах">
              <Button type="text" icon={<CopyOutlined />} style={{ color: '#722ed1' }} />
            </Tooltip>
          </Popconfirm>
          <Tooltip title="Засах">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => navigate(`/admin/trainings/${record._id}/edit`)}
            />
          </Tooltip>
          <Popconfirm
            title="Хогийн саванд хийх"
            description={`"${record.title}" сургалтыг хогийн саванд хийх үү?`}
            onConfirm={() => handleDelete(record)}
            okText="Устгах"
            cancelText="Цуцлах"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Устгах">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  const trashedColumns = [
    {
      title: 'Сургалтын нэр',
      dataIndex: 'title',
      key: 'title',
      render: (title) => <Text strong>{title}</Text>,
    },
    {
      title: 'Устгагдсан огноо',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      width: 150,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Үйлдэл',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button 
            type="text" 
            icon={<ReloadOutlined />} 
            style={{ color: '#52c41a' }}
            onClick={() => handleRestore(record)}
          >
            Сэргээх
          </Button>
          <Popconfirm
            title="Бүрмөсөн устгах"
            description={`"${record.title}" сургалтыг бүрмөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй!`}
            onConfirm={() => handlePermanentDelete(record)}
            okText="Устгах"
            cancelText="Цуцлах"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              Бүрмөсөн устгах
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'active',
      label: (
        <span>
          📚 Сургалтууд <Badge count={trainings.length} style={{ backgroundColor: '#1890ff' }} />
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">Нийт {trainings.length} сургалт</Text>
            {isSuperAdmin && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => navigate('/admin/trainings/new')}
              >
                Сургалт нэмэх
              </Button>
            )}
          </div>

          <Table
            dataSource={trainings}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Нийт ${total}` }}
            locale={{ emptyText: <Empty description="Сургалт байхгүй" /> }}
          />
        </>
      )
    },
    ...(isSuperAdmin ? [{
      key: 'trash',
      label: (
        <span style={{ color: trashedTrainings.length > 0 ? '#ff4d4f' : undefined }}>
          🗑️ Хогийн сав {trashedTrainings.length > 0 && <Badge count={trashedTrainings.length} style={{ backgroundColor: '#ff4d4f' }} />}
        </span>
      ),
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Хогийн саванд {trashedTrainings.length} сургалт байна</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Хогийн савнаас сэргээх эсвэл бүрмөсөн устгах боломжтой
            </Text>
          </div>

          <Table
            dataSource={trashedTrainings}
            columns={trashedColumns}
            rowKey="_id"
            pagination={false}
            locale={{ 
              emptyText: (
                <Empty 
                  image={<InboxOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
                  description="Хогийн сав хоосон байна" 
                />
              )
            }}
          />
        </>
      )
    }] : [])
  ];

  return (
    <AdminLayout title="Сургалт">
      <Tabs
        activeKey={viewMode}
        onChange={setViewMode}
        items={tabItems}
        style={{ background: token.colorBgContainer, padding: 16, borderRadius: 8 }}
      />
    </AdminLayout>
  );
};

export default Trainings;
