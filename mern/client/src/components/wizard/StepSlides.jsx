import { useState, useRef } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button, Upload, Card, Empty, Typography, Spin, message, Modal, Progress, Input, Divider, InputNumber, Slider, Alert, Row, Col, theme } from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  EditOutlined,
  DragOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  SwapOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  BulbOutlined,
  DownloadOutlined,
  PlaySquareOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { adminApi } from '../../api';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Sortable Slide Item
const SortableSlide = ({ id, index, slide, onRemove, onPreview, onEdit }) => {
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
  
  const isPdf = slide.contentType === 'application/pdf' || slide.url?.toLowerCase().endsWith('.pdf') || slide.fileName?.toLowerCase().endsWith('.pdf');
  const isPpt = slide.contentType?.includes('powerpoint') || slide.contentType?.includes('presentation') || 
                slide.url?.toLowerCase().match(/\.(ppt|pptx|ppsx)$/) || slide.fileName?.toLowerCase().match(/\.(ppt|pptx|ppsx)$/);
  const isText = slide.type === 'text';
  const isGoogleSlides = slide.type === 'google_slides' || slide.url?.includes('docs.google.com/presentation');
  
  return (
    <div ref={setNodeRef} style={{ ...style, marginBottom: 12 }}>
      <Card 
        size="small"
        style={{ boxShadow: isDragging ? token.boxShadowSecondary : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div 
            {...attributes} 
            {...listeners}
            style={{ cursor: 'grab', color: token.colorTextSecondary }}
          >
            <DragOutlined style={{ fontSize: 18 }} />
          </div>
          
          <div style={{ 
            flexShrink: 0, 
            width: 64, 
            height: 64, 
            background: token.colorBgLayout, 
            borderRadius: 8, 
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isText ? (
              <FileTextOutlined style={{ fontSize: 24, color: token.colorSuccess }} />
            ) : isGoogleSlides ? (
              <PlaySquareOutlined style={{ fontSize: 24, color: '#FBBC04' }} />
            ) : isPpt ? (
              <FilePptOutlined style={{ fontSize: 24, color: '#D24726' }} />
            ) : isPdf ? (
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
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong style={{ display: 'block' }} ellipsis>
              {slide.title || `Слайд #${index + 1}`}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }} ellipsis>
              {slide.type === 'text' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileTextOutlined /> Текст слайд
                </span>
              ) : isGoogleSlides ? 'Google Slides' : isPpt ? 'PowerPoint файл' : isPdf ? 'PDF файл' : slide.fileName || 'Зураг'}
              <span style={{ marginLeft: 8, color: token.colorPrimary }}>• {slide.duration || 30} сек</span>
            </Text>
            {slide.content && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }} ellipsis>
                {slide.content.substring(0, 50)}{slide.content.length > 50 ? '...' : ''}
              </Text>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => onPreview(slide)}
              title="Харах"
            />
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(index, slide)}
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

const StepSlides = () => {
  const { control, setValue, watch } = useFormContext();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'slides'
  });
  const { token } = theme.useToken();
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewModal, setPreviewModal] = useState({ visible: false, slide: null });
  const [editModal, setEditModal] = useState({ visible: false, index: null, slide: null });
  const [editUploading, setEditUploading] = useState(false);
  const [createModal, setCreateModal] = useState({ visible: false, type: 'file' });
  const [newSlide, setNewSlide] = useState({ title: '', content: '', type: 'text', duration: 30 });
  const [googleSlidesModal, setGoogleSlidesModal] = useState({ visible: false });
  const [googleSlidesUrl, setGoogleSlidesUrl] = useState('');
  const [googleSlidesTitle, setGoogleSlidesTitle] = useState('');
  const [googleSlidesDuration, setGoogleSlidesDuration] = useState(60);
  const fileInputRef = useRef(null);
  
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
  
  const handleUpload = async (file) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isPpt = file.type.includes('powerpoint') || file.type.includes('presentation') || 
                  file.name.toLowerCase().match(/\.(ppt|pptx|ppsx)$/);
    
    if (!isImage && !isPdf && !isPpt) {
      message.error('Зөвхөн зураг, PDF эсвэл PowerPoint файл оруулна уу');
      return false;
    }
    
    const maxSize = isPpt ? 100 * 1024 * 1024 : isPdf ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for PPT, 50MB for PDF, 10MB for images
    if (file.size > maxSize) {
      message.error(`Файлын хэмжээ ${isPpt ? '100MB' : isPdf ? '50MB' : '10MB'}-аас их байна`);
      return false;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    let endpoint, fieldName;
    
    if (isPpt) {
      endpoint = '/upload/presentation';
      fieldName = 'presentation';
    } else if (isPdf) {
      endpoint = '/upload/pdf';
      fieldName = 'pdf';
    } else {
      endpoint = '/upload/image';
      fieldName = 'image';
    }
    
    formData.append(fieldName, file);
    
    try {
      const response = await adminApi.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });
      
      const newSlide = {
        url: response.data.url,
        fileName: file.name,
        contentType: file.type,
        type: 'file',
        duration: 30,
        order: fields.length
      };
      
      append(newSlide);
      message.success('Слайд амжилттай нэмэгдлээ');
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Файл байршуулахад алдаа гарлаа');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
    
    return false; // Prevent default upload behavior
  };
  
  const handleRemove = (index) => {
    Modal.confirm({
      title: 'Слайд устгах',
      content: 'Энэ слайдыг устгахдаа итгэлтэй байна уу?',
      okText: 'Устгах',
      okType: 'danger',
      cancelText: 'Болих',
      onOk: () => remove(index)
    });
  };
  
  const handlePreview = (slide) => {
    setPreviewModal({ visible: true, slide });
  };
  
  const handleEdit = (index, slide) => {
    setEditModal({ 
      visible: true, 
      index, 
      slide: { 
        ...slide, 
        title: slide.title || '',
        content: slide.content || '',
        type: slide.type || (slide.url ? 'file' : 'text'),
        duration: slide.duration || 30
      }
    });
  };
  
  const handleEditTitleChange = (e) => {
    setEditModal(prev => ({
      ...prev,
      slide: { ...prev.slide, title: e.target.value }
    }));
  };
  
  const handleEditContentChange = (e) => {
    setEditModal(prev => ({
      ...prev,
      slide: { ...prev.slide, content: e.target.value }
    }));
  };
  
  const handleEditSave = () => {
    if (editModal.index !== null && editModal.slide) {
      const currentSlides = watch('slides');
      const updatedSlides = [...currentSlides];
      updatedSlides[editModal.index] = {
        ...updatedSlides[editModal.index],
        title: editModal.slide.title,
        content: editModal.slide.content,
        url: editModal.slide.url,
        fileName: editModal.slide.fileName,
        contentType: editModal.slide.contentType,
        type: editModal.slide.type,
        duration: editModal.slide.duration || 30
      };
      setValue('slides', updatedSlides);
      message.success('Слайд амжилттай шинэчлэгдлээ');
      setEditModal({ visible: false, index: null, slide: null });
    }
  };
  
  // Create text slide
  const handleCreateTextSlide = () => {
    if (!newSlide.title && !newSlide.content) {
      message.error('Гарчиг эсвэл текст оруулна уу');
      return;
    }
    
    const textSlide = {
      title: newSlide.title || `Текст слайд #${fields.length + 1}`,
      content: newSlide.content,
      type: 'text',
      duration: newSlide.duration || 30,
      order: fields.length
    };
    
    append(textSlide);
    message.success('Текст слайд амжилттай нэмэгдлээ');
    setNewSlide({ title: '', content: '', type: 'text', duration: 30 });
    setCreateModal({ visible: false, type: 'file' });
  };
  
  // Convert Google Slides URL to embed URL
  const getGoogleSlidesEmbedUrl = (url) => {
    // Extract presentation ID from various URL formats
    const patterns = [
      /\/presentation\/d\/([a-zA-Z0-9-_]+)/,
      /\/presentation\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
      }
    }
    return url;
  };
  
  // Add Google Slides
  const handleAddGoogleSlides = () => {
    if (!googleSlidesUrl) {
      message.error('Google Slides URL оруулна уу');
      return;
    }
    
    if (!googleSlidesUrl.includes('docs.google.com/presentation')) {
      message.error('Зөв Google Slides URL оруулна уу');
      return;
    }
    
    const embedUrl = getGoogleSlidesEmbedUrl(googleSlidesUrl);
    
    const googleSlide = {
      title: googleSlidesTitle || 'Google Slides Presentation',
      url: embedUrl,
      type: 'google_slides',
      duration: googleSlidesDuration || 60,
      order: fields.length
    };
    
    append(googleSlide);
    message.success('Google Slides амжилттай нэмэгдлээ');
    setGoogleSlidesUrl('');
    setGoogleSlidesTitle('');
    setGoogleSlidesDuration(60);
    setGoogleSlidesModal({ visible: false });
  };
  
  const handleReplaceFile = async (file) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isPpt = file.type.includes('powerpoint') || file.type.includes('presentation') || 
                  file.name.toLowerCase().match(/\.(ppt|pptx|ppsx)$/);
    
    if (!isImage && !isPdf && !isPpt) {
      message.error('Зөвхөн зураг, PDF эсвэл PowerPoint файл оруулна уу');
      return false;
    }
    
    const maxSize = isPpt ? 100 * 1024 * 1024 : isPdf ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      message.error(`Файлын хэмжээ ${isPpt ? '100MB' : isPdf ? '50MB' : '10MB'}-аас их байна`);
      return false;
    }
    
    setEditUploading(true);
    
    const formData = new FormData();
    let endpoint, fieldName;
    
    if (isPpt) {
      endpoint = '/upload/presentation';
      fieldName = 'presentation';
    } else if (isPdf) {
      endpoint = '/upload/pdf';
      fieldName = 'pdf';
    } else {
      endpoint = '/upload/image';
      fieldName = 'image';
    }
    
    formData.append(fieldName, file);
    
    try {
      const response = await adminApi.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setEditModal(prev => ({
        ...prev,
        slide: {
          ...prev.slide,
          url: response.data.url,
          fileName: file.name,
          contentType: file.type
        }
      }));
      
      message.success('Файл амжилттай солигдлоо');
    } catch (error) {
      console.error('Upload error:', error);
      message.error('Файл байршуулахад алдаа гарлаа');
    } finally {
      setEditUploading(false);
    }
    
    return false;
  };

  const uploadProps = {
    accept: 'image/*,.pdf,.ppt,.pptx,.ppsx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    multiple: true,
    showUploadList: false,
    beforeUpload: handleUpload,
    disabled: uploading
  };
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>Слайдууд</Title>
        <Text type="secondary">
          Сургалтын материалыг зураг, PDF, PowerPoint эсвэл текст хэлбэрээр нэмнэ үү. Чирж байрлалыг өөрчлөх боломжтой.
        </Text>
      </div>
      
      {/* Add Slide Options */}
      <Row gutter={16}>
        {/* Upload File Option */}
        <Col xs={24} md={12}>
          <Card 
            style={{ 
              border: `2px dashed ${token.colorBorder}`, 
              textAlign: 'center',
              cursor: 'pointer'
            }}
            hoverable
          >
            <Upload.Dragger {...uploadProps} style={{ border: 0, background: 'transparent' }}>
              {uploading ? (
                <div style={{ padding: 16 }}>
                  <Spin size="large" />
                  <Progress percent={uploadProgress} style={{ marginTop: 16, maxWidth: 200, margin: '16px auto 0' }} />
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>Байршуулж байна...</Text>
                </div>
              ) : (
                <>
                  <p style={{ marginBottom: 8 }}>
                    <CloudUploadOutlined style={{ fontSize: 32, color: token.colorPrimary }} />
                  </p>
                  <Text strong style={{ display: 'block' }}>
                    Зураг / PDF файл оруулах
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    PNG, JPG, GIF (10MB), PDF (50MB)
                  </Text>
                </>
              )}
            </Upload.Dragger>
          </Card>
        </Col>
        
        {/* Add Text Slide Option */}
        <Col xs={24} md={12}>
          <Card 
            style={{ 
              border: `2px dashed ${token.colorBorder}`, 
              textAlign: 'center',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            hoverable
            onClick={() => setCreateModal({ visible: true, type: 'text' })}
          >
            <div style={{ padding: 16 }}>
              <p style={{ marginBottom: 8 }}>
                <FileTextOutlined style={{ fontSize: 32, color: token.colorSuccess }} />
              </p>
              <Text strong style={{ display: 'block' }}>
                Текст слайд нэмэх
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Гарчиг болон тайлбар текст бүхий слайд
              </Text>
            </div>
          </Card>
        </Col>
        
        {/* Add Google Slides Option */}
        <Col xs={24} md={12}>
          <Card 
            style={{ 
              border: `2px dashed ${token.colorBorder}`, 
              textAlign: 'center',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            hoverable
            onClick={() => setGoogleSlidesModal({ visible: true })}
          >
            <div style={{ padding: 16 }}>
              <p style={{ marginBottom: 8 }}>
                <PlaySquareOutlined style={{ fontSize: 32, color: '#FBBC04' }} />
              </p>
              <Text strong style={{ display: 'block' }}>
                Google Slides нэмэх
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Google Slides presentation embed хийх
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
      
      {/* Slides List */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text strong>
            Нэмэгдсэн слайдууд ({fields.length})
          </Text>
        </div>
        
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
                <SortableSlide
                  key={field.id}
                  id={field.id}
                  index={index}
                  slide={field}
                  onRemove={handleRemove}
                  onPreview={handlePreview}
                  onEdit={handleEdit}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Одоогоор слайд байхгүй байна"
          />
        )}
      </div>
      
      {/* Info Box */}
      <Alert
        title={<span><BulbOutlined /> Зөвлөгөө</span>}
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Слайдуудыг чирж дарааллыг өөрчлөх боломжтой</li>
            <li>Текст слайд нь гарчиг болон дэлгэрэнгүй тайлбар агуулна</li>
            <li>Зураг файлд нэмэлт тайлбар текст нэмж болно</li>
            <li>PDF файлыг олон хуудастай байлгаж болно</li>
            <li>Зураг тод, уншихад хялбар байх ёстой</li>
          </ul>
        }
        type="info"
        showIcon={false}
      />
      
      {/* Preview Modal */}
      <Modal
        open={previewModal.visible}
        title={previewModal.slide?.title || "Слайд харах"}
        footer={null}
        onCancel={() => setPreviewModal({ visible: false, slide: null })}
        width={800}
        centered
      >
        {previewModal.slide && (
          previewModal.slide.type === 'text' ? (
            <div style={{ 
              padding: 24, 
              background: 'linear-gradient(to bottom right, #eff6ff, #eef2ff)', 
              borderRadius: 8, 
              minHeight: 300 
            }}>
              {previewModal.slide.title && (
                <Title level={3} style={{ marginBottom: 16 }}>{previewModal.slide.title}</Title>
              )}
              <Text style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{previewModal.slide.content}</Text>
            </div>
          ) : previewModal.slide.type === 'google_slides' || previewModal.slide.url?.includes('docs.google.com/presentation') ? (
            <div style={{ aspectRatio: '16/9' }}>
              <iframe
                src={previewModal.slide.url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Google Slides Preview"
                allowFullScreen
              />
            </div>
          ) : previewModal.slide.contentType === 'application/pdf' || previewModal.slide.url?.toLowerCase().endsWith('.pdf') ? (
            <iframe
              src={previewModal.slide.url}
              style={{ width: '100%', height: '70vh' }}
              title="PDF Preview"
            />
          ) : previewModal.slide.contentType?.includes('powerpoint') || 
              previewModal.slide.contentType?.includes('presentation') ||
              previewModal.slide.url?.toLowerCase().match(/\.(ppt|pptx|ppsx)$/) ? (
            <div style={{ position: 'relative', height: '70vh' }}>
              {/* Google Docs Viewer for PowerPoint */}
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + previewModal.slide.url)}&embedded=true`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="PowerPoint Preview"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
              {/* Footer with file info and download */}
              <div style={{ 
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                padding: '24px 16px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FilePptOutlined style={{ fontSize: 20, color: 'white' }} />
                  <Text style={{ color: 'white' }}>
                    {previewModal.slide.fileName || 'PowerPoint Presentation'}
                  </Text>
                </div>
                <Button 
                  type="primary" 
                  size="small"
                  icon={<DownloadOutlined />}
                  href={previewModal.slide.url}
                  target="_blank"
                >
                  Татах
                </Button>
              </div>
            </div>
          ) : (
            <img
              src={previewModal.slide.url}
              alt="Slide preview"
              style={{ width: '100%' }}
            />
          )
        )}
      </Modal>
      
      {/* Create Text Slide Modal */}
      <Modal
        open={createModal.visible}
        title="Текст слайд үүсгэх"
        okText="Нэмэх"
        cancelText="Болих"
        onOk={handleCreateTextSlide}
        onCancel={() => {
          setCreateModal({ visible: false, type: 'file' });
          setNewSlide({ title: '', content: '', type: 'text', duration: 30 });
        }}
        width={700}
        centered
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              Гарчиг <Text type="secondary">(заавал биш)</Text>
            </Text>
            <Input
              value={newSlide.title}
              onChange={(e) => setNewSlide(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Слайдын гарчиг"
              size="large"
            />
          </div>
          
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              Текст агуулга
            </Text>
            <TextArea
              value={newSlide.content}
              onChange={(e) => setNewSlide(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Слайдын текст агуулгыг энд бичнэ үү..."
              rows={8}
              showCount
              maxLength={2000}
            />
          </div>
          
          {/* Preview */}
          {(newSlide.title || newSlide.content) && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Урьдчилан харах
              </Text>
              <div style={{ 
                padding: 16, 
                background: 'linear-gradient(to bottom right, #eff6ff, #eef2ff)', 
                borderRadius: 8, 
                border: `1px solid ${token.colorBorder}` 
              }}>
                {newSlide.title && (
                  <Title level={4} style={{ marginBottom: 8 }}>{newSlide.title}</Title>
                )}
                <Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{newSlide.content}</Text>
              </div>
            </div>
          )}
          
          {/* Duration Setting */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Слайд харах хугацаа (секунд)
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Slider
                min={5}
                max={120}
                value={newSlide.duration}
                onChange={(val) => setNewSlide(prev => ({ ...prev, duration: val }))}
                style={{ flex: 1 }}
              />
              <InputNumber
                min={5}
                max={300}
                value={newSlide.duration}
                onChange={(val) => setNewSlide(prev => ({ ...prev, duration: val || 30 }))}
                style={{ width: 80 }}
                suffix="с"
              />
            </div>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              Суралцагч энэ слайдыг хамгийн багадаа {newSlide.duration} секунд харсны дараа дараагийн слайд руу шилжих боломжтой
            </Text>
          </div>
        </div>
      </Modal>
      
      {/* Edit Modal */}
      <Modal
        open={editModal.visible}
        title="Слайд засах"
        okText="Хадгалах"
        cancelText="Болих"
        onOk={handleEditSave}
        onCancel={() => setEditModal({ visible: false, index: null, slide: null })}
        width={700}
        centered
      >
        {editModal.slide && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
            {/* Slide Title */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                Слайдын гарчиг <Text type="secondary">(заавал биш)</Text>
              </Text>
              <Input
                value={editModal.slide.title || ''}
                onChange={handleEditTitleChange}
                placeholder={`Слайд #${(editModal.index || 0) + 1}`}
                size="large"
              />
            </div>
            
            {/* Text Content - show for text slides or as additional description for file slides */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                {editModal.slide.type === 'text' ? 'Текст агуулга' : 'Нэмэлт тайлбар'} 
                <Text type="secondary"> (заавал биш)</Text>
              </Text>
              <TextArea
                value={editModal.slide.content || ''}
                onChange={handleEditContentChange}
                placeholder={editModal.slide.type === 'text' 
                  ? "Слайдын текст агуулгыг энд бичнэ үү..." 
                  : "Энэ слайдын нэмэлт тайлбар..."}
                rows={editModal.slide.type === 'text' ? 8 : 3}
                showCount
                maxLength={2000}
              />
            </div>
            
            {/* Current File Preview - only for file slides */}
            {editModal.slide.type !== 'text' && editModal.slide.url && (
              <>
                <Divider />
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Одоогийн файл
                  </Text>
                  <div style={{ border: `1px solid ${token.colorBorder}`, borderRadius: 8, padding: 16, background: token.colorBgLayout }}>
                    {editModal.slide.contentType === 'application/pdf' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <FilePdfOutlined style={{ fontSize: 28, color: token.colorError }} />
                        <div>
                          <Text strong>{editModal.slide.fileName || 'PDF файл'}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>PDF документ</Text>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={editModal.slide.url}
                        alt="Current slide"
                        style={{ maxHeight: 192, margin: '0 auto', display: 'block', borderRadius: 4 }}
                      />
                    )}
                  </div>
                </div>
                
                {/* Replace File */}
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Файл солих
                  </Text>
                  <Upload
                    accept="image/*,.pdf,.ppt,.pptx,.ppsx"
                    showUploadList={false}
                    beforeUpload={handleReplaceFile}
                    disabled={editUploading}
                  >
                    <Button 
                      icon={editUploading ? <Spin size="small" /> : <SwapOutlined />}
                      disabled={editUploading}
                    >
                      {editUploading ? 'Байршуулж байна...' : 'Шинэ файл сонгох'}
                    </Button>
                  </Upload>
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                    Зураг, PDF эсвэл PowerPoint файл сонгоно уу
                  </Text>
                </div>
              </>
            )}
            
            {/* Preview for text slides */}
            {editModal.slide.type === 'text' && (editModal.slide.title || editModal.slide.content) && (
              <>
                <Divider />
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Урьдчилан харах
                  </Text>
                  <div style={{ 
                    padding: 16, 
                    background: 'linear-gradient(to bottom right, #eff6ff, #eef2ff)', 
                    borderRadius: 8, 
                    border: `1px solid ${token.colorBorder}` 
                  }}>
                    {editModal.slide.title && (
                      <Title level={4} style={{ marginBottom: 8 }}>{editModal.slide.title}</Title>
                    )}
                    <Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{editModal.slide.content}</Text>
                  </div>
                </div>
              </>
            )}
            
            {/* Duration Setting */}
            <Divider />
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Слайд харах хугацаа (секунд)
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Slider
                  min={5}
                  max={120}
                  value={editModal.slide.duration || 30}
                  onChange={(val) => setEditModal(prev => ({
                    ...prev,
                    slide: { ...prev.slide, duration: val }
                  }))}
                  style={{ flex: 1 }}
                />
                <InputNumber
                  min={5}
                  max={300}
                  value={editModal.slide.duration || 30}
                  onChange={(val) => setEditModal(prev => ({
                    ...prev,
                    slide: { ...prev.slide, duration: val || 30 }
                  }))}
                  style={{ width: 80 }}
                  suffix="с"
                />
              </div>
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                Суралцагч энэ слайдыг хамгийн багадаа {editModal.slide.duration || 30} секунд харсны дараа дараагийн слайд руу шилжих боломжтой
              </Text>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Google Slides Modal */}
      <Modal
        open={googleSlidesModal.visible}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlaySquareOutlined style={{ color: '#FBBC04' }} />
            Google Slides нэмэх
          </div>
        }
        okText="Нэмэх"
        cancelText="Болих"
        onOk={handleAddGoogleSlides}
        onCancel={() => {
          setGoogleSlidesModal({ visible: false });
          setGoogleSlidesUrl('');
          setGoogleSlidesTitle('');
          setGoogleSlidesDuration(60);
        }}
        width={700}
        centered
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
          <Alert
            title="Google Slides-г хэрхэн оруулах вэ?"
            description={
              <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>Google Slides дээр presentation-оо нээнэ</li>
                <li>File → Share → Publish to web сонгоно</li>
                <li>Embed tab дээрээс Link-г хуулна</li>
                <li>Эсвэл шууд browser-ийн URL-г хуулна</li>
              </ol>
            }
            type="info"
            showIcon
          />
          
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              Google Slides URL <Text type="danger">*</Text>
            </Text>
            <Input
              value={googleSlidesUrl}
              onChange={(e) => setGoogleSlidesUrl(e.target.value)}
              placeholder="https://docs.google.com/presentation/d/..."
              size="large"
              prefix={<LinkOutlined />}
            />
          </div>
          
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              Гарчиг <Text type="secondary">(заавал биш)</Text>
            </Text>
            <Input
              value={googleSlidesTitle}
              onChange={(e) => setGoogleSlidesTitle(e.target.value)}
              placeholder="Presentation-ийн нэр"
            />
          </div>
          
          {/* Preview */}
          {googleSlidesUrl && googleSlidesUrl.includes('docs.google.com/presentation') && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Урьдчилан харах
              </Text>
              <div style={{ 
                aspectRatio: '16/9', 
                borderRadius: 8, 
                overflow: 'hidden',
                border: `1px solid ${token.colorBorder}`
              }}>
                <iframe
                  src={getGoogleSlidesEmbedUrl(googleSlidesUrl)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Google Slides Preview"
                  allowFullScreen
                />
              </div>
            </div>
          )}
          
          {/* Duration Setting */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Слайд харах хугацаа (секунд)
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Slider
                min={30}
                max={300}
                value={googleSlidesDuration}
                onChange={(val) => setGoogleSlidesDuration(val)}
                style={{ flex: 1 }}
              />
              <InputNumber
                min={30}
                max={600}
                value={googleSlidesDuration}
                onChange={(val) => setGoogleSlidesDuration(val || 60)}
                style={{ width: 80 }}
                suffix="с"
              />
            </div>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              Google Slides олон хуудастай байж болох тул урт хугацаа тохируулахыг зөвлөж байна
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StepSlides;
