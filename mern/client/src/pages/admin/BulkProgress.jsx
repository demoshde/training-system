import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api';
import toast from 'react-hot-toast';
import { 
  Card, Input, Select, Button, Table, Tag, Progress, Typography, 
  Space, Divider, Empty, Spin, Alert, Statistic, Row, Col, theme
} from 'antd';
import { 
  SearchOutlined, UserOutlined, BookOutlined, 
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined, TeamOutlined, PlusOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Text, Title } = Typography;

const BulkProgress = () => {
  const { token } = theme.useToken();
  const [trainings, setTrainings] = useState([]);
  const [sapInput, setSapInput] = useState('');
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    fetchTrainings();
  }, []);

  const fetchTrainings = async () => {
    try {
      const res = await adminApi.get('/trainings');
      setTrainings(res.data.filter(t => t.isActive));
    } catch (error) {
      toast.error('Сургалтын жагсаалт татахад алдаа гарлаа');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSearch = async () => {
    // Parse SAP IDs from input (supports comma, space, newline separated)
    const sapIds = sapInput
      .split(/[\s,\n]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (sapIds.length === 0) {
      toast.error('SAP дугаар оруулна уу');
      return;
    }

    setLoading(true);
    try {
      const res = await adminApi.post('/enrollments/bulk-check', {
        sapIds,
        trainingId: selectedTraining || undefined
      });
      setResults(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Хайхад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  // Get workers who are not enrolled in the selected training
  const getNotEnrolledWorkers = () => {
    if (!results || !selectedTraining) return [];
    return results.results
      .filter(r => r.found && r.enrollments.length === 0)
      .map(r => r.worker._id);
  };

  // Enroll all not-enrolled workers to selected training
  const handleEnrollAll = async () => {
    const workerIds = getNotEnrolledWorkers();
    if (workerIds.length === 0) {
      toast.error('Бүртгэх ажилтан байхгүй');
      return;
    }

    setEnrolling(true);
    try {
      await adminApi.post('/enrollments/bulk', {
        training: selectedTraining,
        workers: workerIds
      });
      toast.success(`${workerIds.length} ажилтан бүртгэгдлээ`);
      // Re-search to update results
      handleSearch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Бүртгэхэд алдаа гарлаа');
    } finally {
      setEnrolling(false);
    }
  };

  const getStatusTag = (status) => {
    const configs = {
      completed: { color: 'success', text: 'Дууссан' },
      in_progress: { color: 'processing', text: 'Эхэлсэн' },
      enrolled: { color: 'default', text: 'Бүртгэгдсэн' },
      failed: { color: 'error', text: 'Унасан' }
    };
    const config = configs[status] || configs.enrolled;
    return <Tag color={config.color} style={{ margin: 0, padding: '0 6px', fontSize: 11 }}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: 'SAP',
      dataIndex: 'sapId',
      key: 'sapId',
      width: 70,
      sorter: (a, b) => a.sapId.localeCompare(b.sapId),
      render: (sapId, record) => (
        <Text strong style={{ color: record.found ? token.colorText : token.colorError, fontSize: 12 }}>
          {sapId}
        </Text>
      )
    },
    {
      title: 'Ажилтан',
      key: 'worker',
      width: 120,
      sorter: (a, b) => {
        const nameA = a.found ? `${a.worker.lastName} ${a.worker.firstName}` : '';
        const nameB = b.found ? `${b.worker.lastName} ${b.worker.firstName}` : '';
        return nameA.localeCompare(nameB);
      },
      render: (_, record) => {
        if (!record.found) return <Text type="danger" style={{ fontSize: 12 }}>-</Text>;
        return (
          <Text style={{ fontSize: 12 }}>{record.worker.lastName} {record.worker.firstName}</Text>
        );
      }
    },
    {
      title: 'Малгай',
      key: 'helmet',
      width: 60,
      align: 'center',
      sorter: (a, b) => {
        const colorA = a.found ? (a.worker.helmetColor || '') : '';
        const colorB = b.found ? (b.worker.helmetColor || '') : '';
        return colorA.localeCompare(colorB);
      },
      render: (_, record) => {
        if (!record.found) return '-';
        const color = record.worker.helmetColor;
        if (!color) return '-';
        const bgColor = color === 'Ногоон' ? '#52c41a' : '#ffffff';
        const borderColor = color === 'Ногоон' ? '#52c41a' : '#d9d9d9';
        return (
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: bgColor,
            border: `2px solid ${borderColor}`,
            margin: '0 auto'
          }} title={color} />
        );
      }
    },
    {
      title: 'Компани',
      key: 'company',
      width: 130,
      sorter: (a, b) => {
        const compA = a.found ? (a.worker.company?.name || '') : '';
        const compB = b.found ? (b.worker.company?.name || '') : '';
        return compA.localeCompare(compB);
      },
      render: (_, record) => {
        if (!record.found) return '-';
        return <Text type="secondary" style={{ fontSize: 12 }}>{record.worker.company?.name || '-'}</Text>;
      }
    },
    {
      title: 'Сургалт',
      key: 'training',
      sorter: (a, b) => {
        const titleA = a.found && a.enrollments[0]?.training?.title || '';
        const titleB = b.found && b.enrollments[0]?.training?.title || '';
        return titleA.localeCompare(titleB);
      },
      render: (_, record) => {
        if (!record.found || record.enrollments.length === 0) return '-';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {record.enrollments.map((e, i) => (
              <Text key={i} style={{ fontSize: 12, lineHeight: 1.2 }}>{e.training?.title}</Text>
            ))}
          </div>
        );
      }
    },
    {
      title: 'Төлөв',
      key: 'status',
      width: 80,
      align: 'center',
      sorter: (a, b) => {
        const statusOrder = { completed: 3, in_progress: 2, not_started: 1 };
        const statusA = a.found && a.enrollments[0]?.status || '';
        const statusB = b.found && b.enrollments[0]?.status || '';
        return (statusOrder[statusA] || 0) - (statusOrder[statusB] || 0);
      },
      render: (_, record) => {
        if (!record.found) return <Tag color="error" style={{ margin: 0, padding: '0 6px', fontSize: 11 }}>Олдсонгүй</Tag>;
        if (record.enrollments.length === 0) return <Tag color="warning" style={{ margin: 0, padding: '0 6px', fontSize: 11 }}>Бүртгэлгүй</Tag>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {record.enrollments.map((e, i) => <div key={i}>{getStatusTag(e.status)}</div>)}
          </div>
        );
      }
    },
    {
      title: 'Явц',
      key: 'progress',
      width: 80,
      sorter: (a, b) => {
        const progA = a.found && a.enrollments[0]?.progress || 0;
        const progB = b.found && b.enrollments[0]?.progress || 0;
        return progA - progB;
      },
      render: (_, record) => {
        if (!record.found || record.enrollments.length === 0) return '-';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {record.enrollments.map((e, i) => (
              <Progress 
                key={i}
                percent={e.progress || 0} 
                size="small"
                showInfo={false}
                strokeWidth={4}
                status={e.status === 'completed' ? 'success' : e.status === 'failed' ? 'exception' : 'active'}
              />
            ))}
          </div>
        );
      }
    },
    {
      title: '%',
      key: 'score',
      width: 45,
      align: 'center',
      sorter: (a, b) => {
        const scoreA = a.found && a.enrollments[0]?.score != null ? a.enrollments[0].score : -1;
        const scoreB = b.found && b.enrollments[0]?.score != null ? b.enrollments[0].score : -1;
        return scoreA - scoreB;
      },
      render: (_, record) => {
        if (!record.found || record.enrollments.length === 0) return '-';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {record.enrollments.map((e, i) => (
              <Text key={i} style={{ fontSize: 12 }} type={e.isPassed ? 'success' : e.score != null ? 'danger' : 'secondary'}>
                {e.score != null ? e.score : '-'}
              </Text>
            ))}
          </div>
        );
      }
    },
    {
      title: '#',
      key: 'attempts',
      width: 35,
      align: 'center',
      sorter: (a, b) => {
        const attA = a.found && a.enrollments[0]?.attempts || 0;
        const attB = b.found && b.enrollments[0]?.attempts || 0;
        return attA - attB;
      },
      render: (_, record) => {
        if (!record.found || record.enrollments.length === 0) return '-';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {record.enrollments.map((e, i) => (
              <Text key={i} style={{ fontSize: 12 }}>{e.attempts || 0}</Text>
            ))}
          </div>
        );
      }
    }
  ];

  return (
    <AdminLayout title="Явц & Сургалт бүртгэх">
      {/* Compact search bar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={12} align="middle">
          <Col flex="1">
            <Input
              value={sapInput}
              onChange={e => setSapInput(e.target.value)}
              placeholder="SAP дугаарууд: SAP001, SAP002, SAP003..."
              style={{ fontFamily: 'monospace' }}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col flex="300px">
            <Select
              style={{ width: '100%' }}
              placeholder="Сургалт сонгох (бүгд)"
              allowClear
              size="middle"
              value={selectedTraining}
              onChange={setSelectedTraining}
              loading={initialLoading}
              options={trainings.map(t => ({
                value: t._id,
                label: t.title
              }))}
            />
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={loading}
            >
              Шалгах
            </Button>
          </Col>
        </Row>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin size="large" />
        </div>
      )}

      {results && !loading && (
        <>
          {/* Compact stats inline */}
          <div style={{ marginBottom: 12, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tag icon={<TeamOutlined />}>Нийт: {results.total}</Tag>
            <Tag color="success" icon={<CheckCircleOutlined />}>Олдсон: {results.found}</Tag>
            {results.notFound > 0 && (
              <Tag color="error" icon={<ExclamationCircleOutlined />}>Олдоогүй: {results.notFound}</Tag>
            )}
            {selectedTraining && getNotEnrolledWorkers().length > 0 && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                loading={enrolling}
                onClick={handleEnrollAll}
                style={{ marginLeft: 'auto' }}
              >
                Бүртгэлгүй {getNotEnrolledWorkers().length} хүнийг бүртгэх
              </Button>
            )}
          </div>

          <Card size="small" bodyStyle={{ padding: 0 }}>
            <style>{`
              .compact-table .ant-table-tbody > tr > td {
                padding: 4px 8px !important;
                line-height: 1.2;
              }
              .compact-table .ant-table-thead > tr > th {
                padding: 6px 8px !important;
                font-size: 12px;
              }
              .compact-table .ant-progress {
                margin: 0;
              }
            `}</style>
            <Table
              className="compact-table"
              dataSource={results.results}
              columns={columns}
              rowKey="sapId"
              size="small"
              pagination={{ pageSize: 50, size: 'small', showSizeChanger: false }}
              scroll={{ x: 700, y: 'calc(100vh - 240px)' }}
              rowClassName={(record) => !record.found ? 'ant-table-row-warning' : ''}
            />
          </Card>
        </>
      )}

      {!results && !loading && (
        <Card size="small">
          <Empty 
            description="SAP дугаарууд оруулж Enter дарна уу"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </AdminLayout>
  );
};

export default BulkProgress;
