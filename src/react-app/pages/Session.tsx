import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Camera, FileText, AlertCircle, Eye, Brain, Activity } from 'lucide-react';
import FacialAnalysis from '@/react-app/components/FacialAnalysis';
import QuestionPanel from '@/react-app/components/QuestionPanel';
import AnalysisReport from '@/react-app/components/AnalysisReport';

interface Session {
  id: number;
  suspect_name: string;
  investigator_name: string;
  session_date: string;
  status: string;
}

interface Question {
  id: number;
  question_text: string;
  answer_text: string;
  timestamp: string;
}

export default function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'analysis'>('questions');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const analysisDataRef = useRef<Array<{
    timestamp: string;
    eyeData: { leftEyeBlink: number; rightEyeBlink: number; eyeLookDown: number; eyeLookUp: number };
    expressionData: { mouthSmile: number; mouthFrown: number; browFurrow: number; jawOpen: number };
    stressScore: number;
    expressionPrediction?: { expression: string; probabilities: { [key: string]: number } };
    authenticityPrediction?: { authenticity: string; probabilities: { [key: string]: number } };
  }>>([]);

  useEffect(() => {
    loadSession();
  }, [id]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  const loadSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${id}`);
      const data = await response.json();
      setSession(data.session);
      setQuestions(data.questions || []);
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 },
        audio: true 
      });
      streamRef.current = stream;
      setCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Start recording
      startRecording(stream);
    } catch (error) {
      alert('تعذر الوصول إلى الكاميرا. يرجى التحقق من الأذونات.' + error);
    }
  };

  const startRecording = (stream: MediaStream) => {
    try {
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await saveRecording();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
    } catch (error) {
      console.error('Error starting recording:', error);
      // Try with default mimeType if the specified one fails
      try {
        const mediaRecorder = new MediaRecorder(stream);
        recordedChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          await saveRecording();
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(1000);
      } catch (fallbackError) {
        console.error('Error starting recording with fallback:', fallbackError);
      }
    }
  };

  const saveRecording = async () => {
    if (recordedChunksRef.current.length === 0) {
      console.log('No video data to save');
      return;
    }

    try {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const timestamp = Date.now();
      const videoFilename = `session-${id}-${timestamp}.webm`;
      const analysisFilename = `session-${id}-${timestamp}-analysis.json`;
      const fileSizeMB = (blob.size / 1024 / 1024).toFixed(2);
      
      // Calculate averages and get last predictions for expression and authenticity
      const framesWithExpression = analysisDataRef.current.filter(d => d.expressionPrediction);
      const framesWithAuthenticity = analysisDataRef.current.filter(d => d.authenticityPrediction);
      
      // Get last predictions
      const lastExpression = framesWithExpression.length > 0 
        ? framesWithExpression[framesWithExpression.length - 1].expressionPrediction 
        : null;
      const lastAuthenticity = framesWithAuthenticity.length > 0 
        ? framesWithAuthenticity[framesWithAuthenticity.length - 1].authenticityPrediction 
        : null;
      
      // Calculate average probabilities for expression
      let averageExpression: { expression: string; probabilities: { [key: string]: number } } | null = null;
      if (framesWithExpression.length > 0) {
        const expressionLabels = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise'];
        const avgProbs: { [key: string]: number } = {};
        
        expressionLabels.forEach(label => {
          const sum = framesWithExpression.reduce((acc, frame) => {
            return acc + (frame.expressionPrediction?.probabilities[label] || 0);
          }, 0);
          avgProbs[label] = sum / framesWithExpression.length;
        });
        
        const maxProbLabel = Object.keys(avgProbs).reduce((a, b) => 
          avgProbs[a] > avgProbs[b] ? a : b
        );
        
        averageExpression = {
          expression: maxProbLabel,
          probabilities: avgProbs
        };
      }
      
      // Calculate average probabilities for authenticity
      let averageAuthenticity: { authenticity: string; probabilities: { [key: string]: number } } | null = null;
      if (framesWithAuthenticity.length > 0) {
        const authenticityLabels = ['Fake', 'Genuine'];
        const avgProbs: { [key: string]: number } = {};
        
        authenticityLabels.forEach(label => {
          const sum = framesWithAuthenticity.reduce((acc, frame) => {
            return acc + (frame.authenticityPrediction?.probabilities[label] || 0);
          }, 0);
          avgProbs[label] = sum / framesWithAuthenticity.length;
        });
        
        const maxProbLabel = Object.keys(avgProbs).reduce((a, b) => 
          avgProbs[a] > avgProbs[b] ? a : b
        );
        
        averageAuthenticity = {
          authenticity: maxProbLabel,
          probabilities: avgProbs
        };
      }
      
      // Prepare analysis results - only include summary, not all frames
      const analysisResults = {
        sessionId: id,
        sessionName: session?.suspect_name || 'Unknown',
        recordingDate: new Date().toISOString(),
        videoFile: videoFilename,
        totalFrames: analysisDataRef.current.length,
        summary: {
          averageStressScore: analysisDataRef.current.length > 0
            ? analysisDataRef.current.reduce((sum, d) => sum + d.stressScore, 0) / analysisDataRef.current.length
            : 0,
          maxStressScore: analysisDataRef.current.length > 0
            ? Math.max(...analysisDataRef.current.map(d => d.stressScore))
            : 0,
          minStressScore: analysisDataRef.current.length > 0
            ? Math.min(...analysisDataRef.current.map(d => d.stressScore))
            : 0,
        },
        // Include only last and average predictions for expression and authenticity
        expression: {
          last: lastExpression,
          average: averageExpression
        },
        authenticity: {
          last: lastAuthenticity,
          average: averageAuthenticity
        }
      };

      const analysisBlob = new Blob([JSON.stringify(analysisResults, null, 2)], { type: 'application/json' });
      
      // Save video file
      if ('showSaveFilePicker' in window) {
        try {
          // Save video
          // @ts-expect-error - File System Access API is not in TypeScript types yet
          const videoHandle = await window.showSaveFilePicker({
            suggestedName: videoFilename,
            types: [{
              description: 'WebM Video',
              accept: { 'video/webm': ['.webm'] }
            }]
          });
          
          const videoWritable = await videoHandle.createWritable();
          await videoWritable.write(blob);
          await videoWritable.close();
          
          // Save analysis JSON
          // @ts-expect-error - File System Access API
          const analysisHandle = await window.showSaveFilePicker({
            suggestedName: analysisFilename,
            types: [{
              description: 'JSON Analysis Data',
              accept: { 'application/json': ['.json'] }
            }]
          });
          
          const analysisWritable = await analysisHandle.createWritable();
          await analysisWritable.write(analysisBlob);
          await analysisWritable.close();
          
          console.log(`Video saved: ${videoHandle.name} (${fileSizeMB} MB)`);
          console.log(`Analysis saved: ${analysisHandle.name}`);
          alert(`تم حفظ الفيديو والتحليل بنجاح!\n\nالفيديو: ${videoHandle.name}\nالتحليل: ${analysisHandle.name}\nالحجم: ${fileSizeMB} MB\n\nإجمالي إطارات التحليل: ${analysisDataRef.current.length}`);
        } catch (fsError: unknown) {
          // User cancelled or error, fall back to download
          const error = fsError as { name?: string };
          if (error.name !== 'AbortError') {
            console.warn('File System Access API failed, using download:', fsError);
            saveAsDownload(blob, videoFilename, fileSizeMB, analysisBlob, analysisFilename);
          }
        }
      } else {
        // Fallback to download for browsers without File System Access API
        saveAsDownload(blob, videoFilename, fileSizeMB, analysisBlob, analysisFilename);
      }

      // Also save metadata via API
      const formData = new FormData();
      formData.append('video', blob, videoFilename);
      formData.append('analysis', analysisBlob, analysisFilename);

      try {
        const response = await fetch(`/api/sessions/${id}/video`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Video and analysis metadata saved:', result);
        }
      } catch (apiError) {
        console.warn('Failed to save video metadata:', apiError);
      }
    } catch (error) {
      console.error('Error saving video:', error);
      alert('حدث خطأ أثناء حفظ الفيديو: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      recordedChunksRef.current = [];
      analysisDataRef.current = []; // Clear analysis data after saving
    }
  };

  const saveAsDownload = (videoBlob: Blob, videoFilename: string, fileSizeMB: string, analysisBlob?: Blob, analysisFilename?: string) => {
    // Download video
    const videoUrl = URL.createObjectURL(videoBlob);
    const videoLink = document.createElement('a');
    videoLink.href = videoUrl;
    videoLink.download = videoFilename;
    document.body.appendChild(videoLink);
    videoLink.click();
    document.body.removeChild(videoLink);
    URL.revokeObjectURL(videoUrl);
    
    // Download analysis if provided
    if (analysisBlob && analysisFilename) {
      setTimeout(() => {
        const analysisUrl = URL.createObjectURL(analysisBlob);
        const analysisLink = document.createElement('a');
        analysisLink.href = analysisUrl;
        analysisLink.download = analysisFilename;
        document.body.appendChild(analysisLink);
        analysisLink.click();
        document.body.removeChild(analysisLink);
        URL.revokeObjectURL(analysisUrl);
      }, 500); // Small delay to avoid browser blocking multiple downloads
    }
    
    console.log(`Video downloaded: ${videoFilename} (${fileSizeMB} MB)`);
    if (analysisFilename) {
      console.log(`Analysis downloaded: ${analysisFilename}`);
    }
    alert(`تم حفظ الفيديو والتحليل بنجاح!\n\nالفيديو: ${videoFilename}\n${analysisFilename ? `التحليل: ${analysisFilename}\n` : ''}الحجم: ${fileSizeMB} MB\n\nسيتم حفظهما في مجلد التنزيلات`);
  };

  const stopCamera = async () => {
    // Stop recording first
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) { 
      videoRef.current.srcObject = null;
    }
    
    setCameraActive(false);
  };

  const handleQuestionAdded = (question: Question) => {
    setQuestions([...questions, question]);
  };

  const completeSession = async () => {
    try {
      console.log('completeSession', id);
      await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      navigate('/');
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-blue-400 text-lg">جاري التحميل...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-red-400">الجلسة غير موجودة</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white" style={{ fontFamily: 'Cairo, sans-serif' }}>
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold">{session.suspect_name}</h1>
                <p className="text-sm text-slate-400">المحقق: {session.investigator_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>تشغيل الكاميرا</span>
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>إيقاف الكاميرا</span>
                </button>
              )}
              <button
                onClick={() => setShowReport(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>التقرير</span>
              </button>
              <button
                onClick={completeSession}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                إنهاء الجلسة
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2">
            <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
              <div className="relative aspect-video bg-slate-900">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? '' : 'hidden'}`}
                />
                {cameraActive && <FacialAnalysis videoRef={videoRef} onAnalysisData={(data) => {
                  analysisDataRef.current.push({
                    timestamp: new Date().toISOString(),
                    eyeData: data.eyeData,
                    expressionData: data.expressionData,
                    stressScore: data.stressScore,
                    expressionPrediction: data.expressionPrediction,
                    authenticityPrediction: data.authenticityPrediction
                  });
                }} />}
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                    <Camera className="w-16 h-16 mb-4" />
                    <p className="text-lg">الكاميرا غير نشطة</p>
                    <p className="text-sm mt-2">انقر على "تشغيل الكاميرا" للبدء</p>
                  </div>
                )}
              </div>
              
              {/* Live Indicators */}
              {cameraActive && (
                <div className="p-4 grid grid-cols-3 gap-4 bg-black/20">
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    <Eye className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="text-xs text-slate-400">حركة العين</div>
                      <div className="text-sm font-semibold">مراقبة نشطة</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <div>
                      <div className="text-xs text-slate-400">تعابير الوجه</div>
                      <div className="text-sm font-semibold">تحليل مستمر</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    <Activity className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="text-xs text-slate-400">مؤشرات التوتر</div>
                      <div className="text-sm font-semibold">تتبع فوري</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('questions')}
                  className={`flex-1 px-4 py-3 font-semibold transition-colors ${
                    activeTab === 'questions' 
                      ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الأسئلة
                </button>
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`flex-1 px-4 py-3 font-semibold transition-colors ${
                    activeTab === 'analysis' 
                      ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  التحليل الفوري
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {activeTab === 'questions' ? (
                  <QuestionPanel 
                    sessionId={id || ''} 
                    questions={questions}
                    onQuestionAdded={handleQuestionAdded}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="text-center py-8 text-slate-400">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">التحليل الفوري سيظهر هنا</p>
                      <p className="text-xs mt-1">خلال جلسة التحقيق النشطة</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReport && (
        <AnalysisReport 
          sessionId={id || ''} 
          onClose={() => setShowReport(false)} 
        />
      )}
    </div>
  );
}
