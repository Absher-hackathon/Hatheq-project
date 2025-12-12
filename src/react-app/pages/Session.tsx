import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Camera, FileText, AlertCircle, Eye, Brain, Activity, Smile, Shield, TrendingUp, AlertTriangle } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'questions' | 'analysis'>('analysis');
  const [latestAnalysis, setLatestAnalysis] = useState<{
    eyeData: { leftEyeBlink: number; rightEyeBlink: number; eyeLookDown: number; eyeLookUp: number };
    expressionData: { mouthSmile: number; mouthFrown: number; browFurrow: number; jawOpen: number };
    stressScore: number;
    expressionPrediction?: { expression: string; probabilities: { [key: string]: number } };
    authenticityPrediction?: { authenticity: string; probabilities: { [key: string]: number } };
    timestamp: string;
  } | null>(null);
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
        mimeType: 'video/mp4;codecs=vp8,opus'
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
      // Detect the actual MIME type from MediaRecorder
      const mimeType = mediaRecorderRef.current?.mimeType || 'video/mp4';
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      
      // Determine file extension based on MIME type
      let extension = '.mp4';
      if (mimeType.includes('mp4') || mimeType.includes('x-m4v')) {
        extension = '.mp4';
      }
      
      const timestamp = Date.now();
      const videoFilename = `session-${id}-${timestamp}${extension}`;
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
      
      // Calculate metrics
      const avgStress = analysisDataRef.current.length > 0
        ? analysisDataRef.current.reduce((sum, d) => sum + d.stressScore, 0) / analysisDataRef.current.length
        : 0;
      const maxStress = analysisDataRef.current.length > 0
        ? Math.max(...analysisDataRef.current.map(d => d.stressScore))
        : 0;
      
      // Calculate final credibility score (0-100)
      // Higher score = more credible
      // Factors: low stress (good), high genuineness (good), neutral/positive expressions (good)
      let credibilityScore = 100;
      
      // Stress penalty (0-40 points)
      credibilityScore -= (avgStress * 40);
      
      // Authenticity factor (0-30 points)
      if (averageAuthenticity) {
        const genuineness = averageAuthenticity.probabilities.Genuine || 0;
        credibilityScore -= ((1 - genuineness) * 30);
      }
      
      // Expression factor (0-30 points)
      if (averageExpression) {
        const negativeExpressions = ['Angry', 'Disgust', 'Fear', 'Sad'];
        const isNegative = negativeExpressions.includes(averageExpression.expression);
        if (isNegative) {
          const negativeProb = averageExpression.probabilities[averageExpression.expression] || 0;
          credibilityScore -= (negativeProb * 30);
        }
      }
      
      // Ensure score is between 0-100
      credibilityScore = Math.max(0, Math.min(100, credibilityScore));
      
      // Determine status
      let status = 'high';
      let statusAr = 'عالية';
      if (credibilityScore < 40) {
        status = 'low';
        statusAr = 'منخفضة';
      } else if (credibilityScore < 70) {
        status = 'medium';
        statusAr = 'متوسطة';
      }
      
      // Simplified analysis results with final aggregated score
      const analysisResults = {
        // Simplified summary with final result
        finalResult: {
          credibilityScore: Math.round(credibilityScore),
          status: status,
          statusAr: statusAr,
          summary: `مصداقية ${statusAr} (${Math.round(credibilityScore)}/100)`
        },
        // Basic info
        sessionId: id,
        sessionName: session?.suspect_name || 'Unknown',
        recordingDate: new Date().toISOString(),
        totalFrames: analysisDataRef.current.length,
        // Detailed metrics (for backward compatibility)
        summary: {
          averageStressScore: avgStress,
          maxStressScore: maxStress,
          minStressScore: analysisDataRef.current.length > 0
            ? Math.min(...analysisDataRef.current.map(d => d.stressScore))
            : 0,
        },
        expression: {
          last: lastExpression,
          average: averageExpression
        },
        authenticity: {
          last: lastAuthenticity,
          average: averageAuthenticity
        }
      };

      // Convert analysis results to JSON string for API
      const analysisJsonString = JSON.stringify(analysisResults, null, 2);
      const analysisBlob = new Blob([analysisJsonString], { type: 'application/json' });
      
      // Save video file only (no JSON file download)
      if ('showSaveFilePicker' in window) {
        try {
          // Save video
          // @ts-expect-error - File System Access API is not in TypeScript types yet
          const videoHandle = await window.showSaveFilePicker({
            suggestedName: videoFilename,
            types: [{
              description: 'Video File',
              accept: { 
                'video/mp4': ['.mp4']
              }
            }]
          });
          
          const videoWritable = await videoHandle.createWritable();
          await videoWritable.write(blob);
          await videoWritable.close();
          
          console.log(`Video saved: ${videoHandle.name} (${fileSizeMB} MB)`);
          
          alert(`تم حفظ الفيديو بنجاح!\n\nالفيديو: ${videoHandle.name}\nالحجم: ${fileSizeMB} MB\n\nإجمالي إطارات التحليل: ${analysisDataRef.current.length}\n\nجاري استخراج الصوت وتحويله إلى نص...`);
          
          // Start transcription after video is saved and camera is stopped
          // Run transcription in background (don't await to avoid blocking)
          transcribeVideo(blob, videoHandle.name).catch(err => {
            console.error('Transcription error:', err);
          });
        } catch (fsError: unknown) {
          // User cancelled or error, fall back to download
          const error = fsError as { name?: string };
          if (error.name !== 'AbortError') {
            console.warn('File System Access API failed, using download:', fsError);
            saveAsDownload(blob, videoFilename, fileSizeMB);
          }
        }
      } else {
        // Fallback to download for browsers without File System Access API
        saveAsDownload(blob, videoFilename, fileSizeMB);
      }

      // Save analysis data to API (for display in AnalysisReport)
      const formData = new FormData();
      formData.append('video', blob, videoFilename);
      formData.append('analysis', analysisBlob, `analysis.json`); // Use simple name, not downloaded

      try {
        const response = await fetch(`/api/sessions/${id}/video`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Video and analysis data saved to API:', result);
        }
      } catch (apiError) {
        console.warn('Failed to save video and analysis data:', apiError);
      }
    } catch (error) {
      console.error('Error saving video:', error);
      alert('حدث خطأ أثناء حفظ الفيديو: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      recordedChunksRef.current = [];
      analysisDataRef.current = []; // Clear analysis data after saving
    }
  };

  const transcribeVideo = async (videoBlob: Blob, videoFilename: string) => {
    try {
      console.log('Starting audio extraction and transcription...');
      console.log(`Video file: ${videoFilename}, Size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
      const formData = new FormData();
      formData.append('video', videoBlob, videoFilename);
      
      const apiPort = import.meta.env.VITE_MODEL_API_PORT || '5001';
      console.log(`Sending video to transcription API at http://localhost:${apiPort}/transcribe`);
      
      const response = await fetch(`http://localhost:${apiPort}/transcribe`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        const transcription = result.transcription;
        
        if (!transcription || transcription.trim().length === 0) {
          console.warn('Transcription is empty');
          alert('تم استخراج الصوت ولكن النص فارغ. قد لا يحتوي الفيديو على صوت.');
          return;
        }
        
        console.log('Transcription completed, saving text file...');
        
        // Save transcription as .txt file (support both .webm and .mp4)
        const txtFilename = videoFilename.replace(/\.(mp4)$/i, '.txt');
        const txtBlob = new Blob([transcription], { type: 'text/plain;charset=utf-8' });
        
        if ('showSaveFilePicker' in window) {
          try {
            // @ts-expect-error - File System Access API
            const txtHandle = await window.showSaveFilePicker({
              suggestedName: txtFilename,
              types: [{
                description: 'Text File',
                accept: { 'text/plain': ['.txt'] }
              }]
            });
            
            const txtWritable = await txtHandle.createWritable();
            await txtWritable.write(txtBlob);
            await txtWritable.close();
            
            console.log(`Transcription saved: ${txtHandle.name}`);
            alert(`تم استخراج الصوت وتحويله إلى نص بنجاح!\n\nملف النص: ${txtHandle.name}`);
          } catch (fsError: unknown) {
            const error = fsError as { name?: string };
            if (error.name !== 'AbortError') {
              // Fallback to download
              const txtUrl = URL.createObjectURL(txtBlob);
              const txtLink = document.createElement('a');
              txtLink.href = txtUrl;
              txtLink.download = txtFilename;
              document.body.appendChild(txtLink);
              txtLink.click();
              document.body.removeChild(txtLink);
              URL.revokeObjectURL(txtUrl);
              console.log(`Transcription downloaded: ${txtFilename}`);
              alert(`تم تحميل ملف النص: ${txtFilename}`);
            }
          }
        } else {
          // Fallback to download
          const txtUrl = URL.createObjectURL(txtBlob);
          const txtLink = document.createElement('a');
          txtLink.href = txtUrl;
          txtLink.download = txtFilename;
          document.body.appendChild(txtLink);
          txtLink.click();
          document.body.removeChild(txtLink);
          URL.revokeObjectURL(txtUrl);
          console.log(`Transcription downloaded: ${txtFilename}`);
          alert(`تم تحميل ملف النص: ${txtFilename}`);
        }
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.warn('Transcription failed:', error);
        alert(`فشل تحويل الصوت إلى نص: ${error.error || 'خطأ غير معروف'}\n\nتأكد من تشغيل خادم Python API (model_api.py)`);
      }
    } catch (error) {
      console.error('Error transcribing video:', error);
      alert('حدث خطأ أثناء تحويل الصوت إلى نص: ' + (error instanceof Error ? error.message : String(error)) + '\n\nتأكد من تشغيل خادم Python API (model_api.py)');
    }
  };

  const saveAsDownload = (videoBlob: Blob, videoFilename: string, fileSizeMB: string) => {
    // Download video only (no JSON file)
    const videoUrl = URL.createObjectURL(videoBlob);
    const videoLink = document.createElement('a');
    videoLink.href = videoUrl;
    videoLink.download = videoFilename;
    document.body.appendChild(videoLink);
    videoLink.click();
    document.body.removeChild(videoLink);
    URL.revokeObjectURL(videoUrl);
    
    console.log(`Video downloaded: ${videoFilename} (${fileSizeMB} MB)`);
    
    alert(`تم حفظ الفيديو بنجاح!\n\nالفيديو: ${videoFilename}\nالحجم: ${fileSizeMB} MB\n\nجاري استخراج الصوت وتحويله إلى نص...`);
    
    // Start transcription after video is downloaded (non-blocking)
    transcribeVideo(videoBlob, videoFilename).catch(err => {
      console.error('Transcription error:', err);
    });
  };

  const stopCamera = async () => {
    // Stop recording first - this will trigger saveRecording via onstop event
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // saveRecording will be called automatically via onstop event
      // which will then trigger transcription
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
                  const analysisEntry = {
                    timestamp: new Date().toISOString(),
                    eyeData: data.eyeData,
                    expressionData: data.expressionData,
                    stressScore: data.stressScore,
                    expressionPrediction: data.expressionPrediction,
                    authenticityPrediction: data.authenticityPrediction
                  };
                  analysisDataRef.current.push(analysisEntry);
                  setLatestAnalysis(analysisEntry);
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
                    {!cameraActive ? (
                      <div className="text-center py-8 text-slate-400">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">الكاميرا غير نشطة</p>
                        <p className="text-xs mt-1">قم بتشغيل الكاميرا لبدء التحليل الفوري</p>
                      </div>
                    ) : !latestAnalysis ? (
                      <div className="text-center py-8 text-slate-400">
                        <div className="animate-pulse">
                          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">جاري تحميل النموذج...</p>
                          <p className="text-xs mt-1">سيبدأ التحليل قريباً</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">

                        {/* Expression Analysis */}
                        {latestAnalysis.expressionPrediction && (
                          <div className="bg-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Smile className="w-5 h-5 text-purple-400" />
                              <h3 className="text-lg font-bold">التعبير الحالي</h3>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">التعبير السائد:</span>
                                <span className="text-lg font-bold text-purple-400">
                                  {latestAnalysis.expressionPrediction.expression === 'Angry' ? 'غاضب' :
                                   latestAnalysis.expressionPrediction.expression === 'Disgust' ? 'اشمئزاز' :
                                   latestAnalysis.expressionPrediction.expression === 'Fear' ? 'خوف' :
                                   latestAnalysis.expressionPrediction.expression === 'Happy' ? 'سعيد' :
                                   latestAnalysis.expressionPrediction.expression === 'Neutral' ? 'محايد' :
                                   latestAnalysis.expressionPrediction.expression === 'Sad' ? 'حزين' :
                                   latestAnalysis.expressionPrediction.expression === 'Surprise' ? 'مفاجأة' :
                                   latestAnalysis.expressionPrediction.expression}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">مستوى الثقة:</span>
                                <span className="text-white font-semibold">
                                  {(latestAnalysis.expressionPrediction.probabilities[latestAnalysis.expressionPrediction.expression] * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Authenticity Analysis */}
                        {latestAnalysis.authenticityPrediction && (
                          <div className="bg-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Shield className={`w-5 h-5 ${
                                latestAnalysis.authenticityPrediction.authenticity === 'Genuine' 
                                  ? 'text-green-400' 
                                  : 'text-red-400'
                              }`} />
                              <h3 className="text-lg font-bold">المصداقية</h3>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">التقييم:</span>
                                <span className={`text-lg font-bold ${
                                  latestAnalysis.authenticityPrediction.authenticity === 'Genuine' 
                                    ? 'text-green-400' 
                                    : 'text-red-400'
                                }`}>
                                  {latestAnalysis.authenticityPrediction.authenticity === 'Genuine' ? 'أصيل' : 'مزيف'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                                  <span className="text-slate-400">أصيل:</span>
                                  <span className="text-green-400 font-semibold">
                                    {(latestAnalysis.authenticityPrediction.probabilities.Genuine * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                                  <span className="text-slate-400">مزيف:</span>
                                  <span className="text-red-400 font-semibold">
                                    {(latestAnalysis.authenticityPrediction.probabilities.Fake * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Eye Movement */}
                        <div className="bg-white/5 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Eye className="w-5 h-5 text-cyan-400" />
                            <h3 className="text-lg font-bold">حركة العين</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="space-y-1">
                              <div className="text-slate-400 text-xs">رمش العين</div>
                              <div className="text-white font-semibold">
                                {((latestAnalysis.eyeData.leftEyeBlink + latestAnalysis.eyeData.rightEyeBlink) / 2 * 100).toFixed(1)}%
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-slate-400 text-xs">حركة العين</div>
                              <div className="text-white font-semibold">
                                {((latestAnalysis.eyeData.eyeLookDown + latestAnalysis.eyeData.eyeLookUp) / 2 * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expression Details */}
                        <div className="bg-white/5 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                            <h3 className="text-lg font-bold">مؤشرات التعبير</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between p-2 bg-white/5 rounded">
                              <span className="text-slate-400">ابتسامة:</span>
                              <span className="text-white">{(latestAnalysis.expressionData.mouthSmile * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex justify-between p-2 bg-white/5 rounded">
                              <span className="text-slate-400">عبوس:</span>
                              <span className="text-white">{(latestAnalysis.expressionData.mouthFrown * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex justify-between p-2 bg-white/5 rounded">
                              <span className="text-slate-400">تجعد الجبين:</span>
                              <span className="text-white">{(latestAnalysis.expressionData.browFurrow * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex justify-between p-2 bg-white/5 rounded">
                              <span className="text-slate-400">فتح الفم:</span>
                              <span className="text-white">{(latestAnalysis.expressionData.jawOpen * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Alert for High Stress */}
                        {latestAnalysis.stressScore > 0.7 && (
                          <div className="bg-red-600/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="text-red-400 font-semibold mb-1">تنبيه: مستوى توتر مرتفع</div>
                              <div className="text-slate-300 text-xs">
                                تم رصد مؤشرات توتر عالية. قد تحتاج إلى إعادة تقييم السؤال أو أخذ استراحة.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
