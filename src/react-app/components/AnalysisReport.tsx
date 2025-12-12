import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, FileText, Smile, Shield } from 'lucide-react';

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
  finalResult?: {
    credibilityScore: number;
    status: string;
    statusAr: string;
    summary: string;
  };
  sessionId: string;
  sessionName: string;
  recordingDate: string;
  videoFile?: string;
  totalFrames: number;
  narrative?: {
    summary: string;
    keyMoments?: Array<{
      timeLabel: string;
      description: string;
    }>;
  };
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

                  {/* Final Result - Simplified JSON Summary */}
                  {videoAnalysis.finalResult && (
                    <div className="bg-gradient-to-br from-blue-600/30 via-cyan-600/20 to-blue-600/30 border-2 border-blue-500/40 rounded-xl p-6 mb-6 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle className={`w-8 h-8 ${
                            videoAnalysis.finalResult.credibilityScore >= 70 ? 'text-green-400' :
                            videoAnalysis.finalResult.credibilityScore >= 40 ? 'text-yellow-400' :
                            'text-red-400'
                          }`} />
                          <div>
                            <h3 className="text-2xl font-bold text-white">النتيجة النهائية</h3>
                            <p className="text-sm text-slate-300 mt-1">ملخص شامل لجميع المؤشرات</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-5xl font-bold ${
                            videoAnalysis.finalResult.credibilityScore >= 70 ? 'text-green-400' :
                            videoAnalysis.finalResult.credibilityScore >= 40 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {videoAnalysis.finalResult.credibilityScore}
                          </div>
                          <div className="text-slate-400 text-sm">من 100</div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                          <span className="text-slate-300 font-semibold">الحالة:</span>
                          <span className={`text-lg font-bold ${
                            videoAnalysis.finalResult.status === 'high' ? 'text-green-400' :
                            videoAnalysis.finalResult.status === 'medium' ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {videoAnalysis.finalResult.statusAr}
                          </span>
                        </div>
                        
                        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                          <div className="text-slate-400 text-sm mb-2">الملخص:</div>
                          <div className="text-white text-lg font-semibold">
                            {videoAnalysis.finalResult.summary}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                videoAnalysis.finalResult.credibilityScore >= 70 
                                  ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                videoAnalysis.finalResult.credibilityScore >= 40 
                                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                  'bg-gradient-to-r from-red-500 to-red-600'
                              }`}
                              style={{ width: `${videoAnalysis.finalResult.credibilityScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

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

                  {/* Stress Score & Narrative Summary */}
                  {(videoAnalysis.summary || videoAnalysis.narrative) && (
                    <div className="grid md:grid-cols-2 gap-4">

                      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900 border border-white/5 rounded-xl p-6 shadow-inner">
                        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-cyan-400" />
                          ملخص الفيديو
                        </h3>

                        {videoAnalysis.narrative?.summary ? (
                          <div className="space-y-4">
                            <p className="text-slate-200 leading-relaxed">
                              {videoAnalysis.narrative.summary}
                            </p>

                            {videoAnalysis.narrative.keyMoments && videoAnalysis.narrative.keyMoments.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-sm text-slate-400">أبرز اللحظات</div>
                                <div className="space-y-2">
                                  {videoAnalysis.narrative.keyMoments.map((moment, idx) => (
                                    <div key={idx} className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
                                      <span className="px-2 py-1 text-xs font-semibold bg-cyan-500/20 text-cyan-200 rounded-md">
                                        {moment.timeLabel}
                                      </span>
                                      <p className="text-slate-200">{moment.description}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-slate-400 text-sm">
                              سيظهر هنا ملخص تلقائي لأحداث الفيديو مع أبرز اللحظات والتغيرات في الحالة الشعورية بعد دمج نموذج التلخيص.
                            </p>
                            <div className="text-slate-500 text-xs leading-relaxed bg-white/5 rounded-lg p-3 border border-white/5">
                              مثال متوقع:
                              <br />
                              • بداية هادئة مع نبرة صوت مستقرة.
                              <br />
                              • ارتفاع في التوتر عند الدقيقة 01:20 أثناء الإجابة عن سؤال حساس.
                              <br />
                              • عودة تدريجية للهدوء مع تحسن تعابير الوجه في نهاية المقابلة.
                            </div>
                          </div>
                        )}
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
