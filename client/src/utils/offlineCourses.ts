// Offline Course Management for TekRiders
// Enables downloading, caching, and offline access to course content

import { 
  saveCourse, 
  getCourse, 
  getAllCourses,
  getEnrolledCourses,
  saveProgress,
  getCourseProgress,
  queueOfflineAction,
  saveCacheMetadata,
  getCacheMetadata
} from './indexedDB';
import type { CourseData, ProgressData, OfflineAction } from './indexedDB';

// Types for offline course functionality
export interface OfflineCourseInfo {
  id: string;
  title: string;
  description: string;
  instructor: string;
  isDownloaded: boolean;
  downloadProgress: number;
  lastAccessed: number;
  totalSize: number;
  downloadedSize: number;
  modules: OfflineModuleInfo[];
}

export interface OfflineModuleInfo {
  id: string;
  title: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  isDownloaded: boolean;
  size: number;
  url?: string;
  content?: string;
  duration?: number;
  order: number;
}

export interface CourseDownloadOptions {
  includeVideos: boolean;
  videoQuality: 'low' | 'medium' | 'high';
  includeAssignments: boolean;
  includeQuizzes: boolean;
}

export interface OfflineProgressUpdate {
  courseId: string;
  moduleId: string;
  progress: number;
  timeSpent: number;
  lastPosition?: number;
  completed: boolean;
  quizAnswers?: any[];
}

// Default download options
const DEFAULT_DOWNLOAD_OPTIONS: CourseDownloadOptions = {
  includeVideos: true,
  videoQuality: 'medium',
  includeAssignments: true,
  includeQuizzes: true
};

// Initialize offline courses system
export async function initOfflineCourses(): Promise<void> {
  try {
    console.log('Offline courses system initialized');
  } catch (error) {
    console.error('Failed to initialize offline courses:', error);
    throw error;
  }
}

// Check if course is available offline
export async function isCourseAvailableOffline(courseId: string): Promise<boolean> {
  try {
    const course = await getCourse(courseId);
    return !!course && course.enrollmentStatus === 'enrolled';
  } catch (error) {
    console.error('Failed to check offline course availability:', error);
    return false;
  }
}

// Get offline course info
export async function getOfflineCourseInfo(courseId: string): Promise<OfflineCourseInfo | null> {
  try {
    const course = await getCourse(courseId);
    if (!course) return null;

    // Calculate download status
    const modules: OfflineModuleInfo[] = course.modules.map(module => ({
      id: module.id,
      title: module.title,
      type: module.type,
      isDownloaded: true, // Simplified - in real implementation, check actual cache
      size: estimateModuleSize(module),
      url: module.videoUrl,
      content: module.content,
      duration: module.duration,
      order: module.order
    }));

    const totalSize = modules.reduce((sum, module) => sum + module.size, 0);
    const downloadedSize = modules
      .filter(m => m.isDownloaded)
      .reduce((sum, module) => sum + module.size, 0);

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      instructor: course.instructor,
      isDownloaded: downloadedSize === totalSize,
      downloadProgress: totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0,
      lastAccessed: course.lastAccessed,
      totalSize,
      downloadedSize,
      modules
    };
  } catch (error) {
    console.error('Failed to get offline course info:', error);
    return null;
  }
}

// Download course for offline access
export async function downloadCourseForOffline(
  courseId: string, 
  options: Partial<CourseDownloadOptions> = {}
): Promise<boolean> {
  try {
    const downloadOptions = { ...DEFAULT_DOWNLOAD_OPTIONS, ...options };
    
    // Get course data from server or cache
    const courseData = await fetchCourseData(courseId);
    if (!courseData) {
      throw new Error('Course not found');
    }

    // Process and cache course content
    const processedCourse = await processCourseForOffline(courseData, downloadOptions);
    
    // Save to offline storage
    await saveCourse(processedCourse);
    
    // Cache metadata
    await saveCacheMetadata({
      key: `course_${courseId}`,
      type: 'course',
      size: estimateCourseSize(processedCourse),
      lastAccessed: Date.now(),
      url: `/api/courses/${courseId}`
    });

    console.log(`Course ${courseId} downloaded for offline access`);
    return true;
  } catch (error) {
    console.error('Failed to download course:', error);
    return false;
  }
}

