import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { ErrorDisplay, ErrorDetails } from '../components/ui/ErrorDisplay';
import { apiClient } from '../utils/api';
import { 
  Mail, 
  ArrowLeft, 
  ArrowRight, 
  Shield, 
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | ErrorDetails | null>(null);
  const [success, setSuccess] = useState('');
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { language } = useLanguage();

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return 'Email address is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess('');
    
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await apiClient.forgotPassword(email.trim().toLowerCase());
      
      if (response.success) {
        setSuccess(response.message || 'Password reset instructions sent to your email.');
        setIsEmailSent(true);
      } else {
        setError(response.error || 'Failed to send reset instructions. Please try again.');
      }
    } catch (err: any) {
      if (err.details) {
        setError(err.details);
      } else {
        setError(err.message || (language === 'rw' 
          ? 'Habayeho ikosa. Ongera ugerageze.'
          : 'Something went wrong. Please try again.'
        ));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
      <Header />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {language === 'rw' ? 'Wibagirwa ijambo banga?' : 'Forgot Password?'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'rw' 
                ? 'Andika email yawe kandi tugukorehere amabwiriza yo guhindura ijambo banga'
                : 'Enter your email address and we\'ll send you instructions to reset your password'
              }
            </p>
          </div>

          <Card className="p-8 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-0 shadow-2xl">
            {!isEmailSent ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <ErrorDisplay 
                    error={error}
                    onDismiss={() => setError(null)}
                    className="animate-fade-in"
                    showTechnical={import.meta.env.DEV}
                  />
                )}

                <div>
                  <Input
                    label={language === 'rw' ? 'Email yawe' : 'Email Address'}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={language === 'rw' ? 'Andika email yawe' : 'Enter your email address'}
                    icon={Mail}
                    required
                    className="py-4 text-lg"
                  />
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/25 transform hover:scale-[1.02] transition-all duration-200 py-4 text-lg" 
                  isLoading={isSubmitting}
                >
                  {isSubmitting ? (
                    language === 'rw' ? 'Byoherezwa...' : 'Sending...'
                  ) : (
                    language === 'rw' ? 'Ohereza amabwiriza' : 'Send Reset Instructions'
                  )}
                  {!isSubmitting && <ArrowRight className="ml-2 h-5 w-5" />}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {language === 'rw' ? 'Email yoherejwe!' : 'Email Sent!'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {language === 'rw' 
                      ? 'Reba email yawe kandi ukurikize amabwiriza yo guhindura ijambo banga.'
                      : 'Check your email and follow the instructions to reset your password.'
                    }
                  </p>
                </div>

                <Alert variant="info" className="text-left">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {language === 'rw' 
                      ? 'Niba utabona email, reba muri spam cyangwa junk folder.'
                      : 'If you don\'t see the email, check your spam or junk folder.'
                    }
                  </span>
                </Alert>

                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEmailSent(false);
                    setEmail('');
                    setSuccess('');
                  }}
                  className="w-full"
                >
                  {language === 'rw' ? 'Ongera ugerageze' : 'Try Again'}
                </Button>
              </div>
            )}

            {/* Back to Login */}
            <div className="mt-8 text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-primary-600 hover:text-primary-500 dark:text-primary-400 font-medium transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {language === 'rw' ? 'Garuka kuri Login' : 'Back to Login'}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword; 