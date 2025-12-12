import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, TrendingUp, FileText, Smile, Shield } from 'lucide-react';

interface AnalysisReportProps {
  sessionId: string;
  onClose: () => void;
}

interface Analysis {
  contradictions: string[];
  deception_indicators: string[];
  credibility_score: number;
  sentiment: string;
  recommendations: string[];
  summary: string;
}

interface VideoAnalysis {
  sessionId: string;
  sessionName: string;
  recordingDate: string;
  videoFile: string;
  totalFrames: number;
  summary: {
    averageStressScore: number;
    maxStressScore: number;
    minStressScore: number;
  };
  expression: {
    last: {
      expression: string;
      probabilities: { [key: string]: number };
    } | null;
    average: {
      expression: string;
      probabilities: { [key: string]: number };
    } | null;
  };
  authenticity: {
    last: {
      authenticity: string;
      probabilities: { [key: string]: number };
    } | null;
    average: {
      authenticity: string;
      probabilities: { [key: string]: number };
    } | null;
  };
}

export default function AnalysisReport({ sessionId, onClose }: AnalysisReportProps) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadReport();
    loadVideoAnalysis();
  }, [sessionId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/report`);
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data.nlp_analysis);
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVideoAnalysis = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/video-analysis`);
      if (response.ok) {
        const data = await response.json();
        setVideoAnalysis(data);
      } else if (response.status === 404) {
        // No analysis found, that's okay
        console.log('No video analysis found for this session');
      }
    } catch (error) {
      console.error('Error loading video analysis:', error);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/analyze`, {
        method: 'POST'
      });
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('حدث خطأ أثناء إنشاء التقرير');
    } finally {
      setGenerating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'text-green-400';
    if (score >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.7) return 'مرتفع';
    if (score >= 0.4) return 'متوسط';
    return 'منخفض';
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ fontFamily: 'Cairo, sans-serif' }}>
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold">التقرير التحليلي</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-pulse text-blue-400">جاري التحميل...</div>
            </div>
          ) : !analysis ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-400 opacity-50" />
              <p className="text-lg mb-4">لم يتم إنشاء تقرير بعد</p>
              <button
                onClick={generateReport}
                disabled={generating}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition-all disabled:opacity-50 font-semibold"
              >
                {generating ? 'جاري الإنشاء...' : 'إنشاء التقرير'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Credibility Score */}
              <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-6">
              </div>

              {/* Video Analysis Section */}
              {videoAnalysis && (
                <>
                  <div className="border-t border-white/10 pt-6 mt-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <FileText className="w-6 h-6 text-cyan-400" />
                      تحليل الفيديو
                    </h2>
                  </div>

                  {/* Expression Analysis */}
                  {(videoAnalysis.expression.last || videoAnalysis.expression.average) && (
                    <div className="bg-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Smile className="w-5 h-5 text-purple-400" />
                        تحليل التعبير
                      </h3>
                      
                      {videoAnalysis.expression.average && (
                        <div className="mb-4">
                          <div className="text-sm text-slate-400 mb-2">المتوسط</div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg font-bold text-purple-400">
                              {videoAnalysis.expression.average.expression}
                            </span>
                            <span className="text-slate-400">
                              ({(videoAnalysis.expression.average.probabilities[videoAnalysis.expression.average.expression] * 100).toFixed(1)}%)
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            {Object.entries(videoAnalysis.expression.average.probabilities).map(([label, prob]) => (
                              <div key={label} className="flex justify-between">
                                <span className="text-slate-400">{label}:</span>
                                <span className="text-white">{(prob * 100).toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {videoAnalysis.expression.last && (
                        <div>
                          <div className="text-sm text-slate-400 mb-2">الأخير</div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-purple-400">
                              {videoAnalysis.expression.last.expression}
                            </span>
                            <span className="text-slate-400">
                              ({(videoAnalysis.expression.last.probabilities[videoAnalysis.expression.last.expression] * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Authenticity Analysis */}
                  {(videoAnalysis.authenticity.last || videoAnalysis.authenticity.average) && (
                    <div className="bg-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-cyan-400" />
                        تحليل المصداقية
                      </h3>
                      
                      {videoAnalysis.authenticity.average && (
                        <div className="mb-4">
                          <div className="text-sm text-slate-400 mb-2">المتوسط</div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`text-lg font-bold ${
                              videoAnalysis.authenticity.average.authenticity === 'Genuine' 
                                ? 'text-green-400' 
                                : 'text-red-400'
                            }`}>
                              {videoAnalysis.authenticity.average.authenticity === 'Genuine' ? 'أصيل' : 'مزيف'}
                            </span>
                            <span className="text-slate-400">
                              ({(videoAnalysis.authenticity.average.probabilities[videoAnalysis.authenticity.average.authenticity] * 100).toFixed(1)}%)
                            </span>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">أصيل:</span>
                              <span className="text-green-400">
                                {(videoAnalysis.authenticity.average.probabilities.Genuine * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">مزيف:</span>
                              <span className="text-red-400">
                                {(videoAnalysis.authenticity.average.probabilities.Fake * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {videoAnalysis.authenticity.last && (
                        <div>
                          <div className="text-sm text-slate-400 mb-2">الأخير</div>
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-bold ${
                              videoAnalysis.authenticity.last.authenticity === 'Genuine' 
                                ? 'text-green-400' 
                                : 'text-red-400'
                            }`}>
                              {videoAnalysis.authenticity.last.authenticity === 'Genuine' ? 'أصيل' : 'مزيف'}
                            </span>
                            <span className="text-slate-400">
                              ({(videoAnalysis.authenticity.last.probabilities[videoAnalysis.authenticity.last.authenticity] * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stress Score Summary */}
                  {videoAnalysis.summary && (
                    <div className="bg-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-bold mb-3">مؤشر التوتر</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">المتوسط:</span>
                          <span className="text-white font-semibold">
                            {(videoAnalysis.summary.averageStressScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">الحد الأقصى:</span>
                          <span className="text-red-400 font-semibold">
                            {(videoAnalysis.summary.maxStressScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">الحد الأدنى:</span>
                          <span className="text-green-400 font-semibold">
                            {(videoAnalysis.summary.minStressScore * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {analysis && (
          <div className="border-t border-white/10 p-6">
            <div className="flex gap-3">
              <button
                onClick={generateReport}
                disabled={generating}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-semibold disabled:opacity-50"
              >
                {generating ? 'جاري إعادة التحليل...' : 'إعادة التحليل'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition-all font-semibold"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
