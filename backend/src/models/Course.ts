import { BaseModel } from './BaseModel';
import { Course, CourseStatus, CourseLevel } from '../types';
import { logger } from '../utils/logger';
import { databases } from '../config/database';
import { fileModel } from './File';
import { config } from '../config/config';

export class CourseModel extends BaseModel<Course> {
  constructor() {
    super('courses', 'course');
  }

  /**
   * Create course with file associations
   */
  async createWithFiles(
    courseData: Omit<Course, '_id' | '_rev' | 'createdAt' | 'updatedAt'>,
    fileIds: { thumbnailId?: string; previewVideoId?: string } = {}
  ): Promise<Course> {
    try {
      // Get file URLs if file IDs are provided
      let thumbnailUrl = courseData.thumbnail;
      let previewVideoUrl = courseData.previewVideo;

      if (fileIds.thumbnailId) {
        const thumbnailFile = await fileModel.findById(fileIds.thumbnailId);
        if (thumbnailFile) {
          thumbnailUrl = thumbnailFile.url;
          // Update file to link to this course
          await fileModel.updateFile(fileIds.thumbnailId, {
            entityType: 'course',
            entityId: '', // Will be updated after course creation
          });
        }
      }

      if (fileIds.previewVideoId) {
        const videoFile = await fileModel.findById(fileIds.previewVideoId);
        if (videoFile) {
          previewVideoUrl = videoFile.url;
          // Update file to link to this course
          await fileModel.updateFile(fileIds.previewVideoId, {
            entityType: 'course',
            entityId: '', // Will be updated after course creation
          });
        }
      }

      // Create course with file URLs
      const course = await this.create({
        ...courseData,
        thumbnail: thumbnailUrl || courseData.thumbnail || '',
        previewVideo: previewVideoUrl || courseData.previewVideo || '',
      });

      // Update file entities with course ID
      if (fileIds.thumbnailId && course._id) {
        await fileModel.updateFile(fileIds.thumbnailId, {
          entityId: course._id,
        });
      }

      if (fileIds.previewVideoId && course._id) {
        await fileModel.updateFile(fileIds.previewVideoId, {
          entityId: course._id,
        });
      }

      return course;
    } catch (error) {
      logger.error('Failed to create course with files:', error);
      throw error;
    }
  }

  /**
   * Get course files
   */
  async getCourseFiles(courseId: string) {
    try {
      return await fileModel.getByEntity('course', courseId);
    } catch (error) {
      logger.error('Failed to get course files:', error);
      return [];
    }
  }

  /**
   * Update course files
   */
  async updateCourseFiles(
    courseId: string,
    fileIds: { thumbnailId?: string; previewVideoId?: string }
  ): Promise<Course> {
    try {
      const course = await this.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const updateData: Partial<Course> = {};

      // Handle thumbnail update
      if (fileIds.thumbnailId) {
        const thumbnailFile = await fileModel.findById(fileIds.thumbnailId);
        if (thumbnailFile) {
          updateData.thumbnail = thumbnailFile.url;
          await fileModel.updateFile(fileIds.thumbnailId, {
            entityType: 'course',
            entityId: courseId,
          });
        }
      }

      // Handle preview video update
      if (fileIds.previewVideoId) {
        const videoFile = await fileModel.findById(fileIds.previewVideoId);
        if (videoFile) {
          updateData.previewVideo = videoFile.url;
          await fileModel.updateFile(fileIds.previewVideoId, {
            entityType: 'course',
            entityId: courseId,
          });
        }
      }

      return await this.update(courseId, updateData);
    } catch (error) {
      logger.error('Failed to update course files:', error);
      throw error;
    }
  }

