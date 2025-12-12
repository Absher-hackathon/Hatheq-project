export interface Env {
  DB: D1Database;
  OPENAI_API_KEY: string;
  R2_BUCKET: R2Bucket;
}

export interface Session {
  id: number;
  suspect_name: string;
  investigator_name: string;
  session_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: number;
  session_id: number;
  question_text: string;
  answer_text: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

export interface BehavioralAnalysis {
  id: number;
  session_id: number;
  question_id: number;
  facial_expression_data: string;
  eye_movement_data: string;
  stress_indicators: string;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface NLPAnalysis {
  id: number;
  session_id: number;
  contradictions: string;
  sentiment_analysis: string;
  deception_indicators: string;
  overall_score: number;
  created_at: string;
  updated_at: string;
}

export interface SessionReport {
  id: number;
  session_id: number;
  report_data: string;
  summary: string;
  recommendations: string;
  created_at: string;
  updated_at: string;
}
