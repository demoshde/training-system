import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api';
import toast from 'react-hot-toast';
import { 
  Table, Button, Modal, Select, Input, Space, Tag, Progress, 
  Typography, Popconfirm, Tooltip, Checkbox, Descriptions, Spin, theme
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, SearchOutlined, EyeOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const Enrollments = () => {
  const { token } = theme.useToken();
  const [enrollments, setEnrollments] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTraining, setFilterTraining] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  
  const [enrollModalVisible, setEnrollModalVisible] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ training: '', workers: [], filterCompany: '' });
  const [workerSearch, setWorkerSearch] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [enrollmentsRes, trainingsRes, companiesRes, workersRes] = await Promise.all([
        adminApi.get('/enrollments'),
        adminApi.get('/trainings'),
        adminApi.get('/companies'),
        adminApi.get('/workers')
      ]);
      setEnrollments(enrollmentsRes.data);
      setTrainings(trainingsRes.data);
      setCompanies(companiesRes.data);
      setWorkers(workersRes.data);
    } catch (error) {
      toast.error('Мэдээлэл татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (enrollment) => {
    try {
      await adminApi.delete(`/enrollments/${enrollment._id}`);
      toast.success('Бүртгэл устгагдлаа');
      fetchData();
    } catch (error) {
      toast.error('Устгахад алдаа гарлаа');
    }
  };

  const handleEnroll = async () => {
    if (!enrollForm.training || enrollForm.workers.length === 0) {
      toast.error('Сургалт болон ажилтан сонгоно уу');
      return;
    }
    
    setEnrolling(true);
    try {
      await adminApi.post('/enrollments/bulk', {
        training: enrollForm.training,
        workers: enrollForm.workers
      });
      toast.success(`${enrollForm.workers.length} ажилтан бүртгэгдлээ`);
      fetchData();
      setEnrollModalVisible(false);
      setEnrollForm({ training: '', workers: [], filterCompany: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Бүртгэхэд алдаа гарлаа');
    } finally {
      setEnrolling(false);
    }
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const worker = enrollment.worker;
    const training = enrollment.training;
    
    const matchesSearch = !search || 
      worker?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      worker?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      worker?.sapId?.toLowerCase().includes(search.toLowerCase());
    
    const matchesTraining = !filterTraining || training?._id === filterTraining;
    const matchesCompany = !filterCompany || worker?.company?._id === filterCompany;
    const matchesStatus = !filterStatus || enrollment.status === filterStatus;
    
    return matchesSearch && matchesTraining && matchesCompany && matchesStatus;
  });

  const filteredWorkers = workers.filter((worker) => {
    const matchesSearch = !workerSearch ||
      worker.firstName?.toLowerCase().includes(workerSearch.toLowerCase()) ||
      worker.lastName?.toLowerCase().includes(workerSearch.toLowerCase()) ||
      worker.sapId?.toLowerCase().includes(workerSearch.toLowerCase());
    const matchesCompany = !enrollForm.filterCompany || worker.company?._id === enrollForm.filterCompany;
    
    // Exclude already enrolled workers
    const alreadyEnrolled = enrollments.some(
      e => e.worker?._id === worker._id && e.training?._id === enrollForm.training
    );
    
    return matchesSearch && matchesCompany && !alreadyEnrolled;
  });

  const getStatusTag = (enrollment) => {
    if (enrollment.isPassed) {
      return <Tag icon={<CheckCircleOutlined />} color="success">Дуусгасан</Tag>;
    }
    if (enrollment.status === 'in_progress') {
      return <Tag icon={<ClockCircleOutlined />} color="processing">Үргэлжилж байна</Tag>;
    }
    return <Tag color="default">Эхлээгүй</Tag>;
  };

  const columns = [
    {
      title: 'Ажилтан',
      key: 'worker',
      sorter: (a, b) => `${a.worker?.lastName}`.localeCompare(`${b.worker?.lastName}`),
      render: (_, r) => (
        <div>
          <Text strong>{r.worker?.lastName} {r.worker?.firstName}</Text>
          <div><Text type="secondary" style={{ fontSize: 12 }}>{r.worker?.sapId}</Text></div>
        </div>
      ),
    },
    {
      title: 'Компани',
      key: 'company',
      width: 150,
      filters: companies.map(c => ({ text: c.name, value: c._id })),
      onFilter: (value, record) => record.worker?.company?._id === value,
      render: (_, r) => <Tag>{r.worker?.company?.name || '-'}</Tag>,
    },
    {
      title: 'Сургалт',
      key: 'training',
      filters: trainings.map(t => ({ text: t.title, value: t._id })),
      onFilter: (value, record) => record.training?._id === value,
      render: (_, r) => <Text ellipsis style={{ maxWidth: 200 }}>{r.training?.title}</Text>,
    },
    {
      title: 'Төлөв',
      key: 'status',
      width: 140,
      filters: [
        { text: 'Дуусгасан', value: 'completed' },
        { text: 'Үргэлжилж байна', value: 'in_progress' },
        { text: 'Эхлээгүй', value: 'not_started' },
      ],
      onFilter: (value, record) => {
        if (value === 'completed') return record.isPassed;
        return record.status === value;
      },
      render: (_, r) => getStatusTag(r),
    },
    {
      title: 'Явц',
      key: 'progress',
      width: 100,
      sorter: (a, b) => (a.progress || 0) - (b.progress || 0),
      render: (_, r) => <Progress percent={r.isPassed ? 100 : (r.progress || 0)} size="small" />,
    },
    {
      title: 'Оноо',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      sorter: (a, b) => (a.score || 0) - (b.score || 0),
      render: (score) => score ? `${score}%` : '-',
    },
    {
      title: 'Үйлдэл',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="Дэлгэрэнгүй">
            <Button type="text" icon={<EyeOutlined />} onClick={() => {
              setSelectedEnrollment(record);
              setDetailModalVisible(true);
            }} />
          </Tooltip>
          <Popconfirm
            title="Бүртгэл устгах"
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
    },
  ];

  return (
    <AdminLayout title="Бүртгэл">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder="Ажилтан хайх..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="Сургалт"
          value={filterTraining || undefined}
          onChange={setFilterTraining}
          allowClear
          style={{ width: 200 }}
        >
          {trainings.map(t => (
            <Select.Option key={t._id} value={t._id}>{t.title}</Select.Option>
          ))}
        </Select>
        <Select
          placeholder="Компани"
          value={filterCompany || undefined}
          onChange={setFilterCompany}
          allowClear
          style={{ width: 150 }}
        >
          {companies.map(c => (
            <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
          ))}
        </Select>
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEnrollModalVisible(true)}>
          Бүртгэх
        </Button>
      </div>

      <Table
        dataSource={filteredEnrollments}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ 
          pageSize: 20, 
          showSizeChanger: true, 
          showTotal: (total) => `Нийт ${total} бүртгэл`,
          pageSizeOptions: [10, 20, 50, 100]
        }}
        style={{ background: token.colorBgContainer, borderRadius: 8 }}
      />

      {/* Detail Modal */}
      <Modal
        title="Бүртгэлийн дэлгэрэнгүй"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={<Button onClick={() => setDetailModalVisible(false)}>Хаах</Button>}
        width={600}
      >
        {selectedEnrollment && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="Ажилтан" span={2}>
              {selectedEnrollment.worker?.lastName} {selectedEnrollment.worker?.firstName}
            </Descriptions.Item>
            <Descriptions.Item label="SAP ID">
              {selectedEnrollment.worker?.sapId}
            </Descriptions.Item>
            <Descriptions.Item label="Компани">
              {selectedEnrollment.worker?.company?.name}
            </Descriptions.Item>
            <Descriptions.Item label="Сургалт" span={2}>
              {selectedEnrollment.training?.title}
            </Descriptions.Item>
            <Descriptions.Item label="Төлөв">
              {getStatusTag(selectedEnrollment)}
            </Descriptions.Item>
            <Descriptions.Item label="Явц">
              <Progress percent={selectedEnrollment.progress || 0} size="small" />
            </Descriptions.Item>
            <Descriptions.Item label="Оноо">
              {selectedEnrollment.score ? `${selectedEnrollment.score}%` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Оролдлого">
              {selectedEnrollment.attempts || 0}
            </Descriptions.Item>
            <Descriptions.Item label="Бүртгэсэн огноо">
              {dayjs(selectedEnrollment.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="Дуусгасан огноо">
              {selectedEnrollment.completedAt ? dayjs(selectedEnrollment.completedAt).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Enroll Modal */}
      <Modal
        title="Сургалтанд бүртгэх"
        open={enrollModalVisible}
        onCancel={() => {
          setEnrollModalVisible(false);
          setEnrollForm({ training: '', workers: [], filterCompany: '' });
          setWorkerSearch('');
        }}
        onOk={handleEnroll}
        okText="Бүртгэх"
        cancelText="Цуцлах"
        confirmLoading={enrolling}
        width={700}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>Сургалт сонгох</Text>
            <Select
              placeholder="Сургалт сонгох"
              value={enrollForm.training || undefined}
              onChange={(v) => setEnrollForm({ ...enrollForm, training: v, workers: [] })}
              style={{ width: '100%', marginTop: 8 }}
            >
              {trainings.filter(t => t.isActive).map(t => (
                <Select.Option key={t._id} value={t._id}>{t.title}</Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>Ажилтан сонгох</Text>
              <Text type="secondary">{enrollForm.workers.length} сонгосон</Text>
            </div>
            <Space style={{ marginBottom: 8 }}>
              <Input
                placeholder="Ажилтан хайх..."
                prefix={<SearchOutlined />}
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                style={{ width: 200 }}
              />
              <Select
                placeholder="Компани"
                value={enrollForm.filterCompany || undefined}
                onChange={(v) => setEnrollForm({ ...enrollForm, filterCompany: v })}
                allowClear
                style={{ width: 150 }}
              >
                {companies.map(c => (
                  <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
                ))}
              </Select>
              <Button 
                size="small"
                onClick={() => setEnrollForm({ ...enrollForm, workers: filteredWorkers.map(w => w._id) })}
              >
                Бүгдийг сонгох
              </Button>
              <Button 
                size="small"
                onClick={() => setEnrollForm({ ...enrollForm, workers: [] })}
              >
                Цуцлах
              </Button>
            </Space>
            <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Checkbox.Group
                value={enrollForm.workers}
                onChange={(v) => setEnrollForm({ ...enrollForm, workers: v })}
                style={{ width: '100%' }}
              >
                {filteredWorkers.map((worker) => (
                  <div 
                    key={worker._id} 
                    style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Checkbox value={worker._id}>
                      <Space>
                        <Text strong>{worker.lastName} {worker.firstName}</Text>
                        <Text type="secondary">({worker.sapId})</Text>
                        <Tag size="small">{worker.company?.name}</Tag>
                      </Space>
                    </Checkbox>
                  </div>
                ))}
                {filteredWorkers.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center' }}>
                    <Text type="secondary">Ажилтан олдсонгүй</Text>
                  </div>
                )}
              </Checkbox.Group>
            </div>
          </div>
        </Space>
      </Modal>
    </AdminLayout>
  );
};

export default Enrollments;
