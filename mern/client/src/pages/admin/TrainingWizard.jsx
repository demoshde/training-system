import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { Steps, Button, message, Card, ConfigProvider, Spin, Space, theme } from 'antd';
import { ArrowLeftOutlined, LoadingOutlined } from '@ant-design/icons';
import AdminLayout from '../../components/AdminLayout';
import { adminApi } from '../../api';
import toast from 'react-hot-toast';

// Step Components
import StepBasicInfo from '../../components/wizard/StepBasicInfo';
import StepSettings from '../../components/wizard/StepSettings';
import StepSlides from '../../components/wizard/StepSlides';
import StepQuiz from '../../components/wizard/StepQuiz';
import StepReview from '../../components/wizard/StepReview';

const { Step } = Steps;

const STEPS = [
  { title: 'Үндсэн мэдээлэл', description: 'Нэр, тайлбар' },
  { title: 'Тохиргоо', description: 'Оноо, хугацаа' },
  { title: 'Слайдууд', description: 'Агуулга нэмэх' },
  { title: 'Шалгалт', description: 'Асуултууд' },
  { title: 'Хянах', description: 'Дуусгах' }
];

const defaultValues = {
  // Basic Info
  title: '',
  description: '',
  
  // Settings
  passingScore: 70,
  validityPeriod: 12,
  isMandatory: false,
  isActive: true,
  
  // Slides (will be managed separately)
  slides: [],
  
  // Quiz questions (will be managed separately)
  questions: []
};

const TrainingWizard = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trainingData, setTrainingData] = useState(null);
  
  // React Hook Form setup with shared state
  const methods = useForm({
    defaultValues,
    mode: 'onChange'
  });
  
  const { handleSubmit, reset, formState: { errors } } = methods;
  
  // Load existing training data
  useEffect(() => {
    const loadData = async () => {
      if (isEditing) {
        try {
          setLoading(true);
          const trainingRes = await adminApi.get(`/trainings/${id}`);
          
          const training = trainingRes.data;
          setTrainingData(training);
          
          reset({
            title: training.title || '',
            description: training.description || '',
            passingScore: training.passingScore || 70,
            validityPeriod: training.validityPeriod || 12,
            isMandatory: training.isMandatory || false,
            isActive: training.isActive !== false,
            slides: training.slides || [],
            questions: training.questions || []
          });
        } catch (error) {
          toast.error('Сургалтын мэдээлэл татахад алдаа гарлаа');
          navigate('/admin/trainings');
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadData();
  }, [id, isEditing, reset, navigate]);
  
  // Step validation
  const validateStep = useCallback(async (step) => {
    const { trigger } = methods;
    
    switch (step) {
      case 0: // Basic Info
        return await trigger(['title', 'description']);
      case 1: // Settings
        return await trigger(['passingScore', 'validityPeriod']);
      case 2: // Slides
        return true; // Slides are optional
      case 3: // Quiz
        return true; // Quiz is optional
      case 4: // Review
        return true;
      default:
        return true;
    }
  }, [methods]);
  
  // Navigate to next step
  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    } else {
      message.error('Шаардлагатай талбаруудыг бөглөнө үү');
    }
  };
  
  // Navigate to previous step
  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };
  
  // Go to specific step
  const goToStep = async (step) => {
    if (step < currentStep) {
      setCurrentStep(step);
    } else if (step > currentStep) {
      // Validate all steps up to the target
      for (let i = currentStep; i < step; i++) {
        const isValid = await validateStep(i);
        if (!isValid) {
          message.error('Өмнөх алхмуудыг дуусгана уу');
          return;
        }
      }
      setCurrentStep(step);
    }
  };
  
  // Save training
  const onSubmit = async (data) => {
    setSaving(true);
    try {
      let trainingId = id;
      
      // Create or update training with slides and questions
      const trainingPayload = {
        title: data.title,
        description: data.description,
        passingScore: data.passingScore,
        validityPeriod: data.validityPeriod,
        isMandatory: data.isMandatory,
        isActive: data.isActive,
        slides: data.slides || [],
        questions: data.questions || []
      };
      
      if (isEditing) {
        await adminApi.put(`/trainings/${id}`, trainingPayload);
      } else {
        const res = await adminApi.post('/trainings', trainingPayload);
        trainingId = res.data._id;
      }
      
      toast.success(isEditing ? 'Сургалт амжилттай шинэчлэгдлээ' : 'Сургалт амжилттай үүсгэгдлээ');
      navigate('/admin/trainings');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };
  
  // Render current step component
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <StepBasicInfo />;
      case 1:
        return <StepSettings />;
      case 2:
        return <StepSlides trainingId={id} />;
      case 3:
        return <StepQuiz trainingId={id} />;
      case 4:
        return <StepReview onSubmit={handleSubmit(onSubmit)} saving={saving} />;
      default:
        return null;
    }
  };
  
  if (loading) {
    return (
      <AdminLayout title="Сургалт">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout title={isEditing ? 'Сургалт засах' : 'Шинэ сургалт үүсгэх'}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#2563eb',
          },
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/trainings')}
          >
            Буцах
          </Button>
        </div>
        
        {/* Steps */}
        <Card style={{ marginBottom: 24 }}>
          <Steps 
            current={currentStep} 
            onChange={goToStep}
            style={{ marginBottom: 0 }}
            items={STEPS.map((step, index) => ({
              title: step.title,
              subTitle: step.description,
              status: index < currentStep ? 'finish' : index === currentStep ? 'process' : 'wait'
            }))}
          />
        </Card>
        
        {/* Form Content */}
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card style={{ marginBottom: 24 }}>
              {renderStepContent()}
            </Card>
            
            {/* Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button 
                size="large"
                onClick={prevStep}
                disabled={currentStep === 0}
              >
                Өмнөх
              </Button>
              
              <Space>
                {currentStep < STEPS.length - 1 ? (
                  <Button 
                    type="primary" 
                    size="large"
                    onClick={nextStep}
                  >
                    Дараагийн
                  </Button>
                ) : (
                  <Button 
                    type="primary" 
                    size="large"
                    onClick={handleSubmit(onSubmit)}
                    loading={saving}
                  >
                    {isEditing ? 'Хадгалах' : 'Үүсгэх'}
                  </Button>
                )}
              </Space>
            </div>
          </form>
        </FormProvider>
      </ConfigProvider>
    </AdminLayout>
  );
};

export default TrainingWizard;
