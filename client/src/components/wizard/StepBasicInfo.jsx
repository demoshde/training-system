import { useFormContext, Controller } from 'react-hook-form';
import { Input, Typography, Form, Alert, theme } from 'antd';
import { BulbOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Title, Text } = Typography;

const StepBasicInfo = () => {
  const { control, formState: { errors } } = useFormContext();
  const { token } = theme.useToken();
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>Үндсэн мэдээлэл</Title>
        <Text type="secondary">
          Сургалтын нэр болон товч тайлбарыг оруулна уу
        </Text>
      </div>
      
      {/* Title */}
      <Form.Item
        label={<span>Сургалтын нэр <span style={{ color: token.colorError }}>*</span></span>}
        validateStatus={errors.title ? 'error' : ''}
        help={errors.title?.message}
        style={{ marginBottom: 0 }}
      >
        <Controller
          name="title"
          control={control}
          rules={{ 
            required: 'Сургалтын нэр оруулна уу',
            minLength: { value: 3, message: 'Хамгийн багадаа 3 тэмдэгт' },
            maxLength: { value: 200, message: 'Хамгийн ихдээ 200 тэмдэгт' }
          }}
          render={({ field }) => (
            <Input 
              {...field}
              size="large"
              placeholder="Жишээ: Галын аюулаас урьдчилан сэргийлэх"
              status={errors.title ? 'error' : ''}
            />
          )}
        />
      </Form.Item>
      
      {/* Description */}
      <Form.Item
        label={<span>Тайлбар <span style={{ color: token.colorError }}>*</span></span>}
        validateStatus={errors.description ? 'error' : ''}
        help={errors.description?.message}
        style={{ marginBottom: 0 }}
      >
        <Controller
          name="description"
          control={control}
          rules={{ 
            required: 'Тайлбар оруулна уу',
            minLength: { value: 10, message: 'Хамгийн багадаа 10 тэмдэгт' },
            maxLength: { value: 2000, message: 'Хамгийн ихдээ 2000 тэмдэгт' }
          }}
          render={({ field }) => (
            <TextArea 
              {...field}
              rows={5}
              placeholder="Сургалтын агуулга, зорилгын талаар товч тайлбар бичнэ үү..."
              status={errors.description ? 'error' : ''}
              showCount
              maxLength={2000}
            />
          )}
        />
      </Form.Item>
      
      {/* Tips */}
      <Alert
        title={<span><BulbOutlined /> Зөвлөмж</span>}
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Сургалтын нэрийг тодорхой, ойлгомжтой бичнэ үү</li>
            <li>Тайлбарт сургалтын зорилго, агуулгыг багтаана уу</li>
            <li>Ажилтнууд ямар мэдлэг эзэмших талаар дурдана уу</li>
          </ul>
        }
        type="info"
        showIcon={false}
      />
    </div>
  );
};

export default StepBasicInfo;
