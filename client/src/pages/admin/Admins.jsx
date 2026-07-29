import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api';
import toast from 'react-hot-toast';
import { Table, Button, Modal, Form, Input, Select, Switch, Space, Tag, Typography, Popconfirm, Tooltip, theme } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

const Admins = () => {
  const { admin } = useAdminAuth();
  const { token } = theme.useToken();
  const [admins, setAdmins] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [adminsRes, companiesRes] = await Promise.all([
        adminApi.get('/admins'),
        adminApi.get('/companies')
      ]);
      setAdmins(adminsRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      toast.error('Мэдээлэл татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (adminUser = null) => {
    if (adminUser) {
      setEditingAdmin(adminUser);
      form.setFieldsValue({
        username: adminUser.username,
        password: '',
        fullName: adminUser.fullName || '',
        email: adminUser.email || '',
        role: adminUser.role,
        company: adminUser.company?._id || '',
        isActive: adminUser.isActive !== false
      });
    } else {
      setEditingAdmin(null);
      form.resetFields();
      form.setFieldsValue({ role: 'company_admin', isActive: true });
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const submitData = { ...values };
      if (editingAdmin && !submitData.password) {
        delete submitData.password;
      }
      if (submitData.role === 'super_admin') {
        delete submitData.company;
      }

      if (editingAdmin) {
        await adminApi.put(`/admins/${editingAdmin._id}`, submitData);
        toast.success('Админ амжилттай шинэчлэгдлээ');
      } else {
        await adminApi.post('/admins', submitData);
        toast.success('Админ амжилттай нэмэгдлээ');
      }
      fetchData();
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Алдаа гарлаа');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (adminUser) => {
    if (adminUser._id === admin._id) {
      toast.error('Өөрийгөө устгах боломжгүй');
      return;
    }
    try {
      await adminApi.delete(`/admins/${adminUser._id}`);
      toast.success('Админ устгагдлаа');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Устгахад алдаа гарлаа');
    }
  };

  const columns = [
    {
      title: 'Хэрэглэгчийн нэр',
      dataIndex: 'username',
      key: 'username',
      render: (username, record) => (
        <Space>
          <UserOutlined />
          <Text strong>{username}</Text>
          {record._id === admin._id && <Tag color="green">Та</Tag>}
        </Space>
      ),
    },
    {
      title: 'Бүтэн нэр',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (name) => name || '-',
    },
    {
      title: 'Эрх',
      dataIndex: 'role',
      key: 'role',
      width: 150,
      filters: [
        { text: 'Супер Админ', value: 'super_admin' },
        { text: 'Компани Админ', value: 'company_admin' },
      ],
      onFilter: (value, record) => record.role === value,
      render: (role) => (
        <Tag color={role === 'super_admin' ? 'purple' : 'blue'}>
          {role === 'super_admin' ? 'Супер Админ' : 'Компани Админ'}
        </Tag>
      ),
    },
    {
      title: 'Компани',
      key: 'company',
      render: (_, record) => record.company?.name || '-',
    },
    {
      title: 'Төлөв',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive !== false ? 'green' : 'red'}>
          {isActive !== false ? 'Идэвхтэй' : 'Идэвхгүй'}
        </Tag>
      ),
    },
    {
      title: 'Үйлдэл',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="Засах">
            <Button type="text" icon={<EditOutlined />} onClick={() => openModal(record)} />
          </Tooltip>
          {record._id !== admin._id && (
            <Popconfirm
              title="Админ устгах"
              description={`"${record.username}" админыг устгах уу?`}
              onConfirm={() => handleDelete(record)}
              okText="Устгах"
              cancelText="Цуцлах"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Устгах">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const role = Form.useWatch('role', form);

  return (
    <AdminLayout title="Админ">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#666' }}>Нийт {admins.length} админ</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Админ нэмэх
        </Button>
      </div>

      <Table
        dataSource={admins}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Нийт ${total}` }}
        style={{ background: token.colorBgContainer, borderRadius: 8 }}
      />

      <Modal
        title={editingAdmin ? 'Админ засах' : 'Админ нэмэх'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="username"
            label="Хэрэглэгчийн нэр"
            rules={[{ required: true, message: 'Хэрэглэгчийн нэр оруулна уу' }]}
          >
            <Input placeholder="username" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Нууц үг"
            rules={editingAdmin ? [] : [{ required: true, message: 'Нууц үг оруулна уу' }]}
          >
            <Input.Password placeholder={editingAdmin ? 'Хоосон орхивол хэвээрээ' : 'Нууц үг'} />
          </Form.Item>

          <Form.Item name="fullName" label="Бүтэн нэр">
            <Input placeholder="Бүтэн нэр" />
          </Form.Item>

          <Form.Item name="email" label="Имэйл">
            <Input placeholder="email@example.com" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Эрх"
            rules={[{ required: true, message: 'Эрх сонгоно уу' }]}
          >
            <Select placeholder="Эрх сонгох">
              <Select.Option value="super_admin">Супер Админ</Select.Option>
              <Select.Option value="company_admin">Компани Админ</Select.Option>
            </Select>
          </Form.Item>

          {role === 'company_admin' && (
            <Form.Item
              name="company"
              label="Компани"
              rules={[{ required: true, message: 'Компани сонгоно уу' }]}
            >
              <Select placeholder="Компани сонгох">
                {companies.map(c => (
                  <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

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
                {editingAdmin ? 'Хадгалах' : 'Нэмэх'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
};

export default Admins;
