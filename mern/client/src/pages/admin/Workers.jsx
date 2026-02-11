import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import toast from 'react-hot-toast';
import { 
  Table, Button, Modal, Form, Input, Select, Space, Tag, Progress, 
  DatePicker, Typography, Popconfirm, Tooltip, Badge, Spin, theme, Alert, Upload
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  DownOutlined, RightOutlined, BookOutlined, TrophyOutlined, 
  SafetyCertificateOutlined, CalendarOutlined, UploadOutlined, InboxOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Text } = Typography;

const Workers = () => {
  const { admin } = useAdminAuth();
  const { token } = theme.useToken();
  const [workers, setWorkers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [workerEnrollments, setWorkerEnrollments] = useState({});
  const [loadingEnrollments, setLoadingEnrollments] = useState({});
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [workersRes, companiesRes] = await Promise.all([
        adminApi.get('/workers'),
        adminApi.get('/companies')
      ]);
      setWorkers(workersRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      toast.error('Мэдээлэл татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (worker = null) => {
    if (worker) {
      setEditingWorker(worker);
      form.setFieldsValue({
        sapId: worker.sapId,
        firstName: worker.firstName,
        lastName: worker.lastName,
        company: worker.company?._id || worker.company,
        position: worker.position || '',
        birthDate: worker.birthDate ? dayjs(worker.birthDate) : null,
        employmentDate: worker.employmentDate ? dayjs(worker.employmentDate) : null,
        helmetColor: worker.helmetColor || ''
      });
    } else {
      setEditingWorker(null);
      form.resetFields();
      if (admin?.role !== 'super_admin') {
        form.setFieldValue('company', admin?.company?._id);
      }
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    const data = {
      ...values,
      birthDate: values.birthDate?.format('YYYY-MM-DD'),
      employmentDate: values.employmentDate?.format('YYYY-MM-DD'),
    };
    
    try {
      if (editingWorker) {
        await adminApi.put(`/workers/${editingWorker._id}`, data);
        toast.success('Ажилтан амжилттай шинэчлэгдлээ');
      } else {
        await adminApi.post('/workers', data);
        toast.success('Ажилтан амжилттай нэмэгдлээ');
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

  const handleDelete = async (worker) => {
    try {
      await adminApi.delete(`/workers/${worker._id}`);
      toast.success('Ажилтан устгагдлаа');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Устгахад алдаа гарлаа');
    }
  };

  const fetchEnrollments = async (workerId) => {
    if (workerEnrollments[workerId]) return;
    
    setLoadingEnrollments(prev => ({ ...prev, [workerId]: true }));
    try {
      const res = await adminApi.get(`/workers/${workerId}/enrollments`);
      setWorkerEnrollments(prev => ({ ...prev, [workerId]: res.data }));
    } catch (error) {
      toast.error('Сургалтын мэдээлэл татахад алдаа гарлаа');
    } finally {
      setLoadingEnrollments(prev => ({ ...prev, [workerId]: false }));
    }
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return '-';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const calculateYearsWorked = (employmentDate) => {
    if (!employmentDate) return '-';
    const today = new Date();
    const startDate = new Date(employmentDate);
    let years = today.getFullYear() - startDate.getFullYear();
    const monthDiff = today.getMonth() - startDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < startDate.getDate())) years--;
    if (years < 1) {
      const months = (today.getFullYear() - startDate.getFullYear()) * 12 + today.getMonth() - startDate.getMonth();
      return months > 0 ? `${months} сар` : 'Шинэ';
    }
    return `${years} жил`;
  };

  const handleFileUpload = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip empty rows and header
        const dataRows = jsonData.slice(1).filter(row => row.length > 0 && row[0]);
        
        setParsedData(dataRows);
        setExcelFile(file);
        toast.success(`${dataRows.length} мөр уншигдлаа`);
      } catch (error) {
        toast.error('Excel файл уншихад алдаа гарлаа');
        console.error(error);
      }
    };
    
    reader.readAsArrayBuffer(file);
    return false; // Prevent auto upload
  };

  const handleBulkImport = async () => {
    if (parsedData.length === 0) {
      toast.error('Excel файл оруулна уу');
      return;
    }

    setBulkImporting(true);
    setBulkResults(null);

    try {
      const results = {
        success: [],
        failed: [],
        skipped: []
      };

      for (const line of parsedData) {
        const parts = line.map(cell => cell ? String(cell).trim() : '');
        
        if (parts.length < 8) {
          results.failed.push({ line: parts.join(' '), reason: 'Дутуу мэдээлэл' });
          continue;
        }

        const [sapId, companyName, lastName, firstName, position, helmetColor, birthDate, employmentDate] = parts;
        
        // Find company by name
        const company = companies.find(c => c.name === companyName);
        if (!company) {
          results.failed.push({ sapId, reason: `Компани олдсонгүй: ${companyName}` });
          continue;
        }

        // Check if worker already exists
        const existingWorker = workers.find(w => w.sapId === String(sapId));
        if (existingWorker) {
          results.skipped.push({ sapId, name: `${lastName} ${firstName}` });
          continue;
        }

        // Parse dates - handle both Excel serial dates and text dates
        const parseDate = (dateValue) => {
          if (!dateValue) return null;
          
          // If it's an Excel serial date (number)
          if (typeof dateValue === 'number') {
            const excelDate = XLSX.SSF.parse_date_code(dateValue);
            return dayjs(`${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`).format('YYYY-MM-DD');
          }
          
          // If it's a text date (MM/DD/YYYY)
          const dateStr = String(dateValue);
          if (dateStr.includes('/')) {
            const [month, day, year] = dateStr.split('/');
            return dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).format('YYYY-MM-DD');
          }
          
          return null;
        };

        const workerData = {
          sapId: String(sapId),
          firstName,
          lastName,
          company: company._id,
          position,
          helmetColor,
          birthDate: parseDate(birthDate),
          employmentDate: parseDate(employmentDate)
        };

        try {
          await adminApi.post('/workers', workerData);
          results.success.push({ sapId, name: `${lastName} ${firstName}` });
        } catch (error) {
          results.failed.push({ 
            sapId, 
            reason: error.response?.data?.message || 'Нэмэхэд алдаа гарлаа' 
          });
        }
      }

      setBulkResults(results);
      
      if (results.success.length > 0) {
        toast.success(`${results.success.length} ажилтан амжилттай нэмэгдлээ`);
        fetchData();
      }
      
      if (results.failed.length > 0) {
        toast.error(`${results.failed.length} ажилтан нэмэгдсэнгүй`);
      }

      if (results.skipped.length > 0) {
        toast.info(`${results.skipped.length} ажилтан аль хэдийн бүртгэгдсэн`);
      }

    } catch (error) {
      toast.error('Импорт хийхэд алдаа гарлаа');
    } finally {
      setBulkImporting(false);
    }
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = 
      worker.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.sapId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = !filterCompany || (worker.company?._id || worker.company) === filterCompany;
    return matchesSearch && matchesCompany;
  });

  const columns = [
    {
      title: 'SAP',
      dataIndex: 'sapId',
      key: 'sapId',
      width: 100,
      sorter: (a, b) => a.sapId.localeCompare(b.sapId),
    },
    {
      title: 'Нэр',
      key: 'name',
      sorter: (a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      render: (_, r) => (
        <div>
          <Text strong>{r.lastName} {r.firstName}</Text>
          {r.position && <div><Text type="secondary" style={{ fontSize: 12 }}>{r.position}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Компани',
      key: 'company',
      width: 150,
      filters: companies.map(c => ({ text: c.name, value: c._id })),
      onFilter: (value, record) => (record.company?._id || record.company) === value,
      render: (_, r) => <Tag>{r.company?.name || '-'}</Tag>,
    },
    {
      title: 'Сургалт',
      key: 'trainings',
      width: 150,
      render: (_, record) => {
        const enrollments = workerEnrollments[record._id];
        if (!enrollments) return <Text type="secondary">-</Text>;
        const completed = enrollments.filter(e => e.isPassed && !e.certificate?.isExpired).length;
        const total = enrollments.length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        return (
          <Space>
            <Progress 
              percent={pct} 
              size="small" 
              style={{ width: 80 }}
              strokeColor={pct >= 80 ? '#52c41a' : pct >= 50 ? '#faad14' : '#f5222d'}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>{completed}/{total}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Нас',
      key: 'age',
      width: 70,
      render: (_, r) => calculateAge(r.birthDate),
    },
    {
      title: 'Ажилсан',
      key: 'yearsWorked',
      width: 90,
      render: (_, r) => calculateYearsWorked(r.employmentDate),
    },
    {
      title: 'Малгай',
      dataIndex: 'helmetColor',
      key: 'helmetColor',
      width: 80,
      render: (color) => color ? (
        <Tag color={color === 'Ногоон' ? 'green' : 'default'}>{color}</Tag>
      ) : '-',
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
          <Popconfirm
            title="Ажилтан устгах"
            description={`"${record.firstName}" ажилтныг устгах уу?`}
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

  const expandedRowRender = (record) => {
    const enrollments = workerEnrollments[record._id];
    const isLoading = loadingEnrollments[record._id];
    
    if (isLoading) {
      return <div style={{ padding: 20, textAlign: 'center' }}><Spin /></div>;
    }
    
    if (!enrollments || enrollments.length === 0) {
      return (
        <div style={{ 
          padding: 32, 
          textAlign: 'center', 
          background: token.colorBgLayout, 
          borderRadius: 8 
        }}>
          <BookOutlined style={{ fontSize: 32, color: token.colorTextSecondary, marginBottom: 8 }} />
          <div><Text type="secondary">Сургалтын бүртгэл байхгүй</Text></div>
        </div>
      );
    }

    // Calculate stats
    const completed = enrollments.filter(e => e.isPassed && !e.certificate?.isExpired).length;
    const inProgress = enrollments.filter(e => !e.isPassed && !e.certificate?.isExpired).length;
    const expired = enrollments.filter(e => e.certificate?.isExpired).length;
    const avgScore = enrollments.filter(e => e.score).reduce((sum, e) => sum + e.score, 0) / 
                     (enrollments.filter(e => e.score).length || 1);

    return (
      <div style={{ padding: 16 }}>
        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: 12, 
          marginBottom: 16 
        }}>
          <div style={{ 
            background: token.colorSuccessBg, 
            borderRadius: 8, 
            padding: '12px 16px',
            border: `1px solid ${token.colorSuccessBorder}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrophyOutlined style={{ color: token.colorSuccess, fontSize: 20 }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: token.colorSuccess }}>{completed}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Дуусгасан</Text>
              </div>
            </div>
          </div>
          <div style={{ 
            background: token.colorInfoBg, 
            borderRadius: 8, 
            padding: '12px 16px',
            border: `1px solid ${token.colorInfoBorder}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockCircleOutlined style={{ color: token.colorInfo, fontSize: 20 }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: token.colorInfo }}>{inProgress}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Үргэлжилж байна</Text>
              </div>
            </div>
          </div>
          {expired > 0 && (
            <div style={{ 
              background: token.colorErrorBg, 
              borderRadius: 8, 
              padding: '12px 16px',
              border: `1px solid ${token.colorErrorBorder}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExclamationCircleOutlined style={{ color: token.colorError, fontSize: 20 }} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: token.colorError }}>{expired}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Хугацаа дууссан</Text>
                </div>
              </div>
            </div>
          )}
          <div style={{ 
            background: token.colorBgLayout, 
            borderRadius: 8, 
            padding: '12px 16px',
            border: `1px solid ${token.colorBorder}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SafetyCertificateOutlined style={{ color: token.colorWarning, fontSize: 20 }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: token.colorWarning }}>{Math.round(avgScore)}%</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Дундаж оноо</Text>
              </div>
            </div>
          </div>
        </div>

        {/* Training List */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: 12 
        }}>
          {enrollments.map((enrollment) => {
            const isPassed = enrollment.isPassed && !enrollment.certificate?.isExpired;
            const isExpired = enrollment.certificate?.isExpired;
            
            let statusColor = token.colorInfo;
            let statusBg = token.colorInfoBg;
            let statusText = 'Үргэлжилж байна';
            let statusIcon = <ClockCircleOutlined />;
            
            if (isPassed) {
              statusColor = token.colorSuccess;
              statusBg = token.colorSuccessBg;
              statusText = 'Дуусгасан';
              statusIcon = <CheckCircleOutlined />;
            } else if (isExpired) {
              statusColor = token.colorError;
              statusBg = token.colorErrorBg;
              statusText = 'Хугацаа дууссан';
              statusIcon = <ExclamationCircleOutlined />;
            }

            return (
              <div 
                key={enrollment._id}
                style={{ 
                  background: token.colorBgContainer, 
                  borderRadius: 8, 
                  padding: 16,
                  border: `1px solid ${token.colorBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                      {enrollment.training?.title || 'Сургалт'}
                    </Text>
                    <Tag 
                      icon={statusIcon} 
                      style={{ 
                        background: statusBg, 
                        color: statusColor, 
                        border: 'none',
                        margin: 0
                      }}
                    >
                      {statusText}
                    </Tag>
                  </div>
                  {enrollment.score !== null && enrollment.score !== undefined && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: 24, 
                        fontWeight: 700, 
                        color: enrollment.score >= 70 ? token.colorSuccess : token.colorError 
                      }}>
                        {enrollment.score}%
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Оноо</Text>
                    </div>
                  )}
                </div>
                
                {/* Progress Bar */}
                {!isPassed && !isExpired && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Явц</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {enrollment.slidesViewed || 0}/{enrollment.training?.slides?.length || 0} слайд
                      </Text>
                    </div>
                    <Progress 
                      percent={enrollment.training?.slides?.length 
                        ? Math.round((enrollment.slidesViewed || 0) / enrollment.training.slides.length * 100) 
                        : 0
                      } 
                      size="small"
                      strokeColor={token.colorInfo}
                    />
                  </div>
                )}

                {/* Dates */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  paddingTop: 8,
                  marginTop: 'auto'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarOutlined style={{ color: token.colorTextSecondary, fontSize: 12 }} />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Эхэлсэн: {enrollment.startedAt ? dayjs(enrollment.startedAt).format('YYYY-MM-DD') : '-'}
                    </Text>
                  </div>
                  {enrollment.completedAt && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Дууссан: {dayjs(enrollment.completedAt).format('YYYY-MM-DD')}
                    </Text>
                  )}
                </div>

                {/* Certificate Expiry */}
                {enrollment.certificate?.expiresAt && (
                  <div style={{ 
                    background: isExpired ? token.colorErrorBg : token.colorWarningBg,
                    borderRadius: 4,
                    padding: '6px 10px',
                    fontSize: 11
                  }}>
                    <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                    {isExpired ? (
                      <Text type="danger">Сертификат хүчинтэй хугацаа: {dayjs(enrollment.certificate.expiresAt).format('YYYY-MM-DD')} дууссан</Text>
                    ) : (
                      <Text style={{ color: token.colorWarning }}>
                        Хүчинтэй хугацаа: {dayjs(enrollment.certificate.expiresAt).format('YYYY-MM-DD')} хүртэл
                      </Text>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout title="Ажилтан">
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder="Хайх..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />
        {admin?.role === 'super_admin' && (
          <Select
            placeholder="Бүх компани"
            value={filterCompany || undefined}
            onChange={setFilterCompany}
            allowClear
            style={{ width: 180 }}
          >
            {companies.map(c => (
              <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
            ))}
          </Select>
        )}
        <div style={{ flex: 1 }} />
        <Button 
          icon={<UploadOutlined />} 
          onClick={() => {
            setBulkModalVisible(true);
            setBulkResults(null);
            setExcelFile(null);
            setParsedData([]);
          }}
          style={{ marginRight: 8 }}
        >
          Олноор ажилтан нэмэх
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Ажилтан нэмэх
        </Button>
      </div>

      <Table
        dataSource={filteredWorkers}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ 
          pageSize: 20, 
          showSizeChanger: true, 
          showTotal: (total) => `Нийт ${total} ажилтан`,
          pageSizeOptions: [10, 20, 50, 100]
        }}
        expandable={{
          expandedRowRender,
          expandedRowKeys,
          onExpand: (expanded, record) => {
            if (expanded) {
              setExpandedRowKeys([record._id]);
              fetchEnrollments(record._id);
            } else {
              setExpandedRowKeys([]);
            }
          },
          expandIcon: ({ expanded, onExpand, record }) => 
            expanded ? (
              <DownOutlined onClick={e => onExpand(record, e)} style={{ cursor: 'pointer' }} />
            ) : (
              <RightOutlined onClick={e => onExpand(record, e)} style={{ cursor: 'pointer' }} />
            )
        }}
        style={{ background: token.colorBgContainer, borderRadius: 8 }}
      />

      <Modal
        title={editingWorker ? 'Ажилтан засах' : 'Ажилтан нэмэх'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="sapId"
              label="SAP ID"
              rules={[{ required: true, message: 'SAP ID оруулна уу' }]}
            >
              <Input placeholder="SAP ID" />
            </Form.Item>

            <Form.Item
              name="company"
              label="Компани"
              rules={[{ required: true, message: 'Компани сонгоно уу' }]}
            >
              <Select placeholder="Компани сонгох" disabled={admin?.role !== 'super_admin'}>
                {companies.map(c => (
                  <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="lastName"
              label="Овог"
              rules={[{ required: true, message: 'Овог оруулна уу' }]}
            >
              <Input placeholder="Овог" />
            </Form.Item>

            <Form.Item
              name="firstName"
              label="Нэр"
              rules={[{ required: true, message: 'Нэр оруулна уу' }]}
            >
              <Input placeholder="Нэр" />
            </Form.Item>

            <Form.Item name="position" label="Албан тушаал">
              <Input placeholder="Албан тушаал" />
            </Form.Item>

            <Form.Item name="helmetColor" label="Малгайн өнгө">
              <Select placeholder="Сонгох" allowClear>
                <Select.Option value="Ногоон">Ногоон</Select.Option>
                <Select.Option value="Цагаан">Цагаан</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="birthDate" label="Төрсөн огноо">
              <DatePicker style={{ width: '100%' }} placeholder="Огноо сонгох" />
            </Form.Item>

            <Form.Item name="employmentDate" label="Ажилд орсон огноо">
              <DatePicker style={{ width: '100%' }} placeholder="Огноо сонгох" />
            </Form.Item>
          </div>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
                Цуцлах
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingWorker ? 'Хадгалах' : 'Нэмэх'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        title="Олноор ажилтан нэмэх"
        open={bulkModalVisible}
        onCancel={() => {
          setBulkModalVisible(false);
          setBulkResults(null);
          setExcelFile(null);
          setParsedData([]);
        }}
        width={800}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setBulkModalVisible(false);
              setBulkResults(null);
              setExcelFile(null);
              setParsedData([]);
            }}
          >
            Хаах
          </Button>,
          <Button 
            key="import" 
            type="primary" 
            onClick={handleBulkImport}
            loading={bulkImporting}
            disabled={parsedData.length === 0}
          >
            Импорт хийх
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="Зааварчилгаа"
            description={
              <div>
                <p><strong>Excel файл:</strong> .xlsx эсвэл .xls формат</p>
                <p><strong>Баганын дараалал:</strong></p>
                <div style={{ 
                  background: '#f5f5f5', 
                  padding: 8, 
                  borderRadius: 4, 
                  fontFamily: 'monospace',
                  fontSize: 11,
                  marginTop: 8
                }}>
                  1. SAP ID | 2. Компани | 3. Овог | 4. Нэр | 5. Албан тушаал | 6. Малгайн өнгө | 7. Төрсөн огноо | 8. Ажилд орсон огноо
                </div>
                <p style={{ marginTop: 8, marginBottom: 0 }}>
                  <Text type="secondary">• Эхний мөр нь толгой мөр (header) байна</Text><br/>
                  <Text type="secondary">• Аль хэдийн бүртгэгдсэн SAP ID-тай ажилтан алгасагдана</Text><br/>
                  <Text type="secondary">• Огноо автоматаар хөрвүүлэгдэнэ</Text>
                </p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Upload.Dragger
            accept=".xlsx,.xls"
            beforeUpload={handleFileUpload}
            onRemove={() => {
              setExcelFile(null);
              setParsedData([]);
            }}
            maxCount={1}
            fileList={excelFile ? [excelFile] : []}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Excel файлаа энд дарж эсвэл чирж оруулна уу</p>
            <p className="ant-upload-hint">
              .xlsx эсвэл .xls файл дэмжигдэнэ
            </p>
          </Upload.Dragger>

          {parsedData.length > 0 && (
            <Alert
              message={`${parsedData.length} мөр уншигдлаа`}
              type="success"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </div>

        {bulkResults && (
          <div style={{ marginTop: 16 }}>
            {bulkResults.success.length > 0 && (
              <Alert
                message={`Амжилттай: ${bulkResults.success.length} ажилтан`}
                description={
                  <div style={{ maxHeight: 100, overflow: 'auto' }}>
                    {bulkResults.success.map((w, i) => (
                      <div key={i}>• {w.sapId} - {w.name}</div>
                    ))}
                  </div>
                }
                type="success"
                showIcon
                style={{ marginBottom: 8 }}
              />
            )}

            {bulkResults.skipped.length > 0 && (
              <Alert
                message={`Алгассан: ${bulkResults.skipped.length} ажилтан (аль хэдийн бүртгэгдсэн)`}
                description={
                  <div style={{ maxHeight: 100, overflow: 'auto' }}>
                    {bulkResults.skipped.map((w, i) => (
                      <div key={i}>• {w.sapId} - {w.name}</div>
                    ))}
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginBottom: 8 }}
              />
            )}

            {bulkResults.failed.length > 0 && (
              <Alert
                message={`Амжилтгүй: ${bulkResults.failed.length} ажилтан`}
                description={
                  <div style={{ maxHeight: 100, overflow: 'auto' }}>
                    {bulkResults.failed.map((w, i) => (
                      <div key={i}>• {w.sapId || 'Тодорхойгүй'} - {w.reason}</div>
                    ))}
                  </div>
                }
                type="error"
                showIcon
              />
            )}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
};

export default Workers;
