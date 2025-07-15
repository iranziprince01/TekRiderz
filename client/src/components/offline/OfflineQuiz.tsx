import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { offlineOperations } from '../../utils/offlineOperations';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface OfflineQuizProps {
  quizData: any;
  onSubmit?: (answers: any) => void;
}

const OfflineQuiz: React.FC<OfflineQuizProps> = ({ quizData, onSubmit }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmit = async () => {
    if (!user || !quizData) return;

    setIsSubmitting(true);
    try {
      const userId = user.id || (user as any)._id;
      const submissionData = {
        quizId: quizData.id,
        courseId: quizData.courseId,
        answers,
        submittedAt: new Date().toISOString(),
        timeSpent: 0 // You can track this if needed
      };

      // Submit offline (will sync when online)
      await offlineOperations.submitQuiz(submissionData, userId);
      setSubmitted(true);
      onSubmit?.(answers);
    } catch (error) {
      console.error('Failed to submit quiz offline:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!quizData) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('Quiz not available')}
        </h3>
        <p className="text-gray-600">
          {t('Unable to load quiz data offline')}
        </p>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('Quiz submitted successfully!')}
        </h3>
        <p className="text-gray-600 mb-4">
          {t('Your answers have been saved and will sync when you\'re back online')}
        </p>
        <div className="flex items-center justify-center gap-2 text-amber-600">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{t('Pending sync')}</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">{quizData.title}</h2>
        {quizData.description && (
          <p className="text-gray-600 mb-6">{quizData.description}</p>
        )}

        <div className="space-y-6">
          {quizData.questions?.map((question: any, index: number) => (
            <div key={question.id || index} className="border-b pb-6 last:border-b-0">
              <h3 className="font-medium mb-3">
                {index + 1}. {question.question}
              </h3>

              {question.type === 'multiple_choice' && (
                <div className="space-y-2">
                  {question.options?.map((option: any, optIndex: number) => (
                    <label key={optIndex} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`question_${question.id || index}`}
                        value={option.value || option}
                        onChange={(e) => handleAnswerChange(question.id || index, e.target.value)}
                        className="text-blue-600"
                      />
                      <span>{option.text || option}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === 'text' && (
                <textarea
                  placeholder={t('Enter your answer...')}
                  onChange={(e) => handleAnswerChange(question.id || index, e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              )}

              {question.type === 'true_false' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`question_${question.id || index}`}
                      value="true"
                      onChange={(e) => handleAnswerChange(question.id || index, e.target.value)}
                      className="text-blue-600"
                    />
                    <span>{t('True')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`question_${question.id || index}`}
                      value="false"
                      onChange={(e) => handleAnswerChange(question.id || index, e.target.value)}
                      className="text-blue-600"
                    />
                    <span>{t('False')}</span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-between items-center">
          <div className="text-sm text-amber-600 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('Working offline - will sync when connected')}
          </div>
          
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || Object.keys(answers).length === 0}
            className="flex items-center gap-2"
          >
            {isSubmitting && <LoadingSpinner className="w-4 h-4" />}
            {isSubmitting ? t('Submitting...') : t('Submit Quiz')}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default OfflineQuiz; 