import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Dashboard components
import AdminDashboard from '../dashboards/admin/AdminDashboard';
import AdminCourses from '../dashboards/admin/AdminCourses';
import AdminUsers from '../dashboards/admin/AdminUsers';
import AdminAnalytics from '../dashboards/admin/AdminAnalytics';
import Profile from './Profile';
import Notifications from './Notifications';
import TutorDashboard from '../dashboards/tutor/TutorDashboard';
import TutorCourses from '../dashboards/tutor/TutorCourses';
import TutorAnalytics from '../dashboards/tutor/TutorAnalytics';
import CourseCreation from '../dashboards/tutor/CourseCreation';
import LearnerDashboard from '../dashboards/learner/LearnerDashboard';
import LearnerCourses from '../dashboards/learner/LearnerCourses';


const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { theme } = useTheme();

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="text-gray-600 dark:text-gray-400">{t('common.loading')}</div>
    </div>;
  }

  return (
    <DashboardLayout>
      <Routes>
        {/* Admin routes */}
        {user.role === 'admin' && (
          <>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/courses" element={<AdminCourses />} />
            <Route path="/users" element={<AdminUsers />} />
            <Route path="/analytics" element={<AdminAnalytics />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
          </>
        )}

        {/* Tutor routes */}
        {user.role === 'tutor' && (
          <>
            <Route path="/" element={
              <ErrorBoundary>
                <TutorDashboard />
              </ErrorBoundary>
            } />
            <Route path="/courses" element={
              <ErrorBoundary>
                <TutorCourses />
              </ErrorBoundary>
            } />
            <Route path="/analytics" element={
              <ErrorBoundary>
                <TutorAnalytics />
              </ErrorBoundary>
            } />
            <Route path="/courses/new" element={
              <ErrorBoundary>
                <CourseCreation />
              </ErrorBoundary>
            } />
            <Route path="/courses/edit/:id" element={
              <ErrorBoundary>
                <CourseCreation />
              </ErrorBoundary>
            } />
            <Route path="/notifications" element={
              <ErrorBoundary>
                <Notifications />
              </ErrorBoundary>
            } />
            <Route path="/profile" element={
              <ErrorBoundary>
                <Profile />
              </ErrorBoundary>
            } />
          </>
        )}

        {/* Learner routes */}
        {user.role === 'learner' && (
          <>
            <Route path="/" element={
              <ErrorBoundary>
                <LearnerDashboard />
              </ErrorBoundary>
            } />
            <Route path="/courses" element={
              <ErrorBoundary>
                <LearnerCourses />
              </ErrorBoundary>
            } />
            <Route path="/notifications" element={
              <ErrorBoundary>
                <Notifications />
              </ErrorBoundary>
            } />
            <Route path="/profile" element={
              <ErrorBoundary>
                <Profile />
              </ErrorBoundary>
            } />
          </>
        )}

        {/* Fallback route */}
        <Route path="*" element={
          <div className="flex items-center justify-center min-h-64 bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t('common.pageNotFound')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {t('common.pageNotFoundDesc')}
              </p>
            </div>
          </div>
        } />
      </Routes>
    </DashboardLayout>
  );
};

export default Dashboard;