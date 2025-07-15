import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Trophy, RotateCcw } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  actions?: {
    label: string;
    onClick: () => void;
  }[];
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(toast.id), 300);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      case 'warning':
        return 'border-yellow-500';
      default:
        return 'border-blue-500';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        bg-white dark:bg-gray-800 shadow-lg rounded-lg border-l-4 ${getBorderColor()}
        p-4 mb-4 max-w-md w-full
      `}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3">
          {getIcon()}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            {toast.title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {toast.message}
          </p>
          {toast.actions && toast.actions.length > 0 && (
            <div className="flex gap-2">
              {toast.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onClose(toast.id)}
          className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const newToast: Toast = {
      ...toast,
      id: Date.now().toString(),
    };
    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const handleQuizSuccess = (event: CustomEvent) => {
      const { title, score, isImprovement, attempts, maxAttempts } = event.detail;
      
      addToast({
        type: 'success',
        title: 'Quiz Passed!',
        message: `You passed "${title}" with ${score}%${isImprovement ? ' (New personal best!)' : ''} on attempt ${attempts}/${maxAttempts}`,
        duration: 6000,
      });
    };

    const handleQuizFailure = (event: CustomEvent) => {
      const { title, score, canRetry, attemptsLeft, passingScore, isImprovement } = event.detail;
      
      let message = `Score: ${score}% (Need ${passingScore}%)`;
      if (isImprovement) {
        message += ' - Improved from previous attempt!';
      }
      
      const actions = canRetry && attemptsLeft > 0 ? [{
        label: `Retry (${attemptsLeft} left)`,
        onClick: () => {
          // This will be handled by the quiz component
          window.dispatchEvent(new CustomEvent('retryQuiz'));
        }
      }] : [];

      addToast({
        type: 'error',
        title: `Quiz "${title}" Not Passed`,
        message,
        duration: 8000,
        actions,
      });
    };

    const handleCourseCompleted = (event: CustomEvent) => {
      const { courseTitle, completionTime } = event.detail;
      
      addToast({
        type: 'success',
        title: '🎓 Course Completed!',
        message: `Congratulations! You have successfully completed "${courseTitle}". Your certificate is now ready for download.`,
        duration: 10000,
        actions: [{
          label: 'View Certificate',
          onClick: () => {
            // Navigate to certificates page
            window.location.href = '/dashboard/certificates';
          }
        }]
      });
    };

    window.addEventListener('quizSuccess', handleQuizSuccess as EventListener);
    window.addEventListener('quizFailure', handleQuizFailure as EventListener);
    window.addEventListener('courseCompleted', handleCourseCompleted as EventListener);

    return () => {
      window.removeEventListener('quizSuccess', handleQuizSuccess as EventListener);
      window.removeEventListener('quizFailure', handleQuizFailure as EventListener);
      window.removeEventListener('courseCompleted', handleCourseCompleted as EventListener);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-4">
      {toasts.map(toast => (
        <ToastComponent
          key={toast.id}
          toast={toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastComponent; 