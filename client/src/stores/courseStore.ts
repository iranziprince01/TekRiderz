import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorId: string;
  category: string;
  price: number;
  rating: number;
  reviews: number;
  students: number;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  thumbnail?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'published';
  createdAt: string;
  updatedAt: string;
  lessons?: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'text' | 'quiz';
  duration: string;
  content?: string;
  videoUrl?: string;
  completed?: boolean;
}

interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  enrolledAt: string;
  progress: number;
  completedLessons: string[];
  lastWatched?: string;
}

interface CourseState {
  // Courses
  courses: Course[];
  enrolledCourses: Course[];
  myCourses: Course[]; // For tutors
  
  // Enrollments
  enrollments: Enrollment[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  categoryFilter: string;
  levelFilter: string;
  
  // Actions
  setCourses: (courses: Course[]) => void;
  addCourse: (course: Course) => void;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  removeCourse: (id: string) => void;
  
  // Enrollment actions
  enrollInCourse: (course: Course) => void;
  updateProgress: (courseId: string, progress: number, completedLessons: string[]) => void;
  
  // Tutor actions
  setMyCourses: (courses: Course[]) => void;
  submitCourseForReview: (courseId: string) => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchTerm: (term: string) => void;
  setCategoryFilter: (category: string) => void;
  setLevelFilter: (level: string) => void;
  clearFilters: () => void;
  
  // Utility actions
  getCourse: (id: string) => Course | undefined;
  getEnrollment: (courseId: string) => Enrollment | undefined;
  isEnrolled: (courseId: string) => boolean;
}

export const useCourseStore = create<CourseState>()(
  persist(
    (set, get) => ({
      // Initial state
      courses: [],
      enrolledCourses: [],
      myCourses: [],
      enrollments: [],
      isLoading: false,
      error: null,
      searchTerm: '',
      categoryFilter: 'all',
      levelFilter: 'all',

      // Course actions
      setCourses: (courses) => set({ courses }),
      
      addCourse: (course) => set((state) => ({ 
        courses: [...state.courses, course] 
      })),
      
      updateCourse: (id, updates) => set((state) => ({
        courses: state.courses.map(course => 
          course.id === id ? { ...course, ...updates } : course
        ),
        enrolledCourses: state.enrolledCourses.map(course => 
          course.id === id ? { ...course, ...updates } : course
        ),
        myCourses: state.myCourses.map(course => 
          course.id === id ? { ...course, ...updates } : course
        ),
      })),
      
      removeCourse: (id) => set((state) => ({
        courses: state.courses.filter(course => course.id !== id),
        enrolledCourses: state.enrolledCourses.filter(course => course.id !== id),
        myCourses: state.myCourses.filter(course => course.id !== id),
        enrollments: state.enrollments.filter(enrollment => enrollment.courseId !== id),
      })),

      // Enrollment actions
      enrollInCourse: (course) => set((state) => {
        const enrollment: Enrollment = {
          id: `enrollment-${Date.now()}`,
          courseId: course.id,
          userId: 'current-user', // TODO: get from auth store
          enrolledAt: new Date().toISOString(),
          progress: 0,
          completedLessons: [],
        };

        return {
          enrolledCourses: [...state.enrolledCourses, course],
          enrollments: [...state.enrollments, enrollment],
          courses: state.courses.filter(c => c.id !== course.id), // Remove from available
        };
      }),
      
      updateProgress: (courseId, progress, completedLessons) => set((state) => ({
        enrollments: state.enrollments.map(enrollment =>
          enrollment.courseId === courseId
            ? { ...enrollment, progress, completedLessons, lastWatched: new Date().toISOString() }
            : enrollment
        ),
      })),

      // Tutor actions
      setMyCourses: (myCourses) => set({ myCourses }),
      
      submitCourseForReview: (courseId) => set((state) => ({
        myCourses: state.myCourses.map(course =>
          course.id === courseId
            ? { ...course, status: 'submitted' as const }
            : course
        ),
      })),

      // UI actions
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setSearchTerm: (searchTerm) => set({ searchTerm }),
      setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
      setLevelFilter: (levelFilter) => set({ levelFilter }),
      clearFilters: () => set({ 
        searchTerm: '', 
        categoryFilter: 'all', 
        levelFilter: 'all' 
      }),

      // Utility actions
      getCourse: (id) => {
        const state = get();
        return state.courses.find(course => course.id === id) ||
               state.enrolledCourses.find(course => course.id === id) ||
               state.myCourses.find(course => course.id === id);
      },
      
      getEnrollment: (courseId) => {
        const state = get();
        return state.enrollments.find(enrollment => enrollment.courseId === courseId);
      },
      
      isEnrolled: (courseId) => {
        const state = get();
        return state.enrollments.some(enrollment => enrollment.courseId === courseId);
      },
    }),
    {
      name: 'course-storage',
      storage: createJSONStorage(() => ({
        getItem: (key: string) => {
          try {
            return localStorage.getItem(key);
          } catch (error) {
            console.warn('Failed to read from localStorage:', error);
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            localStorage.setItem(key, value);
          } catch (error) {
            console.warn('Failed to write to localStorage, clearing and retrying:', error);
            // Try emergency cleanup and retry once
            try {
              localStorage.clear();
              localStorage.setItem(key, value);
            } catch (retryError) {
              console.error('Failed to write to localStorage even after cleanup:', retryError);
            }
          }
        },
        removeItem: (key: string) => {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
          }
        },
      })),
      partialize: (state) => ({
        // Only persist essential enrollment data, not full course objects
        enrollments: state.enrollments.slice(0, 10), // Limit to 10 most recent enrollments
        // Don't persist full course data - too large and causes quota issues
        // enrolledCourses: state.enrolledCourses,
        // myCourses: state.myCourses,
      }),
      // Increase version to reset storage and clear old data
      version: 3,
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('Course store rehydrated successfully');
        }
      },
    }
  )
); 