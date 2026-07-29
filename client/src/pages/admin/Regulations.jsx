import { useState, useEffect } from 'react';
import { adminApi } from '../../api';
import AdminLayout from '../../components/AdminLayout';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import toast from 'react-hot-toast';
import { 
  Table, Button, Modal, Form, Input, Select, Switch, Space, Tag, Typography, 
  Popconfirm, Tooltip, Upload, Spin, theme, Empty
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, UploadOutlined,
  FilePdfOutlined, SafetyOutlined, ToolOutlined, EnvironmentOutlined, FileOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

const CATEGORIES = [
  { value: 'safety', label: 'Аюулгүй ажиллагаа', icon: <SafetyOutlined />, color: 'red' },
  { value: 'work', label: 'Ажлын журам', icon: <ToolOutlined />, color: 'blue' },
  { value: 'environment', label: 'Байгаль орчин', icon: <EnvironmentOutlined />, color: 'green' },
  { value: 'other', label: 'Бусад', icon: <FileOutlined />, color: 'default' }
];

const Regulations = () => {
  const { admin } = useAdminAuth();
  const isSuperAdmin = admin?.role === 'super_admin';
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRegulation, setEditingRegulation] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    fetchRegulations();
  }, []);

  const fetchRegulations = async () => {
    try {
      const response = await adminApi.get('/regulations/admin');
      setRegulations(response.data);
    } catch (error) {
      toast.error('Журам татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (regulation = null) => {
    if (regulation) {
      setEditingRegulation(regulation);
      form.setFieldsValue({
        regulationNumber: regulation.regulationNumber,
        title: regulation.title,
        description: regulation.description || '',
        pdfUrl: regulation.pdfUrl,
        category: regulation.category,
        isActive: regulation.isActive
      });
    } else {
      setEditingRegulation(null);
      form.resetFields();
      form.setFieldsValue({ category: 'other', isActive: true });
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    if (!values.pdfUrl) {
      toast.error('PDF файл оруулна уу');
      return;
    }
    
    setSubmitting(true);
    try {
      if (editingRegulation) {
        await adminApi.put(`/regulations/${editingRegulation._id}`, values);
        toast.success('Журам шинэчлэгдлээ');
      } else {
        await adminApi.post('/regulations', values);
        toast.success('Журам нэмэгдлээ');
      }
      setModalVisible(false);
      form.resetFields();
      fetchRegulations();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Алдаа гарлаа');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (regulation) => {
    try {
      await adminApi.delete(`/regulations/${regulation._id}`);
      toast.success('Журам устгагдлаа');
      fetchRegulations();
    } catch (error) {
      toast.error('Устгахад алдаа гарлаа');
    }
  };

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('pdf', file);
    
    setUploading(true);
    try {
      const response = await adminApi.post('/upload/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      form.setFieldValue('pdfUrl', response.data.url);
      toast.success('PDF файл амжилттай хуулагдлаа');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Файл хуулахад алдаа гарлаа');
    } finally {
      setUploading(false);
    }
  };

  const getCategoryInfo = (category) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[3];
  };

  const columns = [
    {
      title: 'Дугаар',
      dataIndex: 'regulationNumber',
      key: 'regulationNumber',
      width: 120,
      render: (number) => <Text strong style={{ color: token.colorPrimary }}>{number}</Text>,
    },
    {
      title: 'Гарчиг',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div>
          <Text strong>{title}</Text>
          {record.description && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.description.substring(0, 60)}...
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Ангилал',
      dataIndex: 'category',
      key: 'category',
      width: 180,
      filters: CATEGORIES.map(c => ({ text: c.label, value: c.value })),
      onFilter: (value, record) => record.category === value,
      render: (category) => {
        const cat = getCategoryInfo(category);
        return <Tag icon={cat.icon} color={cat.color}>{cat.label}</Tag>;
      },
    },
    {
      title: 'PDF',
      key: 'pdf',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="PDF харах">
          <Button 
            type="link" 
            icon={<FilePdfOutlined style={{ fontSize: 20, color: '#f5222d' }} />}
            href={record.pdfUrl}
            target="_blank"
          />
        </Tooltip>
      ),
    },
    {
      title: 'Төлөв',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      filters: [
        { text: 'Идэвхтэй', value: true },
        { text: 'Идэвхгүй', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
        </Tag>
      ),
    },
    {
      title: 'Огноо',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      sorter: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Үйлдэл',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Харах">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              href={record.pdfUrl}
              target="_blank"
            />
          </Tooltip>
          {isSuperAdmin && (
            <>
              <Tooltip title="Засах">
                <Button type="text" icon={<EditOutlined />} onClick={() => openModal(record)} />
              </Tooltip>
              <Popconfirm
                title="Журам устгах"
                description={`"${record.title}" журмыг устгах уу?`}
                onConfirm={() => handleDelete(record)}
                okText="Устгах"
                cancelText="Цуцлах"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Устгах">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  if (!isSuperAdmin) {
    return (
      <AdminLayout title="Журамууд">
        <Table
          dataSource={regulations}
          columns={columns.filter(c => c.key !== 'actions' || !isSuperAdmin)}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Нийт ${total}` }}
          style={{ background: token.colorBgContainer, borderRadius: 8 }}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Журамууд">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary">Нийт {regulations.length} журам</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Журам нэмэх
        </Button>
      </div>

      <Table
        dataSource={regulations}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Нийт ${total}` }}
        style={{ background: token.colorBgContainer, borderRadius: 8 }}
      />

      {/* Create/Edit Modal */}
      {modalVisible && (
        <Modal
          title={editingRegulation ? 'Журам засах' : 'Журам нэмэх'}
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
          }}
          footer={null}
          width={600}
        >
        <Spin spinning={uploading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            style={{ marginTop: 16 }}
          >
            <Form.Item
              name="regulationNumber"
              label="Журмын дугаар"
              rules={[{ required: true, message: 'Журмын дугаар оруулна уу' }]}
            >
              <Input placeholder="Жишээ: ЖД-001" />
            </Form.Item>

            <Form.Item
              name="title"
              label="Гарчиг"
              rules={[{ required: true, message: 'Гарчиг оруулна уу' }]}
            >
              <Input placeholder="Журмын нэр" />
            </Form.Item>

            <Form.Item
              name="category"
              label="Ангилал"
              rules={[{ required: true, message: 'Ангилал сонгоно уу' }]}
            >
              <Select placeholder="Ангилал сонгох">
                {CATEGORIES.map(c => (
                  <Select.Option key={c.value} value={c.value}>
                    <Space>{c.icon} {c.label}</Space>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="description"
              label="Тайлбар"
            >
              <TextArea rows={3} placeholder="Журмын товч тайлбар" />
            </Form.Item>

            {/* Hidden field for pdfUrl */}
            <Form.Item name="pdfUrl" hidden>
              <Input />
            </Form.Item>

            <Form.Item
              label="PDF файл"
              required
            >
              <Space vertical style={{ width: '100%' }}>
                <Upload
                  accept=".pdf"
                  showUploadList={false}
                  customRequest={({ file }) => handleUpload(file)}
                >
                  <Button icon={<UploadOutlined />} loading={uploading}>
                    PDF файл сонгох
                  </Button>
                </Upload>
                <Form.Item noStyle shouldUpdate>
                  {() => {
                    const pdfUrl = form.getFieldValue('pdfUrl');
                    return pdfUrl && pdfUrl.startsWith('/uploads') ? (
                      <Space>
                        <FilePdfOutlined style={{ color: '#f5222d' }} />
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                          PDF харах
                        </a>
                      </Space>
                    ) : null;
                  }}
                </Form.Item>
              </Space>
            </Form.Item>

            <Form.Item
              name="isActive"
              label="Төлөв"
              valuePropName="checked"
            >
              <Switch checkedChildren="Идэвхтэй" unCheckedChildren="Идэвхгүй" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setModalVisible(false)}>Цуцлах</Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  {editingRegulation ? 'Хадгалах' : 'Нэмэх'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
      )}
    </AdminLayout>
  );
};

export default Regulations;
