import React, { useState } from 'react';
import { useProgress } from '../../hooks/useProgress';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface ProgressDebuggerProps {
  courseId: string;
}

export const ProgressDebugger: React.FC<ProgressDebuggerProps> = ({ courseId }) => {
  const { user } = useAuth();
  const {
    courseProgress,
    allProgress,
    loading,
    error,
    dbInfo,
    saveLessonProgress,
    markLessonComplete,
    updateLessonProgress,
    fetchCourseProgress,
    deleteLessonProgress,
    clearAllUserProgress,
    syncProgress,
    fetchDatabaseInfo
  } = useProgress();

  const [testLessonId, setTestLessonId] = useState('test_lesson_1');
  const [testPercentage, setTestPercentage] = useState(50);

  const handleTestSave = async () => {
    if (!user?.id) return;
    
    await saveLessonProgress(courseId, testLessonId, {
      percentage: testPercentage,
      timeSpent: 300, // 5 minutes
      isCompleted: testPercentage >= 100
    });
    
    // Refresh progress
    await fetchCourseProgress(courseId);
  };

  const handleTestComplete = async () => {
    if (!user?.id) return;
    
    await markLessonComplete(courseId, testLessonId, 600); // 10 minutes
    await fetchCourseProgress(courseId);
  };

  const handleTestUpdate = async () => {
    if (!user?.id) return;
    
    await updateLessonProgress(courseId, testLessonId, testPercentage, 300);
    await fetchCourseProgress(courseId);
  };

  const handleTestDelete = async () => {
    if (!user?.id) return;
    
    await deleteLessonProgress(courseId, testLessonId);
    await fetchCourseProgress(courseId);
  };

  const handleRefreshProgress = async () => {
    await fetchCourseProgress(courseId);
  };

  const handleSyncProgress = async () => {
    await syncProgress(courseId);
  };

  const handleClearAllProgress = async () => {
    if (confirm('Are you sure you want to clear all progress for this user?')) {
      await clearAllUserProgress();
    }
  };

  const handleRefreshDbInfo = async () => {
    await fetchDatabaseInfo();
  };

  if (!user) {
    return (
      <Card className="p-4">
        <p className="text-gray-600">Please log in to test progress functionality.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Progress System Debugger</h3>
        <Badge variant={dbInfo?.status === 'active' ? 'success' : 'warning'}>
          DB: {dbInfo?.status || 'unknown'}
        </Badge>
      </div>

      {/* Database Info */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Database Info</h4>
        <pre className="text-sm text-gray-600 dark:text-gray-400">
          {JSON.stringify(dbInfo, null, 2)}
        </pre>
        <Button onClick={handleRefreshDbInfo} size="sm" className="mt-2">
          Refresh DB Info
        </Button>
      </div>

      {/* Test Controls */}
      <div className="space-y-4">
        <h4 className="font-medium">Test Progress Operations</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Lesson ID</label>
            <input
              type="text"
              value={testLessonId}
              onChange={(e) => setTestLessonId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Percentage</label>
            <input
              type="number"
              min="0"
              max="100"
              value={testPercentage}
              onChange={(e) => setTestPercentage(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleTestSave} disabled={loading} size="sm">
            Save Progress ({testPercentage}%)
          </Button>
          <Button onClick={handleTestComplete} disabled={loading} size="sm">
            Mark Complete
          </Button>
          <Button onClick={handleTestUpdate} disabled={loading} size="sm">
            Update Progress
          </Button>
          <Button onClick={handleTestDelete} disabled={loading} size="sm" variant="outline">
            Delete Progress
          </Button>
        </div>
      </div>

      {/* Course Progress Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Course Progress</h4>
          <div className="flex gap-2">
            <Button onClick={handleRefreshProgress} disabled={loading} size="sm">
              Refresh
            </Button>
            <Button onClick={handleSyncProgress} disabled={loading} size="sm">
              Sync
            </Button>
          </div>
        </div>

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-600">Error: {error}</p>}
        
        {courseProgress && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Total Lessons:</span> {courseProgress.totalLessons}
              </div>
              <div>
                <span className="font-medium">Completed:</span> {courseProgress.completedLessons}
              </div>
              <div>
                <span className="font-medium">Overall %:</span> {courseProgress.overallPercentage.toFixed(1)}%
              </div>
              <div>
                <span className="font-medium">Time Spent:</span> {Math.round(courseProgress.totalTimeSpent / 60)}m
              </div>
            </div>
            
            {Object.keys(courseProgress.lessons).length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium mb-2">Lesson Details:</h5>
                <div className="space-y-2">
                  {Object.entries(courseProgress.lessons).map(([lessonId, progress]) => (
                    <div key={lessonId} className="flex justify-between items-center text-sm">
                      <span className="font-mono">{lessonId}</span>
                      <div className="flex items-center gap-2">
                        <span>{progress.percentage}%</span>
                        {progress.isCompleted && (
                          <Badge variant="success" size="sm">✓</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* All Progress Display */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">All User Progress ({allProgress.length} records)</h4>
          <Button onClick={handleClearAllProgress} disabled={loading} size="sm" variant="outline">
            Clear All
          </Button>
        </div>

        {allProgress.length > 0 && (
          <div className="max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            {allProgress.map((progress, index) => (
              <div key={index} className="text-sm mb-2 p-2 bg-white dark:bg-gray-700 rounded">
                <div className="font-mono text-xs text-gray-500">
                  {progress.courseId} / {progress.lessonId || 'overall'}
                </div>
                <div className="flex justify-between items-center">
                  <span>{progress.progress.percentage}%</span>
                  <span className="text-xs text-gray-500">
                    {new Date(progress.progress.lastUpdated).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}; 