  /**
   * Delete course and associated files
   */
  async deleteCourseWithFiles(courseId: string): Promise<boolean> {
    try {
      // Get course files first
      const courseFiles = await this.getCourseFiles(courseId);

      // Delete the course
      const deleted = await this.delete(courseId);

      if (deleted) {
        // Mark associated files as inactive
        for (const file of courseFiles) {
          if (file._id) {
            await fileModel.deleteFile(file._id);
          }
        }
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete course with files:', error);
      return false;
    }
  }

  // Create course with proper validation
  async create(courseData: Omit<Course, '_id' | '_rev' | 'createdAt' | 'updatedAt'>): Promise<Course> {
    try {
      const courseWithDefaults = {
        ...courseData,
        type: 'course' as const,
        status: courseData.status || 'draft',
        
        // Initialize workflow tracking
        workflowHistory: courseData.workflowHistory || [],
        
        // Initialize versioning
        version: courseData.version || '1.0.0',
        isCurrentVersion: courseData.isCurrentVersion !== undefined ? courseData.isCurrentVersion : true,
        
        // Initialize quality and validation
        qualityScore: courseData.qualityScore || 0,
        validationResult: courseData.validationResult || {
          isValid: false,
          errors: [],
          warnings: [],
          score: 0
        },
        
        // Initialize content flags
        contentFlags: courseData.contentFlags || {
          hasVideo: false,
          hasQuizzes: false,
          hasAssignments: false,
          hasCertificate: false,
          hasPrerequisites: false,
          isAccessible: false
        },
        
        // Initialize metrics
        metrics: courseData.metrics || {
          views: 0,
          completionRate: 0,
          avgTimeToComplete: 0,
          dropoffPoints: [],
          engagement: {
            avgSessionDuration: 0,
            returnRate: 0,
            discussionPosts: 0
          },
          performance: {
            avgQuizScore: 0,
            assignmentSubmissionRate: 0,
            certificateEarnedRate: 0
          }
        },
        
        // Initialize business metrics
        enrollmentCount: courseData.enrollmentCount || 0,
        completionCount: courseData.completionCount || 0,
        revenue: courseData.revenue || 0,
        
        // Initialize rating
        rating: courseData.rating || {
          average: 0,
          count: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        },
        
        // Initialize SEO
        seo: courseData.seo || {
          metaTitle: courseData.title,
          metaDescription: courseData.shortDescription,
          keywords: courseData.tags || [],
          slug: courseData.title?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || ''
        },
        
        // Initialize accessibility
        accessibility: courseData.accessibility || {
          compliantWith: [],
          hasTranscriptions: false,
          hasCaptions: false,
          hasAudioDescriptions: false,
          keyboardNavigable: false,
          screenReaderOptimized: false
        },
        
        // Initialize schedule
        schedule: courseData.schedule || {
          cohortBased: false
        },
        
        // Initialize arrays
        tags: courseData.tags || [],
        requirements: courseData.requirements || [],
        learningObjectives: courseData.learningObjectives || [],
        sections: courseData.sections || [],
        
        // Initialize durations
        totalDuration: courseData.totalDuration || 0,
        totalLessons: courseData.totalLessons || 0,
      };

      // Update content flags based on sections
      this.updateContentFlags(courseWithDefaults);

      return await super.create(courseWithDefaults);
    } catch (error) {
      logger.error('Failed to create course:', error);
      throw error;
    }
  }

  // Update content flags based on course content
  private updateContentFlags(course: any): void {
    const flags = {
      hasVideo: false,
      hasQuizzes: false,
      hasAssignments: false,
      hasCertificate: false,
      hasPrerequisites: false,
      isAccessible: false
    };

    if (course.sections && course.sections.length > 0) {
      course.sections.forEach((section: any) => {
        if (section.lessons && section.lessons.length > 0) {
          section.lessons.forEach((lesson: any) => {
            if (lesson.type === 'video' && lesson.content?.videoUrl) {
              flags.hasVideo = true;
            }
            if (lesson.type === 'quiz') {
              flags.hasQuizzes = true;
            }
            if (lesson.type === 'assignment') {
              flags.hasAssignments = true;
            }
            if (lesson.prerequisites && lesson.prerequisites.length > 0) {
              flags.hasPrerequisites = true;
            }
            if (lesson.accessibility?.hasTranscription || lesson.accessibility?.hasCaptions) {
              flags.isAccessible = true;
            }
          });
        }
      });
    }

    // Check if course has prerequisites
    if (course.requirements && course.requirements.length > 0) {
      flags.hasPrerequisites = true;
    }

    // Assume certificate is available for published courses
    if (course.status === 'published') {
      flags.hasCertificate = true;
    }

    course.contentFlags = flags;
  }

  /**
   * Post-process course data to ensure file URLs are properly constructed
   */
  private async validateAndFixFileUrls(course: Course): Promise<Course> {
    try {
      // Fix thumbnail URL if it looks like a filename only
      if (course.thumbnail && !course.thumbnail.startsWith('http') && !course.thumbnail.includes('/uploads/')) {
        const correctedUrl = `${config.server.baseUrl}/uploads/courses/thumbnails/${course.thumbnail}`;
        logger.info('Correcting thumbnail URL:', { 
          original: course.thumbnail, 
          corrected: correctedUrl 
        });
        course.thumbnail = correctedUrl;
      }

      // Fix preview video URL if it looks like a filename only
      if (course.previewVideo && !course.previewVideo.startsWith('http') && !course.previewVideo.includes('/uploads/')) {
        const correctedUrl = `${config.server.baseUrl}/uploads/courses/videos/${course.previewVideo}`;
        logger.info('Correcting preview video URL:', { 
          original: course.previewVideo, 
          corrected: correctedUrl 
        });
        course.previewVideo = correctedUrl;
      }

      // Fix section video URLs
      if (course.sections && Array.isArray(course.sections)) {
        course.sections = course.sections.map(section => {
          if (section.lessons && Array.isArray(section.lessons)) {
            section.lessons = section.lessons.map(lesson => {
              if (lesson.content?.videoUrl && 
                  !lesson.content.videoUrl.startsWith('http') && 
                  !lesson.content.videoUrl.includes('/uploads/')) {
                const correctedUrl = `${config.server.baseUrl}/uploads/courses/videos/${lesson.content.videoUrl}`;
                logger.info('Correcting lesson video URL:', { 
                  lessonId: lesson.id,
                  original: lesson.content.videoUrl, 
                  corrected: correctedUrl 
                });
                lesson.content.videoUrl = correctedUrl;
              }
              return lesson;
            });
          }
          return section;
        });
      }

      return course;
    } catch (error) {
      logger.warn('Failed to validate and fix file URLs:', error);
      return course;
    }
  }

  // Override findById to include URL validation
  async findById(id: string): Promise<Course | null> {
    try {
      const course = await super.findById(id);
      if (course) {
        return await this.validateAndFixFileUrls(course);
      }
      return course;
    } catch (error) {
      logger.error('Failed to find course by ID:', error);
      throw error;
    }
  }

  // Get courses with pagination and filtering
  async findCourses(options: {
    page?: number;
    limit?: number;
    category?: string;
    level?: CourseLevel;
    status?: CourseStatus;
    instructorId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    courses: Course[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      let viewName = 'all_courses';
      let viewOptions: any = {
        include_docs: true,
        limit,
        skip,
        descending: options.sortOrder === 'desc',
      };

      // Use specific views based on filters
      if (options.status) {
        viewName = options.status === 'published' ? 'published' : 'by_status';
        if (viewName === 'by_status') {
          viewOptions.key = options.status;
        }
      } else if (options.category) {
        viewName = 'by_category';
        viewOptions.key = options.category;
      } else if (options.level) {
        viewName = 'by_level';
        viewOptions.key = options.level;
      } else if (options.instructorId) {
        viewName = 'by_instructor';
        viewOptions.key = options.instructorId;
      }

      // Get courses from view
      let courses: Course[];
      try {
        logger.info('Querying view:', { viewName, viewOptions });
        const result = await databases.courses.view('courses', viewName, viewOptions);
        logger.info('View result:', { rowCount: result.rows.length, totalRows: result.total_rows });
        courses = result.rows.map(row => row.doc as Course).filter(course => course !== null);
        logger.info('Processed courses:', { courseCount: courses.length });
      } catch (viewError) {
        logger.warn(`View ${viewName} failed, using fallback query:`, viewError);
        
        // Fallback: direct query
        let selector: any = { type: 'course' };
        
        if (options.status) {
          selector.status = options.status;
        }
        if (options.category) {
          selector.category = options.category;
        }
        if (options.level) {
          selector.level = options.level;
        }
        if (options.instructorId) {
          selector.instructorId = options.instructorId;
        }
        
        const fallbackResult = await databases.courses.find({
          selector,
          limit: 1000 // Get all and filter/paginate manually
        });
        
        courses = fallbackResult.docs.map(doc => {
          const course = doc as Course;
          course.id = course._id!;
          return course;
        });
      }

      // Apply search filter if provided
      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        courses = courses.filter(course => 
          course.title.toLowerCase().includes(searchTerm) ||
          course.description.toLowerCase().includes(searchTerm) ||
          course.category.toLowerCase().includes(searchTerm) ||
          (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
      }

      // Get total count
      let total = courses.length;
      if (!options.search) {
        try {
          // If no search, get accurate total from view
          const countResult = await databases.courses.view('courses', viewName, {
            ...viewOptions,
            include_docs: false,
            limit: undefined,
            skip: undefined,
          });
          total = countResult.total_rows || countResult.rows.length || 0;
        } catch (countError) {
          logger.warn('Failed to get count from view, using current results length:', countError);
          total = courses.length;
        }
      }

      // Apply pagination if we got all results (fallback scenario or if view didn't handle pagination)
      let paginatedCourses: Course[];
      if (courses.length > limit) {
        // If we got more courses than the limit, it means pagination wasn't handled by the view
        const startIndex = skip;
        const endIndex = startIndex + limit;
        paginatedCourses = courses.slice(startIndex, endIndex);
      } else {
        // View handled pagination correctly
        paginatedCourses = courses;
      }
      
      const pages = Math.ceil(total / limit);

      return {
        courses: paginatedCourses,
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      };
    } catch (error) {
      logger.error('Failed to find courses:', error);
      throw error;
    }
  }

  // Get published courses (for public access)
  async getPublishedCourses(options: {
    page?: number;
    limit?: number;
    category?: string;
    level?: CourseLevel;
    search?: string;
  } = {}): Promise<{
    courses: Course[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const result = await this.findCourses({
      ...options,
      status: 'published',
    });
    
    // Validate and fix URLs for all courses
    result.courses = await Promise.all(
      result.courses.map((course: Course) => this.validateAndFixFileUrls(course))
    );
    
    return result;
  }

  // Get courses by instructor
  async getInstructorCourses(instructorId: string, options: {
    page?: number;
    limit?: number;
    status?: CourseStatus;
  } = {}): Promise<{
    courses: Course[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      logger.info('Getting instructor courses:', { instructorId, options });
      
      const result = await this.findCourses({
        ...options,
        instructorId,
      });
      
      // Validate and fix URLs for all courses
      result.courses = await Promise.all(
        result.courses.map((course: Course) => this.validateAndFixFileUrls(course))
      );
      
      logger.info('Instructor courses result:', { 
        instructorId, 
        courseCount: result.courses.length,
        total: result.pagination.total 
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to get instructor courses, trying fallback method:', { instructorId, error });
      
      // Fallback: direct query if views fail
      try {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;
        
        let selector: any = { 
          type: 'course',
          instructorId: instructorId
        };
        
        if (options.status) {
          selector.status = options.status;
        }
        
        const result = await databases.courses.find({
          selector,
          limit: limit + skip, // Get more to handle pagination
          skip: 0
        });
        
        const allCourses = result.docs.map(doc => {
          const course = doc as Course;
          course.id = course._id!;
          return course;
        });
        
        // Apply pagination and URL validation
        const paginatedCourses = await Promise.all(
          allCourses.slice(skip, skip + limit).map((course: Course) => this.validateAndFixFileUrls(course))
        );
        
        const total = allCourses.length;
        const pages = Math.ceil(total / limit);
        
        logger.info('Fallback instructor courses result:', { 
          instructorId, 
          courseCount: paginatedCourses.length,
          total 
        });
        
        return {
          courses: paginatedCourses,
          pagination: {
            page,
            limit,
            total,
            pages,
          },
        };
      } catch (fallbackError) {
        logger.error('Fallback method also failed:', { instructorId, fallbackError });
        
        // Return empty result if everything fails
        return {
          courses: [],
          pagination: {
            page: options.page || 1,
            limit: options.limit || 10,
            total: 0,
            pages: 0,
          },
        };
      }
    }
  }

  // Get pending approval courses (for admin)
  async getPendingCourses(): Promise<Course[]> {
    try {
      const result = await databases.courses.view('courses', 'pending_approval', {
        include_docs: true,
      });

      return result.rows.map(row => row.doc as Course);
    } catch (error) {
      logger.error('Failed to get pending courses:', error);
      throw error;
    }
  }

  // Update course status (for approval workflow)
  async updateStatus(courseId: string, status: CourseStatus, reason?: string): Promise<Course> {
    try {
      const updateData: Partial<Course> = { status };
      if (reason) {
        (updateData as any).moderationReason = reason;
      }
      if (status === 'published') {
        (updateData as any).publishedAt = new Date().toISOString();
      }

      return await this.update(courseId, updateData);
    } catch (error) {
      logger.error('Failed to update course status:', { courseId, status, error });
      throw error;
    }
  }

  // Enhanced method to get course with all related files and enriched data
  async getCourseWithCompleteData(courseId: string, userId?: string): Promise<{
    course: Course;
    isEnrolled: boolean;
    enrollmentId?: string;
    files: {
      thumbnail?: any;
      previewVideo?: any;
      lessonVideos: { [lessonId: string]: any };
      documents: any[];
      materials: any[];
    };
  }> {
    try {
      // Get basic course with enrollment
      const basicResult = await this.getCourseWithEnrollment(courseId, userId);
      let course = basicResult.course;

      // Fetch all related files
      const files = await this.getCourseFiles(courseId);
      
      // Organize files by type
      const organizedFiles = {
        thumbnail: files.find(f => f.fileType === 'thumbnail'),
        previewVideo: files.find(f => f.fileType === 'video' && f.entityId === courseId),
        lessonVideos: {} as { [lessonId: string]: any },
        documents: files.filter(f => f.fileType === 'document'),
        materials: files.filter(f => f.fileType === 'material')
      };

      // Map lesson videos
      files.filter(f => f.fileType === 'video' && f.entityType === 'lesson').forEach(file => {
        if (file.entityId) {
          organizedFiles.lessonVideos[file.entityId] = file;
        }
      });

      // Enrich course data with proper file URLs
      course = await this.enrichCourseWithFiles(course, organizedFiles);

      const result: {
        course: Course;
        isEnrolled: boolean;
        enrollmentId?: string;
        files: {
          thumbnail?: any;
          previewVideo?: any;
          lessonVideos: { [lessonId: string]: any };
          documents: any[];
          materials: any[];
        };
      } = {
        course,
        isEnrolled: basicResult.isEnrolled,
        files: organizedFiles
      };

      if (basicResult.enrollmentId) {
        result.enrollmentId = basicResult.enrollmentId;
      }

      return result;
    } catch (error) {
      logger.error('Failed to get course with complete data:', { courseId, userId, error });
      throw error;
    }
  }

  // Method to enrich course data with file information
  private async enrichCourseWithFiles(course: Course, files: any): Promise<Course> {
    try {
      // Set thumbnail URL from file data
      if (files.thumbnail) {
        course.thumbnail = files.thumbnail.url;
        logger.debug('Enriched course thumbnail:', { courseId: course._id, url: course.thumbnail });
      }

      // Set preview video URL from file data
      if (files.previewVideo) {
        course.previewVideo = files.previewVideo.url;
        logger.debug('Enriched course preview video:', { courseId: course._id, url: course.previewVideo });
      }

      // Enrich sections and lessons with video URLs
      if (course.sections && Array.isArray(course.sections)) {
        course.sections = course.sections.map(section => {
          if (section.lessons && Array.isArray(section.lessons)) {
            section.lessons = section.lessons.map(lesson => {
              // Check if lesson has a corresponding video file
              const lessonVideo = files.lessonVideos[lesson.id];
                             if (lessonVideo && lesson.content) {
                 lesson.content.videoUrl = lessonVideo.url;
                 // Add additional metadata from file
                 lesson.content.duration = lessonVideo.metadata?.duration || lesson.content.duration;
                 logger.debug('Enriched lesson video:', { 
                   lessonId: lesson.id, 
                   url: lesson.content.videoUrl,
                   fileSize: lessonVideo.size,
                   filename: lessonVideo.filename
                 });
               }
              return lesson;
            });
          }
          return section;
        });
      }

      // Update content flags based on actual file availability
      const contentFlags = {
        ...course.contentFlags,
        hasVideo: !!(files.previewVideo || Object.keys(files.lessonVideos).length > 0),
        hasDocuments: files.documents.length > 0,
        hasMaterials: files.materials.length > 0
      };
      course.contentFlags = contentFlags;

      return course;
    } catch (error) {
      logger.warn('Failed to enrich course with files:', error);
      return course;
    }
  }

  // Get course by ID with enrollment check (enhanced to use complete data)
  async getCourseWithEnrollment(courseId: string, userId?: string): Promise<{
    course: Course;
    isEnrolled: boolean;
    enrollmentId?: string;
  }> {
    try {
      const course = await this.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      let isEnrolled = false;
      let enrollmentId: string | undefined = undefined;

      if (userId) {
        // Check if user is enrolled
        const enrollmentResult = await databases.enrollments.view('enrollments', 'by_user', {
          key: userId,
          include_docs: true,
        });

        const enrollment = enrollmentResult.rows.find(row => 
          row.doc && (row.doc as any).courseId === courseId
        );

        if (enrollment && (enrollment.doc as any).status === 'active') {
          isEnrolled = true;
          enrollmentId = enrollment.doc!._id;
        }
      }

      // Apply URL validation and fixing
      const enrichedCourse = await this.validateAndFixFileUrls(course);

      const returnValue: {
        course: Course;
        isEnrolled: boolean;
        enrollmentId?: string;
      } = {
        course: enrichedCourse,
        isEnrolled,
      };

      if (enrollmentId) {
        returnValue.enrollmentId = enrollmentId;
      }

      return returnValue;
    } catch (error) {
      logger.error('Failed to get course with enrollment:', { courseId, userId, error });
      throw error;
    }
  }

  // Enhanced search courses with advanced filtering
  async searchCourses(options: {
    searchTerm: string;
    page?: number;
    limit?: number;
    category?: string;
    level?: 'beginner' | 'intermediate' | 'advanced';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    status?: string;
  }): Promise<{
    courses: Course[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const searchTerm = options.searchTerm.toLowerCase();

      logger.info('Searching courses:', { searchTerm, options });

      // Get all published courses first
      let courses: Course[];
      try {
        courses = await this.getAllCourses();
      } catch (error) {
        logger.warn('Failed to get all courses, using fallback:', error);
        const result = await this.findAll({ limit: 1000 });
        courses = result.docs;
      }

      // Filter by status (default to published)
      const status = options.status || 'published';
      courses = courses.filter(course => course.status === status);

      // Apply search filter
      courses = courses.filter(course => {
        const searchableText = [
          course.title,
          course.description,
          course.shortDescription,
          course.instructorName,
          ...(course.tags || []),
          ...(course.learningObjectives || []),
          course.category,
          course.level,
        ]
          .filter(text => text)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(searchTerm);
      });

      // Apply additional filters
      if (options.category) {
        courses = courses.filter(course => course.category === options.category);
      }

      if (options.level) {
        courses = courses.filter(course => course.level === options.level);
      }

      // Sort courses
      const sortBy = options.sortBy || 'relevance';
      const sortOrder = options.sortOrder || 'desc';

      courses.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (sortBy) {
          case 'relevance':
            // Calculate relevance score based on title match priority
            aValue = a.title.toLowerCase().includes(searchTerm) ? 2 : 1;
            bValue = b.title.toLowerCase().includes(searchTerm) ? 2 : 1;
            if (aValue === bValue) {
              // Secondary sort by rating and enrollment
              aValue = (a.rating?.average || 0) * (a.enrollmentCount || 0);
              bValue = (b.rating?.average || 0) * (b.enrollmentCount || 0);
            }
            break;
          case 'rating':
            aValue = a.rating?.average || 0;
            bValue = b.rating?.average || 0;
            break;
          case 'enrollment':
            aValue = a.enrollmentCount || 0;
            bValue = b.enrollmentCount || 0;
            break;
          case 'created':
            aValue = new Date(a.createdAt || '').getTime();
            bValue = new Date(b.createdAt || '').getTime();
            break;
          case 'title':
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          default:
            aValue = new Date(a.createdAt || '').getTime();
            bValue = new Date(b.createdAt || '').getTime();
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });

      // Apply pagination
      const total = courses.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedCourses = courses.slice(startIndex, endIndex);

      logger.info('Search completed:', {
        searchTerm,
        totalFound: total,
        returned: paginatedCourses.length,
        page,
        limit
      });

      return {
        courses: paginatedCourses,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to search courses:', { options, error });
      throw error;
    }
  }

  // Get popular courses based on enrollment and rating
  async getPopularCourses(options: {
    limit?: number;
    category?: string;
    timeframe?: string;
  }): Promise<{
    courses: Course[];
    metadata: {
      timeframe: string;
      category: string;
      sortedBy: string;
      criteria: string;
    };
  }> {
    try {
      const limit = options.limit || 10;
      const category = options.category;
      const timeframe = options.timeframe || '30days';

      logger.info('Getting popular courses:', { limit, category, timeframe });

      // Get all published courses
      let courses: Course[];
      try {
        courses = await this.getAllCourses();
      } catch (error) {
        logger.warn('Failed to get all courses, using fallback:', error);
        const result = await this.findAll({ limit: 1000 });
        courses = result.docs;
      }

      // Filter published courses only
      let filteredCourses = courses.filter(course => course.status === 'published');

      // Apply category filter if specified
      if (category) {
        filteredCourses = filteredCourses.filter(course => course.category === category);
      }

      // Apply timeframe filter (based on creation date for now)
      if (timeframe !== 'all') {
        const now = new Date();
        let cutoffDate: Date;

        switch (timeframe) {
          case '7days':
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90days':
            cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            cutoffDate = new Date(0); // All time
        }

        filteredCourses = filteredCourses.filter(course => {
          const courseDate = new Date(course.createdAt || '');
          return courseDate >= cutoffDate;
        });
      }

      // Calculate popularity score and sort
      const coursesWithScore = filteredCourses.map(course => {
        // Popularity algorithm: combination of enrollment count, rating, and recency
        const enrollmentScore = (course.enrollmentCount || 0) * 2;
        const ratingScore = (course.rating?.average || 0) * (course.rating?.count || 1);
        const recencyScore = Math.max(0, 100 - Math.floor(
          (Date.now() - new Date(course.createdAt || '').getTime()) / (1000 * 60 * 60 * 24)
        )); // Decreases over time

        const popularityScore = enrollmentScore + ratingScore + (recencyScore * 0.1);

        return {
          ...course,
          popularityScore,
        };
      });

      // Sort by popularity score (descending) and take top results
      coursesWithScore.sort((a, b) => b.popularityScore - a.popularityScore);
      const popularCourses = coursesWithScore.slice(0, limit);

      logger.info('Popular courses calculated:', {
        totalCourses: filteredCourses.length,
        returned: popularCourses.length,
        category: category || 'all',
        timeframe
      });

      return {
        courses: popularCourses,
        metadata: {
          timeframe: timeframe,
          category: category || 'all',
          sortedBy: 'popularity',
          criteria: 'enrollment_count_and_rating',
        },
      };
    } catch (error) {
      logger.error('Failed to get popular courses:', { options, error });
      throw error;
    }
  }

  // Update course enrollment count
  async updateEnrollmentCount(courseId: string, increment: number = 1): Promise<Course> {
    try {
      const course = await this.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const newCount = Math.max(0, (course.enrollmentCount || 0) + increment);
      
      return await this.update(courseId, { 
        enrollmentCount: newCount 
      } as Partial<Course>);
    } catch (error) {
      logger.error('Failed to update enrollment count:', { courseId, increment, error });
      throw error;
    }
  }

  // Update course rating (from external reviews)
  async updateRating(courseId: string, newRating: number): Promise<Course> {
    try {
      const course = await this.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const currentRating = course.rating;
      const newCount = currentRating.count + 1;
      const newAverage = ((currentRating.average * currentRating.count) + newRating) / newCount;

      // Update distribution
      const newDistribution = { ...currentRating.distribution };
      newDistribution[newRating as keyof typeof newDistribution]++;

      return await this.update(courseId, {
        rating: {
          average: Math.round(newAverage * 10) / 10,
          count: newCount,
          distribution: newDistribution,
        },
      } as Partial<Course>);
    } catch (error) {
      logger.error('Failed to update course rating:', { courseId, newRating, error });
      throw error;
    }
  }

  // Get all courses (for admin purposes) - includes all statuses
  async getAllCourses(): Promise<Course[]> {
    try {
      logger.info('Fetching all courses for admin dashboard');
      
      // Try using the all_courses view first
      try {
        const result = await databases.courses.view('courses', 'all_courses', {
          include_docs: true,
          limit: 10000, // Increase limit for comprehensive data
        });

        const courses = result.rows.map(row => {
          const course = row.doc as Course;
          // Ensure id is set for consistency
          if (!course.id && course._id) {
            course.id = course._id;
          }
          return course;
        });

        logger.info('Successfully fetched courses via view:', { count: courses.length });
        return courses;
      } catch (viewError) {
        logger.warn('Failed to find courses via view, falling back to direct query', viewError);
        
        // Fallback: use direct query with proper error handling
        const result = await databases.courses.find({
          selector: { type: 'course' },
          limit: 10000,
          sort: [{ createdAt: 'desc' }] // Sort by creation date
        });
        
        const courses = result.docs.map(doc => {
          const course = doc as Course;
          // Ensure id is set for consistency
          if (!course.id && course._id) {
            course.id = course._id;
          }
          return course;
        });

        logger.info('Successfully fetched courses via fallback query:', { count: courses.length });
        return courses;
      }
    } catch (error) {
      logger.error('Failed to fetch courses with all methods:', error);
      throw new Error('Unable to fetch courses from database');
    }
  }

  // Get course categories with counts
  async getCourseCategories(): Promise<Array<{ category: string; count: number }>> {
    try {
      logger.info('Getting course categories');

      // Get all published courses
      let courses: Course[];
      try {
        courses = await this.getAllCourses();
      } catch (error) {
        logger.warn('Failed to get all courses, using fallback:', error);
        const result = await this.findAll({ limit: 1000 });
        courses = result.docs;
      }

      // Filter published courses only
      const publishedCourses = courses.filter(course => course.status === 'published');

      // Count courses by category
      const categoryCount = new Map<string, number>();

      publishedCourses.forEach(course => {
        const category = course.category || 'uncategorized';
        categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
      });

      // Convert to array and sort by count (descending)
      const categories = Array.from(categoryCount.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      logger.info('Categories found:', { 
        totalCategories: categories.length,
        totalPublishedCourses: publishedCourses.length 
      });

      return categories;
    } catch (error) {
      logger.error('Failed to get course categories:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive course statistics
   */
  async getCourseStats(courseId: string): Promise<{
    enrollments: number;
    completions: number;
    completionRate: number;
    averageRating: number;
    totalRevenue: number;
    totalWatchTime: number;
    engagementMetrics: {
      dailyActiveUsers: number;
      weeklyActiveUsers: number;
      monthlyActiveUsers: number;
      averageSessionDuration: number;
      dropoffRate: number;
    };
    performanceMetrics: {
      averageQuizScore: number;
      passRate: number;
      certificatesIssued: number;
    };
  }> {
    try {
      const course = await this.findById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      // Get basic course metrics
      const enrollmentCount = course.enrollmentCount || 0;
      const completionCount = course.completionCount || 0;
      const completionRate = enrollmentCount > 0 ? (completionCount / enrollmentCount) * 100 : 0;
      const averageRating = course.rating?.average || 0;
      const totalRevenue = course.revenue || 0;

      // Get metrics from course object or use defaults
      const metrics = course.metrics || {
        views: 0,
        completionRate: 0,
        avgTimeToComplete: 0,
        dropoffPoints: [],
        engagement: {
          avgSessionDuration: 0,
          returnRate: 0,
          discussionPosts: 0
        },
        performance: {
          avgQuizScore: 0,
          assignmentSubmissionRate: 0,
          certificateEarnedRate: 0
        }
      };

      // Calculate engagement metrics
      const engagementMetrics = {
        dailyActiveUsers: Math.round(enrollmentCount * 0.1), // Estimated 10% daily active
        weeklyActiveUsers: Math.round(enrollmentCount * 0.3), // Estimated 30% weekly active
        monthlyActiveUsers: Math.round(enrollmentCount * 0.6), // Estimated 60% monthly active
        averageSessionDuration: metrics.engagement?.avgSessionDuration || 0,
        dropoffRate: metrics.dropoffPoints?.length || 0,
      };

      // Calculate performance metrics
      const performanceMetrics = {
        averageQuizScore: metrics.performance?.avgQuizScore || 0,
        passRate: completionRate,
        certificatesIssued: Math.round(completionCount * (metrics.performance?.certificateEarnedRate || 0.8)),
      };

      return {
        enrollments: enrollmentCount,
        completions: completionCount,
        completionRate: Math.round(completionRate * 100) / 100,
        averageRating: Math.round(averageRating * 100) / 100,
        totalRevenue: totalRevenue,
        totalWatchTime: metrics.avgTimeToComplete || 0,
        engagementMetrics,
        performanceMetrics,
      };
    } catch (error) {
      logger.error('Failed to get course stats:', error);
      throw error;
    }
  }

  // Get courses by instructor (simple method for analytics)
  async findByInstructor(instructorId: string): Promise<Course[]> {
    try {
      const result = await this.getInstructorCourses(instructorId, {
        limit: 1000 // Get all courses for this instructor
      });
      return result.courses;
    } catch (error) {
      logger.error('Failed to find courses by instructor:', error);
      return [];
    }
  }
}

export const courseModel = new CourseModel();
export default courseModel; 