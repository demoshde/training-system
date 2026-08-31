import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { adminApi } from '../../api';
import toast from 'react-hot-toast';
import {
  Table, Button, Tabs, Tag, Space, Empty, Typography, Popconfirm, Tooltip, Badge, Switch, theme, Modal, Input, Spin
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, ReloadOutlined, 
  InboxOutlined, CheckCircleOutlined, StopOutlined, FileTextOutlined, QuestionCircleOutlined,
  ShareAltOutlined, BarChartOutlined, CopyOutlined as CopyLinkOutlined
} from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
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
  const [shareTraining, setShareTraining] = useState(null);
  const [results, setResults] = useState(null);   // { loading, data, title }

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

  const shareUrl = (id) => `${window.location.origin}/train/${id}`;

  const openResults = async (record) => {
    setResults({ loading: true, data: null, title: record.title });
    try {
      const { data } = await adminApi.get(`/trainings/${record._id}/results`);
      setResults({ loading: false, data, title: record.title });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Үр дүн татахад алдаа гарлаа');
      setResults(null);
    }
  };

  const copyShareLink = (id) => {
    navigator.clipboard?.writeText(shareUrl(id));
    toast.success('Линк хууллаа');
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
          <Tooltip title="Хуваалцах / QR">
            <Button type="text" icon={<ShareAltOutlined />} style={{ color: '#0958d9' }}
              onClick={() => setShareTraining(record)} />
          </Tooltip>
          <Tooltip title="Үр дүн / шинжилгээ">
            <Button type="text" icon={<BarChartOutlined />} style={{ color: '#08979c' }}
              onClick={() => openResults(record)} />
          </Tooltip>
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

      {/* Share / QR modal */}
      <Modal
        title="Сургалтын холбоос"
        open={!!shareTraining}
        onCancel={() => setShareTraining(null)}
        footer={null}
        width={420}
      >
        {shareTraining && (
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">{shareTraining.title}</Text>
            <div style={{ margin: '18px 0', display: 'flex', justifyContent: 'center' }}>
              <div style={{ padding: 12, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12 }}>
                <QRCodeCanvas value={shareUrl(shareTraining._id)} size={200} includeMargin />
              </div>
            </div>
            <Input.Group compact style={{ display: 'flex' }}>
              <Input readOnly value={shareUrl(shareTraining._id)} />
              <Button type="primary" icon={<CopyLinkOutlined />} onClick={() => copyShareLink(shareTraining._id)}>
                Хуулах
              </Button>
            </Input.Group>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
              Ажилтан энэ линкээр орж SAP дугаараа хийхэд сургалт шууд эхэлнэ.
            </Text>
          </div>
        )}
      </Modal>

      {/* Results / analytics modal */}
      <Modal
        title={results ? `Үр дүн — ${results.title}` : 'Үр дүн'}
        open={!!results}
        onCancel={() => setResults(null)}
        footer={null}
        width={760}
      >
        {results?.loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : results?.data ? (
          <div>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Нийт', value: results.data.summary.total, color: '#000' },
                { label: 'Тэнцсэн', value: results.data.summary.passed, color: '#52c41a' },
                { label: 'Тэнцээгүй', value: results.data.summary.failed, color: '#ff4d4f' },
                { label: 'Дуусаагүй', value: results.data.summary.inProgress, color: '#faad14' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Attendees */}
            <Text strong>Суусан ажилтнууд</Text>
            <Table
              size="small"
              style={{ marginTop: 8, marginBottom: 24 }}
              dataSource={results.data.attendees}
              rowKey="enrollmentId"
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty description="Одоогоор хэн ч суугаагүй" /> }}
              columns={[
                { title: 'Нэр', dataIndex: 'name', render: (v, r) => v || <Text type="secondary">{r.isSelfRegistered ? 'Зочин' : '—'}</Text> },
                { title: 'SAP', dataIndex: 'sapId' },
                { title: 'Оноо', dataIndex: 'score', render: v => v == null ? '—' : `${v}%` },
                { title: 'Оролдлого', dataIndex: 'attempts' },
                { title: 'Төлөв', key: 'status', render: (_, r) => (
                  r.isPassed ? <Tag color="success">Тэнцсэн</Tag>
                  : r.hasQuiz ? <Tag color="error">Тэнцээгүй</Tag>
                  : <Tag color="warning">Дуусаагүй</Tag>
                ) },
              ]}
            />

            {/* Per-question analytics */}
            <Text strong>Асуултын шинжилгээ <Text type="secondary" style={{ fontWeight: 400 }}>(хамгийн их алдсанаар)</Text></Text>
            <div style={{ marginTop: 8 }}>
              {results.data.questionStats.length === 0 && <Text type="secondary">Асуулт байхгүй</Text>}
              {results.data.questionStats.map((q, i) => (
                <div key={q.questionId} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 13 }}>{i + 1}. {q.questionText}</span>
                    <span style={{ fontWeight: 700, color: q.wrongPct >= 50 ? '#ff4d4f' : q.wrongPct >= 25 ? '#faad14' : '#52c41a', whiteSpace: 'nowrap' }}>
                      {q.wrongPct}% алдсан
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#f0f0f0', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${q.wrongPct}%`, background: q.wrongPct >= 50 ? '#ff4d4f' : q.wrongPct >= 25 ? '#faad14' : '#52c41a' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                    {q.answered} хариулсан · {q.correct} зөв · {q.wrong} буруу · Зөв хариулт: {q.correctText || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </AdminLayout>
  );
};

export default Trainings;
