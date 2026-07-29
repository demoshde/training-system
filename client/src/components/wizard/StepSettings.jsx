import { useFormContext, Controller } from 'react-hook-form';
import { InputNumber, Switch, Select, Typography, Divider, Form, Alert, Card, Row, Col, theme } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const StepSettings = () => {
  const { control, formState: { errors }, watch } = useFormContext();
  const validityPeriod = watch('validityPeriod');
  const { token } = theme.useToken();
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>Тохиргоо</Title>
        <Text type="secondary">
          Сургалтын тэнцэх оноо болон хүчинтэй хугацааг тохируулна уу
        </Text>
      </div>
      
      {/* Passing Score */}
      <Form.Item
        label="Тэнцэх оноо (%)"
        validateStatus={errors.passingScore ? 'error' : ''}
        help={errors.passingScore?.message || 'Ажилтан энэ оноонд хүрвэл тэнцсэнд тооцогдоно'}
        style={{ marginBottom: 0 }}
      >
        <Controller
          name="passingScore"
          control={control}
          rules={{ 
            required: 'Тэнцэх оноо оруулна уу',
            min: { value: 1, message: 'Хамгийн багадаа 1%' },
            max: { value: 100, message: 'Хамгийн ихдээ 100%' }
          }}
          render={({ field }) => (
            <InputNumber
              {...field}
              size="large"
              min={1}
              max={100}
              formatter={(value) => `${value}%`}
              parser={(value) => value.replace('%', '')}
              style={{ width: 200 }}
              status={errors.passingScore ? 'error' : ''}
            />
          )}
        />
      </Form.Item>
      
      <Divider />
      
      {/* Validity Period */}
      <Form.Item
        label="Гэрчилгээний хүчинтэй хугацаа"
        help={validityPeriod === 0 
          ? 'Гэрчилгээ хугацаагүй хүчинтэй байна'
          : `Гэрчилгээ ${validityPeriod} сарын дараа дуусна, дахин сургалтанд хамрагдах шаардлагатай`
        }
        style={{ marginBottom: 0 }}
      >
        <Controller
          name="validityPeriod"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              size="large"
              style={{ width: 300 }}
              options={[
                { value: 0, label: 'Хугацаагүй (байнга хүчинтэй)' },
                { value: 3, label: '3 сар' },
                { value: 6, label: '6 сар' },
                { value: 12, label: '1 жил' },
                { value: 24, label: '2 жил' },
                { value: 36, label: '3 жил' },
              ]}
            />
          )}
        />
      </Form.Item>
      
      <Divider />
      
      {/* Toggles */}
      <Row gutter={[16, 16]}>
        {/* Is Mandatory */}
        <Col xs={24} md={12}>
          <Card size="small" style={{ background: token.colorBgLayout }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text strong>Заавал үзэх сургалт</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Бүх ажилтнууд заавал үзэх ёстой эсэх
                </Text>
              </div>
              <Controller
                name="isMandatory"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <Switch 
                    checked={value}
                    onChange={onChange}
                  />
                )}
              />
            </div>
          </Card>
        </Col>
        
        {/* Is Active */}
        <Col xs={24} md={12}>
          <Card size="small" style={{ background: token.colorBgLayout }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text strong>Идэвхтэй</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Ажилтнуудад харагдах эсэх
                </Text>
              </div>
              <Controller
                name="isActive"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <Switch 
                    checked={value}
                    onChange={onChange}
                  />
                )}
              />
            </div>
          </Card>
        </Col>
      </Row>
      
      {/* Info Box */}
      <Alert
        title={<span><WarningOutlined /> Анхааруулга</span>}
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Тэнцэх оноог хэтэрхий өндөр тавибал ажилтнууд олон удаа оролдох хэрэгтэй болно</li>
            <li>Хүчинтэй хугацаа дуусахад ажилтнуудад мэдэгдэл очно</li>
            <li>Идэвхгүй сургалтыг ажилтнууд харахгүй</li>
          </ul>
        }
        type="warning"
        showIcon={false}
      />
    </div>
  );
};

export default StepSettings;