// Remove course from offline storage
export async function removeCourseFromOffline(courseId: string): Promise<boolean> {
  try {
    const course = await getCourse(courseId);
    if (course) {
      // Update enrollment status but keep the course record
      const updatedCourse = {
        ...course,
        enrollmentStatus: 'not_enrolled' as const,
        modules: [] // Clear modules to save space
      };
      await saveCourse(updatedCourse);
    }

    console.log(`Course ${courseId} removed from offline storage`);
    return true;
  } catch (error) {
    console.error('Failed to remove course from offline:', error);
    return false;
  }
}

// Get all offline courses
export async function getAllOfflineCourses(): Promise<OfflineCourseInfo[]> {
  try {
    const courses = await getEnrolledCourses();
    const offlineCourses: OfflineCourseInfo[] = [];

    for (const course of courses) {
      const info = await getOfflineCourseInfo(course.id);
      if (info) {
        offlineCourses.push(info);
      }
    }

    return offlineCourses.sort((a, b) => b.lastAccessed - a.lastAccessed);
  } catch (error) {
    console.error('Failed to get offline courses:', error);
    return [];
  }
}

// Update course progress offline
export async function updateOfflineCourseProgress(
  userId: string,
  update: OfflineProgressUpdate
): Promise<void> {
  try {
    const progressData: ProgressData = {
      id: `${update.courseId}-${update.moduleId}-${userId}-${Date.now()}`,
      userId,
      courseId: update.courseId,
      moduleId: update.moduleId,
      type: update.quizAnswers ? 'quiz_completion' : 'video_progress',
      progress: update.progress,
      timeSpent: update.timeSpent,
      lastPosition: update.lastPosition,
      quizAnswers: update.quizAnswers,
      completed: update.completed,
      timestamp: Date.now(),
      synced: false
    };

    await saveProgress(progressData);

    // Queue for sync when online
    await queueOfflineAction({
      type: 'progress_update',
      endpoint: `/api/courses/${update.courseId}/progress`,
      method: 'POST',
      data: {
        moduleId: update.moduleId,
        progress: update.progress,
        timeSpent: update.timeSpent,
        lastPosition: update.lastPosition,
        completed: update.completed,
        quizAnswers: update.quizAnswers
      },
      priority: 2 // Medium priority
    });

    console.log('Offline progress updated:', update);
  } catch (error) {
    console.error('Failed to update offline progress:', error);
    throw error;
  }
}

// Get course progress offline
export async function getOfflineCourseProgress(courseId: string): Promise<ProgressData[]> {
  try {
    return await getCourseProgress(courseId);
  } catch (error) {
    console.error('Failed to get offline course progress:', error);
    return [];
  }
}

// Enroll in course offline (queue for online sync)
export async function enrollInCourseOffline(userId: string, courseId: string): Promise<void> {
  try {
    // Queue enrollment action
    await queueOfflineAction({
      type: 'enrollment',
      endpoint: `/api/courses/${courseId}/enroll`,
      method: 'POST',
      data: { userId },
      priority: 1 // High priority
    });

    // Update local course status
    const course = await getCourse(courseId);
    if (course) {
      const updatedCourse = {
        ...course,
        enrollmentStatus: 'enrolled' as const,
        lastAccessed: Date.now()
      };
      await saveCourse(updatedCourse);
    }

    console.log(`Queued enrollment for course ${courseId}`);
  } catch (error) {
    console.error('Failed to enroll in course offline:', error);
    throw error;
  }
}

