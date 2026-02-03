import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workerApi } from '../../api';
import toast from 'react-hot-toast';
import { 
  Button, 
  Card, 
  Spin, 
  Modal, 
  Radio, 
  Progress, 
  Typography, 
  Space, 
  Result,
  theme 
} from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  CheckOutlined,
  HomeOutlined,
  ExpandOutlined,
  CloseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
  FilePptOutlined,
  DownloadOutlined,
  PlaySquareOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const API_URL = 'http://localhost:5001';

// Helper function to get full URL for uploaded files
const getFileUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('/uploads/')) {
    return `${API_URL}${url}`;
  }
  return url;
};

// Extract YouTube video ID
const getYouTubeId = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
};

// Check if file is PowerPoint
const isPowerPoint = (slide) => {
  if (!slide) return false;
  const contentType = slide.contentType || '';
  const url = slide.url || '';
  const fileName = slide.fileName || '';
  
  return contentType.includes('powerpoint') || 
         contentType.includes('presentation') ||
         url.toLowerCase().match(/\.(ppt|pptx|ppsx)$/) ||
         fileName.toLowerCase().match(/\.(ppt|pptx|ppsx)$/);
};

// Check if slide is Google Slides
const isGoogleSlides = (slide) => {
  if (!slide) return false;
  return slide.type === 'google_slides' || 
         slide.url?.includes('docs.google.com/presentation');
};

// Check if file is PDF
const isPdfFile = (slide) => {
  if (!slide) return false;
  return slide.contentType === 'application/pdf' || 
         slide.pdfUrl ||
         slide.url?.toLowerCase().endsWith('.pdf');
};

