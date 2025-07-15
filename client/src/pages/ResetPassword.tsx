import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { ErrorDisplay, ErrorDetails } from '../components/ui/ErrorDisplay';
import { apiClient } from '../utils/api';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Shield, 
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | ErrorDetails | null>(null);
  const [success, setSuccess] = useState('');
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { language } = useLanguage();

  useEffect(() => {
    if (!token) {
      setIsTokenValid(false);
      return;
    }
    
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await apiClient.validateResetToken(token!);
      setIsTokenValid(response.success);
      if (!response.success) {
        setError(response.error || 'Invalid or expired reset token.');
      }
    } catch (err: any) {
      setIsTokenValid(false);
      setError(err.message || 'Failed to validate reset token.');
    }
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
    if (!/(?=.*[@$!%*?&])/.test(password)) return 'Password must contain at least one special character (@$!%*?&)';
    return undefined;
  };

  const validateConfirmPassword = (password: string, confirmPassword: string): string | undefined => {
    if (!confirmPassword) return 'Please confirm your password';
    if (password !== confirmPassword) return 'Passwords do not match';
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess('');
    
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    const confirmPasswordError = validateConfirmPassword(password, confirmPassword);
    if (confirmPasswordError) {
      setError(confirmPasswordError);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await apiClient.resetPassword(token!, password, confirmPassword);
      
      if (response.success) {
        setSuccess(response.message || 'Password reset successfully!');
        setIsPasswordReset(true);
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Password reset successfully. Please login with your new password.' 
            }
          });
        }, 3000);
      } else {
        setError(response.error || 'Failed to reset password. Please try again.');
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

  // Show loading state while validating token
  if (isTokenValid === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'rw' ? 'Tugenzura...' : 'Validating...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show invalid token message
  if (isTokenValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <Card className="p-8 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-0 shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {language === 'rw' ? 'Link ntiyakora' : 'Invalid Link'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {language === 'rw' 
                  ? 'Link yo guhindura ijambo banga ntiyakora cyangwa yarangiye. Saba link nshya.'
                  : 'The password reset link is invalid or has expired. Please request a new one.'
                }
              </p>
              
              <div className="space-y-4">
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center justify-center w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  {language === 'rw' ? 'Saba link nshya' : 'Request New Link'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
  }

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
              {language === 'rw' ? 'Hindura ijambo banga' : 'Reset Password'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'rw' 
                ? 'Shiraho ijambo banga rishya ryumutekano'
                : 'Enter your new secure password'
              }
            </p>
          </div>

          <Card className="p-8 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-0 shadow-2xl">
            {!isPasswordReset ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <ErrorDisplay 
                    error={error}
                    onDismiss={() => setError(null)}
                    className="animate-fade-in"
                    showTechnical={import.meta.env.DEV}
                  />
                )}

                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      label={language === 'rw' ? 'Ijambo banga rishya' : 'New Password'}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={language === 'rw' ? 'Shiraho ijambo banga rishya' : 'Enter new password'}
                      icon={Lock}
                      required
                      className="pr-12 py-4 text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-11 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Input
                      label={language === 'rw' ? 'Emeza ijambo banga' : 'Confirm Password'}
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={language === 'rw' ? 'Emeza ijambo banga' : 'Confirm new password'}
                      icon={Lock}
                      required
                      className="pr-12 py-4 text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-11 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    {language === 'rw' ? 'Ijambo banga rigomba kuba rifite:' : 'Password requirements:'}
                  </p>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• {language === 'rw' ? 'Byibuze inyuguti 8' : 'At least 8 characters'}</li>
                    <li>• {language === 'rw' ? 'Inyuguti nto n\'ikurura' : 'Upper and lowercase letters'}</li>
                    <li>• {language === 'rw' ? 'Umubare' : 'At least one number'}</li>
                    <li>• {language === 'rw' ? 'Ikimenyetso kidasanzwe' : 'At least one special character'}</li>
                  </ul>
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/25 transform hover:scale-[1.02] transition-all duration-200 py-4 text-lg" 
                  isLoading={isSubmitting}
                >
                  {isSubmitting ? (
                    language === 'rw' ? 'Birahindurwa...' : 'Resetting...'
                  ) : (
                    language === 'rw' ? 'Hindura ijambo banga' : 'Reset Password'
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
                    {language === 'rw' ? 'Ijambo banga ryahinduwe!' : 'Password Reset Successfully!'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {language === 'rw' 
                      ? 'Ijambo banga ryawe ryahinduwe neza. Uzahitamo kuri login page.'
                      : 'Your password has been reset successfully. You\'ll be redirected to the login page.'
                    }
                  </p>
                </div>

                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 