// Search offline courses
export async function searchOfflineCourses(query: string): Promise<OfflineCourseInfo[]> {
  try {
    const allCourses = await getAllOfflineCourses();
    const lowercaseQuery = query.toLowerCase();

    return allCourses.filter(course => 
      course.title.toLowerCase().includes(lowercaseQuery) ||
      course.description.toLowerCase().includes(lowercaseQuery) ||
      course.instructor.toLowerCase().includes(lowercaseQuery)
    );
  } catch (error) {
    console.error('Failed to search offline courses:', error);
    return [];
  }
}

// Get offline learning statistics
export async function getOfflineLearningStats(userId: string): Promise<{
  totalCourses: number;
  completedCourses: number;
  totalTimeSpent: number;
  offlineTime: number;
  coursesDownloaded: number;
}> {
  try {
    const courses = await getAllOfflineCourses();
    const allProgress = await Promise.all(
      courses.map(course => getCourseProgress(course.id))
    );

    const flatProgress = allProgress.flat().filter(p => p.userId === userId);
    
    const totalTimeSpent = flatProgress.reduce((sum, p) => sum + p.timeSpent, 0);
    const offlineTime = flatProgress
      .filter(p => !p.synced)
      .reduce((sum, p) => sum + p.timeSpent, 0);

    const completedCourses = courses.filter(course => {
      const courseProgress = flatProgress.filter(p => p.courseId === course.id);
      const completedModules = courseProgress.filter(p => p.completed);
      return completedModules.length === course.modules.length && course.modules.length > 0;
    }).length;

    return {
      totalCourses: courses.length,
      completedCourses,
      totalTimeSpent,
      offlineTime,
      coursesDownloaded: courses.filter(c => c.isDownloaded).length
    };
  } catch (error) {
    console.error('Failed to get offline learning stats:', error);
    return {
      totalCourses: 0,
      completedCourses: 0,
      totalTimeSpent: 0,
      offlineTime: 0,
      coursesDownloaded: 0
    };
  }
}

// Helper functions

// Fetch course data (simulate API call)
async function fetchCourseData(courseId: string): Promise<any> {
  // In a real implementation, this would fetch from your API
  // For now, we'll simulate course data
  return {
    id: courseId,
    title: 'Sample Course',
    description: 'A sample course for offline learning',
    instructor: 'John Doe',
    modules: [
      {
        id: 'module1',
        title: 'Introduction',
        type: 'video',
        content: 'Introduction content',
        videoUrl: '/videos/intro.mp4',
        duration: 300,
        order: 1
      }
    ]
  };
}

// Process course for offline storage
async function processCourseForOffline(
  courseData: any, 
  options: CourseDownloadOptions
): Promise<CourseData> {
  const processedModules = courseData.modules
    .filter((module: any) => {
      if (module.type === 'video' && !options.includeVideos) return false;
      if (module.type === 'assignment' && !options.includeAssignments) return false;
      if (module.type === 'quiz' && !options.includeQuizzes) return false;
      return true;
    })
    .map((module: any) => ({
      id: module.id,
      title: module.title,
      type: module.type,
      content: module.content,
      videoUrl: module.videoUrl,
      duration: module.duration,
      order: module.order
    }));

  return {
    id: courseData.id,
    title: courseData.title,
    description: courseData.description,
    instructor: courseData.instructor,
    thumbnail: courseData.thumbnail,
    modules: processedModules,
    enrollmentStatus: 'enrolled',
    lastAccessed: Date.now(),
    cachedAt: Date.now()
  };
}

// Estimate module size (simplified)
function estimateModuleSize(module: any): number {
  switch (module.type) {
    case 'video':
      return (module.duration || 300) * 1000; // 1KB per second (very rough estimate)
    case 'text':
      return (module.content?.length || 1000) * 2; // 2 bytes per character
    case 'quiz':
      return 5000; // 5KB for quiz data
    default:
      return 1000; // 1KB default
  }
}

// Estimate course size
function estimateCourseSize(course: CourseData): number {
  return course.modules.reduce((sum, module) => sum + estimateModuleSize(module), 0);
}

// Export default initialization
export default initOfflineCourses; 