const Training = () => {
  const { trainingId } = useParams();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [training, setTraining] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [canProceed, setCanProceed] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [showGoogleSlidesFullscreen, setShowGoogleSlidesFullscreen] = useState(false);

  useEffect(() => {
    fetchTrainingData();
  }, [trainingId]);

  // Timer effect for slide duration
  useEffect(() => {
    if (!training || !training.slides || training.slides.length === 0) {
      setCanProceed(true);
      setTimeRemaining(0);
      return;
    }
    
    if (!training.slides[currentSlide]) {
      setCanProceed(true);
      setTimeRemaining(0);
      return;
    }
    
    const isCompleted = enrollment?.status === 'completed' || enrollment?.isPassed;
    
    // Skip timer for completed trainings
    if (isCompleted) {
      setCanProceed(true);
      setTimeRemaining(0);
      return;
    }
    
    const slideDuration = training.slides[currentSlide].duration || 10;
    setTimeRemaining(slideDuration);
    setCanProceed(false);
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanProceed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [currentSlide, training, enrollment]);

  const fetchTrainingData = async () => {
    try {
      const res = await workerApi.get(`/trainings/${trainingId}`);
      setTraining(res.data.training);
      setEnrollment(res.data.enrollment);
      setQuestions(res.data.questions || []);
      
      // For completed trainings, always start from beginning
      // For in-progress trainings, resume from saved position
      if (res.data.enrollment?.status === 'completed' || res.data.enrollment?.isPassed) {
        setCurrentSlide(0);
      } else if (res.data.enrollment?.currentSlide) {
        setCurrentSlide(res.data.enrollment.currentSlide);
      }
    } catch (error) {
      toast.error('Сургалтын мэдээлэл татахад алдаа гарлаа');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSlideChange = async (newSlide) => {
    if (newSlide < 0 || newSlide >= training.slides.length) return;
    
    setCurrentSlide(newSlide);
    
    // Track progress
    try {
      await workerApi.post(`/trainings/${trainingId}/track`, {
        slideIndex: newSlide
      });
    } catch (error) {
      console.error('Failed to track slide');
    }
  };

  // Seeded random number generator (deterministic based on seed)
  const seededRandom = (seed) => {
    let s = seed;
    return () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  };

  // Seeded shuffle array function (same seed = same shuffle result)
  const seededShuffleArray = (array, seed) => {
    const shuffled = [...array];
    const random = seededRandom(seed);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Generate seed from string (worker ID + training ID)
  const generateSeed = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };
  
  // Complete training without quiz (for trainings with no questions)
  const handleCompleteWithoutQuiz = async () => {
    try {
      await workerApi.post(`/trainings/${trainingId}/complete-without-quiz`);
      toast.success('Баяр хүргэе! Сургалт амжилттай дууслаа!');
      navigate(`/certificate/${trainingId}`);
    } catch (error) {
      toast.error('Алдаа гарлаа');
    }
  };

  const handleStartQuiz = () => {
    // If no questions, complete training directly
    if (questions.length === 0) {
      handleCompleteWithoutQuiz();
      return;
    }
    
    // Use worker ID + training ID as seed for consistent shuffle per user
    const workerId = enrollment?.worker?._id || enrollment?.worker || 'default';
    const seed = generateSeed(`${workerId}-${trainingId}`);
    
    // Shuffle questions and their options with seeded random
    const shuffled = questions.map((q, idx) => ({
      ...q,
      options: seededShuffleArray(q.options, seed + idx + 1000) // Different seed for each question's options
    }));
    setShuffledQuestions(seededShuffleArray(shuffled, seed));
    setShowQuiz(true);
    setAnswers({});
    setQuizSubmitted(false);
    setQuizResult(null);
  };

  const handleAnswerChange = (questionId, answerId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerId
    }));
  };

  const handleSubmitQuiz = async () => {
    if (Object.keys(answers).length < shuffledQuestions.length) {
      toast.error('Бүх асуултад хариулна уу');
      return;
    }

    try {
      const res = await workerApi.post(`/trainings/${trainingId}/submit-quiz`, {
        answers
      });
      setQuizResult(res.data);
      setQuizSubmitted(true);
      
      if (res.data.passed) {
        toast.success('Баяр хүргэе! Та тэнцлээ!');
      } else {
        toast.error('Та тэнцсэнгүй. Дахин оролдоно уу.');
      }
    } catch (error) {
      toast.error('Шалгалт илгээхэд алдаа гарлаа');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: token.colorBgLayout 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!training) return null;

  // If training has no slides, show quiz directly or complete
  if (!training.slides || training.slides.length === 0) {
    // If already completed, show completion message
    if (enrollment?.status === 'completed' || enrollment?.isPassed) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          background: token.colorBgLayout, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: 'clamp(16px, 4vw, 32px)' 
        }}>
          <Card style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: 'clamp(12px, 3vw, 24px)' }}>
            <div style={{ fontSize: 'clamp(48px, 12vw, 64px)', marginBottom: 'clamp(12px, 3vw, 16px)' }}>✅</div>
            <Title level={3} style={{ fontSize: 'clamp(16px, 4vw, 24px)', marginBottom: 'clamp(12px, 3vw, 16px)' }}>{training.title}</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 'clamp(16px, 4vw, 24px)', fontSize: 'clamp(12px, 2.5vw, 14px)' }}>
              Та энэ сургалтыг амжилттай дуусгасан байна.
            </Text>
            <Space wrap style={{ justifyContent: 'center' }}>
              <Button 
                type="primary" 
                onClick={() => navigate(`/certificate/${trainingId}`)}
                style={{ fontSize: 'clamp(12px, 2.5vw, 14px)' }}
              >
                Гэрчилгээ харах
              </Button>
              <Button 
                onClick={() => navigate('/')}
                style={{ fontSize: 'clamp(12px, 2.5vw, 14px)' }}
              >
                Нүүр хуудас
              </Button>
            </Space>
          </Card>
        </div>
      );
    }
    
    // If has questions, show quiz start screen
    if (questions.length > 0 && !showQuiz) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          background: token.colorBgLayout, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: 'clamp(16px, 4vw, 32px)' 
        }}>
          <Card style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: 'clamp(12px, 3vw, 24px)' }}>
            <div style={{ fontSize: 'clamp(48px, 12vw, 64px)', marginBottom: 'clamp(12px, 3vw, 16px)' }}>📝</div>
            <Title level={3} style={{ fontSize: 'clamp(16px, 4vw, 24px)', marginBottom: 'clamp(12px, 3vw, 16px)' }}>{training.title}</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 'clamp(6px, 1.5vw, 8px)', fontSize: 'clamp(12px, 2.5vw, 14px)' }}>
              {training.description}
            </Text>
            <Text type="secondary" style={{ display: 'block', marginBottom: 'clamp(16px, 4vw, 24px)', fontSize: 'clamp(11px, 2vw, 12px)' }}>
              Энэ сургалт {questions.length} асуулттай шалгалттай. Тэнцэх оноо: {training.passingScore}%
            </Text>
            <Button type="primary" block onClick={handleStartQuiz} style={{ fontSize: 'clamp(12px, 3vw, 14px)', padding: 'clamp(8px, 2vw, 10px) 0' }}>
              Шалгалт эхлүүлэх
            </Button>
          </Card>
        </div>
      );
    }
    
    // If no questions, complete directly
    if (questions.length === 0 && !showQuiz) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          background: token.colorBgLayout, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: 'clamp(16px, 4vw, 32px)' 
        }}>
          <Card style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: 'clamp(12px, 3vw, 24px)' }}>
            <div style={{ fontSize: 'clamp(48px, 12vw, 64px)', marginBottom: 'clamp(12px, 3vw, 16px)' }}>✅</div>
            <Title level={3} style={{ fontSize: 'clamp(16px, 4vw, 24px)', marginBottom: 'clamp(12px, 3vw, 16px)' }}>{training.title}</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 'clamp(16px, 4vw, 24px)', fontSize: 'clamp(12px, 2.5vw, 14px)' }}>
              {training.description}
            </Text>
            <Button 
              type="primary" 
              block 
              onClick={handleCompleteWithoutQuiz}
              style={{ fontSize: 'clamp(12px, 3vw, 14px)', padding: 'clamp(8px, 2vw, 10px) 0' }}
            >
              Сургалт дуусгах
            </Button>
          </Card>
        </div>
      );
    }
  }

  // Show quiz
  if (showQuiz) {
    return (
      <div style={{ minHeight: '100vh', background: token.colorBgLayout, padding: 'clamp(12px, 3vw, 32px) clamp(8px, 2vw, 16px)' }}>
        <div style={{ maxWidth: 768, margin: '0 auto' }}>
          <Card style={{ padding: 'clamp(12px, 3vw, 24px)' }}>
            <Title level={3} style={{ marginBottom: 'clamp(16px, 4vw, 24px)', fontSize: 'clamp(16px, 4vw, 24px)' }}>
              {training.title} - Шалгалт
            </Title>

            {quizSubmitted ? (
              <Result
                icon={<span style={{ fontSize: 'clamp(48px, 12vw, 64px)' }}>{quizResult.passed ? '🎉' : '😢'}</span>}
                title={
                  <span style={{ color: quizResult.passed ? token.colorSuccess : token.colorError, fontSize: 'clamp(16px, 4vw, 20px)' }}>
                    {quizResult.passed ? 'Баяр хүргэе!' : 'Тэнцсэнгүй'}
                  </span>
                }
                subTitle={
                  <span style={{ fontSize: 'clamp(13px, 3vw, 14px)' }}>
                    Таны оноо: {quizResult.score}/{shuffledQuestions.length} ({quizResult.percentage}%)
                  </span>
                }
                extra={
                  quizResult.passed ? (
                    <Button 
                      type="primary" 
                      onClick={() => navigate(`/certificate/${trainingId}`)}
                      style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}
                    >
                      Гэрчилгээ харах
                    </Button>
                  ) : (
                    <Button 
                      type="primary" 
                      onClick={handleStartQuiz}
                      style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}
                    >
                      Дахин өгөх
                    </Button>
                  )
                }
              />
            ) : (
              <div>
                {shuffledQuestions.map((question, index) => (
                  <Card 
                    key={question._id} 
                    size="small" 
                    style={{ marginBottom: 'clamp(12px, 3vw, 16px)' }}
                  >
                    <Text strong style={{ display: 'block', marginBottom: 'clamp(8px, 2vw, 12px)', fontSize: 'clamp(13px, 3vw, 15px)', lineHeight: 1.5 }}>
                      {index + 1}. {question.questionText}
                    </Text>
                    <Radio.Group
                      value={answers[question._id]}
                      onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {question.options.map((option) => (
                          <div
                            key={option._id}
                            style={{
                              padding: 'clamp(8px, 2vw, 12px) clamp(12px, 3vw, 16px)',
                              borderRadius: 'clamp(6px, 1.5vw, 8px)',
                              border: `1px solid ${answers[question._id] === option._id ? token.colorPrimary : token.colorBorder}`,
                              background: answers[question._id] === option._id ? token.colorPrimaryBg : token.colorBgContainer,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              fontSize: 'clamp(12px, 2.5vw, 14px)'
                            }}
                            onClick={() => handleAnswerChange(question._id, option._id)}
                          >
                            <Radio value={option._id} style={{ fontSize: 'clamp(12px, 2.5vw, 14px)' }}>{option.text}</Radio>
                          </div>
                        ))}
                      </Space>
                    </Radio.Group>
                  </Card>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'clamp(12px, 3vw, 16px)', flexWrap: 'wrap', gap: 'clamp(8px, 2vw, 12px)' }}>
                  <Button
                    type="link"
                    onClick={() => {
                      if (!training.slides || training.slides.length === 0) {
                        navigate('/');
                      } else {
                        setShowQuiz(false);
                      }
                    }}
                    icon={<LeftOutlined />}
                  >
                    Буцах
                  </Button>
                  <Button type="primary" onClick={handleSubmitQuiz}>
                    Илгээх
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Show slides
  const slide = training.slides?.[currentSlide];
  const isLastSlide = currentSlide === (training.slides?.length || 0) - 1;
  const isCompleted = enrollment?.status === 'completed' || enrollment?.isPassed;

  // Safety check - if slide is undefined but we have slides array
  if (!slide && training.slides && training.slides.length > 0) {
    setCurrentSlide(0);
    return null;
  }

  const handleExit = () => {
    if (isCompleted) {
      navigate('/');
    } else {
      setShowExitConfirm(true);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1f2937', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ 
        background: '#374151', 
        color: 'white', 
        padding: '8px 12px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
          <Button
            type="text"
            icon={<HomeOutlined />}
            onClick={handleExit}
            style={{ color: 'white', marginRight: 8, padding: '4px 8px' }}
            title="Гарах"
          />
          <Text 
            strong 
            style={{ 
              color: 'white',
              fontSize: 'clamp(12px, 3vw, 16px)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {training.title}
          </Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text type="secondary" style={{ color: '#9ca3af', fontSize: 'clamp(11px, 2.5vw, 14px)', whiteSpace: 'nowrap' }}>
            {currentSlide + 1} / {training.slides.length}
          </Text>
          <Button size="small" onClick={handleExit} style={{ fontSize: 'clamp(11px, 2.5vw, 14px)', padding: '4px 12px' }}>
            Гарах
          </Button>
        </div>
      </header>

      {/* Slide content */}
      <main style={{ flex: 1, overflow: 'auto', padding: 'clamp(4px, 2vw, 16px)' }}>
        <div style={{ maxWidth: 896, width: '100%', margin: '0 auto' }}>
          <Card 
            styles={{ body: { padding: 0 } }}
            style={{ borderRadius: 'clamp(8px, 2vw, 12px)', overflow: 'hidden' }}
          >
            {/* Video Content (YouTube) */}
            {slide?.videoUrl && (
              <div style={{ aspectRatio: '16/9', background: 'black' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeId(slide.videoUrl)}?rel=0`}
                  style={{ width: '100%', height: '100%', border: 0 }}
                  title={slide.title || 'Video'}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}
            
            {/* PDF Content - support both old pdfUrl and new url field */}
            {(slide?.pdfUrl || (slide?.url && slide?.contentType === 'application/pdf') || (slide?.type === 'file' && slide?.url?.endsWith('.pdf'))) && !slide?.videoUrl && !isPowerPoint(slide) && (
              <div style={{ position: 'relative', background: token.colorBgLayout, aspectRatio: '4/3', minHeight: '300px' }}>
                <iframe
                  src={`${getFileUrl(slide.pdfUrl || slide.url)}#toolbar=0&view=FitH`}
                  style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, border: 0 }}
                  title={slide.title || 'PDF Document'}
                />
                {/* Expand button - always visible */}
                <Button
                  type="primary"
                  icon={<ExpandOutlined />}
                  onClick={() => {
                    setShowPdfViewer(true);
                    setPdfZoom(100);
                  }}
                  size="small"
                  style={{ 
                    position: 'absolute', 
                    top: 'clamp(8px, 2vw, 12px)', 
                    right: 'clamp(8px, 2vw, 12px)', 
                    zIndex: 10,
                    fontSize: 'clamp(11px, 2.5vw, 14px)',
                    padding: 'clamp(4px, 1vw, 8px) clamp(8px, 2vw, 12px)'
                  }}
                >
                  <span style={{ display: 'none' }}>Томруулах</span>
                  <ExpandOutlined />
                </Button>
              </div>
            )}
            
            {/* Google Slides Content */}
            {isGoogleSlides(slide) && !slide?.videoUrl && (
              <div style={{ 
                position: 'relative', 
                aspectRatio: '16/9',
                background: token.colorBgLayout
              }}>
                <iframe
                  src={slide.url}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    border: 'none',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}
                  title={slide.title || 'Google Slides Presentation'}
                  allowFullScreen
                />
                <Button
                  type="primary"
                  icon={<ExpandOutlined />}
                  onClick={() => setShowGoogleSlidesFullscreen(true)}
                  size="small"
                  style={{ 
                    position: 'absolute', 
                    top: 'clamp(8px, 2vw, 12px)', 
                    right: 'clamp(8px, 2vw, 12px)', 
                    zIndex: 10,
                    fontSize: 'clamp(11px, 2.5vw, 14px)',
                    padding: 'clamp(4px, 1vw, 8px) clamp(8px, 2vw, 12px)'
                  }}
                >
                  <span style={{ display: 'none' }}>Бүтэн дэлгэц</span>
                  <ExpandOutlined />
                </Button>
              </div>
            )}
            
            {/* PowerPoint Content */}
            {isPowerPoint(slide) && !slide?.videoUrl && !isGoogleSlides(slide) && (
              <div style={{ 
                position: 'relative', 
                aspectRatio: '16/9',
                background: token.colorBgLayout
              }}>
                {/* Try Google Docs Viewer for PPT files */}
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + getFileUrl(slide.url))}&embedded=true`}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    border: 'none',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}
                  title="PowerPoint Viewer"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
                {/* Fallback overlay - shown if iframe fails to load */}
                <div style={{ 
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                  padding: '24px 16px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FilePptOutlined style={{ fontSize: 20, color: 'white' }} />
                    <Text style={{ color: 'white', fontSize: 14 }}>
                      {slide.fileName || 'PowerPoint Presentation'}
                    </Text>
                  </div>
                  <Button 
                    type="primary" 
                    size="small"
                    icon={<DownloadOutlined />}
                    href={getFileUrl(slide.url)}
                    target="_blank"
                  >
                    Татах
                  </Button>
                </div>
              </div>
            )}
            
            {/* Image Content - support both old imageUrl and new url field */}
            {(slide?.imageUrl || 
              (slide?.url && slide?.contentType?.startsWith('image/')) || 
              (slide?.type === 'image') ||
              (slide?.url && slide?.url?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))) && 
              !slide?.pdfUrl && 
              !slide?.videoUrl && 
              !isPowerPoint(slide) && 
              !isGoogleSlides(slide) && (
              <div style={{ 
                width: '100%',
                maxHeight: '70vh',
                background: token.colorBgLayout,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px'
              }}>
                <img
                  src={getFileUrl(slide.imageUrl || slide.url)}
                  alt={slide.title || 'Slide'}
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain' 
                  }}
                  onError={(e) => {
                    console.error('Image load error:', slide);
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div style="padding: 48px; text-align: center; color: #ef4444;">⚠️ Зураг ачааллахад алдаа гарлаа</div>';
                  }}
                />
              </div>
            )}
            
            {/* Text-only slide */}
            {slide?.type === 'text' && !slide?.url && !slide?.imageUrl && !slide?.pdfUrl && !slide?.videoUrl && (
              <div style={{ 
                padding: 'clamp(16px, 4vw, 32px)', 
                background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)', 
                minHeight: 'clamp(200px, 40vh, 300px)', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center' 
              }}>
                {slide?.title && (
                  <Title level={3} style={{ textAlign: 'center', marginBottom: 'clamp(12px, 3vw, 16px)', fontSize: 'clamp(16px, 4vw, 24px)' }}>
                    {slide.title}
                  </Title>
                )}
                {slide?.content && (
                  <Paragraph style={{ textAlign: 'center', whiteSpace: 'pre-wrap', fontSize: 'clamp(13px, 3vw, 16px)', lineHeight: 1.6 }}>
                    {slide.content}
                  </Paragraph>
                )}
              </div>
            )}
            
            {/* Title and Content for media slides */}
            {(slide?.imageUrl || slide?.pdfUrl || slide?.videoUrl || (slide?.url && slide?.type !== 'text')) && (
              <div style={{ padding: 'clamp(12px, 3vw, 24px)' }}>
                {slide?.title && (
                  <Title level={4} style={{ marginBottom: 'clamp(8px, 2vw, 12px)', fontSize: 'clamp(14px, 3.5vw, 20px)' }}>
                    {slide.title}
                  </Title>
                )}
                {slide?.content && (
                  <div 
                    dangerouslySetInnerHTML={{ __html: slide.content }}
                    style={{ 
                      color: token.colorTextSecondary,
                      fontSize: 'clamp(12px, 2.5vw, 14px)',
                      lineHeight: 1.6
                    }}
                  />
                )}
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Floating Navigation Buttons for Mobile */}
      {!isLastSlide && (
        <>
          {/* Previous Button - Left Side */}
          {currentSlide > 0 && (
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<LeftOutlined />}
              onClick={() => handleSlideChange(currentSlide - 1)}
              style={{
                position: 'fixed',
                left: 'clamp(8px, 2vw, 16px)',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 'clamp(48px, 12vw, 64px)',
                height: 'clamp(48px, 12vw, 64px)',
                fontSize: 'clamp(18px, 4vw, 24px)',
                zIndex: 100,
                background: 'rgba(55, 65, 81, 0.9)',
                borderColor: 'rgba(55, 65, 81, 0.9)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          )}

          {/* Next Button - Right Side */}
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={canProceed ? <RightOutlined /> : null}
            onClick={() => handleSlideChange(currentSlide + 1)}
            disabled={!canProceed}
            style={{
              position: 'fixed',
              right: 'clamp(8px, 2vw, 16px)',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 'clamp(48px, 12vw, 64px)',
              height: 'clamp(48px, 12vw, 64px)',
              fontSize: 'clamp(18px, 4vw, 24px)',
              zIndex: 100,
              background: canProceed ? 'rgba(37, 99, 235, 0.9)' : 'rgba(75, 85, 99, 0.6)',
              borderColor: canProceed ? 'rgba(37, 99, 235, 0.9)' : 'rgba(107, 114, 128, 0.6)',
              boxShadow: canProceed ? '0 4px 12px rgba(37, 99, 235, 0.4)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canProceed ? 'pointer' : 'not-allowed'
            }}
          >
            {!canProceed && (
              <span style={{
                fontSize: 'clamp(14px, 3vw, 18px)',
                fontWeight: 'bold',
                color: 'white'
              }}>
                {timeRemaining}
              </span>
            )}
          </Button>
        </>
      )}

      {/* Navigation */}
      <footer style={{ background: '#374151', padding: 'clamp(8px, 2vw, 16px)' }}>
        <div style={{ maxWidth: 896, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <Button
            type="text"
            icon={<LeftOutlined />}
            onClick={() => handleSlideChange(currentSlide - 1)}
            disabled={currentSlide === 0}
            style={{ 
              color: currentSlide === 0 ? '#6b7280' : 'white',
              fontSize: 'clamp(11px, 2.5vw, 14px)',
              padding: 'clamp(4px, 1vw, 8px) clamp(8px, 2vw, 15px)'
            }}
          >
            <span style={{ display: 'none' }}>Өмнөх</span>
            <span style={{ display: 'inline' }}>←</span>
          </Button>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'wrap', justifyContent: 'center', flex: 1, maxWidth: '60%' }}>
            {training.slides.map((_, index) => {
              const canGoToSlide = index <= currentSlide || canProceed || enrollment?.isPassed;
              return (
                <button
                  key={index}
                  onClick={() => canGoToSlide && handleSlideChange(index)}
                  disabled={!canGoToSlide}
                  style={{
                    width: index === currentSlide ? 'clamp(12px, 3vw, 16px)' : 'clamp(6px, 1.5vw, 8px)',
                    height: 'clamp(6px, 1.5vw, 8px)',
                    borderRadius: 'clamp(3px, 1vw, 4px)',
                    border: 'none',
                    cursor: canGoToSlide ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    background: index === currentSlide
                      ? '#3b82f6'
                      : index < currentSlide
                      ? '#93c5fd'
                      : canGoToSlide
                      ? '#9ca3af'
                      : '#4b5563'
                  }}
                />
              );
            })}
          </div>

          {isLastSlide ? (
            enrollment?.status === 'completed' || enrollment?.isPassed ? (
              <Button
                icon={<CheckOutlined />}
                onClick={() => navigate('/')}
              >
                Дууссан
              </Button>
            ) : (
              <Button
                type={canProceed ? 'primary' : 'default'}
                icon={canProceed ? <CheckOutlined /> : null}
                onClick={handleStartQuiz}
                disabled={!canProceed}
                style={{ 
                  background: canProceed ? '#16a34a' : 'rgba(255,255,255,0.1)',
                  borderColor: canProceed ? '#16a34a' : 'rgba(255,255,255,0.3)',
                  color: canProceed ? 'white' : 'rgba(255,255,255,0.6)',
                  fontSize: 'clamp(11px, 2.5vw, 14px)',
                  padding: 'clamp(4px, 1vw, 8px) clamp(12px, 3vw, 15px)'
                }}
              >
                {canProceed ? (
                  <span style={{ whiteSpace: 'nowrap' }}>{questions.length > 0 ? 'Шалгалт' : 'Дуусгах'}</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)' }}>
                    <span style={{ 
                      width: 'clamp(18px, 4vw, 24px)', 
                      height: 'clamp(18px, 4vw, 24px)', 
                      borderRadius: '50%', 
                      background: '#2563eb',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: 'clamp(10px, 2vw, 12px)',
                      fontWeight: 'bold',
                      color: 'white'
                    }}>
                      {timeRemaining}
                    </span>
                    <span style={{ whiteSpace: 'nowrap' }}>{questions.length > 0 ? 'Шалгалт' : 'Дуусгах'}</span>
                  </span>
                )}
              </Button>
            )
          ) : (
            <Button
              type={canProceed ? 'text' : 'default'}
              onClick={() => handleSlideChange(currentSlide + 1)}
              disabled={!canProceed}
              style={{ 
                color: canProceed ? 'white' : 'rgba(255,255,255,0.6)',
                background: canProceed ? 'transparent' : 'rgba(255,255,255,0.1)',
                borderColor: canProceed ? 'transparent' : 'rgba(255,255,255,0.3)',
                fontSize: 'clamp(11px, 2.5vw, 14px)',
                padding: 'clamp(4px, 1vw, 8px) clamp(8px, 2vw, 15px)'
              }}
            >
              {canProceed ? (
                <span>
                  <span style={{ display: 'none' }}>Дараах</span>
                  <span style={{ display: 'inline' }}>→</span>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)' }}>
                  <span style={{ 
                    width: 'clamp(20px, 4vw, 28px)', 
                    height: 'clamp(20px, 4vw, 28px)', 
                    borderRadius: '50%', 
                    background: '#2563eb', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: 'clamp(10px, 2vw, 12px)',
                    fontWeight: 'bold',
                    color: 'white',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}>
                    {timeRemaining}
                  </span>
                  <span style={{ display: 'none' }}>Дараах</span>
                </span>
              )}
            </Button>
          )}
        </div>
      </footer>

      {/* Exit Confirm Modal */}
      <Modal
        open={showExitConfirm}
        onCancel={() => setShowExitConfirm(false)}
        onOk={() => navigate('/')}
        title="Сургалтаас гарах"
        okText="Гарах"
        cancelText="Үргэлжлүүлэх"
        okButtonProps={{ danger: true }}
      >
        <Text>Сургалтаас гарах уу? Таны явц хадгалагдсан.</Text>
      </Modal>

      {/* PDF Fullscreen Viewer */}
      <Modal
        open={showPdfViewer && (slide?.pdfUrl || (slide?.contentType === 'application/pdf') || (slide?.url?.endsWith('.pdf')))}
        onCancel={() => setShowPdfViewer(false)}
        footer={null}
        width="100%"
        style={{ top: 0, padding: 0, maxWidth: '100vw', margin: 0 }}
        styles={{ body: { padding: 0, height: 'calc(100vh - 55px)', background: '#000' } }}
        closable={false}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', margin: -24, marginBottom: 0, padding: '12px 24px' }}>
            <Text strong style={{ color: 'white' }}>{slide?.title || 'PDF Материал'}</Text>
            <Space>
              {/* Zoom controls */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                background: '#374151', 
                borderRadius: 8, 
                padding: '4px 12px' 
              }}>
                <Button
                  type="text"
                  icon={<ZoomOutOutlined />}
                  onClick={() => setPdfZoom(prev => Math.max(50, prev - 25))}
                  style={{ color: '#d1d5db' }}
                />
                <Text style={{ color: 'white', minWidth: 60, textAlign: 'center' }}>{pdfZoom}%</Text>
                <Button
                  type="text"
                  icon={<ZoomInOutlined />}
                  onClick={() => setPdfZoom(prev => Math.min(200, prev + 25))}
                  style={{ color: '#d1d5db' }}
                />
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={() => setPdfZoom(100)}
                  style={{ color: '#d1d5db' }}
                />
              </div>
              <Button
                danger
                type="primary"
                icon={<CloseOutlined />}
                onClick={() => setShowPdfViewer(false)}
              >
                Хаах
              </Button>
            </Space>
          </div>
        }
      >
        <iframe
          src={`${getFileUrl(slide?.pdfUrl || slide?.url)}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
          style={{ width: '100%', height: '100%', border: 0 }}
          title={slide?.title || 'PDF Document'}
        />
      </Modal>

      {/* Google Slides Fullscreen Viewer */}
      <Modal
        open={showGoogleSlidesFullscreen && isGoogleSlides(slide)}
        onCancel={() => setShowGoogleSlidesFullscreen(false)}
        footer={null}
        width="100%"
        style={{ top: 0, padding: 0, maxWidth: '100vw', margin: 0 }}
        styles={{ body: { padding: 0, height: 'calc(100vh - 55px)', background: '#000' } }}
        closable={false}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', margin: -24, marginBottom: 0, padding: '12px 24px' }}>
            <Space>
              <PlaySquareOutlined style={{ color: '#FBBC04', fontSize: 20 }} />
              <Text strong style={{ color: 'white' }}>{slide?.title || 'Google Slides'}</Text>
            </Space>
            <Space>
              <Button
                type="default"
                icon={<ExpandOutlined />}
                onClick={() => {
                  const iframe = document.querySelector('.google-slides-fullscreen-iframe');
                  if (iframe?.requestFullscreen) {
                    iframe.requestFullscreen();
                  } else if (iframe?.webkitRequestFullscreen) {
                    iframe.webkitRequestFullscreen();
                  }
                }}
                style={{ background: '#374151', borderColor: '#374151', color: 'white' }}
              >
                Бүтэн дэлгэц (F11)
              </Button>
              <Button
                danger
                type="primary"
                icon={<CloseOutlined />}
                onClick={() => setShowGoogleSlidesFullscreen(false)}
              >
                Хаах
              </Button>
            </Space>
          </div>
        }
      >
        <iframe
          className="google-slides-fullscreen-iframe"
          src={slide?.url?.replace('/embed?', '/embed?start=true&loop=false&') || slide?.url}
          style={{ 
            width: '100%', 
            height: '100%', 
            border: 0,
            background: '#000'
          }}
          title={slide?.title || 'Google Slides Presentation'}
          allowFullScreen
        />
      </Modal>
    </div>
  );
};

export default Training;
