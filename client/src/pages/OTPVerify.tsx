import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { 
  Mail, 
  Shield, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  Clock,
  X
} from 'lucide-react';

interface LocationState {
  email?: string;
  message?: string;
}

const OTPVerify: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyOtp, resendOtp, isLoading, tempEmail } = useAuth();
  const { language } = useLanguage();
  
  const locationState = location.state as LocationState;
  const email = locationState?.email || tempEmail;
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);

  // Redirect if no email provided
  useEffect(() => {
    if (!email) {
      navigate('/signup', { replace: true });
      return;
    }
  }, [email, navigate]);

  // Countdown timer for OTP expiration
  useEffect(() => {
    if (timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setError(language === 'rw' 
            ? 'Kode yo kwemeza yarangiye. Saba kode nshya.'
            : 'Verification code has expired. Please request a new one.'
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, language]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    
    const timer = setInterval(() => {
      setResendCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;
    
    const newOtpValues = [...otpValues];
    newOtpValues[index] = value;
    setOtpValues(newOtpValues);
    
    // Clear any existing errors
    if (error) setError('');
    
    // Auto-focus next input
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all digits are entered
    if (newOtpValues.every(val => val !== '') && newOtpValues.length === 6) {
      handleOtpSubmit(newOtpValues.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newOtpValues = pastedData.split('');
      setOtpValues(newOtpValues);
      
      // Focus last input
      inputRefs.current[5]?.focus();
      
      // Auto-submit
      handleOtpSubmit(pastedData);
    }
  };

  const handleOtpSubmit = async (otpCode: string) => {
    if (!email || otpCode.length !== 6 || isSubmitting) return;
    
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      await verifyOtp(email, otpCode);
      setSuccess('Account verified successfully! Redirecting to dashboard...');
      // Navigation is handled by AuthContext after successful verification
    } catch (err: any) {
      setError(err.message || (language === 'rw' 
        ? 'Kode yo kwemeza ntabwo ari yo. Ongera ugerageze.'
        : 'Invalid verification code. Please try again.'
      ));
      
      // Clear OTP inputs on error
      setOtpValues(['', '', '', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = () => {
    const otpCode = otpValues.join('');
    if (otpCode.length === 6) {
      handleOtpSubmit(otpCode);
    }
  };

  const handleResendOtp = async () => {
    if (!email || resendCountdown > 0 || resendAttempts >= 3) return;
    
    setResendLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await resendOtp(email);
      setSuccess(result.message);
      setResendCountdown(60); // 1 minute cooldown
      setResendAttempts(prev => prev + 1);
      setTimeRemaining(600); // Reset to 10 minutes
      
      // Clear and focus first input
      setOtpValues(['', '', '', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      
    } catch (err: any) {
      setError(err.message || (language === 'rw' 
        ? 'Ntibyakunze kohereza kode nshya. Ongera ugerageze.'
        : 'Failed to resend verification code. Please try again.'
      ));
    } finally {
      setResendLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const maskEmail = (email: string) => {
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.slice(0, 2) + '*'.repeat(username.length - 2)
      : username;
    return `${maskedUsername}@${domain}`;
  };

  if (!email) {
    return null; // Will redirect in useEffect
  }

  const isOtpComplete = otpValues.every(val => val !== '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header showAuth={false} />
      
      <div className="pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {language === 'rw' ? 'Emeza Imeyili Yawe' : 'Verify Your Email'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-base mb-2">
              {language === 'rw' 
                ? 'Twakoherereje kode yo kwemeza kuri'
                : 'We sent a verification code to'
              }
            </p>
            <p className="text-blue-600 dark:text-blue-400 font-medium text-lg">
              {maskEmail(email)}
            </p>
          </div>

          <Card className="p-8 shadow-2xl border-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm">
            {error && (
              <Alert variant="error" className="mb-6">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">{language === 'rw' ? 'Ikosa' : 'Error'}</span>
                </div>
                <p className="mt-1 text-sm">{error}</p>
              </Alert>
            )}

            {success && (
              <Alert variant="success" className="mb-6">
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4" />
                  <span className="font-medium">{language === 'rw' ? 'Byagenze neza' : 'Success'}</span>
                </div>
                <p className="mt-1 text-sm">{success}</p>
              </Alert>
            )}

            {/* Timer Display */}
            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {language === 'rw' ? 'Igihe gisigaye:' : 'Time remaining:'}
                </span>
                <span className={`text-sm font-mono font-bold ${
                  timeRemaining <= 60 ? 'text-red-600 dark:text-red-400' : 'text-yellow-800 dark:text-yellow-200'
                }`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>

            {/* OTP Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                {language === 'rw' ? 'Andika kode yo kwemeza' : 'Enter verification code'}
              </label>
              
              <div className="flex justify-center space-x-3 mb-6" onPaste={handlePaste}>
                {otpValues.map((value, index) => (
                  <input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value}
                    onChange={e => handleOtpChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      error ? 'border-red-500 shake' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="0"
                    disabled={isSubmitting}
                  />
                ))}
              </div>

              {/* Manual Submit Button */}
              <Button 
                onClick={handleManualSubmit}
                size="lg" 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25 transform hover:scale-[1.02] transition-all duration-200 h-12 text-base font-semibold" 
                isLoading={isSubmitting}
                disabled={!isOtpComplete || isSubmitting}
              >
                {isSubmitting ? (
                  language === 'rw' ? 'Urimo kwemeza...' : 'Verifying...'
                ) : (
                  language === 'rw' ? 'Emeza kode' : 'Verify code'
                )}
                {!isSubmitting && <ArrowRight className="ml-2 h-5 w-5" />}
              </Button>
            </div>

            {/* Resend Section */}
            <div className="mt-8">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {language === 'rw' ? 'Ntawubonye kode?' : "Didn't receive the code?"}
                </p>
                
                <Button
                  variant="outline"
                  onClick={handleResendOtp}
                  disabled={resendCountdown > 0 || resendAttempts >= 3 || resendLoading}
                  isLoading={resendLoading}
                  className="w-full"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${resendLoading ? 'animate-spin' : ''}`} />
                  {resendCountdown > 0 ? (
                    `${language === 'rw' ? 'Saba kode nshya mu' : 'Resend in'} ${resendCountdown}s`
                  ) : resendAttempts >= 3 ? (
                    language === 'rw' ? 'Warahindutse kode kanaka' : 'Maximum attempts reached'
                  ) : (
                    language === 'rw' ? 'Saba kode nshya' : 'Resend code'
                  )}
                </Button>

                {resendAttempts > 0 && resendAttempts < 3 && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {language === 'rw' 
                      ? `Ibyageragezwa: ${resendAttempts}/3`
                      : `Attempts: ${resendAttempts}/3`
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Back to signup */}
            <div className="mt-8 text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {language === 'rw' ? 'Cyangwa' : 'Or'}
                  </span>
                </div>
              </div>
              <div className="mt-6">
                <Link
                  to="/signup"
                  className="group inline-flex items-center justify-center w-full px-6 py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 hover:scale-[1.02]"
                >
                  <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  {language === 'rw' ? 'Subira ku kwandika' : 'Back to signup'}
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OTPVerify; 