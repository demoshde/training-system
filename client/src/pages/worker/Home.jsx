import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  AcademicCapIcon,
  ArrowRightOnRectangleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

const Home = () => {
  const { worker, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-2xl mr-3">🏠</span>
            <h1 className="text-xl font-bold text-gray-900">Нүүр хуудас</h1>
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
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Сайн байна уу, {worker?.firstName}!
          </h2>
          <p className="text-gray-500 mt-1">Үргэлжлүүлэхийг хүсэж буй хэсгээ сонгоно уу.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Training System */}
          <button
            onClick={() => navigate('/trainings')}
            className="group text-left bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <AcademicCapIcon className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Сургалтын систем</h3>
            <p className="text-sm text-gray-500 mt-1">
              Сургалт, мэдээ, санал асуулга болон дүрэм журам
            </p>
            <span className="inline-flex items-center gap-1 mt-4 text-blue-600 font-semibold text-sm">
              Нээх
              <ArrowRightIcon className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>

          {/* PVT Test */}
          <button
            onClick={() => navigate('/pvt/test')}
            className="group text-left bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all"
          >
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-2xl">🧠</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900">PVT Когнитив Шалгалт</h3>
            <p className="text-sm text-gray-500 mt-1">
              Санах ой · Эрэмбэлэлт · Хариу урвалын хугацааны 3 үе шаттай шалгалт
            </p>
            <span className="inline-flex items-center gap-1 mt-4 text-emerald-600 font-semibold text-sm">
              Шалгалт өгөх
              <ArrowRightIcon className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Home;
