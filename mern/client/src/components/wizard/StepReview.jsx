import { useFormContext } from 'react-hook-form';
import { Typography, Card, Descriptions, Tag, Empty, Alert, Row, Col, theme } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  QuestionCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const StepReview = () => {
  const { watch, formState: { errors } } = useFormContext();
  const { token } = theme.useToken();
  
  const formData = watch();
  const {
    title,
    description,
    passingScore,
    validityPeriod,
    isMandatory,
    isActive,
    slides = [],
    questions = []
  } = formData;
  
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 10), 0);
  const hasErrors = Object.keys(errors).length > 0;
  
  const getValidityText = (months) => {
    if (months === 0) return 'Хугацаагүй';
    if (months === 12) return '1 жил';
    if (months === 24) return '2 жил';
    if (months === 36) return '3 жил';
    return `${months} сар`;
  };
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>Хянах</Title>
        <Text type="secondary">
          Сургалтын мэдээллийг хянаад хадгалах боломжтой
        </Text>
      </div>
      
      {/* Validation Warnings */}
      {hasErrors && (
        <Alert
          type="error"
          showIcon
          title="Дутуу мэдээлэл байна"
          description="Өмнөх алхамуудад буцаж дутуу мэдээллийг бөглөнө үү"
        />
      )}
      
      {slides.length === 0 && (
        <Alert
          type="warning"
          showIcon
          title="Слайд байхгүй байна"
          description="Сургалтын материал нэмэхгүй бол ажилтнууд зөвхөн шалгалт өгнө"
        />
      )}
      
      {questions.length === 0 && (
        <Alert
          type="warning"
          showIcon
          title="Асуулт байхгүй байна"
          description="Шалгалтын асуулт нэмэхгүй бол ажилтнууд үнэлгээгүй дуусгана"
        />
      )}
      
      {/* Basic Info */}
      <Card title="Үндсэн мэдээлэл" size="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Гарчиг">
            {title || <Text type="secondary">Оруулаагүй</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Тайлбар">
            {description ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>{description}</div>
            ) : (
              <Text type="secondary">Оруулаагүй</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      
      {/* Settings */}
      <Card title="Тохиргоо" size="small">
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <div style={{ textAlign: 'center', padding: 12, background: token.colorBgLayout, borderRadius: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: token.colorPrimary }}>{passingScore || 70}%</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Тэнцэх оноо</Text>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div style={{ textAlign: 'center', padding: 12, background: token.colorBgLayout, borderRadius: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#722ed1' }}>
                {getValidityText(validityPeriod || 0)}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Хүчинтэй хугацаа</Text>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div style={{ textAlign: 'center', padding: 12, background: token.colorBgLayout, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {isMandatory ? (
                  <CheckCircleOutlined style={{ fontSize: 20, color: token.colorSuccess }} />
                ) : (
                  <CloseCircleOutlined style={{ fontSize: 20, color: token.colorTextSecondary }} />
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>Заавал үзэх</Text>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div style={{ textAlign: 'center', padding: 12, background: token.colorBgLayout, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {isActive ? (
                  <Tag color="green">Идэвхтэй</Tag>
                ) : (
                  <Tag>Идэвхгүй</Tag>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>Төлөв</Text>
            </div>
          </Col>
        </Row>
      </Card>
      
      {/* Slides Summary */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Слайдууд</span>
            <Tag color="blue">{slides.length} ширхэг</Tag>
          </div>
        } 
        size="small"
      >
        {slides.length > 0 ? (
          <Row gutter={[8, 8]}>
            {slides.map((slide, index) => (
              <Col key={index} span={3}>
                <div 
                  style={{ 
                    aspectRatio: '1',
                    background: token.colorBgLayout, 
                    borderRadius: 8, 
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}
                >
                  {slide.type === 'text' ? (
                    <FileTextOutlined style={{ fontSize: 24, color: token.colorSuccess }} />
                  ) : slide.contentType === 'application/pdf' ? (
                    <FilePdfOutlined style={{ fontSize: 24, color: token.colorError }} />
                  ) : slide.url ? (
                    <img 
                      src={slide.url} 
                      alt={`Slide ${index + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <FileImageOutlined style={{ fontSize: 24, color: token.colorTextSecondary }} />
                  )}
                  <div style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    background: 'rgba(0,0,0,0.5)', 
                    color: 'white', 
                    fontSize: 11, 
                    textAlign: 'center', 
                    padding: 2 
                  }}>
                    #{index + 1}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="Слайд байхгүй"
          />
        )}
      </Card>
      
      {/* Questions Summary */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Шалгалтын асуултууд</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Tag color="blue">{questions.length} асуулт</Tag>
              <Tag color="green">{totalPoints} оноо</Tag>
            </div>
          </div>
        } 
        size="small"
      >
        {questions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {questions.map((question, index) => (
              <div key={index} style={{ padding: 12, background: token.colorBgLayout, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ 
                    flexShrink: 0, 
                    width: 32, 
                    height: 32, 
                    background: token.colorInfoBg, 
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <QuestionCircleOutlined style={{ color: token.colorPrimary }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong ellipsis>
                        {index + 1}. {question.text}
                      </Text>
                      <Tag color="green" style={{ flexShrink: 0 }}>
                        {question.points || 10} оноо
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {question.options?.length || 0} хариулт, зөв: {' '}
                      <span style={{ color: token.colorSuccess }}>
                        {question.options?.find(o => o.isCorrect)?.text || '-'}
                      </span>
                    </Text>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="Асуулт байхгүй"
          />
        )}
      </Card>
      
      {/* Ready to Save */}
      {!hasErrors && slides.length > 0 && questions.length > 0 && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          title="Бэлэн боллоо!"
          description="Сургалтыг хадгалах бэлэн байна. 'Хадгалах' товч дарна уу."
        />
      )}
    </div>
  );
};

export default StepReview;
