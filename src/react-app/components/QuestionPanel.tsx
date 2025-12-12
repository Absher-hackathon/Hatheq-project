import { useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';

interface Question {
  id: number;
  question_text: string;
  answer_text: string;
  timestamp: string;
}

interface QuestionPanelProps {
  sessionId: string;
  questions: Question[];
  onQuestionAdded: (question: Question) => void;
}

export default function QuestionPanel({ sessionId, questions, onQuestionAdded }: QuestionPanelProps) {
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !answerText.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: questionText,
          answer_text: answerText
        })
      });

      const data = await response.json();
      onQuestionAdded({
        id: data.id,
        question_text: questionText,
        answer_text: answerText,
        timestamp: new Date().toISOString()
      });

      setQuestionText('');
      setAnswerText('');
    } catch (error) {
      console.error('Error adding question:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Questions List */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {questions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">لا توجد أسئلة بعد</p>
            <p className="text-xs mt-1">ابدأ بإضافة سؤال وإجابة</p>
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="bg-white/5 rounded-lg p-3 space-y-2">
              <div>
                <div className="text-xs text-blue-400 font-semibold mb-1">السؤال</div>
                <div className="text-sm">{q.question_text}</div>
              </div>
              <div>
                <div className="text-xs text-green-400 font-semibold mb-1">الإجابة</div>
                <div className="text-sm text-slate-300">{q.answer_text}</div>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(q.timestamp).toLocaleString('ar-SA')}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Question Form */}
      <form onSubmit={handleSubmit} className="space-y-3 border-t border-white/10 pt-4">
        <div>
          <input
            type="text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="أدخل السؤال..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-sm"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="أدخل الإجابة..."
            rows={3}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-sm resize-none"
            disabled={isSubmitting}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !questionText.trim() || !answerText.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          <span className="font-semibold">إضافة</span>
        </button>
      </form>
    </div>
  );
}
