import { useEffect, useState, useRef } from 'react';
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
  CompressOutlined,
  CloseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
  FilePptOutlined,
  DownloadOutlined,
  PlaySquareOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// Prefix for uploaded file URLs — empty lets Vite dev proxy or Nginx prod proxy handle /uploads/
const API_BASE = import.meta.env.VITE_API_URL || '';

// Helper function to get full URL for uploaded files
// Also strips old absolute localhost URLs that may be stored in the DB
const getFileUrl = (url) => {
  if (!url) return '';
  // Normalize old absolute localhost URLs to relative paths
  const normalized = url.replace(/^https?:\/\/[^/]+(\/uploads\/)/, '/uploads/');
  if (normalized.startsWith('/uploads/')) {
    return `${API_BASE}${normalized}`;
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true);
  const trainingContainerRef = useRef(null);

  // --- Fullscreen helpers ---
  const enterFullscreen = async () => {
    const el = trainingContainerRef.current || document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) await el.msRequestFullscreen();
      else setIsFullscreen(true); // visual fallback (iOS)
      screen.orientation?.lock?.('landscape').catch(() => {});
    } catch {
      setIsFullscreen(true); // visual fallback if API rejected
    }
  };

  const exitFullscreen = () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)
          ?.call(document);
      } else {
        setIsFullscreen(false);
      }
      screen.orientation?.unlock?.();
    } catch {
      setIsFullscreen(false);
    }
  };

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

  // Reset media error when navigating between slides
  useEffect(() => {
    setMediaLoadError(false);
  }, [currentSlide]);

  // Track native fullscreen state changes
  useEffect(() => {
    const onFSChange = () => {
      const active = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(active);
      if (!active) screen.orientation?.unlock?.();
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
      // Clean up on unmount: exit fullscreen & unlock orientation
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document).catch(() => {});
      }
      screen.orientation?.unlock?.();
    };
  }, []);

  // Auto-enter fullscreen once training data has loaded
  useEffect(() => {
    if (!loading && training) {
      enterFullscreen().then(() => setShowFullscreenPrompt(false)).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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
      navigate('/trainings');
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
                onClick={() => navigate('/trainings')}
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
                        navigate('/trainings');
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
    // Exit native fullscreen before navigating away
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document).catch(() => {});
    }
    setIsFullscreen(false);
    screen.orientation?.unlock?.();
    if (isCompleted) {
      navigate('/trainings');
    } else {
      setShowExitConfirm(true);
    }
  };

  // Visual-fullscreen: cover viewport via CSS when native API is unavailable (e.g. iOS Safari)
  const visualFullscreenStyle = isFullscreen && !document.fullscreenElement && !document.webkitFullscreenElement
    ? { position: 'fixed', inset: 0, zIndex: 9999 }
    : {};

  return (
    <div
      ref={trainingContainerRef}
      style={{ height: '100dvh', background: '#111827', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...visualFullscreenStyle }}
    >
      {/* Fullscreen launch prompt — shown on first load, requires direct tap to satisfy browser gesture policy */}
      {showFullscreenPrompt && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 20, padding: 24
          }}
        >
          <span style={{ fontSize: 56 }}>📱</span>
          <Title level={3} style={{ color: 'white', textAlign: 'center', margin: 0, fontSize: 'clamp(18px, 4vw, 24px)' }}>
            {training.title}
          </Title>
          <Text style={{ color: '#9ca3af', textAlign: 'center', fontSize: 'clamp(13px, 3vw, 15px)' }}>
            Бүтэн дэлгэцээр сургалт үзэх нь тохиромжтой
          </Text>
          <Space direction="vertical" style={{ width: '100%', maxWidth: 320 }}>
            <Button
              type="primary"
              block
              size="large"
              icon={<ExpandOutlined />}
              onClick={() => {
                enterFullscreen();
                setShowFullscreenPrompt(false);
              }}
              style={{ height: 52, fontSize: 16 }}
            >
              Бүтэн дэлгэцээр нээх
            </Button>
            <Button
              block
              size="large"
              onClick={() => setShowFullscreenPrompt(false)}
              style={{ height: 52, fontSize: 16, background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              Хэвийн цонхиоцоор үргэлжлүүлэх
            </Button>
          </Space>
        </div>
      )}
      {/* Compact header */}
      <header style={{
        height: 48, flexShrink: 0,
        background: '#111827',
        display: 'flex', alignItems: 'center',
        padding: '0 4px',
        borderBottom: '1px solid rgba(255,255,255,0.07)'
      }}>
        <Button type="text" icon={<HomeOutlined />} onClick={handleExit}
          style={{ color: 'white', width: 44, height: 44, flexShrink: 0 }} />
        <Text strong style={{
          color: 'white', fontSize: 13, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          padding: '0 6px'
        }}>
          {training.title}
        </Text>
        <Text style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {currentSlide + 1}/{training.slides.length}
        </Text>
        <Button type="text"
          icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
          onClick={isFullscreen ? exitFullscreen : enterFullscreen}
          style={{ color: '#9ca3af', width: 44, height: 44, flexShrink: 0 }}
          title={isFullscreen ? 'Бүтэн дэлгэцнээс гарах' : 'Бүтэн дэлгэц'}
        />
      </header>

      {/* Slide content — edge-to-edge, no card/padding */}
      <main style={{ flex: 1, overflow: 'auto', background: '#000', position: 'relative' }}>

        {/* YouTube Video */}
        {slide?.videoUrl && (
          <div style={{ background: '#000', position: 'relative' }}>
            <div style={{ aspectRatio: '16/9', width: '100%' }}>
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(slide.videoUrl)}?rel=0`}
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                title={slide.title || 'Video'}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
            <a href={slide.videoUrl} target="_blank" rel="noopener noreferrer"
              style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.65)', borderRadius: 6, padding: '3px 8px', color: '#93c5fd', fontSize: 11, textDecoration: 'none' }}>
              YouTube ↗
            </a>
          </div>
        )}

        {/* PDF */}
        {(slide?.pdfUrl || (slide?.url && slide?.contentType === 'application/pdf') || (slide?.type === 'file' && slide?.url?.endsWith('.pdf'))) && !slide?.videoUrl && !isPowerPoint(slide) && (
          <div style={{ width: '100%', height: 'calc(100dvh - 96px)', position: 'relative' }}>
            {mediaLoadError ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#111' }}>
                <span style={{ fontSize: 32 }}>⚠️</span>
                <Text style={{ color: '#ef4444' }}>Файл ачаалахад алдаа гарлаа</Text>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={() => setMediaLoadError(false)}>Дахин</Button>
                  <Button icon={<DownloadOutlined />} href={getFileUrl(slide.pdfUrl || slide.url)} target="_blank" rel="noopener noreferrer">Татах</Button>
                </Space>
              </div>
            ) : (
              <iframe
                src={`${getFileUrl(slide.pdfUrl || slide.url)}#toolbar=0&view=FitH`}
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                title={slide.title || 'PDF Document'}
                onError={() => setMediaLoadError(true)}
              />
            )}
            {!mediaLoadError && (
              <Button type="primary" icon={<ExpandOutlined />}
                onClick={() => { setShowPdfViewer(true); setPdfZoom(100); }}
                size="small"
                style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                Томруулах
              </Button>
            )}
          </div>
        )}

        {/* Google Slides */}
        {isGoogleSlides(slide) && !slide?.videoUrl && (
          <div style={{ width: '100%', height: 'calc(100dvh - 96px)', position: 'relative' }}>
            <iframe
              src={slide.url}
              style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
              title={slide.title || 'Google Slides'}
              allowFullScreen
            />
            <Button type="primary" icon={<ExpandOutlined />}
              onClick={() => setShowGoogleSlidesFullscreen(true)}
              size="small"
              style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
              Бүтэн дэлгэц
            </Button>
          </div>
        )}

        {/* PowerPoint */}
        {isPowerPoint(slide) && !slide?.videoUrl && !isGoogleSlides(slide) && (
          <div style={{ width: '100%', height: 'calc(100dvh - 96px)', position: 'relative' }}>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + getFileUrl(slide.url))}&embedded=true`}
              style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
              title="PowerPoint Viewer"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', padding: '24px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FilePptOutlined style={{ fontSize: 18, color: 'white' }} />
                <Text style={{ color: 'white', fontSize: 13 }}>{slide.fileName || 'PowerPoint'}</Text>
              </div>
              <Button type="primary" size="small" icon={<DownloadOutlined />} href={getFileUrl(slide.url)} target="_blank">Татах</Button>
            </div>
          </div>
        )}

        {/* Image */}
        {(slide?.imageUrl ||
          (slide?.url && slide?.contentType?.startsWith('image/')) ||
          (slide?.type === 'image') ||
          (slide?.url && slide?.url?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))) &&
          !slide?.pdfUrl && !slide?.videoUrl && !isPowerPoint(slide) && !isGoogleSlides(slide) && (
          <div style={{ width: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={getFileUrl(slide.imageUrl || slide.url)}
              alt={slide.title || 'Slide'}
              style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 'calc(100dvh - 96px)', objectFit: 'contain' }}
              onError={(e) => {
                if (import.meta.env.DEV) console.error('Image error:', slide);
                e.target.style.display = 'none';
                const div = document.createElement('div');
                div.style.cssText = 'padding:48px;text-align:center;color:#ef4444;font-size:16px;width:100%;background:#111';
                div.innerHTML = '⚠️ Зураг ачааллахад алдаа гарлаа';
                e.target.parentElement.appendChild(div);
              }}
            />
          </div>
        )}

        {/* Text-only slide */}
        {slide?.type === 'text' && !slide?.url && !slide?.imageUrl && !slide?.pdfUrl && !slide?.videoUrl && (
          <div style={{ minHeight: 'calc(100dvh - 96px)', padding: '32px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(135deg, #1e3a5f 0%, #111827 100%)' }}>
            {slide?.title && <Title level={3} style={{ color: 'white', textAlign: 'center', marginBottom: 16, fontSize: 'clamp(18px, 4vw, 26px)' }}>{slide.title}</Title>}
            {slide?.content && <Paragraph style={{ color: '#d1d5db', textAlign: 'center', whiteSpace: 'pre-wrap', fontSize: 'clamp(14px, 3vw, 16px)', lineHeight: 1.7, margin: 0 }}>{slide.content}</Paragraph>}
          </div>
        )}

        {/* Title + description for media slides shown below the media */}
        {(slide?.imageUrl || slide?.pdfUrl || slide?.videoUrl || (slide?.url && slide?.type !== 'text')) && (slide?.title || slide?.content) && (
          <div style={{ padding: '14px 16px', background: '#111827', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {slide?.title && <Title level={5} style={{ color: 'white', margin: '0 0 6px', fontSize: 'clamp(13px, 3vw, 17px)' }}>{slide.title}</Title>}
            {slide?.content && <div dangerouslySetInnerHTML={{ __html: slide.content }} style={{ color: '#9ca3af', fontSize: 'clamp(12px, 2.5vw, 14px)', lineHeight: 1.6 }} />}
          </div>
        )}

      </main>

      {/* Slim bottom navigation bar */}
      <footer style={{
        height: 48, flexShrink: 0,
        background: '#111827',
        display: 'flex', alignItems: 'center',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '0 4px'
      }}>
        {/* Previous */}
        <Button type="text" icon={<LeftOutlined />}
          onClick={() => handleSlideChange(currentSlide - 1)}
          disabled={currentSlide === 0}
          style={{ color: currentSlide === 0 ? '#374151' : 'white', width: 48, height: 48, flexShrink: 0 }}
        />

        {/* Progress dots */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden', padding: '0 4px' }}>
          {training.slides.map((_, index) => {
            const canGoToSlide = index <= currentSlide || canProceed || enrollment?.isPassed;
            return (
              <button key={index} onClick={() => canGoToSlide && handleSlideChange(index)}
                disabled={!canGoToSlide}
                style={{
                  width: index === currentSlide ? 20 : 7, height: 7,
                  borderRadius: 4, border: 'none', padding: 0, flexShrink: 0,
                  cursor: canGoToSlide ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  background: index === currentSlide ? '#3b82f6' : index < currentSlide ? '#6b7280' : '#374151'
                }}
              />
            );
          })}
        </div>

        {/* Next / Quiz / Done */}
        {isLastSlide ? (
          enrollment?.status === 'completed' || enrollment?.isPassed ? (
            <Button type="text" icon={<CheckOutlined />} onClick={() => navigate('/trainings')}
              style={{ color: '#22c55e', width: 48, height: 48, flexShrink: 0 }} />
          ) : (
            <Button onClick={handleStartQuiz} disabled={!canProceed}
              style={{
                background: canProceed ? '#16a34a' : 'transparent',
                borderColor: canProceed ? '#16a34a' : '#374151',
                color: canProceed ? 'white' : '#6b7280',
                height: 36, padding: '0 14px', borderRadius: 8, fontSize: 13,
                flexShrink: 0, marginRight: 4
              }}>
              {canProceed
                ? (questions.length > 0 ? 'Шалгалт →' : 'Дуусгах ✓')
                : <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 'bold', color: 'white' }}>{timeRemaining}</span>
                    {questions.length > 0 ? 'Шалгалт' : 'Дуусгах'}
                  </span>
              }
            </Button>
          )
        ) : (
          <Button type="text" onClick={() => handleSlideChange(currentSlide + 1)} disabled={!canProceed}
            style={{ color: canProceed ? 'white' : '#374151', width: 48, height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {canProceed
              ? <RightOutlined />
              : <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 'bold', color: 'white' }}>{timeRemaining}</span>
            }
          </Button>
        )}
      </footer>

      {/* Exit Confirm Modal */}
      <Modal
        open={showExitConfirm}
        onCancel={() => setShowExitConfirm(false)}
        onOk={() => navigate('/trainings')}
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
