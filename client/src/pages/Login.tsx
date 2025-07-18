import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Mail, Lock, GraduationCap, Eye, EyeOff, ArrowRight, Wifi, WifiOff } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasOfflineCredentials, setHasOfflineCredentials] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const { login } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  // Check for offline credentials when email changes
  useEffect(() => {
        setHasOfflineCredentials(false);
  }, [email]);

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError(language === 'rw' ? 'Uzuza byose' : 'Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || (language === 'rw' ? 'Habaye ikosa' : 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col relative overflow-hidden">
      {/* Header */}
      <Header showAuth={false} />
      
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] dark:opacity-[0.05]"></div>
      <div className="absolute top-0 right-0 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-400/10 rounded-full blur-3xl"></div>
      
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="bg-blue-600 p-4 rounded-2xl w-16 h-16 mx-auto mb-6 flex items-center justify-center shadow-lg">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {language === 'rw' ? 'Kwinjira' : 'Welcome back'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'rw' ? 'Injira konte yawe' : 'Sign in to your account'}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="error">
                  {error}
                </Alert>
              )}

              {/* Network Status & Offline Auth Indicator */}
              {isOffline && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                  <div className="flex items-center">
                    <WifiOff className="h-5 w-5 text-orange-500 mr-2" />
                    <div className="text-sm">
                      <p className="font-medium text-orange-800 dark:text-orange-200">
                        {language === 'rw' ? 'Nta ntaneti' : 'You\'re offline'}
                      </p>
                      <p className="text-orange-600 dark:text-orange-300">
                        {language === 'rw' 
                          ? 'Wakanda online wakore login cyangwa koresha offline account'
                          : 'Connect to the internet for full access or use cached credentials'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {hasOfflineCredentials && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-2 text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-200">
                        {language === 'rw' ? 'Offline credentials ziraboneka' : 'Offline credentials available'}
                      </p>
                      <p className="text-blue-600 dark:text-blue-300">
                        {language === 'rw' 
                          ? 'Ushobora kwinjira offline ukoresha credentials zisobitswe'
                          : 'You can login offline using your cached credentials'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'rw' ? 'Imeli' : 'Email address'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-white/50 dark:bg-gray-700/50 border-gray-200/50 dark:border-gray-600/50"
                    placeholder={language === 'rw' ? 'Injiza imeli yawe' : 'Enter your email'}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'rw' ? 'Ijambo ry\'ibanga' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-white/50 dark:bg-gray-700/50 border-gray-200/50 dark:border-gray-600/50"
                    placeholder={language === 'rw' ? 'Injiza ijambo ry\'ibanga' : 'Enter your password'}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    {language === 'rw' ? 'Nyibuke' : 'Remember me'}
                  </label>
                </div>

                <Link
                  to="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {language === 'rw' ? 'Wibagiwe ijambo ry\'ibanga?' : 'Forgot your password?'}
                </Link>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    {language === 'rw' ? 'Kwinjira' : 'Sign in'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Footer */}
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'rw' ? 'Ntufite konte?' : "Don't have an account?"}{' '}
                <Link
                  to="/signup"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {language === 'rw' ? 'Iyandikishe' : 'Sign up'}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;