import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { workerApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

const Certificate = () => {
  const { trainingId } = useParams();
  const navigate = useNavigate();
  const { worker } = useAuth();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const certificateRef = useRef(null);

  useEffect(() => {
    fetchCertificate();
  }, [trainingId]);

  const fetchCertificate = async () => {
    try {
      const res = await workerApi.get(`/trainings/${trainingId}/certificate`);
      setCertificate(res.data);
    } catch (error) {
      toast.error('Гэрчилгээ татахад алдаа гарлаа');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    // Dynamic import html2canvas only when needed
    const html2canvas = (await import('html2canvas')).default;
    
    if (!certificateRef.current) return;

    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `certificate-${certificate.training.title}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast.success('Гэрчилгээ татагдлаа');
    } catch (error) {
      toast.error('Гэрчилгээ татахад алдаа гарлаа');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!certificate) return null;

  const completedDate = new Date(certificate.completedAt).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Actions */}
        <div className="flex justify-between items-center mb-6">
          <Link
            to="/"
            className="flex items-center text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Буцах
          </Link>
          <button
            onClick={handleDownload}
            className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            Татах
          </button>
        </div>

        {/* Certificate */}
        <div
          ref={certificateRef}
          className="bg-white rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="border-8 border-double border-gray-200 m-4 p-8">
            {/* Certificate Number */}
            <div className="text-right mb-2">
              <span className="text-xs text-gray-500 font-mono">
                № {certificate.certificateNumber}
              </span>
            </div>

            {/* Header decoration */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600"></div>
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-serif font-bold text-gray-800 mb-2">
                ГЭРЧИЛГЭЭ
              </h1>
              <p className="text-gray-500">Certificate of Completion</p>
            </div>

            {/* Body */}
            <div className="text-center mb-8">
              <p className="text-gray-600 mb-4">Энэхүү гэрчилгээг</p>
              
              <h2 className="text-3xl font-bold text-blue-700 mb-4">
                {worker?.firstName} {worker?.lastName}
              </h2>
              
              <p className="text-gray-600 mb-2">
                ({worker?.sapId})
              </p>
              
              <p className="text-gray-600 mb-6">
                {certificate.company?.name}
              </p>
              
              <p className="text-gray-600 mb-4">
                Дараах сургалтыг амжилттай дүүргэсэн болно:
              </p>
              
              <h3 className="text-2xl font-semibold text-gray-800 mb-6 px-8 py-4 bg-gray-50 inline-block rounded-lg">
                {certificate.training.title}
              </h3>
            </div>

            {/* Score */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center bg-green-100 text-green-800 px-6 py-2 rounded-full">
                <span className="text-lg font-semibold">
                  Оноо: {certificate.score}% | {certificate.attempts} удаа
                </span>
              </div>
            </div>

            {/* Date & Signature */}
            <div className="flex justify-between items-end pt-8 border-t border-gray-200">
              <div className="text-left space-y-3">
                <div>
                  <p className="text-gray-600 text-sm mb-1">Дуусгасан огноо</p>
                  <p className="font-medium">{completedDate}</p>
                </div>
                {certificate.expiresAt && (
                  <div>
                    <p className="text-gray-600 text-sm mb-1">Хүчинтэй хугацаа</p>
                    <p className={`font-medium ${certificate.isExpired ? 'text-red-600' : 'text-green-600'}`}>
                      {new Date(certificate.expiresAt).toLocaleDateString('mn-MN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      {certificate.isExpired && ' (Дууссан)'}
                    </p>
                  </div>
                )}
                {!certificate.expiresAt && (
                  <div>
                    <p className="text-gray-600 text-sm mb-1">Хүчинтэй хугацаа</p>
                    <p className="font-medium text-green-600">Хугацаагүй</p>
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <p className="font-serif italic text-xl text-gray-700 mb-1">
                  {certificate.signature || certificate.issuedBy}
                </p>
                <div className="w-40 border-b border-gray-400 mb-1"></div>
                <p className="text-gray-500 text-sm">Гарын үсэг</p>
              </div>
            </div>

            {/* Footer decoration */}
            <div className="flex justify-center mt-8">
              <div className="w-24 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600"></div>
            </div>
            
            {/* Validity notice */}
            <div className="text-center mt-4">
              {certificate.isExpired ? (
                <span className="text-xs text-red-600">⚠ Хугацаа дууссан гэрчилгээ</span>
              ) : certificate.isValid ? (
                <span className="text-xs text-green-600">✓ Хүчинтэй гэрчилгээ</span>
              ) : (
                <span className="text-xs text-gray-500">Хүчингүй гэрчилгээ</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Certificate;
