import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { offlineOperations } from '../utils/offlineOperations';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Badge } from '../components/ui/Badge';
import { 
  BookOpen, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  ArrowLeft,
  Wifi,
  WifiOff
} from 'lucide-react';
import OfflineQuiz from '../components/offline/OfflineQuiz';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const OfflineTest: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isOnline } = useNetworkStatus();
  const [testData, setTestData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    const loadTestData = async () => {
      if (!id) {
        setError('Test ID not provided');
        setLoading(false);
        return;
      }

      try {
        // Try to load test data from localStorage cache
        const cachedTests = localStorage.getItem(`tekr_1.0.0_tests_${user?.id || (user as any)?._id}`);
        if (cachedTests) {
          const tests = JSON.parse(cachedTests);
          const test = tests.find((t: any) => t.id === id || t._id === id);
          if (test) {
            setTestData(test);
          } else {
            setError('Test not found in offline cache');
          }
        } else {
          setError('No offline test data available');
        }
      } catch (error) {
        console.error('Failed to load test data:', error);
        setError('Failed to load test data');
      } finally {
        setLoading(false);
      }
    };

    loadTestData();
  }, [id, user]);

  const handleQuizSubmit = async (answers: any) => {
    // Quiz submission is handled by the OfflineQuiz component
    console.log('Test completed:', answers);
  };

  const handleStartTest = () => {
    setShowQuiz(true);
  };

  const handleBackToCourse = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="mx-auto mb-4" />
          <p className="text-gray-600">{t('Loading test...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('Test Not Available')}
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span>{isOnline ? t('Online') : t('Offline')}</span>
          </div>
          <Button onClick={handleBackToCourse} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('Back to Course')}
          </Button>
        </Card>
      </div>
    );
  }

  if (showQuiz && testData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6 flex items-center gap-4">
            <Button 
              onClick={() => setShowQuiz(false)} 
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('Back to Overview')}
            </Button>
            
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-sm text-gray-600">
                {isOnline ? t('Online') : t('Working offline')}
              </span>
            </div>
          </div>

          <OfflineQuiz 
            quizData={testData} 
            onSubmit={handleQuizSubmit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button 
            onClick={handleBackToCourse} 
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('Back to Course')}
          </Button>
          
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-500" />
            )}
            <span className="text-sm text-gray-600">
              {isOnline ? t('Online') : t('Working offline')}
            </span>
          </div>
        </div>

        {/* Test Overview */}
        <Card className="p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-blue-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {testData?.title || t('Course Test')}
            </h1>

            {testData?.description && (
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                {testData.description}
              </p>
            )}

            {/* Test Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {testData?.questions?.length || 0}
                </div>
                <div className="text-sm text-gray-600">{t('Questions')}</div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {testData?.timeLimit || '∞'}
                </div>
                <div className="text-sm text-gray-600">
                  {testData?.timeLimit ? t('Minutes') : t('No Time Limit')}
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {testData?.passingScore || 70}%
                </div>
                <div className="text-sm text-gray-600">{t('Passing Score')}</div>
              </div>
            </div>

            {/* Offline Notice */}
            {!isOnline && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-amber-800">
                  <WifiOff className="w-5 h-5" />
                  <span className="font-medium">{t('Taking test offline')}</span>
                </div>
                <p className="text-sm text-amber-600 mt-1">
                  {t('Your answers will be saved locally and synced when you\'re back online')}
                </p>
              </div>
            )}

            {/* Start Test Button */}
            <Button 
              onClick={handleStartTest}
              className="px-8 py-3 text-lg"
            >
              {t('Start Test')}
            </Button>

            {/* Instructions */}
            <div className="mt-8 text-left bg-blue-50 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">
                {t('Instructions')}
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• {t('Read each question carefully before answering')}</li>
                <li>• {t('You can review and change your answers before submitting')}</li>
                <li>• {t('Your progress is automatically saved')}</li>
                {!isOnline && (
                  <li>• {t('Your test will be submitted when you reconnect to the internet')}</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OfflineTest; 