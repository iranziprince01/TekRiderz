import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';

// Dashboard components
import AdminDashboard from '../dashboards/admin/AdminDashboard';
import AdminCourses from '../dashboards/admin/AdminCourses';
import AdminUsers from '../dashboards/admin/AdminUsers';
import Profile from './Profile';
import TutorDashboard from '../dashboards/tutor/TutorDashboard';
import TutorCourses from '../dashboards/tutor/TutorCourses';
import CourseCreation from '../dashboards/tutor/CourseCreation';
import LearnerDashboard from '../dashboards/learner/LearnerDashboard';
import LearnerCourses from '../dashboards/learner/LearnerCourses';


const Dashboard = () => {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
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
            <Route path="/profile" element={<Profile />} />
          </>
        )}

        {/* Tutor routes */}
        {user.role === 'tutor' && (
          <>
            <Route path="/" element={<TutorDashboard />} />
            <Route path="/courses" element={<TutorCourses />} />
            <Route path="/courses/new" element={<CourseCreation />} />
            <Route path="/courses/edit/:id" element={<CourseCreation />} />
            <Route path="/profile" element={<Profile />} />
          </>
        )}

        {/* Learner routes */}
        {user.role === 'learner' && (
          <>
            <Route path="/" element={<LearnerDashboard />} />
            <Route path="/courses" element={<LearnerCourses />} />

            <Route path="/profile" element={<Profile />} />
          </>
        )}

        {/* Fallback route */}
        <Route path="*" element={<div>Page not found</div>} />
      </Routes>
    </DashboardLayout>
  );
};

export default Dashboard;