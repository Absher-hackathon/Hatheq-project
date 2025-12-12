import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as tf from '@tensorflow/tfjs';

interface FacialAnalysisProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onAnalysisData?: (data: {
    eyeData: { leftEyeBlink: number; rightEyeBlink: number; eyeLookDown: number; eyeLookUp: number };
    expressionData: { mouthSmile: number; mouthFrown: number; browFurrow: number; jawOpen: number };
    stressScore: number;
    expressionPrediction?: {
      expression: string;
      probabilities: { [key: string]: number };
    };
    authenticityPrediction?: {
      authenticity: string;
      probabilities: { [key: string]: number };
    };
  }) => void;
}

const EXPRESSION_LABELS = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise'];
const AUTHENTICITY_LABELS = ['Fake', 'Genuine'];
const IMG_SIZE = 224;

interface ApiModel {
  api: boolean;
}

type ModelType = tf.LayersModel | ApiModel | null;

export default function FacialAnalysis({ videoRef, onAnalysisData }: FacialAnalysisProps) {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [tfModel, setTfModel] = useState<ModelType>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<{
    eyeData: { leftEyeBlink: number; rightEyeBlink: number; eyeLookDown: number; eyeLookUp: number };
    expressionData: { mouthSmile: number; mouthFrown: number; browFurrow: number; jawOpen: number };
    stressScore: number;
    timestamp: string;
    expressionPrediction?: {
      expression: string;
      probabilities: { [key: string]: number };
    };
    authenticityPrediction?: {
      authenticity: string;
      probabilities: { [key: string]: number };
    };
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    initializeFaceLandmarker();
    loadTensorFlowModel();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const loadTensorFlowModel = async () => {
    try {
      setModelLoading(true);
      console.log('Checking Python model API...');
      // Check if Python API is available (default port 5001 to avoid macOS AirPlay conflict)
      const apiPort = import.meta.env.VITE_MODEL_API_PORT || '5001';
      const response = await fetch(`http://localhost:${apiPort}/health`);
      if (response.ok) {
        const data = await response.json();
        if (data.model_loaded) {
          setTfModel({ api: true }); // Mark as API model
          setModelLoading(false);
          console.log('Python model API is available!');
        } else {
          throw new Error('Model not loaded on server');
        }
      } else {
        throw new Error('API server not responding');
      }
    } catch (error) {
      console.warn('Could not connect to Python model API:', error);
      console.log('Make sure to start the Python API server: python model_api.py');
      setModelLoading(false);
    }
  };

  useEffect(() => {
    if (faceLandmarker && videoRef.current) {
      startAnalysis();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [faceLandmarker, videoRef]);

  const initializeFaceLandmarker = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      console.log('vision', vision);
      
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });

      console.log('landmarker', landmarker);

      setFaceLandmarker(landmarker);
    } catch (error) {
      console.error('Error initializing face landmarker:', error);
    }
  };

  const predictWithTensorFlowModel = async (frame: HTMLCanvasElement): Promise<{
    expression: { expression: string; probabilities: { [key: string]: number } };
    authenticity: { authenticity: string; probabilities: { [key: string]: number } };
  } | null> => {
    if (!tfModel) return null;

    try {
      // Check if using API model
      if ('api' in tfModel && (tfModel as ApiModel).api) {
        // Convert canvas to base64 image
        const imageData = frame.toDataURL('image/jpeg', 0.8);
        
        // Send to Python API
        const apiPort = import.meta.env.VITE_MODEL_API_PORT || '5001';
        const response = await fetch(`http://localhost:${apiPort}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageData })
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        return {
          expression: {
            expression: result.expression.label,
            probabilities: result.expression.probabilities
          },
          authenticity: {
            authenticity: result.authenticity.label,
            probabilities: result.authenticity.probabilities
          }
        };
      } else {
        // Fallback to TensorFlow.js (if model was converted)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = IMG_SIZE;
        tempCanvas.height = IMG_SIZE;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return null;

        tempCtx.drawImage(frame, 0, 0, IMG_SIZE, IMG_SIZE);
        
        let tensor = tf.browser.fromPixels(tempCanvas);
        tensor = tf.cast(tensor, 'float32');
        tensor = tf.div(tensor, 127.5);
        tensor = tf.sub(tensor, 1.0);
        tensor = tf.expandDims(tensor, 0);
        
        const predictions = (tfModel as tf.LayersModel).predict(tensor) as tf.Tensor[];
        const exprProbs = await predictions[0].data();
        const authProbs = await predictions[1].data();
        
        tensor.dispose();
        predictions.forEach(p => p.dispose());
        
        const exprProbObj: { [key: string]: number } = {};
        EXPRESSION_LABELS.forEach((label, idx) => {
          exprProbObj[label] = exprProbs[idx];
        });
        
        const authProbObj: { [key: string]: number } = {};
        AUTHENTICITY_LABELS.forEach((label, idx) => {
          authProbObj[label] = authProbs[idx];
        });
        
        const exprIndex = Array.from(exprProbs).indexOf(Math.max(...Array.from(exprProbs)));
        const authIndex = Array.from(authProbs).indexOf(Math.max(...Array.from(authProbs)));
        
        return {
          expression: {
            expression: EXPRESSION_LABELS[exprIndex],
            probabilities: exprProbObj
          },
          authenticity: {
            authenticity: AUTHENTICITY_LABELS[authIndex],
            probabilities: authProbObj
          }
        };
      }
    } catch (error) {
      console.error('Error predicting with model:', error);
      return null;
    }
  };

  const startAnalysis = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !faceLandmarker) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create analysis canvas for TensorFlow model
    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement('canvas');
    }
    const analysisCanvas = analysisCanvasRef.current;
    const analysisCtx = analysisCanvas.getContext('2d');
    if (!analysisCtx) return;

    let frameCount = 0;

    const analyze = async () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        analysisCanvas.width = video.videoWidth;
        analysisCanvas.height = video.videoHeight;

        const startTimeMs = performance.now();
        const results = faceLandmarker.detectForVideo(video, startTimeMs);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);

        let expressionPrediction: { expression: string; probabilities: { [key: string]: number } } | undefined;
        let authenticityPrediction: { authenticity: string; probabilities: { [key: string]: number } } | undefined;

        // Run TensorFlow model prediction every 10 frames (to reduce computation)
        if (tfModel && frameCount % 10 === 0) {
          const tfResults = await predictWithTensorFlowModel(analysisCanvas);
          if (tfResults) {
            expressionPrediction = tfResults.expression;
            authenticityPrediction = tfResults.authenticity;
          }
        }
        frameCount++;

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          // Draw landmarks
          const landmarks = results.faceLandmarks[0];
          
          // Draw face mesh
          ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
          landmarks.forEach(landmark => {
            ctx.beginPath();
            ctx.arc(
              landmark.x * canvas.width,
              landmark.y * canvas.height,
              2,
              0,
              2 * Math.PI
            );
            ctx.fill();
          });

          // Analyze facial expressions
          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const blendshapes = results.faceBlendshapes[0].categories;
            
            // Extract key indicators
            const eyeData = {
              leftEyeBlink: blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0,
              rightEyeBlink: blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0,
              eyeLookDown: blendshapes.find(b => b.categoryName === 'eyeLookDownLeft')?.score || 0,
              eyeLookUp: blendshapes.find(b => b.categoryName === 'eyeLookUpLeft')?.score || 0,
            };

            const expressionData = {
              mouthSmile: blendshapes.find(b => b.categoryName === 'mouthSmileLeft')?.score || 0,
              mouthFrown: blendshapes.find(b => b.categoryName === 'mouthFrownLeft')?.score || 0,
              browFurrow: blendshapes.find(b => b.categoryName === 'browDownLeft')?.score || 0,
              jawOpen: blendshapes.find(b => b.categoryName === 'jawOpen')?.score || 0,
            };

            // Calculate stress indicators
            const stressScore = (
              (eyeData.leftEyeBlink + eyeData.rightEyeBlink) / 2 * 0.3 +
              expressionData.browFurrow * 0.4 +
              expressionData.mouthFrown * 0.3
            );

            const analysisData = {
              eyeData,
              expressionData,
              stressScore,
              timestamp: new Date().toISOString(),
              expressionPrediction,
              authenticityPrediction
            };
            
            setAnalysisData(analysisData);
            
            // Notify parent component of analysis update
            if (onAnalysisData) {
              onAnalysisData({
                eyeData,
                expressionData,
                stressScore,
                expressionPrediction,
                authenticityPrediction
              });
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.7 }}
      />
      {modelLoading && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-lg p-3 text-xs text-yellow-400">
          جاري تحميل النموذج...
        </div>
      )}
      {analysisData && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-lg p-3 space-y-2 text-xs max-w-xs">
          <div>
            <div className="text-cyan-400 font-semibold mb-1">مؤشر التوتر</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all"
                  style={{ width: `${analysisData.stressScore * 100}%` }}
                />
              </div>
              <span className="text-white font-mono">{(analysisData.stressScore * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <div className="text-purple-400 font-semibold mb-1">حركة العين</div>
            <div className="text-slate-300">
              رمش: {((analysisData.eyeData.leftEyeBlink + analysisData.eyeData.rightEyeBlink) / 2 * 100).toFixed(0)}%
            </div>
          </div>
          {analysisData.expressionPrediction && (
            <div>
              <div className="text-green-400 font-semibold mb-1">التعبير</div>
              <div className="text-slate-300">
                {analysisData.expressionPrediction.expression} ({(analysisData.expressionPrediction.probabilities[analysisData.expressionPrediction.expression] * 100).toFixed(1)}%)
              </div>
            </div>
          )}
          {analysisData.authenticityPrediction && (
            <div>
              <div className={`font-semibold mb-1 ${analysisData.authenticityPrediction.authenticity === 'Genuine' ? 'text-green-400' : 'text-red-400'}`}>
                المصداقية
              </div>
              <div className="text-slate-300">
                {analysisData.authenticityPrediction.authenticity === 'Genuine' ? 'أصيل' : 'مزيف'} ({(analysisData.authenticityPrediction.probabilities[analysisData.authenticityPrediction.authenticity] * 100).toFixed(1)}%)
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
