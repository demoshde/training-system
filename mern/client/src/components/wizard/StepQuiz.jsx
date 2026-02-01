import { useState, useEffect } from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { 
  Button, 
  Card, 
  Input, 
  InputNumber, 
  Empty, 
  Typography, 
  Modal,
  Radio,
  Tag,
  Tooltip,
  Space,
  Row,
  Col,
  Alert,
  Form,
  theme
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  EditOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  DragOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Sortable Question Item
const SortableQuestion = ({ id, index, question, onEdit, onRemove }) => {
  const { token } = theme.useToken();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const correctAnswer = question.options?.find(opt => opt.isCorrect);
  
  return (
    <div ref={setNodeRef} style={{ ...style, marginBottom: 12 }}>
      <Card 
        size="small"
        style={{ boxShadow: isDragging ? token.boxShadowSecondary : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div 
            {...attributes} 
            {...listeners}
            style={{ cursor: 'grab', color: token.colorTextSecondary, marginTop: 4 }}
          >
            <DragOutlined style={{ fontSize: 18 }} />
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Tag color="blue">Асуулт #{index + 1}</Tag>
              <Tag color="green">{question.points || 10} оноо</Tag>
            </div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {question.questionText || question.text || 'Асуултын текст'}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {question.options?.map((option, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  {option.isCorrect ? (
                    <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                  ) : (
                    <span style={{ 
                      width: 14, 
                      height: 14, 
                      borderRadius: '50%', 
                      border: `1px solid ${token.colorBorder}`,
                      display: 'inline-block'
                    }} />
                  )}
                  <span style={{ color: option.isCorrect ? token.colorSuccess : token.colorTextSecondary, fontWeight: option.isCorrect ? 500 : 400 }}>
                    {option.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(index)}
              title="Засах"
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onRemove(index)}
              title="Устгах"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

// Question Editor Modal
const QuestionEditorModal = ({ visible, question, onSave, onCancel }) => {
  const { token } = theme.useToken();
  const [text, setText] = useState('');
  const [points, setPoints] = useState(10);
  const [options, setOptions] = useState([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false }
  ]);
  const [errors, setErrors] = useState({});
  
  // Reset form when modal opens with new question
  useEffect(() => {
    if (visible) {
      if (question) {
        setText(question.questionText || question.text || '');
        setPoints(question.points || 10);
        setOptions(question.options?.length > 0 ? question.options : [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false }
        ]);
      } else {
        // Reset to defaults for new question
        setText('');
        setPoints(10);
        setOptions([
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false }
        ]);
      }
      setErrors({});
    }
  }, [visible, question]);
  
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index].text = value;
    setOptions(newOptions);
  };
  
  const handleCorrectChange = (index) => {
    const newOptions = options.map((opt, idx) => ({
      ...opt,
      isCorrect: idx === index
    }));
    setOptions(newOptions);
  };
  
  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, { text: '', isCorrect: false }]);
    }
  };
  
  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, idx) => idx !== index);
      // If removing the correct answer, make first one correct
      if (options[index].isCorrect && newOptions.length > 0) {
        newOptions[0].isCorrect = true;
      }
      setOptions(newOptions);
    }
  };
  
  const validate = () => {
    const newErrors = {};
    
    if (!text.trim()) {
      newErrors.text = 'Асуулт оруулна уу';
    }
    
    const filledOptions = options.filter(opt => opt.text.trim());
    if (filledOptions.length < 2) {
      newErrors.options = 'Дор хаяж 2 хариулт оруулна уу';
    }
    
    const hasCorrect = options.some(opt => opt.isCorrect && opt.text.trim());
    if (!hasCorrect) {
      newErrors.correct = 'Зөв хариултыг сонгоно уу';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSave = () => {
    if (validate()) {
      // Filter out empty options
      const validOptions = options.filter(opt => opt.text.trim());
      onSave({
        questionText: text.trim(),
        points,
        options: validOptions
      });
    }
  };
  
  return (
    <Modal
      open={visible}
      title={question ? 'Асуулт засах' : 'Шинэ асуулт нэмэх'}
      okText="Хадгалах"
      cancelText="Болих"
      onOk={handleSave}
      onCancel={onCancel}
      width={700}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '16px 0' }}>
        {/* Question Text */}
        <Form.Item
          label={<span>Асуулт <span style={{ color: token.colorError }}>*</span></span>}
          validateStatus={errors.text ? 'error' : ''}
          help={errors.text}
          style={{ marginBottom: 0 }}
        >
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Асуултаа оруулна уу..."
            rows={3}
            status={errors.text ? 'error' : ''}
          />
        </Form.Item>
        
        {/* Points */}
        <Form.Item
          label="Оноо"
          style={{ marginBottom: 0 }}
        >
          <InputNumber
            value={points}
            onChange={setPoints}
            min={1}
            max={100}
            style={{ width: 120 }}
          />
        </Form.Item>
        
        {/* Options */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Хариултууд <span style={{ color: token.colorError }}>*</span>
            <Tooltip title="Зөв хариултыг сонгоно уу">
              <QuestionCircleOutlined style={{ marginLeft: 8, color: token.colorTextSecondary }} />
            </Tooltip>
          </Text>
          
          {errors.options && (
            <Text type="danger" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>{errors.options}</Text>
          )}
          {errors.correct && (
            <Text type="danger" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>{errors.correct}</Text>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {options.map((option, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Radio
                  checked={option.isCorrect}
                  onChange={() => handleCorrectChange(index)}
                />
                <Input
                  value={option.text}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Хариулт ${index + 1}`}
                  style={{ flex: 1 }}
                  suffix={
                    option.isCorrect && (
                      <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                    )
                  }
                />
                {options.length > 2 && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeOption(index)}
                  />
                )}
              </div>
            ))}
          </div>
          
          {options.length < 6 && (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addOption}
              style={{ marginTop: 12 }}
            >
              Хариулт нэмэх
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

const StepQuiz = () => {
  const { control } = useFormContext();
  const { fields, append, remove, update, move } = useFieldArray({
    control,
    name: 'questions'
  });
  const { token } = theme.useToken();
  
  const [editorModal, setEditorModal] = useState({ 
    visible: false, 
    index: null, 
    question: null 
  });
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((item) => item.id === active.id);
      const newIndex = fields.findIndex((item) => item.id === over.id);
      move(oldIndex, newIndex);
    }
  };
  
  const handleAddQuestion = () => {
    setEditorModal({ visible: true, index: null, question: null });
  };
  
  const handleEditQuestion = (index) => {
    setEditorModal({ visible: true, index, question: fields[index] });
  };
  
  const handleRemoveQuestion = (index) => {
    Modal.confirm({
      title: 'Асуулт устгах',
      content: 'Энэ асуултыг устгахдаа итгэлтэй байна уу?',
      okText: 'Устгах',
      okType: 'danger',
      cancelText: 'Болих',
      onOk: () => remove(index)
    });
  };
  
  const handleSaveQuestion = (questionData) => {
    if (editorModal.index !== null) {
      update(editorModal.index, { ...questionData, order: editorModal.index });
    } else {
      append({ ...questionData, order: fields.length });
    }
    setEditorModal({ visible: false, index: null, question: null });
  };
  
  const totalPoints = fields.reduce((sum, q) => sum + (q.points || 10), 0);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>Шалгалтын асуултууд</Title>
        <Text type="secondary">
          Ажилтнуудын ойлголтыг шалгах асуултуудыг нэмнэ үү
        </Text>
      </div>
      
      {/* Stats */}
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card size="small" style={{ background: token.colorInfoBg, textAlign: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: token.colorPrimary }}>{fields.length}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>Нийт асуулт</Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ background: token.colorSuccessBg, textAlign: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: token.colorSuccess }}>{totalPoints}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>Нийт оноо</Text>
          </Card>
        </Col>
      </Row>
      
      {/* Add Question Button */}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddQuestion}
        size="large"
        block
      >
        Асуулт нэмэх
      </Button>
      
      {/* Questions List */}
      <div>
        {fields.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map(f => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {fields.map((field, index) => (
                <SortableQuestion
                  key={field.id}
                  id={field.id}
                  index={index}
                  question={field}
                  onEdit={handleEditQuestion}
                  onRemove={handleRemoveQuestion}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Одоогоор асуулт байхгүй байна"
          >
            <Button type="primary" onClick={handleAddQuestion}>
              Эхний асуултыг нэмэх
            </Button>
          </Empty>
        )}
      </div>
      
      {/* Info Box */}
      <Alert
        title={<span><BulbOutlined /> Зөвлөгөө</span>}
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Асуултуудыг чирж дарааллыг өөрчлөх боломжтой</li>
            <li>Асуулт бүрт өөр оноо өгч болно (анхдагч: 10 оноо)</li>
            <li>Хариулт 2-6 хүртэл байж болно</li>
            <li>Нэг зөв хариулт заавал байх ёстой</li>
          </ul>
        }
        type="info"
        showIcon={false}
        style={{ background: token.colorInfoBg }}
      />
      
      {/* Question Editor Modal */}
      <QuestionEditorModal
        visible={editorModal.visible}
        question={editorModal.question}
        onSave={handleSaveQuestion}
        onCancel={() => setEditorModal({ visible: false, index: null, question: null })}
      />
    </div>
  );
};

export default StepQuiz;
