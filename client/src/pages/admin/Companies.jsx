import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api';
import toast from 'react-hot-toast';
import { Table, Button, Modal, Form, Input, Space, Typography, Popconfirm, theme } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;

const Companies = () => {
  const { token } = theme.useToken();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await adminApi.get('/companies');
      setCompanies(res.data);
    } catch (error) {
      toast.error('Компаний мэдээлэл татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (company = null) => {
    if (company) {
      setEditingCompany(company);
      form.setFieldsValue({ name: company.name, description: company.description || '' });
    } else {
      setEditingCompany(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingCompany) {
        await adminApi.put(`/companies/${editingCompany._id}`, values);
        toast.success('Компани амжилттай шинэчлэгдлээ');
      } else {
        await adminApi.post('/companies', values);
        toast.success('Компани амжилттай нэмэгдлээ');
      }
      fetchCompanies();
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Алдаа гарлаа');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (company) => {
    try {
      await adminApi.delete(`/companies/${company._id}`);
      toast.success('Компани устгагдлаа');
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Устгахад алдаа гарлаа');
    }
  };

  const columns = [
    {
      title: 'Нэр',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Тайлбар',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || '-',
    },
    {
      title: 'Ажилтан',
      dataIndex: 'workerCount',
      key: 'workerCount',
      width: 120,
      sorter: (a, b) => (a.workerCount || 0) - (b.workerCount || 0),
      render: (count) => (
        <Space>
          <TeamOutlined />
          {count || 0}
        </Space>
      ),
    },
    {
      title: 'Үйлдэл',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          />
          <Popconfirm
            title="Компани устгах"
            description={`"${record.name}" компанийг устгах уу?`}
            onConfirm={() => handleDelete(record)}
            okText="Устгах"
            cancelText="Цуцлах"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout title="Компани">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#666' }}>Нийт {companies.length} компани</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Компани нэмэх
        </Button>
      </div>

      <Table
        dataSource={companies}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Нийт ${total}` }}
        style={{ background: token.colorBgContainer, borderRadius: 8 }}
      />

      <Modal
        title={editingCompany ? 'Компани засах' : 'Компани нэмэх'}
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
            name="name"
            label="Нэр"
            rules={[{ required: true, message: 'Нэр оруулна уу' }]}
          >
            <Input placeholder="Компанийн нэр" />
          </Form.Item>

          <Form.Item name="description" label="Тайлбар">
            <TextArea rows={3} placeholder="Тайлбар" />
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
                {editingCompany ? 'Хадгалах' : 'Нэмэх'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
};

export default Companies;
