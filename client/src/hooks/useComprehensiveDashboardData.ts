import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStatus } from './useNetworkStatus';

interface DashboardData {
  user: any;
  stats: any;
  courses: any[];
  enrolledCourses: any[];
  isLoading: boolean;
  error: string | null;
}

interface UseComprehensiveDashboardDataReturn extends DashboardData {
  refreshData: () => Promise<void>;
}

/**
 * Essential dashboard data hook with seamless offline functionality
 * Provides transparent access to data whether online or offline
 */
export const useComprehensiveDashboardData = (): UseComprehensiveDashboardDataReturn => {
  const { user, token } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    user: null,
    stats: null,
    courses: [],
    enrolledCourses: [],
    isLoading: true,
    error: null,
  });

  const refreshData = useCallback(async () => {
    if (!user || !token || !isOnline) {
      return;
    }

    try {
      setDashboardData(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch dashboard data based on user role
      let stats = null;
      let courses: any[] = [];
      let enrolledCourses: any[] = [];

      if (user.role === 'admin') {
        const [usersResponse, coursesResponse] = await Promise.all([
          apiClient.getAllUsers(),
          apiClient.getAllCourses()
        ]);
        
        const users = usersResponse?.data || [];
        const allCourses = coursesResponse?.data || [];
        
        stats = {
          totalUsers: users.length || 0,
          totalCourses: allCourses.length || 0,
          totalInstructors: users.filter((u: any) => u.role === 'tutor').length,
          totalLearners: users.filter((u: any) => u.role === 'learner').length,
        };
        courses = allCourses;
      } 
      else if (user.role === 'tutor') {
        const coursesResponse = await apiClient.getInstructorCourses();
        const instructorCourses = coursesResponse?.data?.courses || [];
        courses = instructorCourses;
        
        stats = {
          totalCourses: courses.length,
          totalStudents: courses.reduce((total: number, course: any) => total + (course.enrolledCount || 0), 0),
          publishedCourses: courses.filter((course: any) => course.status === 'published').length,
          draftCourses: courses.filter((course: any) => course.status === 'draft').length,
        };
      } 
      else if (user.role === 'learner') {
        const [enrolledResponse, availableResponse] = await Promise.all([
          apiClient.getEnrolledCourses(),
          apiClient.getPublishedCourses()
              ]);

        enrolledCourses = enrolledResponse?.data?.courses || [];
        courses = availableResponse?.data?.courses || [];
        
        stats = {
          enrolledCourses: enrolledCourses.length,
          completedCourses: enrolledCourses.filter((course: any) => course.progress >= 100).length,
          inProgressCourses: enrolledCourses.filter((course: any) => course.progress > 0 && course.progress < 100).length,
          availableCourses: courses.length,
        };
      }

      setDashboardData({
        user,
        stats,
        courses,
        enrolledCourses,
            isLoading: false,
            error: null,
      });

    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      setDashboardData(prev => ({
        ...prev,
        isLoading: false,
        error: error?.message || 'Failed to load dashboard data',
      }));
    }
  }, [user, token, isOnline]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    ...dashboardData,
    refreshData,
  };
}; 