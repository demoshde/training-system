import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { workerApi } from '../../api';
import api from '../../api';
import toast from 'react-hot-toast';
import {
  AcademicCapIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  NewspaperIcon,
  SparklesIcon,
  PhotoIcon,
  DocumentIcon,
  PlayCircleIcon,
  ChatBubbleLeftRightIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const CATEGORIES = [
  { value: 'change', label: 'Сүүлд гарсан өөрчлөлт', icon: ArrowPathIcon, color: 'blue' },
  { value: 'accident', label: 'Ослын сургамж', icon: ExclamationTriangleIcon, color: 'red' },
  { value: 'improvement', label: 'Сайжруулалт', icon: SparklesIcon, color: 'green' }
];

const Dashboard = () => {
  const { worker, logout } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reEnrolling, setReEnrolling] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'incomplete', 'completed', 'expired'
  const [expandedCards, setExpandedCards] = useState({});
  
  // News state
  const [news, setNews] = useState([]);
  const [newsCategory, setNewsCategory] = useState('');
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [selectedNews, setSelectedNews] = useState(null);
  
  // Polls state
  const [polls, setPolls] = useState([]);
  const [showPollModal, setShowPollModal] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [pollAnswers, setPollAnswers] = useState({});
  const [submittingPoll, setSubmittingPoll] = useState(false);
  const [submittedResponse, setSubmittedResponse] = useState(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('trainings'); // 'trainings', 'news', or 'polls'

  useEffect(() => {
    // Only fetch when worker is authenticated
    if (worker) {
      fetchEnrollments();
      fetchNews();
      fetchPolls();
    }
  }, [worker]);

  const fetchEnrollments = async () => {
    try {
      const res = await workerApi.get('/trainings');
      setEnrollments(res.data);
    } catch (error) {
      toast.error('Сургалтын мэдээлэл татахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  const fetchNews = async () => {
    try {
      const res = await api.get('/news?active=true');
      setNews(res.data);
    } catch (error) {
      console.error('News fetch error:', error);
    }
  };

  const fetchPolls = async () => {
    try {
      const res = await workerApi.get('/polls');
      setPolls(res.data);
    } catch (error) {
      console.error('Polls fetch error:', error);
    }
  };

  const openPollModal = async (poll) => {
    setSelectedPoll(poll);
    setPollAnswers({});
    setSubmittedResponse(null);
    setShowPollModal(true);
    
    // If already responded, fetch the response
    if (poll.hasResponded) {
      try {
        const res = await workerApi.get(`/polls/${poll._id}`);
        if (res.data.response) {
          setSubmittedResponse(res.data.response);
          // Populate answers for display
          const answers = {};
          res.data.response.answers.forEach(a => {
            answers[a.questionIndex] = a.answer;
          });
          setPollAnswers(answers);
        }
      } catch (error) {
        console.error('Fetch poll response error:', error);
      }
    }
  };

  const handlePollAnswerChange = (questionIndex, value, isMultiple = false) => {
    if (isMultiple) {
      const current = pollAnswers[questionIndex] || [];
      if (current.includes(value)) {
        setPollAnswers({
          ...pollAnswers,
          [questionIndex]: current.filter(v => v !== value)
        });
      } else {
        setPollAnswers({
          ...pollAnswers,
          [questionIndex]: [...current, value]
        });
      }
    } else {
      setPollAnswers({
        ...pollAnswers,
        [questionIndex]: value
      });
    }
  };

  const submitPollResponse = async () => {
    if (!selectedPoll) return;
    
    setSubmittingPoll(true);
    try {
      const answers = Object.entries(pollAnswers).map(([questionIndex, answer]) => ({
        questionIndex: parseInt(questionIndex),
        answer,
        answerType: selectedPoll.questions[parseInt(questionIndex)]?.questionType
      }));
      
      await workerApi.post(`/polls/${selectedPoll._id}/respond`, { answers });
      toast.success('Хариулт амжилттай илгээгдлээ');
      setShowPollModal(false);
      fetchPolls();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Алдаа гарлаа');
    } finally {
      setSubmittingPoll(false);
    }
  };

  // Re-enroll for expired training
  const handleReEnroll = async (trainingId) => {
    setReEnrolling(trainingId);
    try {
      await workerApi.post(`/trainings/${trainingId}/re-enroll`);
      toast.success('Дахин бүртгэл амжилттай! Сургалтаа эхлүүлнэ үү.');
      fetchEnrollments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Алдаа гарлаа');
    } finally {
      setReEnrolling(null);
    }
  };

  // Check if enrollment certificate is expired
  const isExpired = (enrollment) => {
    if (!enrollment.isPassed) return false;
    if (!enrollment.certificateExpiresAt) return false;
    return new Date() > new Date(enrollment.certificateExpiresAt);
  };

  // Filter enrollments based on selected filter
  const filteredEnrollments = enrollments.filter((enrollment) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return enrollment.isPassed && !isExpired(enrollment);
    if (filter === 'incomplete') return !enrollment.isPassed;
    if (filter === 'expired') return isExpired(enrollment);
    return true;
  });

  // Count for badges
  const completedCount = enrollments.filter(e => e.isPassed && !isExpired(e)).length;
  const incompleteCount = enrollments.filter(e => !e.isPassed).length;
  const expiredCount = enrollments.filter(e => isExpired(e)).length;

  // Calculate overall progress percentage
  const totalProgress = enrollments.length > 0 
    ? Math.round((completedCount / enrollments.length) * 100) 
    : 0;

  // Circular progress component
  const CircularProgress = ({ percentage, size = 120, strokeWidth = 12, compact = false }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#progressGradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold text-white ${compact ? 'text-lg' : 'text-3xl'}`}>{percentage}%</span>
          <span className={`text-white/80 ${compact ? 'text-[10px]' : 'text-xs'}`}>үзсэн</span>
        </div>
      </div>
    );
  };

  const getStatusBadge = (enrollment) => {
    if (isExpired(enrollment)) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
          Хугацаа дууссан
        </span>
      );
    }
    if (enrollment.isPassed) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <CheckCircleIcon className="h-4 w-4 mr-1" />
          Үзсэн
        </span>
      );
    }
    if (enrollment.progress > 0) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          <ClockIcon className="h-4 w-4 mr-1" />
          Үргэлжилж байна ({enrollment.progress}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
        <AcademicCapIcon className="h-4 w-4 mr-1" />
        Шинэ
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-2xl mr-3">🎓</span>
            <h1 className="text-xl font-bold text-gray-900">Сургалтын систем</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">
              {worker?.firstName} {worker?.lastName}
            </span>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-red-600 transition"
              title="Гарах"
            >
              <ArrowRightOnRectangleIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8 sm:px-6 lg:px-8">
        {/* Welcome card with Progress */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 sm:p-6 text-white mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold mb-1 truncate">
                Сайн байна уу, {worker?.firstName}!
              </h2>
              <p className="opacity-90 text-sm sm:text-base truncate">
                {worker?.company?.name}
              </p>
              <p className="text-xs sm:text-sm opacity-75">SAP: {worker?.sapId}</p>
              
              {/* Stats - Compact on mobile */}
              <div className="flex gap-4 sm:gap-6 mt-3">
                <div>
                  <p className="text-xl sm:text-2xl font-bold">{completedCount}</p>
                  <p className="text-xs opacity-75">Үзсэн</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold">{incompleteCount}</p>
                  <p className="text-xs opacity-75">Үзэх шаардлагатай</p>
                </div>
                {expiredCount > 0 && (
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-red-300">{expiredCount}</p>
                    <p className="text-xs opacity-75">Хугацаа дууссан</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Progress Circle - Smaller on mobile */}
            {enrollments.length > 0 && (
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="hidden sm:block">
                  <CircularProgress percentage={totalProgress} size={120} strokeWidth={12} />
                </div>
                <div className="sm:hidden">
                  <CircularProgress percentage={totalProgress} size={80} strokeWidth={8} compact={true} />
                </div>
                <p className="text-center text-xs sm:text-sm mt-2 font-medium text-white/90">
                  Нийт явц
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
          <button
            onClick={() => setActiveTab('trainings')}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === 'trainings'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <AcademicCapIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Миний сургалтууд</span>
            <span className="sm:hidden">Сургалт</span>
            {incompleteCount > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'trainings' ? 'bg-white/20' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {incompleteCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === 'news'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <NewspaperIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Мэдээ мэдээлэл</span>
            <span className="sm:hidden">Мэдээ</span>
            {news.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'news' ? 'bg-white/20' : 'bg-blue-100 text-blue-700'
              }`}>
                {news.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('polls')}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition whitespace-nowrap text-sm sm:text-base flex-shrink-0 ${
              activeTab === 'polls'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Санал асуулга</span>
            <span className="sm:hidden">Санал</span>
            {polls.filter(p => !p.hasResponded).length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'polls' ? 'bg-white/20' : 'bg-purple-100 text-purple-700'
              }`}>
                {polls.filter(p => !p.hasResponded).length}
              </span>
            )}
          </button>
        </div>

        {/* Trainings Tab */}
        {activeTab === 'trainings' && (
          <>
        {/* Trainings */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <h3 className="text-xl font-bold text-gray-900">Миний сургалтууд</h3>
          
          {/* Filter buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Бүгд ({enrollments.length})
            </button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'incomplete'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Үзэх шаардлагатай ({incompleteCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Үзсэн ({completedCount})
            </button>
            {expiredCount > 0 && (
              <button
                onClick={() => setFilter('expired')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'expired'
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-red-600 hover:bg-red-50'
                }`}
              >
                Хугацаа дууссан ({expiredCount})
              </button>
            )}
          </div>
        </div>
        
        {enrollments.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">
            <AcademicCapIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>Танд одоогоор сургалт бүртгэгдээгүй байна.</p>
          </div>
        ) : filteredEnrollments.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">
            <AcademicCapIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>{filter === 'completed' ? 'Үзсэн сургалт байхгүй.' : 'Үзэх шаардлагатай сургалт байхгүй.'}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredEnrollments.map((enrollment) => {
              const isExpanded = expandedCards[enrollment._id];
              
              return (
              <div
                key={enrollment._id}
                className="bg-white rounded-xl shadow-sm overflow-hidden"
              >
                {/* Header - Always visible */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedCards(prev => ({ ...prev, [enrollment._id]: !prev[enrollment._id] }))}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      enrollment.isPassed ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <h4 className="font-medium text-gray-900 truncate">
                      {enrollment.training.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(enrollment)}
                    {isExpanded ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                    {/* Description */}
                    <p className="text-gray-500 text-sm pt-3">
                      {enrollment.training.description}
                    </p>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Явц</span>
                        <span>{enrollment.isPassed ? 100 : enrollment.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            enrollment.isPassed ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${enrollment.isPassed ? 100 : enrollment.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Completed date and expiry info for completed trainings */}
                    {enrollment.isPassed && (
                      <div className="space-y-2 text-sm">
                        {/* Completed date */}
                        <div className="flex items-center justify-between px-3 py-2 bg-green-50 text-green-700 rounded-lg">
                          <span>Дуусгасан:</span>
                          <span className="font-medium">
                            {new Date(enrollment.completedAt).toLocaleDateString('mn-MN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        
                        {/* Expiry date */}
                        {enrollment.certificateExpiresAt ? (
                          <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                            isExpired(enrollment) 
                              ? 'bg-red-50 text-red-700' 
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            <span>{isExpired(enrollment) ? 'Дуусан:' : 'Хүчинтэй:'}</span>
                            <span className="font-medium">
                              {new Date(enrollment.certificateExpiresAt).toLocaleDateString('mn-MN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 text-gray-600 rounded-lg">
                            <span>Хүчинтэй:</span>
                            <span className="font-medium">Хугацаагүй</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      {/* Main Action Button */}
                      <Link
                        to={enrollment.isPassed 
                          ? `/certificate/${enrollment.training._id}`
                          : `/training/${enrollment.training._id}`
                        }
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition font-medium text-sm ${
                          isExpired(enrollment)
                            ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            : enrollment.isPassed
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isExpired(enrollment) ? (
                          <>
                            <DocumentTextIcon className="h-4 w-4" />
                            <span>Хуучин гэрчилгээ</span>
                          </>
                        ) : enrollment.isPassed ? (
                          <>
                            <DocumentTextIcon className="h-4 w-4" />
                            <span>Гэрчилгээ</span>
                          </>
                        ) : (
                          <>
                            <PlayCircleIcon className="h-4 w-4" />
                            <span>Үргэлжлүүлэх</span>
                          </>
                        )}
                      </Link>
                      
                      {/* Re-watch button for completed */}
                      {enrollment.isPassed && !isExpired(enrollment) && (
                        <Link
                          to={`/training/${enrollment.training._id}`}
                          className="p-2.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                          title="Сургалт дахин үзэх"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </Link>
                      )}
                      
                      {/* Re-enroll button for expired */}
                      {isExpired(enrollment) && (
                        <button
                          onClick={() => handleReEnroll(enrollment.training._id)}
                          disabled={reEnrolling === enrollment.training._id}
                          className="p-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
                          title="Дахин бүртгүүлэх"
                        >
                          {reEnrolling === enrollment.training._id ? (
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                          ) : (
                            <ArrowPathIcon className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
        </>
        )}

        {/* News Tab */}
        {activeTab === 'news' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <NewspaperIcon className="h-6 w-6" />
                Мэдээ мэдээлэл
              </h3>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setNewsCategory('')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  newsCategory === ''
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Бүгд
              </button>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setNewsCategory(newsCategory === cat.value ? '' : cat.value)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                      newsCategory === cat.value
                        ? cat.color === 'blue' ? 'bg-blue-600 text-white'
                        : cat.color === 'red' ? 'bg-red-600 text-white'
                        : 'bg-green-600 text-white'
                        : cat.color === 'blue' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : cat.color === 'red' ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* News Grid */}
            {news.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                <NewspaperIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Одоогоор мэдээ байхгүй байна.</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {news
                .filter(item => !newsCategory || item.category === newsCategory)
                .map((item) => {
                  const catInfo = CATEGORIES.find(c => c.value === item.category) || CATEGORIES[0];
                  const CatIcon = catInfo.icon;
                  return (
                    <div
                      key={item._id}
                      onClick={() => {
                        setSelectedNews(item);
                        setShowNewsModal(true);
                      }}
                      className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition border border-gray-100"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          catInfo.color === 'blue' ? 'bg-blue-100' 
                          : catInfo.color === 'red' ? 'bg-red-100' 
                          : 'bg-green-100'
                        }`}>
                          <CatIcon className={`h-5 w-5 ${
                            catInfo.color === 'blue' ? 'text-blue-600' 
                            : catInfo.color === 'red' ? 'text-red-600' 
                            : 'text-green-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            catInfo.color === 'blue' ? 'bg-blue-100 text-blue-700' 
                            : catInfo.color === 'red' ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                          }`}>
                            {catInfo.label}
                          </span>
                          <h4 className="font-semibold text-gray-900 mt-2 line-clamp-2">
                            {item.title}
                          </h4>
                          <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                            {item.content}
                          </p>
                          {/* Media indicators */}
                          <div className="flex items-center gap-1 mt-2">
                            {item.imageUrl && (
                              <span className="p-1 bg-purple-100 text-purple-600 rounded">
                                <PhotoIcon className="h-3 w-3" />
                              </span>
                            )}
                            {item.pdfUrl && (
                              <span className="p-1 bg-red-100 text-red-600 rounded">
                                <DocumentIcon className="h-3 w-3" />
                              </span>
                            )}
                            {item.youtubeUrl && (
                              <span className="p-1 bg-red-100 text-red-600 rounded">
                                <PlayCircleIcon className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(item.createdAt).toLocaleDateString('mn-MN')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            )}
          </div>
        )}

        {/* Polls Tab */}
        {activeTab === 'polls' && (
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Санал асуулга</h3>
            
            {polls.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl">
                <ChatBubbleLeftRightIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Одоогоор санал асуулга байхгүй байна</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {polls.map((poll) => (
                  <div
                    key={poll._id}
                    className={`bg-white rounded-xl shadow-sm p-6 transition hover:shadow-md ${
                      poll.hasResponded ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-gray-900">{poll.title}</h4>
                          {poll.hasResponded ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                              <CheckCircleIcon className="h-3 w-3" />
                              Хариулсан
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">
                              Шинэ
                            </span>
                          )}
                          {poll.isAnonymous && (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                              Нэргүй
                            </span>
                          )}
                        </div>
                        {poll.description && (
                          <p className="text-gray-600 text-sm mb-2">{poll.description}</p>
                        )}
                        <p className="text-sm text-gray-500">
                          {poll.questions?.length || 0} асуулт
                          {poll.endDate && (
                            <span className="ml-3">
                              Дуусах: {new Date(poll.endDate).toLocaleDateString('mn-MN')}
                            </span>
                          )}
                        </p>
                      </div>
                      
                      {!poll.hasResponded && (
                        <button
                          onClick={() => openPollModal(poll)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                        >
                          Хариулах
                        </button>
                      )}
                      {poll.hasResponded && (
                        <button
                          onClick={() => openPollModal(poll)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          Харах
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Poll Modal */}
      {showPollModal && selectedPoll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden my-8">
            <div className={`px-6 py-4 ${submittedResponse ? 'bg-green-600' : 'bg-purple-600'} text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedPoll.title}</h2>
                  {selectedPoll.description && (
                    <p className="text-white/80 text-sm mt-1">{selectedPoll.description}</p>
                  )}
                </div>
                {submittedResponse && (
                  <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">Хариулсан</span>
                  </div>
                )}
              </div>
              {submittedResponse && (
                <p className="text-white/70 text-xs mt-2">
                  Хариулсан огноо: {new Date(submittedResponse.submittedAt).toLocaleString('mn-MN')}
                </p>
              )}
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {submittedResponse && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-green-800 text-sm">
                    <CheckCircleIcon className="h-5 w-5 inline mr-2" />
                    Та энэ санал асуулгад аль хэдийн хариулсан байна. Доор таны өгсөн хариултууд харагдаж байна.
                  </p>
                </div>
              )}
              
              {selectedPoll.questions?.map((q, qIndex) => (
                <div key={qIndex} className="border-b border-gray-100 pb-4 last:border-0">
                  <label className="block font-medium text-gray-900 mb-3">
                    {qIndex + 1}. {q.questionText}
                    {q.required && !submittedResponse && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  
                  {/* Text input */}
                  {q.questionType === 'text' && (
                    submittedResponse ? (
                      <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                        {pollAnswers[qIndex] || <span className="text-gray-400 italic">Хариулаагүй</span>}
                      </div>
                    ) : (
                      <textarea
                        value={pollAnswers[qIndex] || ''}
                        onChange={(e) => handlePollAnswerChange(qIndex, e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        rows={3}
                        placeholder="Хариултаа бичнэ үү..."
                      />
                    )
                  )}
                  
                  {/* Rating */}
                  {q.questionType === 'rating' && (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => !submittedResponse && handlePollAnswerChange(qIndex, rating)}
                          disabled={!!submittedResponse}
                          className={`p-3 rounded-lg transition ${submittedResponse ? 'cursor-default' : 'cursor-pointer'} ${
                            pollAnswers[qIndex] === rating || (submittedResponse && pollAnswers[qIndex] >= rating)
                              ? 'bg-yellow-400 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                          }`}
                        >
                          <StarIcon className={`h-6 w-6 ${
                            pollAnswers[qIndex] >= rating ? 'fill-current' : ''
                          }`} />
                        </button>
                      ))}
                      {submittedResponse && pollAnswers[qIndex] && (
                        <span className="ml-2 text-gray-600 self-center">({pollAnswers[qIndex]} од)</span>
                      )}
                    </div>
                  )}
                  
                  {/* Single choice */}
                  {q.questionType === 'single_choice' && (
                    <div className="space-y-2">
                      {q.options?.map((opt, optIndex) => (
                        <label
                          key={optIndex}
                          className={`flex items-center p-3 rounded-lg transition ${submittedResponse ? 'cursor-default' : 'cursor-pointer'} ${
                            pollAnswers[qIndex] === opt.text
                              ? submittedResponse ? 'bg-green-100 border-green-500' : 'bg-purple-100 border-purple-500'
                              : 'bg-gray-50 hover:bg-gray-100'
                          } border`}
                        >
                          <input
                            type="radio"
                            name={`question-${qIndex}`}
                            checked={pollAnswers[qIndex] === opt.text}
                            onChange={() => !submittedResponse && handlePollAnswerChange(qIndex, opt.text)}
                            disabled={!!submittedResponse}
                            className="mr-3"
                          />
                          <span className={pollAnswers[qIndex] === opt.text && submittedResponse ? 'font-medium text-green-700' : ''}>
                            {opt.text}
                          </span>
                          {pollAnswers[qIndex] === opt.text && submittedResponse && (
                            <CheckCircleIcon className="h-5 w-5 text-green-600 ml-auto" />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {/* Multiple choice */}
                  {q.questionType === 'multiple_choice' && (
                    <div className="space-y-2">
                      {q.options?.map((opt, optIndex) => {
                        const isSelected = (pollAnswers[qIndex] || []).includes(opt.text);
                        return (
                          <label
                            key={optIndex}
                            className={`flex items-center p-3 rounded-lg transition ${submittedResponse ? 'cursor-default' : 'cursor-pointer'} ${
                              isSelected
                                ? submittedResponse ? 'bg-green-100 border-green-500' : 'bg-purple-100 border-purple-500'
                                : 'bg-gray-50 hover:bg-gray-100'
                            } border`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => !submittedResponse && handlePollAnswerChange(qIndex, opt.text, true)}
                              disabled={!!submittedResponse}
                              className="mr-3"
                            />
                            <span className={isSelected && submittedResponse ? 'font-medium text-green-700' : ''}>
                              {opt.text}
                            </span>
                            {isSelected && submittedResponse && (
                              <CheckCircleIcon className="h-5 w-5 text-green-600 ml-auto" />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              {submittedResponse ? (
                <button
                  onClick={() => {
                    setShowPollModal(false);
                    setSelectedPoll(null);
                    setPollAnswers({});
                    setSubmittedResponse(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition"
                >
                  Хаах
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowPollModal(false);
                      setSelectedPoll(null);
                      setPollAnswers({});
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition"
                  >
                    Цуцлах
                  </button>
                  <button
                    onClick={submitPollResponse}
                    disabled={submittingPoll}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition disabled:opacity-50"
                  >
                    {submittingPoll ? 'Илгээж байна...' : 'Илгээх'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* News Modal */}
      {showNewsModal && selectedNews && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden my-8">
            {(() => {
              const catInfo = CATEGORIES.find(c => c.value === selectedNews.category) || CATEGORIES[0];
              const CatIcon = catInfo.icon;
              // Extract YouTube video ID
              const getYoutubeVideoId = (url) => {
                if (!url) return null;
                const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                return match ? match[1] : null;
              };
              const videoId = getYoutubeVideoId(selectedNews.youtubeUrl);
              return (
                <>
                  <div className={`px-6 py-4 flex items-center gap-3 ${
                    catInfo.color === 'blue' ? 'bg-blue-600' 
                    : catInfo.color === 'red' ? 'bg-red-600' 
                    : 'bg-green-600'
                  } text-white`}>
                    <CatIcon className="h-6 w-6" />
                    <span className="font-medium">{catInfo.label}</span>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                      {selectedNews.title}
                    </h2>
                    
                    {/* Image */}
                    {selectedNews.imageUrl && (
                      <div className="mb-4">
                        <img 
                          src={selectedNews.imageUrl} 
                          alt={selectedNews.title}
                          className="w-full rounded-lg max-h-64 object-cover"
                        />
                      </div>
                    )}

                    {/* YouTube Video */}
                    {videoId && (
                      <div className="mb-4 aspect-video">
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title="YouTube video"
                          className="w-full h-full rounded-lg"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      </div>
                    )}

                    <p className="text-gray-600 whitespace-pre-line">
                      {selectedNews.content}
                    </p>

                    {/* PDF Link */}
                    {selectedNews.pdfUrl && (
                      <div className="mt-4">
                        <a 
                          href={selectedNews.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                        >
                          <DocumentIcon className="h-5 w-5" />
                          PDF файл үзэх
                        </a>
                      </div>
                    )}

                    <p className="text-sm text-gray-400 mt-4">
                      {new Date(selectedNews.createdAt).toLocaleDateString('mn-MN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowNewsModal(false);
                        setSelectedNews(null);
                      }}
                      className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition"
                    >
                      Хаах
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
