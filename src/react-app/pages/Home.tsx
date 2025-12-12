import { useState, useEffect } from 'react';
import { Plus, FileText, Video } from 'lucide-react';
import { useNavigate } from 'react-router';

interface Session {
  id: number;
  suspect_name: string;
  investigator_name: string;
  session_date: string;
  status: string;
  created_at: string;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [suspectName, setSuspectName] = useState('');
  const [investigatorName, setInvestigatorName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspect_name: suspectName, investigator_name: investigatorName })
      });
      console.log(response);
      const data = await response.json();
      setShowNewModal(false);
      setSuspectName('');
      setInvestigatorName('');
      navigate(`/session/${data.id}`);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-blue-400 text-lg">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                TruthScope
              </h1>
              <p className="text-slate-400 mt-1">نظام التحقيق الذكي المدعوم بالذكاء الاصطناعي</p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
            >
              <Plus className="w-5 h-5" />
              <span className="font-semibold">جلسة جديدة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {sessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 mb-6">
              <Video className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">لا توجد جلسات بعد</h2>
            <p className="text-slate-400 mb-6">ابدأ جلسة تحقيق جديدة لبدء التحليل</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>إنشاء جلسة جديدة</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => navigate(`/session/${session.id}`)}
                className="group cursor-pointer bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all hover:shadow-xl hover:shadow-blue-500/10"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">{session.suspect_name}</h3>
                    <p className="text-sm text-slate-400">المحقق: {session.investigator_name}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(session.status)}`}>
                    {session.status === 'active' ? 'نشط' : 'مكتمل'}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{new Date(session.session_date).toLocaleDateString('ar-SA')}</span>
                  <FileText className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Session Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">جلسة تحقيق جديدة</h2>
            <form onSubmit={createSession} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-300">اسم المشتبه به</label>
                <input
                  type="text"
                  value={suspectName}
                  onChange={(e) => setSuspectName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="أدخل الاسم"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-300">اسم المحقق</label>
                <input
                  type="text"
                  value={investigatorName}
                  onChange={(e) => setInvestigatorName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="أدخل الاسم"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all font-semibold"
                >
                  إنشاء
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all font-semibold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
