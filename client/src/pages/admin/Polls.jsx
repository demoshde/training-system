import { useState, useEffect } from 'react';
import { 
  Spin, Table, Tag, Button, Input, Space, Tooltip, Progress, Modal, Popconfirm,
  Form, Select, DatePicker, Checkbox, Card, Typography, Divider, theme
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, BarChartOutlined, SearchOutlined,
  StarOutlined, StarFilled, CheckCircleOutlined, UnorderedListOutlined, 
  MessageOutlined, BankOutlined, CloseOutlined
} from '@ant-design/icons';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Polls = () => {
  const { admin } = useAdminAuth();
  const { token } = theme.useToken();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [expandedPollId, setExpandedPollId] = useState(null);
  const [expandedPollStats, setExpandedPollStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingPoll, setDeletingPoll] = useState(null);
  const [form] = Form.useForm();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    questions: [],
    targetAudience: 'all',
    company: '',
    isActive: true,
    isAnonymous: false,
    endDate: ''
  });

  useEffect(() => {
    fetchPolls();
    if (admin?.role === 'super_admin') {
      fetchCompanies();
    }
  }, [admin?.role]);

  const fetchPolls = async () => {
    try {
      const res = await adminApi.get('/polls');
      // Fetch company stats for each poll
      const pollsWithStats = await Promise.all(res.data.map(async (poll) => {
        try {
          const statsRes = await adminApi.get(`/polls/${poll._id}/company-stats`);
          return { ...poll, companyStats: statsRes.data };
        } catch (error) {
          return { ...poll, companyStats: null };
        }
      }));
      setPolls(pollsWithStats);
    } catch (error) {
      toast.error('Санал асуулга татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await adminApi.get('/companies');
      setCompanies(res.data);
    } catch (error) {
      console.error('Failed to fetch companies');
    }
  };

  const openModal = (poll = null) => {
    if (poll) {
      setSelectedPoll(poll);
      setFormData({
        title: poll.title,
        description: poll.description || '',
        questions: poll.questions || [],
        targetAudience: poll.targetAudience || 'all',
        company: poll.company?._id || '',
        isActive: poll.isActive,
        isAnonymous: poll.isAnonymous || false,
        endDate: poll.endDate ? poll.endDate.split('T')[0] : ''
      });
    } else {
      setSelectedPoll(null);
      setFormData({
        title: '',
        description: '',
        questions: [],
        targetAudience: 'all',
        company: '',
        isActive: true,
        isAnonymous: false,
        endDate: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (formData.questions.length === 0) {
      toast.error('Хамгийн багадаа 1 асуулт нэмнэ үү');
      return;
    }
    
    try {
      const data = {
        ...formData,
        company: formData.targetAudience === 'company' ? formData.company : null
      };
      
      if (selectedPoll) {
        await adminApi.put(`/polls/${selectedPoll._id}`, data);
        toast.success('Санал асуулга шинэчлэгдлээ');
      } else {
        await adminApi.post('/polls', data);
        toast.success('Санал асуулга үүсгэгдлээ');
      }
      
      setShowModal(false);
      fetchPolls();
    } catch (error) {
      toast.error('Алдаа гарлаа');
    }
  };

  const handleDelete = async (poll) => {
    try {
      await adminApi.delete(`/polls/${poll._id}`);
      toast.success('Устгагдлаа');
      fetchPolls();
    } catch (error) {
      toast.error('Устгахад алдаа гарлаа');
    }
  };

  const toggleStats = async (poll) => {
    if (expandedPollId === poll._id) {
      setExpandedPollId(null);
      setExpandedPollStats(null);
      return;
    }
    try {
      const res = await adminApi.get(`/polls/${poll._id}/stats`);
      setExpandedPollStats(res.data);
      setExpandedPollId(poll._id);
    } catch (error) {
      toast.error('Статистик татахад алдаа гарлаа');
    }
  };

  // Question management
  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        {
          questionText: '',
          questionType: 'text',
          options: [],
          required: false
        }
      ]
    });
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...formData.questions];
    updated[index][field] = value;
    
    // Reset options when type changes
    if (field === 'questionType') {
      if (value === 'single_choice' || value === 'multiple_choice') {
        updated[index].options = [{ text: '' }, { text: '' }];
      } else {
        updated[index].options = [];
      }
    }
    
    setFormData({ ...formData, questions: updated });
  };

  const removeQuestion = (index) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter((_, i) => i !== index)
    });
  };

  const addOption = (questionIndex) => {
    const updated = [...formData.questions];
    updated[questionIndex].options.push({ text: '' });
    setFormData({ ...formData, questions: updated });
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    const updated = [...formData.questions];
    updated[questionIndex].options[optionIndex].text = value;
    setFormData({ ...formData, questions: updated });
  };

  const removeOption = (questionIndex, optionIndex) => {
    const updated = [...formData.questions];
    updated[questionIndex].options = updated[questionIndex].options.filter((_, i) => i !== optionIndex);
    setFormData({ ...formData, questions: updated });
  };

  const getQuestionTypeIcon = (type) => {
    switch (type) {
      case 'rating': return <StarOutlined />;
      case 'single_choice': return <CheckCircleOutlined />;
      case 'multiple_choice': return <UnorderedListOutlined />;
      default: return <MessageOutlined />;
    }
  };

  const getQuestionTypeName = (type) => {
    switch (type) {
      case 'rating': return 'Үнэлгээ (1-5)';
      case 'single_choice': return 'Нэг сонголт';
      case 'multiple_choice': return 'Олон сонголт';
      default: return 'Текст';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
          <Spin size="large" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Санал асуулга</Title>
            <Text type="secondary">Ажилтнуудаас санал хүсэлт авах</Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
            size="large"
          >
            Шинэ санал асуулга
          </Button>
        </div>

        {/* Table */}
        <Card styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={polls}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Нийт ${total}` }}
            expandable={{
              expandedRowRender: (poll) => (
                <div style={{ padding: 16 }}>
                  {/* Company Stats */}
                  {poll.companyStats?.companies?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <BankOutlined />
                        Компаниар хариулсан хувь
                      </Text>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                        {poll.companyStats.companies.map((company, idx) => {
                          const colors = ['#1890ff', '#722ed1', '#52c41a', '#fa8c16', '#eb2f96', '#13c2c2'];
                          const color = colors[idx % colors.length];
                          return (
                            <Card key={company.companyId} size="small" style={{ background: token.colorBgLayout }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text strong style={{ fontSize: 13 }}>{company.companyName}</Text>
                                <Text strong style={{ 
                                  color: company.responseRate >= 80 ? token.colorSuccess : 
                                         company.responseRate >= 50 ? token.colorWarning : token.colorError 
                                }}>
                                  {company.responseRate}%
                                </Text>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                {company.responses} / {company.totalWorkers}
                              </Text>
                              <Progress percent={company.responseRate} showInfo={false} strokeColor={color} size="small" />
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Poll Stats */}
                  {expandedPollId === poll._id && expandedPollStats && (
                    <div style={{ borderTop: `1px solid ${token.colorBorder}`, paddingTop: 16 }}>
                      <Text strong style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <BarChartOutlined style={{ color: token.colorSuccess }} />
                        Хариултын статистик ({expandedPollStats.totalResponses} хариулт)
                      </Text>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                        {expandedPollStats.questions.slice(0, 12).map((q, index) => (
                          <Card key={index} size="small" style={{ background: token.colorBgLayout }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                              {getQuestionTypeIcon(q.questionType)}
                              <Text strong style={{ fontSize: 13 }} ellipsis={{ tooltip: q.questionText }}>{q.questionText}</Text>
                            </div>
                            {q.questionType === 'rating' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{q.averageRating}</Text>
                                <Space size={2}>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    star <= Math.round(q.averageRating) 
                                      ? <StarFilled key={star} style={{ color: '#faad14', fontSize: 14 }} />
                                      : <StarOutlined key={star} style={{ color: '#d9d9d9', fontSize: 14 }} />
                                  ))}
                                </Space>
                              </div>
                            )}
                            {(q.questionType === 'single_choice' || q.questionType === 'multiple_choice') && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {q.optionCounts?.slice(0, 5).map((opt, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Text style={{ width: 80, fontSize: 12 }} ellipsis>{opt.option}</Text>
                                    <Progress 
                                      percent={expandedPollStats.totalResponses > 0 ? Math.round((opt.count / expandedPollStats.totalResponses) * 100) : 0} 
                                      size="small" 
                                      style={{ flex: 1 }} 
                                    />
                                    <Text type="secondary" style={{ fontSize: 12, width: 16 }}>{opt.count}</Text>
                                  </div>
                                ))}
                              </div>
                            )}
                            {q.questionType === 'text' && (
                              <div style={{ maxHeight: 96, overflowY: 'auto' }}>
                                {q.textResponses?.length > 0 ? (
                                  q.textResponses.slice(0, 3).map((text, i) => (
                                    <div key={i} style={{ 
                                      background: token.colorBgContainer, 
                                      borderRadius: 4, 
                                      padding: 8, 
                                      marginBottom: 4, 
                                      fontSize: 12 
                                    }}>
                                      {text}
                                    </div>
                                  ))
                                ) : (
                                  <Text type="secondary" style={{ fontSize: 12 }}>Хариулт байхгүй</Text>
                                )}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ),
              rowExpandable: () => true,
            }}
            columns={[
              {
                title: 'Гарчиг',
                dataIndex: 'title',
                key: 'title',
                filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                  <div style={{ padding: 8 }}>
                    <Input
                      placeholder="Хайх..."
                      value={selectedKeys[0]}
                      onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                      onPressEnter={() => confirm()}
                      style={{ marginBottom: 8, display: 'block' }}
                    />
                    <Space>
                      <Button type="primary" onClick={() => confirm()} size="small">Хайх</Button>
                      <Button onClick={() => clearFilters()} size="small">Арилгах</Button>
                    </Space>
                  </div>
                ),
                filterIcon: filtered => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
                onFilter: (value, record) => record.title?.toLowerCase().includes(value.toLowerCase()),
                render: (title, record) => (
                  <div>
                    <Text strong>{title}</Text>
                    {record.description && <Text type="secondary" style={{ display: 'block', fontSize: 12, maxWidth: 280 }} ellipsis>{record.description}</Text>}
                  </div>
                ),
              },
              {
                title: 'Төлөв',
                dataIndex: 'isActive',
                key: 'isActive',
                width: 120,
                filters: [
                  { text: 'Идэвхтэй', value: true },
                  { text: 'Идэвхгүй', value: false },
                ],
                onFilter: (value, record) => record.isActive === value,
                render: (isActive, record) => (
                  <Space>
                    <Tag color={isActive ? 'green' : 'default'}>{isActive ? 'Идэвхтэй' : 'Идэвхгүй'}</Tag>
                    {record.isAnonymous && <Tag color="purple">Нэргүй</Tag>}
                  </Space>
                ),
              },
              {
                title: 'Асуулт',
                key: 'questions',
                width: 80,
                render: (_, record) => <span>{record.questions?.length || 0}</span>,
              },
              {
                title: 'Хариулт',
                key: 'responses',
                width: 150,
                sorter: (a, b) => (a.companyStats?.overall?.responseRate || 0) - (b.companyStats?.overall?.responseRate || 0),
                render: (_, record) => {
                  const rate = record.companyStats?.overall?.responseRate || 0;
                  const responses = record.companyStats?.overall?.totalResponses || 0;
                  const total = record.companyStats?.overall?.totalWorkers || 0;
                  return (
                    <div>
                      <Progress 
                        percent={rate} 
                        size="small" 
                        strokeColor={rate >= 80 ? '#52c41a' : rate >= 50 ? '#faad14' : '#ff4d4f'}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>{responses} / {total}</Text>
                    </div>
                  );
                },
              },
              {
                title: 'Хамрах хүрээ',
                key: 'target',
                width: 150,
                render: (_, record) => (
                  record.company ? (
                    <Tag color="blue">{record.company.name}</Tag>
                  ) : (
                    <Tag color="green">Бүх ажилтан</Tag>
                  )
                ),
              },
              {
                title: 'Үйлдэл',
                key: 'actions',
                width: 150,
                render: (_, record) => {
                  // Company admin cannot edit/delete global polls (company: null / targetAudience: 'all')
                  const canEditDelete = admin?.role === 'super_admin' || record.company;
                  
                  return (
                    <Space>
                      <Tooltip title="Статистик">
                        <Button
                          type={expandedPollId === record._id ? 'primary' : 'default'}
                          icon={<BarChartOutlined />}
                          onClick={() => toggleStats(record)}
                          size="small"
                        />
                      </Tooltip>
                      {canEditDelete && (
                        <>
                          <Tooltip title="Засах">
                            <Button
                              icon={<EditOutlined />}
                              onClick={() => openModal(record)}
                              size="small"
                            />
                          </Tooltip>
                          <Popconfirm
                            title="Санал асуулга устгах"
                            description={`"${record.title}" санал асуулгыг устгах уу?`}
                            onConfirm={() => handleDelete(record)}
                            okText="Устгах"
                            cancelText="Цуцлах"
                            okButtonProps={{ danger: true }}
                          >
                            <Tooltip title="Устгах">
                              <Button
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                              />
                            </Tooltip>
                          </Popconfirm>
                        </>
                      )}
                    </Space>
                  );
                },
              },
            ]}
          />
        </Card>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onCancel={() => setShowModal(false)}
        title={selectedPoll ? 'Санал асуулга засах' : 'Шинэ санал асуулга'}
        width={800}
        footer={null}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form layout="vertical" onFinish={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="Гарчиг" required style={{ gridColumn: 'span 2' }}>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Санал асуулгын гарчиг"
              />
            </Form.Item>
            
            <Form.Item label="Тайлбар" style={{ gridColumn: 'span 2' }}>
              <TextArea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Тайлбар"
              />
            </Form.Item>

            {admin?.role === 'super_admin' ? (
              <>
                <Form.Item label="Хамрах хүрээ">
                  <Select
                    value={formData.targetAudience}
                    onChange={(value) => setFormData({ ...formData, targetAudience: value })}
                  >
                    <Select.Option value="all">Бүх ажилтан</Select.Option>
                    <Select.Option value="company">Тодорхой компани</Select.Option>
                  </Select>
                </Form.Item>

                {formData.targetAudience === 'company' && (
                  <Form.Item label="Компани">
                    <Select
                      value={formData.company}
                      onChange={(value) => setFormData({ ...formData, company: value })}
                      placeholder="Сонгоно уу"
                    >
                      {companies.map((c) => (
                        <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )}
              </>
            ) : (
              <Form.Item label="Хамрах хүрээ">
                <Tag color="blue">{admin?.company?.name || 'Таны компани'}</Tag>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  (Зөвхөн өөрийн компани дотор явуулах боломжтой)
                </Text>
              </Form.Item>
            )}

            <Form.Item label="Дуусах огноо">
              <DatePicker
                value={formData.endDate ? dayjs(formData.endDate) : null}
                onChange={(date) => setFormData({ ...formData, endDate: date ? date.format('YYYY-MM-DD') : '' })}
                style={{ width: '100%' }}
                placeholder="Огноо сонгох"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Space size={24}>
                <Checkbox
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                >
                  Идэвхтэй
                </Checkbox>
                <Checkbox
                  checked={formData.isAnonymous}
                  onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                >
                  Нэргүй санал асуулга
                </Checkbox>
              </Space>
            </Form.Item>
          </div>

          <Divider />

          {/* Questions */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text strong>Асуултууд</Text>
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={addQuestion}
              >
                Асуулт нэмэх
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formData.questions.map((q, qIndex) => (
                <Card 
                  key={qIndex} 
                  size="small"
                  title={<Text type="secondary">Асуулт {qIndex + 1}</Text>}
                  extra={
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeQuestion(qIndex)}
                    />
                  }
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Input
                      value={q.questionText}
                      onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                      placeholder="Асуултын текст"
                    />

                    <Space>
                      <Select
                        value={q.questionType}
                        onChange={(value) => updateQuestion(qIndex, 'questionType', value)}
                        style={{ width: 180 }}
                      >
                        <Select.Option value="text">Текст</Select.Option>
                        <Select.Option value="rating">Үнэлгээ (1-5)</Select.Option>
                        <Select.Option value="single_choice">Нэг сонголт</Select.Option>
                        <Select.Option value="multiple_choice">Олон сонголт</Select.Option>
                      </Select>

                      <Checkbox
                        checked={q.required}
                        onChange={(e) => updateQuestion(qIndex, 'required', e.target.checked)}
                      >
                        Заавал
                      </Checkbox>
                    </Space>

                    {/* Options for choice questions */}
                    {(q.questionType === 'single_choice' || q.questionType === 'multiple_choice') && (
                      <div style={{ paddingLeft: 16 }}>
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Input
                              value={opt.text}
                              onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                              placeholder={`Сонголт ${optIndex + 1}`}
                              style={{ flex: 1 }}
                              size="small"
                            />
                            {q.options.length > 2 && (
                              <Button
                                type="text"
                                danger
                                icon={<CloseOutlined />}
                                onClick={() => removeOption(qIndex, optIndex)}
                                size="small"
                              />
                            )}
                          </div>
                        ))}
                        <Button
                          type="link"
                          size="small"
                          onClick={() => addOption(qIndex)}
                        >
                          + Сонголт нэмэх
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}

              {formData.questions.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 32, 
                  border: `2px dashed ${token.colorBorder}`, 
                  borderRadius: 8 
                }}>
                  <Text type="secondary">Асуулт нэмнэ үү</Text>
                </div>
              )}
            </div>
          </div>

          <Divider />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={() => setShowModal(false)}>
              Цуцлах
            </Button>
            <Button type="primary" htmlType="submit">
              {selectedPoll ? 'Хадгалах' : 'Үүсгэх'}
            </Button>
          </div>
        </Form>
      </Modal>

    </AdminLayout>
  );
};

export default Polls;
