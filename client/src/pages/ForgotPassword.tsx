import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Key
} from 'lucide-react';

type Step = 'email' | 'verify-reset' | 'success';

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | ErrorDetails | null>(null);
  const [success, setSuccess] = useState('');
  const { language } = useLanguage();
  const navigate = useNavigate();

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return 'Email address is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    return undefined;
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

  const validateOTP = (otp: string): string | undefined => {
    if (!otp.trim()) return 'Verification code is required';
    if (otp.trim().length !== 6) return 'Verification code must be 6 digits';
    if (!/^\d{6}$/.test(otp.trim())) return 'Verification code must contain only numbers';
    return undefined;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
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
        setSuccess(response.message || 'Password reset code sent to your email.');
        setStep('verify-reset');
      } else {
        setError(response.error || 'Failed to send reset code. Please try again.');
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

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess('');
    
    const otpError = validateOTP(otp);
    if (otpError) {
      setError(otpError);
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await apiClient.resetPassword(email.trim().toLowerCase(), otp.trim(), newPassword);
      
      if (response.success) {
        setSuccess(response.message || 'Password reset successfully!');
        setStep('success');
        
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

  const handleResendOTP = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await apiClient.forgotPassword(email.trim().toLowerCase());
      
      if (response.success) {
        setSuccess(response.message || 'New verification code sent to your email.');
      } else {
        setError(response.error || 'Failed to resend code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'email':
        return (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
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
        );

      case 'verify-reset':
        return (
          <form onSubmit={handlePasswordResetSubmit} className="space-y-6">
            {error && (
              <ErrorDisplay 
                error={error}
                onDismiss={() => setError(null)}
                className="animate-fade-in"
                showTechnical={import.meta.env.DEV}
              />
            )}

            {success && (
              <Alert variant="success" className="animate-fade-in">
                <CheckCircle className="h-4 w-4" />
                <span>{success}</span>
              </Alert>
            )}

            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {language === 'rw' 
                  ? `Andika code ya 6 ya numero yoherejwe kuri ${email}`
                  : `Enter the 6-digit code sent to ${email}`
                }
              </p>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep('email')}
                className="mb-4"
              >
                {language === 'rw' ? 'Hindura email' : 'Change Email'}
              </Button>
            </div>

            <div>
              <Input
                label={language === 'rw' ? 'Code yo kwemeza' : 'Verification Code'}
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={language === 'rw' ? 'Andika code ya 6' : 'Enter 6-digit code'}
                icon={Key}
                required
                className="py-4 text-lg text-center"
                maxLength={6}
              />
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Input
                  label={language === 'rw' ? 'Ijambo banga rishya' : 'New Password'}
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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

            <div className="text-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleResendOTP}
                disabled={isSubmitting}
                className="text-sm"
              >
                {language === 'rw' ? 'Ongera wohereze code' : 'Resend Code'}
              </Button>
            </div>
          </form>
        );

      case 'success':
        return (
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
        );

      default:
        return null;
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
              {step === 'email' && (language === 'rw' ? 'Wibagirwa ijambo banga?' : 'Forgot Password?')}
              {step === 'verify-reset' && (language === 'rw' ? 'Hindura ijambo banga' : 'Reset Password')}
              {step === 'success' && (language === 'rw' ? 'Byakunze!' : 'Success!')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {step === 'email' && (language === 'rw' 
                ? 'Andika email yawe kandi tugukorehere amabwiriza yo guhindura ijambo banga'
                : 'Enter your email address and we\'ll send you instructions to reset your password'
              )}
              {step === 'verify-reset' && (language === 'rw' 
                ? 'Shiraho code yo kwemeza n\'ijambo banga rishya'
                : 'Enter the verification code and your new password'
              )}
              {step === 'success' && (language === 'rw' 
                ? 'Ijambo banga ryawe ryahinduwe neza'
                : 'Your password has been successfully reset'
              )}
            </p>
          </div>

          <Card className="p-8 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-0 shadow-2xl">
            {renderStepContent()}

            {/* Back to Login */}
            {step !== 'success' && (
              <div className="mt-8 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-primary-600 hover:text-primary-500 dark:text-primary-400 font-medium transition-colors"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {language === 'rw' ? 'Garuka kuri Login' : 'Back to Login'}
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword; 