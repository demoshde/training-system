import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trainingLinkApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function TrainingJoin() {
  const { trainingId } = useParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const [training, setTraining] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [sapId, setSapId] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    trainingLinkApi.get(`/${trainingId}`)
      .then(({ data }) => setTraining(data))
      .catch(err => setLoadErr(err.response?.data?.message || 'Сургалт олдсонгүй'));
  }, [trainingId]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!sapId.trim()) { toast.error('SAP дугаараа оруулна уу'); return; }
    setJoining(true);
    try {
      const { data } = await trainingLinkApi.post(`/${trainingId}/join`, { sapId: sapId.trim() });
      setSession(data.token, data.worker);
      toast.success('Сургалтад бүртгэгдлээ');
      navigate(`/training/${trainingId}`, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Алдаа гарлаа');
      setJoining(false);
    }
  };

  if (loadErr) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-3">😕</div>
          <p className="text-gray-700 font-semibold">{loadErr}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-7">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl">📚</div>
            <p className="text-blue-600 uppercase text-xs tracking-widest font-bold mb-1">Сургалтад нэгдэх</p>
            <h1 className="text-xl font-bold text-gray-900 leading-snug">
              {training ? training.title : 'Ачааллаж байна...'}
            </h1>
            {training && (
              <p className="text-gray-400 text-sm mt-2">
                {training.slideCount} слайд · {training.questionCount} асуулт · Тэнцэх {training.passingScore}%
              </p>
            )}
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">SAP дугаар</label>
              <input
                type="text" inputMode="numeric" value={sapId}
                onChange={(e) => setSapId(e.target.value)}
                placeholder="SAP дугаараа оруулна уу"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-lg text-gray-900 placeholder-gray-400"
                autoFocus
              />
            </div>
            <button
              type="submit" disabled={joining || !training}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold text-lg shadow-lg shadow-blue-600/30"
            >
              {joining ? 'Бүртгэж байна...' : 'Сургалт эхлэх'}
            </button>
          </form>
        </div>
        <p className="text-center text-gray-400 text-xs mt-4">SAP дугаараа оруулаад сургалтдаа шууд орно</p>
      </div>
    </div>
  );
}
