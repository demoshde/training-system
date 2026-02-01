import { useState, useEffect } from 'react';
import { adminApi } from '../../api';
import AdminLayout from '../../components/AdminLayout';
import toast from 'react-hot-toast';
import { 
  Table, Button, Modal, Form, Input, Select, Switch, Space, Tag, Typography, 
  Popconfirm, Tooltip, Upload, Image, Spin, theme
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, UploadOutlined,
  SyncOutlined, WarningOutlined, BulbOutlined, FileImageOutlined, 
  FilePdfOutlined, YoutubeOutlined, PlaySquareOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;

const CATEGORIES = [
  { value: 'change', label: 'Сүүлд гарсан өөрчлөлт', icon: <SyncOutlined />, color: 'blue' },
  { value: 'accident', label: 'Ослын сургамж', icon: <WarningOutlined />, color: 'red' },
  { value: 'improvement', label: 'Сайжруулалт', icon: <BulbOutlined />, color: 'green' }
];

const News = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewNews, setPreviewNews] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    fetchNews();
  }, [filterCategory]);

  const fetchNews = async () => {
    try {
      const params = filterCategory ? `?category=${filterCategory}` : '';
      const response = await adminApi.get(`/news${params}`);
      setNews(response.data);
    } catch (error) {
      toast.error('Мэдээ татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (newsItem = null) => {
    if (newsItem) {
      setEditingNews(newsItem);
      form.setFieldsValue({
        title: newsItem.title,
        content: newsItem.content,
        category: newsItem.category,
        isActive: newsItem.isActive,
        imageUrl: newsItem.imageUrl || '',
        pdfUrl: newsItem.pdfUrl || '',
        youtubeUrl: newsItem.youtubeUrl || '',
        googleSlidesUrl: newsItem.googleSlidesUrl || ''
      });
    } else {
      setEditingNews(null);
      form.resetFields();
      form.setFieldsValue({ category: 'change', isActive: true });
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingNews) {
        await adminApi.put(`/news/${editingNews._id}`, values);
        toast.success('Мэдээ шинэчлэгдлээ');
      } else {
        await adminApi.post('/news', values);
        toast.success('Мэдээ нэмэгдлээ');
      }
      setModalVisible(false);
      form.resetFields();
      fetchNews();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Алдаа гарлаа');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (newsItem) => {
    try {
      await adminApi.delete(`/news/${newsItem._id}`);
      toast.success('Мэдээ устгагдлаа');
      fetchNews();
    } catch (error) {
      toast.error('Устгахад алдаа гарлаа');
    }
  };

  const handleUpload = async (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    setUploading(true);
    try {
      const response = await adminApi.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const field = type === 'image' ? 'imageUrl' : 'pdfUrl';
      form.setFieldValue(field, response.data.url);
      toast.success('Файл амжилттай хуулагдлаа');
    } catch (error) {
      toast.error('Файл хуулахад алдаа гарлаа');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const getCategoryInfo = (category) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  };

  const columns = [
    {
      title: 'Гарчиг',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div>
          <Text strong>{title}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {record.content?.substring(0, 80)}...
            </Text>
          </div>
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
      title: 'Медиа',
      key: 'media',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.imageUrl && <Tooltip title="Зураг"><FileImageOutlined style={{ color: '#1890ff' }} /></Tooltip>}
          {record.pdfUrl && <Tooltip title="PDF"><FilePdfOutlined style={{ color: '#f5222d' }} /></Tooltip>}
          {record.youtubeUrl && <Tooltip title="YouTube"><YoutubeOutlined style={{ color: '#ff0000' }} /></Tooltip>}
          {record.googleSlidesUrl && <Tooltip title="Google Slides"><PlaySquareOutlined style={{ color: '#FBBC04' }} /></Tooltip>}
          {!record.imageUrl && !record.pdfUrl && !record.youtubeUrl && !record.googleSlidesUrl && <Text type="secondary">-</Text>}
        </Space>
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
            <Button type="text" icon={<EyeOutlined />} onClick={() => {
              setPreviewNews(record);
              setPreviewVisible(true);
            }} />
          </Tooltip>
          <Tooltip title="Засах">
            <Button type="text" icon={<EditOutlined />} onClick={() => openModal(record)} />
          </Tooltip>
          <Popconfirm
            title="Мэдээ устгах"
            description={`"${record.title}" мэдээг устгах уу?`}
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
    <AdminLayout title="Мэдээ мэдээлэл">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select
            placeholder="Бүх ангилал"
            value={filterCategory || undefined}
            onChange={setFilterCategory}
            allowClear
            style={{ width: 200 }}
          >
            {CATEGORIES.map(c => (
              <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>
            ))}
          </Select>
          <Text type="secondary">Нийт {news.length} мэдээ</Text>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Мэдээ нэмэх
        </Button>
      </div>

      <Table
        dataSource={news}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Нийт ${total}` }}
        style={{ background: token.colorBgContainer, borderRadius: 8 }}
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingNews ? 'Мэдээ засах' : 'Мэдээ нэмэх'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={700}
        destroyOnHidden
      >
        <Spin spinning={uploading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            style={{ marginTop: 16 }}
          >
            <Form.Item
              name="title"
              label="Гарчиг"
              rules={[{ required: true, message: 'Гарчиг оруулна уу' }]}
            >
              <Input placeholder="Мэдээний гарчиг" />
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
              name="content"
              label="Агуулга"
              rules={[{ required: true, message: 'Агуулга оруулна уу' }]}
            >
              <TextArea rows={6} placeholder="Мэдээний агуулга" />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item name="imageUrl" label="Зургийн URL">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="imageUrl" noStyle>
                    <Input placeholder="https://..." style={{ flex: 1 }} />
                  </Form.Item>
                  <Upload
                    showUploadList={false}
                    beforeUpload={(file) => handleUpload(file, 'image')}
                    accept="image/*"
                  >
                    <Button icon={<UploadOutlined />} />
                  </Upload>
                </Space.Compact>
              </Form.Item>

              <Form.Item name="pdfUrl" label="PDF URL">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="pdfUrl" noStyle>
                    <Input placeholder="https://..." style={{ flex: 1 }} />
                  </Form.Item>
                  <Upload
                    showUploadList={false}
                    beforeUpload={(file) => handleUpload(file, 'pdf')}
                    accept=".pdf"
                  >
                    <Button icon={<UploadOutlined />} />
                  </Upload>
                </Space.Compact>
              </Form.Item>
            </div>

            <Form.Item name="youtubeUrl" label="YouTube URL">
              <Input placeholder="https://youtube.com/watch?v=..." />
            </Form.Item>

            <Form.Item name="googleSlidesUrl" label="Google Slides URL">
              <Input placeholder="https://docs.google.com/presentation/d/.../edit" />
            </Form.Item>

            <Form.Item name="isActive" label="Идэвхтэй" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  setModalVisible(false);
                  form.resetFields();
                }}>
                  Цуцлах
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  {editingNews ? 'Хадгалах' : 'Нэмэх'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title={previewNews?.title}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={<Button onClick={() => setPreviewVisible(false)}>Хаах</Button>}
        width={700}
      >
        {previewNews && (
          <div>
            <Tag icon={getCategoryInfo(previewNews.category).icon} color={getCategoryInfo(previewNews.category).color}>
              {getCategoryInfo(previewNews.category).label}
            </Tag>
            <Paragraph style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>
              {previewNews.content}
            </Paragraph>
            {previewNews.imageUrl && (
              <Image src={previewNews.imageUrl} style={{ maxWidth: '100%', marginTop: 16 }} />
            )}
            {previewNews.youtubeUrl && (
              <div style={{ marginTop: 16 }}>
                <iframe
                  width="100%"
                  height="315"
                  src={previewNews.youtubeUrl.replace('watch?v=', 'embed/')}
                  title="YouTube video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {previewNews.googleSlidesUrl && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <PlaySquareOutlined style={{ color: '#FBBC04' }} />
                  <Text strong>Google Slides</Text>
                </div>
                <iframe
                  width="100%"
                  height="400"
                  src={previewNews.googleSlidesUrl.includes('/embed') 
                    ? previewNews.googleSlidesUrl 
                    : previewNews.googleSlidesUrl.replace(/\/(edit|view)(\?.*)?$/, '/embed')}
                  title="Google Slides"
                  frameBorder="0"
                  allowFullScreen
                  style={{ borderRadius: 8, border: '1px solid #e8e8e8' }}
                />
              </div>
            )}
            {previewNews.pdfUrl && (
              <Button type="link" href={previewNews.pdfUrl} target="_blank" icon={<FilePdfOutlined />}>
                PDF татах
              </Button>
            )}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
};

export default News;
