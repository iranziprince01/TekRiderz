import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';

export const ApiDebug: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [testResults, setTestResults] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);

  const runApiTests = async () => {
    setIsLoading(true);
    const results: any = {};

    try {
      // Test public courses endpoint
      try {
        const coursesResponse = await apiClient.getCourses();
        results.courses = {
          success: coursesResponse.success,
          count: coursesResponse.success ? (coursesResponse.data?.courses?.length || 0) : 0,
          error: coursesResponse.error
        };
      } catch (error) {
        results.courses = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Test authenticated endpoints only if logged in
      if (isAuthenticated) {
        try {
          const profileResponse = await apiClient.getProfile();
          results.profile = {
            success: profileResponse.success,
            error: profileResponse.error
          };
        } catch (error) {
          results.profile = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }

        try {
          const enrollmentsResponse = await apiClient.getEnrollments();
          results.enrollments = {
            success: enrollmentsResponse.success,
            count: enrollmentsResponse.success ? (enrollmentsResponse.data?.length || 0) : 0,
            error: enrollmentsResponse.error
          };
        } catch (error) {
          results.enrollments = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }

      setTestResults(results);
    } catch (error) {
      console.error('API test failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runApiTests();
  }, [isAuthenticated]);

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <Card className="p-4 mb-6 border-dashed border-2 border-blue-200 bg-blue-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-blue-800">API Debug Panel</h3>
        <div className="flex gap-2">
          <Badge variant={isAuthenticated ? 'success' : 'default'}>
            {isAuthenticated ? 'Authenticated' : 'Guest'}
          </Badge>
          <Button size="sm" onClick={runApiTests} disabled={isLoading}>
            {isLoading ? 'Testing...' : 'Refresh Tests'}
          </Button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <strong>User:</strong> {user?.name || user?.email || 'Not logged in'}
        </div>
        
        <div className="flex items-center gap-2">
          <strong>Courses API:</strong>
          <Badge variant={testResults.courses?.success ? 'success' : 'error'}>
            {testResults.courses?.success ? `${testResults.courses.count} courses` : 'Failed'}
          </Badge>
          {testResults.courses?.error && (
            <span className="text-red-600 text-xs">{testResults.courses.error}</span>
          )}
        </div>

        {isAuthenticated && (
          <>
            <div className="flex items-center gap-2">
              <strong>Profile API:</strong>
              <Badge variant={testResults.profile?.success ? 'success' : 'error'}>
                {testResults.profile?.success ? 'Success' : 'Failed'}
              </Badge>
              {testResults.profile?.error && (
                <span className="text-red-600 text-xs">{testResults.profile.error}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <strong>Enrollments API:</strong>
              <Badge variant={testResults.enrollments?.success ? 'success' : 'error'}>
                {testResults.enrollments?.success ? `${testResults.enrollments.count} enrollments` : 'Failed'}
              </Badge>
              {testResults.enrollments?.error && (
                <span className="text-red-600 text-xs">{testResults.enrollments.error}</span>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}; 