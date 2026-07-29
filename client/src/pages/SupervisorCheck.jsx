import { useState } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  UserIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  ArrowLeftIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftEllipsisIcon,
  TrashIcon,
  XMarkIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpSolid, HandThumbDownIcon as HandThumbDownSolid } from '@heroicons/react/24/solid';
import loginIllustration from '../assets/images/login-illustration.png';

// Create axios instance for supervisor API
const supervisorApi = axios.create({
  baseURL: '/api/supervisor'
});

const SupervisorCheck = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  
  const [sapId, setSapId] = useState('');
  const [loading, setLoading] = useState(false);
  const [worker, setWorker] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [resetConfirm, setResetConfirm] = useState(null);
  const [resetting, setResetting] = useState(false);
  
  // Feedback state
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackSummary, setFeedbackSummary] = useState({ likes: 0, dislikes: 0 });
  const [newComment, setNewComment] = useState('');
  const [selectedRating, setSelectedRating] = useState(null);
  const [selectedTraining, setSelectedTraining] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === '2026') {
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('Буруу PIN код');
      setPin('');
    }
  };

  const fetchFeedback = async (workerId) => {
    try {
      const [feedbackRes, summaryRes] = await Promise.all([
        supervisorApi.get(`/feedback/${workerId}`),
        supervisorApi.get(`/feedback-summary/${workerId}`)
      ]);
      setFeedbackList(feedbackRes.data);
      setFeedbackSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!sapId.trim()) {
      toast.error('SAP дугаар оруулна уу');
      return;
    }

    setLoading(true);
    setWorker(null);
    setEnrollments([]);
    setFeedbackList([]);
    setFeedbackSummary({ likes: 0, dislikes: 0 });
    setNewComment('');
    setSelectedRating(null);
    setSelectedTraining('');

    try {
      const res = await supervisorApi.get(`/check/${sapId.trim()}`);
      setWorker(res.data.worker);
      setEnrollments(res.data.enrollments);
      
      // Fetch feedback for this worker
      await fetchFeedback(res.data.worker._id);
      
      if (res.data.enrollments.length === 0) {
        toast('Энэ ажилтан сургалтанд бүртгэгдээгүй байна', { icon: 'ℹ️' });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Ажилтан олдсонгүй');
      } else {
        toast.error('Алдаа гарлаа');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedRating) {
      toast.error('Үнэлгээ сонгоно уу');
      return;
    }

    setSubmittingFeedback(true);
    try {
      await supervisorApi.post('/feedback', {
        workerId: worker._id,
        trainingId: selectedTraining || null,
        comment: newComment,
        rating: selectedRating
      });
      
      toast.success('Сэтгэгдэл амжилттай нэмэгдлээ');
      setNewComment('');
      setSelectedRating(null);
      setSelectedTraining('');
      
      // Refresh feedback
      await fetchFeedback(worker._id);
    } catch (error) {
      toast.error('Алдаа гарлаа');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    try {
      await supervisorApi.delete(`/feedback/${feedbackId}`);
      toast.success('Сэтгэгдэл устгагдлаа');
      await fetchFeedback(worker._id);
    } catch (error) {
      toast.error('Алдаа гарлаа');
    }
  };

  const handleResetEnrollment = async (enrollmentId) => {
    setResetting(true);
    try {
      await supervisorApi.post(`/reset/${enrollmentId}`);
      toast.success('Сургалт дахин эхлүүлэхээр тохируулагдлаа');
      // Refresh data
      const res = await supervisorApi.get(`/check/${sapId.trim()}`);
      setEnrollments(res.data.enrollments);
      setResetConfirm(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Алдаа гарлаа');
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPin('');
    setWorker(null);
    setEnrollments([]);
    setSapId('');
  };

  const getStatusInfo = (enrollment) => {
    if (enrollment.isPassed) {
      return {
        label: 'Дуусгасан',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircleIcon,
        iconColor: 'text-green-500'
      };
    } else if (enrollment.score !== null && enrollment.score !== undefined && enrollment.score < (enrollment.training?.passingScore || 70)) {
      return {
        label: 'Тэнцээгүй',
        color: 'bg-red-100 text-red-800',
        icon: XCircleIcon,
        iconColor: 'text-red-500'
      };
    } else if (enrollment.progress > 0) {
      return {
        label: 'Үзэж байгаа',
        color: 'bg-blue-100 text-blue-800',
        icon: ClockIcon,
        iconColor: 'text-blue-500'
      };
    }
    return {
      label: 'Бүртгэгдсэн',
      color: 'bg-yellow-100 text-yellow-800',
      icon: ClockIcon,
      iconColor: 'text-yellow-500'
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('mn-MN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // PIN Entry Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Toaster position="top-center" />
        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
          {/* Illustration */}
          <div className="w-full max-w-xs mb-6">
            <img 
              src={loginIllustration} 
              alt="Safety Training" 
              className="w-full h-auto"
            />
          </div>

          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <MagnifyingGlassIcon className="w-6 h-6 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Хянагч</h1>
          </div>
          <p className="text-gray-500 text-sm mb-6">PIN код оруулна уу</p>

          {/* Form */}
          <form onSubmit={handlePinSubmit} className="w-full max-w-sm space-y-4">
            <div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-4 text-center text-3xl tracking-widest border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
                placeholder="• • • •"
                maxLength={4}
                autoFocus
              />
              {pinError && (
                <p className="mt-2 text-center text-red-600 text-sm">{pinError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-orange-600 text-white py-3.5 rounded-xl hover:bg-orange-700 font-semibold text-lg shadow-lg shadow-orange-600/30 transition"
            >
              Нэвтрэх
            </button>
          </form>
        </div>

        {/* Bottom Navigation */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-5">
          <div className="max-w-sm mx-auto flex justify-center gap-12">
            {/* Worker Link */}
            <a 
              href="/login" 
              className="flex flex-col items-center gap-2 text-gray-600 hover:text-blue-600 transition group"
            >
              <div className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center group-hover:shadow-lg group-hover:bg-blue-50 transition">
                <UserIcon className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-xs font-medium">Ажилтан</span>
            </a>

            {/* Admin Link */}
            <a 
              href="/admin/login" 
              className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-800 transition group"
            >
              <div className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center group-hover:shadow-lg group-hover:bg-gray-100 transition">
                <ShieldCheckIcon className="w-6 h-6 text-gray-600" />
              </div>
              <span className="text-xs font-medium">Админ</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Main Check Interface
  return (
    <div className="min-h-screen bg-gray-100">
      
      {/* Header */}
      <header className="bg-orange-600 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MagnifyingGlassIcon className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Ажилтан шалгах</h1>
              <p className="text-orange-200 text-sm">Хянагчийн хэсэг</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-orange-700 rounded-lg hover:bg-orange-800 transition"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Гарах
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-6 mt-4">
          <form onSubmit={handleSearch} className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={sapId}
              onChange={(e) => setSapId(e.target.value.toUpperCase())}
              placeholder="SAP дугаар"
              className="w-full pl-11 pr-14 py-3.5 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <MagnifyingGlassIcon className="h-5 w-5" />
              )}
            </button>
          </form>
        </div>

        {/* Worker Info */}
        {worker && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
            {/* Mobile-first Layout */}
            <div className="flex flex-col gap-4">
              {/* Row 1: Helmet + Name/Info */}
              <div className="flex items-start gap-3">
                {/* Helmet color icon */}
                <div className={`h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center flex-shrink-0 ${
                  worker.helmetColor === 'Ногоон' 
                    ? 'bg-green-500' 
                    : worker.helmetColor === 'Цагаан' 
                      ? 'bg-white border-2 border-gray-300' 
                      : 'bg-orange-100'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" 
                    className={`h-7 w-7 sm:h-10 sm:w-10 ${
                      worker.helmetColor === 'Ногоон' 
                        ? 'text-green-900' 
                        : worker.helmetColor === 'Цагаан' 
                          ? 'text-gray-600' 
                          : 'text-orange-600'
                    }`}
                    fill="currentColor">
                    <path d="M56 36c0-1.1-.9-2-2-2h-2v-6c0-11-9-20-20-20S12 17 12 28v6h-2c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h4v2c0 1.1.9 2 2 2h32c1.1 0 2-.9 2-2v-2h4c1.1 0 2-.9 2-2v-4zM16 28c0-8.8 7.2-16 16-16s16 7.2 16 16v6H16v-6z"/>
                  </svg>
                </div>
                
                {/* Name and info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                      {worker.lastName?.charAt(0)}. {worker.firstName}
                    </h2>
                    {worker.helmetColor && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        worker.helmetColor === 'Ногоон' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {worker.helmetColor} малгай
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 font-mono text-sm">{worker.sapId}</p>
                  <p className="text-sm text-gray-500">
                    {worker.company?.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {worker.position || 'Албан тушаал тодорхойгүй'}
                  </p>
                  {worker.employmentDate && (
                    <p className="text-sm text-blue-600 font-medium mt-1">
                      📅 {(() => {
                        const years = Math.floor((new Date() - new Date(worker.employmentDate)) / (365.25 * 24 * 60 * 60 * 1000));
                        const months = Math.floor(((new Date() - new Date(worker.employmentDate)) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
                        if (years > 0) {
                          return `${years} жил ${months > 0 ? months + ' сар' : ''}`;
                        }
                        return `${months} сар`;
                      })()}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Row 2: Feedback - separate row on mobile */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-5">
                  <div className="flex items-center gap-1.5 text-green-600">
                    <HandThumbUpIcon className="h-5 w-5" />
                    <span className="font-bold text-lg">{feedbackSummary.likes}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-red-600">
                    <HandThumbDownIcon className="h-5 w-5" />
                    <span className="font-bold text-lg">{feedbackSummary.dislikes}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowFeedbackModal(true)}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />
                  Сэтгэгдэл ({feedbackList.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enrollments List */}
        {worker && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AcademicCapIcon className="h-5 w-5" />
                Сургалтууд ({enrollments.length})
              </h3>
            </div>

            {enrollments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Сургалтанд бүртгэгдээгүй байна
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {enrollments.map((enrollment) => {
                  const status = getStatusInfo(enrollment);
                  const StatusIcon = status.icon;
                  
                  return (
                    <div key={enrollment._id} className="p-4 sm:p-6">
                      {/* Header: Icon + Title + Status + Button */}
                      <div className="flex flex-col gap-3">
                        {/* Row 1: Title and Status */}
                        <div className="flex items-start gap-2">
                          <StatusIcon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${status.iconColor}`} />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 leading-tight">
                              {enrollment.training?.title}
                            </h4>
                          </div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        
                        {/* Row 2: Progress Bar */}
                        <div className="pl-7">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">Явц</span>
                            <span className="font-medium">{enrollment.progress || 0}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                enrollment.isPassed ? 'bg-green-500' : 'bg-orange-500'
                              }`}
                              style={{ width: `${enrollment.progress || 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Row 3: Stats Grid - 2 columns on mobile */}
                        <div className="pl-7 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <span className="text-gray-500">Оноо:</span>
                            <span className="ml-1 font-medium">
                              {enrollment.score !== null && enrollment.score !== undefined 
                                ? `${enrollment.score}%` 
                                : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Оролдлого:</span>
                            <span className="ml-1 font-medium">{enrollment.attempts || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Дуусгасан:</span>
                            <span className="ml-1 font-medium block sm:inline">{formatDate(enrollment.completedAt)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Тэнцэх:</span>
                            <span className="ml-1 font-medium">{enrollment.training?.passingScore || 70}%</span>
                          </div>
                        </div>

                        {/* Certificate Expiry */}
                        {enrollment.certificate && (
                          <div className={`pl-7 flex items-center gap-2 text-sm ${
                            enrollment.certificate.isExpired ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {enrollment.certificate.isExpired ? (
                              <>
                                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                                <span>Гэрчилгээ дууссан: {formatDate(enrollment.certificate.expiresAt)}</span>
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                                <span>Гэрчилгээ хүчинтэй: {formatDate(enrollment.certificate.expiresAt)} хүртэл</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Reset Button - Full width on mobile */}
                        <div className="pl-7 pt-2">
                          {resetConfirm === enrollment._id ? (
                            <div className="flex items-center gap-3">
                              <p className="text-sm text-red-600 font-medium">Дахин эхлүүлэх үү?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleResetEnrollment(enrollment._id)}
                                  disabled={resetting}
                                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                  {resetting ? '...' : 'Тийм'}
                                </button>
                                <button
                                  onClick={() => setResetConfirm(null)}
                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                                >
                                  Үгүй
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setResetConfirm(enrollment._id)}
                              className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition border border-orange-200"
                              title="Сургалтыг дахин эхлүүлэх"
                            >
                              <ArrowPathIcon className="h-5 w-5" />
                              <span className="text-sm font-medium">Дахин эхлүүлэх</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!worker && !loading && (
          <div className="bg-orange-50 rounded-xl p-6">
            <h3 className="font-semibold text-orange-900 mb-2">Зааварчилгаа</h3>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>• SAP дугаар оруулаад хайх товч дарна уу</li>
              <li>• Ажилтны бүх сургалтын явц харагдана</li>
              <li>• "Дахин эхлүүлэх" товч дарж сургалтыг шинээр эхлүүлнэ</li>
              <li>• Аюулгүй ажиллагааны зөрчил гарсан үед сургалтыг дахин эхлүүлнэ</li>
            </ul>
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && worker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ChatBubbleLeftIcon className="h-5 w-5" />
                Хянагчийн сэтгэгдэл
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-white hover:text-orange-200 transition"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Worker info in modal */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium text-gray-900">{worker.lastName?.charAt(0)}. {worker.firstName}</span>
                <span className="text-gray-500 ml-2">({worker.sapId})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-green-600 font-semibold">
                  <HandThumbUpSolid className="h-4 w-4" />
                  {feedbackSummary.likes}
                </span>
                <span className="flex items-center gap-1 text-red-600 font-semibold">
                  <HandThumbDownSolid className="h-4 w-4" />
                  {feedbackSummary.dislikes}
                </span>
              </div>
            </div>

            {/* Add Feedback Form */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRating('like')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
                      selectedRating === 'like'
                        ? 'bg-green-500 text-white shadow-md'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    <HandThumbUpIcon className="h-5 w-5" />
                    Сайн
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRating('dislike')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
                      selectedRating === 'dislike'
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    <HandThumbDownIcon className="h-5 w-5" />
                    Анхааруулга
                  </button>
                </div>

                {enrollments.length > 0 && (
                  <select
                    value={selectedTraining}
                    onChange={(e) => setSelectedTraining(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  >
                    <option value="">Ерөнхий сэтгэгдэл</option>
                    {enrollments.map((e) => (
                      <option key={e.training._id} value={e.training._id}>
                        {e.training.title}
                      </option>
                    ))}
                  </select>
                )}

                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Сэтгэгдэл бичих... (заавал биш)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none text-sm"
                  rows={2}
                />

                <button
                  onClick={handleSubmitFeedback}
                  disabled={!selectedRating || submittingFeedback}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
                >
                  {submittingFeedback ? 'Хадгалж байна...' : 'Сэтгэгдэл нэмэх'}
                </button>
              </div>
            </div>

            {/* Feedback List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
              {/* Filter indicator */}
              {selectedRating && (
                <div className="px-4 py-2 bg-gray-100 text-sm text-gray-600 flex items-center justify-between">
                  <span>
                    Шүүлт: {selectedRating === 'like' ? '👍 Сайн' : '👎 Анхааруулга'} ({feedbackList.filter(fb => fb.rating === selectedRating).length})
                  </span>
                  <button
                    onClick={() => setSelectedRating(null)}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Бүгдийг харах
                  </button>
                </div>
              )}
              {(selectedRating ? feedbackList.filter(fb => fb.rating === selectedRating) : feedbackList).length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <ChatBubbleLeftIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  {selectedRating ? 'Энэ төрлийн сэтгэгдэл байхгүй' : 'Сэтгэгдэл байхгүй байна'}
                </div>
              ) : (
                (selectedRating ? feedbackList.filter(fb => fb.rating === selectedRating) : feedbackList).map((fb) => (
                  <div key={fb._id} className="p-4 flex items-start gap-3 hover:bg-gray-50 transition">
                    <div className={`p-2 rounded-full flex-shrink-0 ${
                      fb.rating === 'like' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {fb.rating === 'like' ? (
                        <HandThumbUpSolid className="h-4 w-4 text-green-600" />
                      ) : (
                        <HandThumbDownSolid className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {fb.training && (
                        <p className="text-xs text-orange-600 font-medium mb-1">
                          {fb.training.title}
                        </p>
                      )}
                      {fb.comment ? (
                        <p className="text-gray-800 text-sm">{fb.comment}</p>
                      ) : (
                        <p className="text-gray-400 italic text-sm">
                          {fb.rating === 'like' ? 'Сайн үнэлгээ' : 'Анхааруулга өгсөн'}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(fb.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteFeedback(fb._id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition flex-shrink-0"
                      title="Устгах"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorCheck;
