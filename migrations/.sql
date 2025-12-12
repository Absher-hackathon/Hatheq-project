
CREATE TABLE interrogation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suspect_name TEXT,
  investigator_name TEXT,
  session_date DATE,
  status TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  question_text TEXT,
  answer_text TEXT,
  timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE behavioral_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  question_id INTEGER,
  facial_expression_data TEXT,
  eye_movement_data TEXT,
  stress_indicators TEXT,
  confidence_score REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nlp_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  contradictions TEXT,
  sentiment_analysis TEXT,
  deception_indicators TEXT,
  overall_score REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE session_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  report_data TEXT,
  summary TEXT,
  recommendations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_session_id ON questions(session_id);
CREATE INDEX idx_behavioral_session_id ON behavioral_analysis(session_id);
CREATE INDEX idx_nlp_session_id ON nlp_analysis(session_id);
CREATE INDEX idx_reports_session_id ON session_reports(session_id);
