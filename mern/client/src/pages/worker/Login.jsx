import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  ShieldCheckIcon, 
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import loginIllustration from '../../assets/images/login-illustration.png';

const Login = () => {
  const [sapId, setSapId] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, worker } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (worker) {
      navigate('/', { replace: true });
    }
  }, [worker, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sapId.trim()) {
      toast.error('SAP дугаар оруулна уу');
      return;
    }

    setLoading(true);
    try {
      const result = await login(sapId);
      if (result.success) {
        toast.success('Амжилттай нэвтэрлээ');
        navigate('/', { replace: true });
      } else {
        toast.error(result.message || 'Нэвтрэхэд алдаа гарлаа');
        setLoading(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Нэвтрэхэд алдаа гарлаа');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Сургалтын систем</h1>
        <p className="text-gray-500 text-sm mb-6">SAP дугаараар нэвтрэх</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              SAP дугаар
            </label>
            <input
              type="text"
              value={sapId}
              onChange={(e) => setSapId(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-lg"
              placeholder="SAP дугаараа оруулна уу"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold text-lg shadow-lg shadow-blue-600/30"
          >
            {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
          </button>
        </form>
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-100 bg-gray-50 px-6 py-5">
        <div className="max-w-sm mx-auto flex justify-center gap-12">
          {/* Supervisor Link */}
          <a 
            href="/supervisor" 
            className="flex flex-col items-center gap-2 text-gray-600 hover:text-orange-600 transition group"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center group-hover:shadow-lg group-hover:bg-orange-50 transition">
              <MagnifyingGlassIcon className="w-6 h-6 text-orange-500" />
            </div>
            <span className="text-xs font-medium">Хянагч</span>
          </a>

          {/* Admin Link */}
          <a 
            href="/admin/login" 
            className="flex flex-col items-center gap-2 text-gray-600 hover:text-blue-600 transition group"
          >
            <div className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center group-hover:shadow-lg group-hover:bg-blue-50 transition">
              <ShieldCheckIcon className="w-6 h-6 text-blue-500" />
            </div>
            <span className="text-xs font-medium">Админ</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
