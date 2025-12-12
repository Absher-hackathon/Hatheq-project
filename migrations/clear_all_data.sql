-- Clear all data from all tables
-- WARNING: This will delete ALL data from the database!

DELETE FROM session_reports;
DELETE FROM nlp_analysis;
DELETE FROM behavioral_analysis;
DELETE FROM questions;
DELETE FROM interrogation_sessions;

-- Reset auto-increment counters (optional, for SQLite/D1)
-- Note: D1 doesn't support this directly, but it's included for reference
-- DELETE FROM sqlite_sequence WHERE name IN ('interrogation_sessions', 'questions', 'behavioral_analysis', 'nlp_analysis', 'session_reports');
