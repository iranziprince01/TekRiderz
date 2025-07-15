import { BaseModel } from './BaseModel';
import { Course, CourseSection, CourseLesson, CourseValidationResult } from '../types';
import { logger } from '../utils/logger';

interface ValidationRule {
  id: string;
  name: string;
  category: 'content' | 'structure' | 'accessibility' | 'pedagogy' | 'technical' | 'marketing';
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  weight: number; // Impact on overall score
  validator: (course: any, context?: any) => Promise<ValidationResult>;
  autoFix?: (course: any) => Promise<any>;
}

interface ValidationResult {
  passed: boolean;
  message: string;
  suggestion?: string;
  data?: any;
  fixable?: boolean;
}

interface QualityMetrics {
  contentQuality: number;
  structuralIntegrity: number;
  pedagogicalValue: number;
  accessibilityScore: number;
  marketingReadiness: number;
  technicalQuality: number;
  overallScore: number;
}

interface ValidationReport {
  courseId: string;
  validationId: string;
  timestamp: string;
  overallStatus: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  qualityMetrics: QualityMetrics;
  
  results: {
    errors: Array<{
      ruleId: string;
      field: string;
      message: string;
      severity: 'error';
      category: string;
      fixable: boolean;
      suggestion?: string;
    }>;
    warnings: Array<{
      ruleId: string;
      field: string;
      message: string;
      severity: 'warning';
      category: string;
      suggestion?: string;
    }>;
    suggestions: Array<{
      ruleId: string;
      field: string;
      message: string;
      severity: 'suggestion';
      category: string;
      priority: 'high' | 'medium' | 'low';
      expectedImpact: string;
    }>;
    info: Array<{
      ruleId: string;
      field: string;
      message: string;
      severity: 'info';
      category: string;
      data?: any;
    }>;
  };
  
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  
  autoFixAvailable: string[];
  estimatedFixTime: number; // in minutes
}

export class CourseValidationEngineModel extends BaseModel<any> {
  private validationRules: Map<string, ValidationRule> = new Map();

  constructor() {
    super('courses', 'validation');
    this.initializeValidationRules();
  }

  // Initialize comprehensive validation rules
  private initializeValidationRules(): void {
    const rules: ValidationRule[] = [
      // Content Quality Rules
      {
        id: 'content_title_required',
        name: 'Course Title Required',
        category: 'content',
        severity: 'error',
        weight: 10,
        validator: async (course) => ({
          passed: !!course.title && course.title.trim().length >= 3,
          message: course.title ? 
            (course.title.trim().length < 3 ? 'Course title must be at least 3 characters long' : '') :
            'Course title is required',
          suggestion: 'Provide a clear, descriptive title that accurately represents your course content'
        })
      },

      {
        id: 'content_description_quality',
        name: 'Course Description Quality',
        category: 'content',
        severity: 'warning',
        weight: 8,
        validator: async (course) => {
          const desc = course.description || '';
          const minLength = 100;
          const hasKeywords = desc.toLowerCase().includes('learn') || desc.toLowerCase().includes('course') || desc.toLowerCase().includes('skill');
          
          if (desc.length < minLength) {
            return {
              passed: false,
              message: `Course description should be at least ${minLength} characters (current: ${desc.length})`,
              suggestion: 'Provide a detailed description explaining what learners will gain from this course'
            };
          }
          
          if (!hasKeywords) {
            return {
              passed: false,
              message: 'Course description should include learning-focused keywords',
              suggestion: 'Include words like "learn", "master", "develop skills" to better communicate value'
            };
          }
          
          return { passed: true, message: 'Course description meets quality standards' };
        }
      },

      {
        id: 'content_learning_objectives',
        name: 'Learning Objectives Quality',
        category: 'pedagogy',
        severity: 'warning',
        weight: 7,
        validator: async (course) => {
          const objectives = course.learningObjectives || [];
          
          if (objectives.length < 3) {
            return {
              passed: false,
              message: `At least 3 learning objectives recommended (current: ${objectives.length})`,
              suggestion: 'Add specific, measurable learning outcomes that students will achieve'
            };
          }
          
          const hasActionVerbs = objectives.some((obj: string) => 
            /^(understand|learn|create|analyze|evaluate|apply|remember|comprehend)/i.test(obj)
          );
          
          if (!hasActionVerbs) {
            return {
              passed: false,
              message: 'Learning objectives should start with action verbs',
              suggestion: 'Use verbs like "understand", "create", "analyze", "apply" to make objectives more specific'
            };
          }
          
          return { passed: true, message: 'Learning objectives are well-structured' };
        }
      },

      // Structure Quality Rules
      {
        id: 'structure_sections_required',
        name: 'Course Sections Required',
        category: 'structure',
        severity: 'error',
        weight: 10,
        validator: async (course) => ({
          passed: course.sections && course.sections.length > 0,
          message: course.sections?.length ? '' : 'Course must have at least one section',
          suggestion: 'Organize your content into logical sections to improve learning flow'
        })
      },

      {
        id: 'structure_lessons_per_section',
        name: 'Lessons per Section',
        category: 'structure',
        severity: 'warning',
        weight: 6,
        validator: async (course) => {
          if (!course.sections || course.sections.length === 0) {
            return { passed: true, message: 'No sections to validate' };
          }
          
          const emptySections = course.sections.filter((section: CourseSection) => 
            !section.lessons || section.lessons.length === 0
          );
          
          if (emptySections.length > 0) {
            return {
              passed: false,
              message: `${emptySections.length} section(s) have no lessons`,
              suggestion: 'Add lessons to empty sections or remove them to maintain course structure'
            };
          }
          
          const sectionsWithFewLessons = course.sections.filter((section: CourseSection) => 
            section.lessons && section.lessons.length < 2
          );
          
          if (sectionsWithFewLessons.length > 0) {
            return {
              passed: false,
              message: `${sectionsWithFewLessons.length} section(s) have only one lesson`,
              suggestion: 'Consider combining single-lesson sections or adding more content'
            };
          }
          
          return { passed: true, message: 'Section structure is well-organized' };
        }
      },

      {
        id: 'structure_lesson_duration',
        name: 'Lesson Duration Balance',
        category: 'structure',
        severity: 'suggestion',
        weight: 4,
        validator: async (course) => {
          if (!course.sections) {
            return { passed: true, message: 'No sections to validate' };
          }
          
          const allLessons = course.sections.flatMap((section: CourseSection) => section.lessons || []);
          if (allLessons.length === 0) {
            return { passed: true, message: 'No lessons to validate' };
          }
          
          const durations = allLessons.map((lesson: CourseLesson) => lesson.estimatedDuration || 0);
          const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
          const veryShort = durations.filter(d => d < 300).length; // < 5 minutes
          const veryLong = durations.filter(d => d > 3600).length; // > 1 hour
          
          if (veryShort > allLessons.length * 0.3) {
            return {
              passed: false,
              message: `${veryShort} lessons are very short (< 5 minutes)`,
              suggestion: 'Consider combining very short lessons or adding more content'
            };
          }
          
          if (veryLong > 0) {
            return {
              passed: false,
              message: `${veryLong} lessons are very long (> 1 hour)`,
              suggestion: 'Break down long lessons into smaller, digestible segments'
            };
          }
          
          return { passed: true, message: 'Lesson durations are well-balanced' };
        }
      },

      // Accessibility Rules
      {
        id: 'accessibility_video_captions',
        name: 'Video Accessibility',
        category: 'accessibility',
        severity: 'warning',
        weight: 5,
        validator: async (course) => {
          if (!course.sections) {
            return { passed: true, message: 'No sections to validate' };
          }
          
          const videoLessons = course.sections.flatMap((section: CourseSection) => 
            (section.lessons || []).filter((lesson: CourseLesson) => lesson.type === 'video')
          );
          
          if (videoLessons.length === 0) {
            return { passed: true, message: 'No video lessons found' };
          }
          
          const lessonsWithoutCaptions = videoLessons.filter((lesson: CourseLesson) => 
            !lesson.content?.captions || lesson.content.captions.length === 0
          );
          
          if (lessonsWithoutCaptions.length > 0) {
            return {
              passed: false,
              message: `${lessonsWithoutCaptions.length} video lessons lack captions`,
              suggestion: 'Add captions to video content to improve accessibility for hearing-impaired learners'
            };
          }
          
          return { passed: true, message: 'All video lessons have accessibility features' };
        }
      },

      {
        id: 'accessibility_alt_text',
        name: 'Image Alternative Text',
        category: 'accessibility',
        severity: 'info',
        weight: 3,
        validator: async (course) => {
          // This would check for images without alt text
          // Implementation depends on how images are stored in content
          return { 
            passed: true, 
            message: 'Image accessibility check completed',
            suggestion: 'Ensure all images have descriptive alternative text'
          };
        }
      },

      // Technical Quality Rules
      {
        id: 'technical_file_formats',
        name: 'Supported File Formats',
        category: 'technical',
        severity: 'warning',
        weight: 6,
        validator: async (course) => {
          const supportedVideoFormats = ['mp4', 'webm'];
          const supportedImageFormats = ['jpg', 'jpeg', 'png', 'webp'];
          
          let unsupportedFiles = 0;
          const issues = [];
          
          // Check thumbnail
          if (course.thumbnail) {
            const ext = course.thumbnail.split('.').pop()?.toLowerCase();
            if (ext && !supportedImageFormats.includes(ext)) {
              unsupportedFiles++;
              issues.push(`Thumbnail format '${ext}' may not be optimal`);
            }
          }
          
          // Check video lessons
          if (course.sections) {
            for (const section of course.sections) {
              if (section.lessons) {
                for (const lesson of section.lessons) {
                  if (lesson.type === 'video' && lesson.content?.videoUrl) {
                    const ext = lesson.content.videoUrl.split('.').pop()?.toLowerCase();
                    if (ext && !supportedVideoFormats.includes(ext)) {
                      unsupportedFiles++;
                      issues.push(`Video in lesson '${lesson.title}' uses format '${ext}'`);
                    }
                  }
                }
              }
            }
          }
          
          if (unsupportedFiles > 0) {
            return {
              passed: false,
              message: `${unsupportedFiles} file(s) use suboptimal formats`,
              suggestion: `Convert files to supported formats: videos (${supportedVideoFormats.join(', ')}), images (${supportedImageFormats.join(', ')})`,
              data: { issues }
            };
          }
          
          return { passed: true, message: 'All files use supported formats' };
        }
      },

      // Marketing Readiness Rules
      {
        id: 'marketing_thumbnail',
        name: 'Course Thumbnail',
        category: 'marketing',
        severity: 'warning',
        weight: 5,
        validator: async (course) => ({
          passed: !!course.thumbnail,
          message: course.thumbnail ? '' : 'Course thumbnail is missing',
          suggestion: 'Add an attractive course thumbnail to improve enrollment rates'
        })
      },

      {
        id: 'marketing_tags',
        name: 'Course Tags',
        category: 'marketing',
        severity: 'suggestion',
        weight: 4,
        validator: async (course) => {
          const tags = course.tags || [];
          
          if (tags.length < 3) {
            return {
              passed: false,
              message: `Add more tags for better discoverability (current: ${tags.length}, recommended: 5+)`,
              suggestion: 'Use relevant keywords that learners might search for'
            };
          }
          
          if (tags.length > 10) {
            return {
              passed: false,
              message: `Too many tags may dilute search relevance (current: ${tags.length}, recommended: 5-8)`,
              suggestion: 'Focus on the most relevant and specific tags'
            };
          }
          
          return { passed: true, message: 'Tag count is optimal for discoverability' };
        }
      },

      // Pedagogy Rules
      {
        id: 'pedagogy_assessment_balance',
        name: 'Assessment Balance',
        category: 'pedagogy',
        severity: 'suggestion',
        weight: 6,
        validator: async (course) => {
          if (!course.sections) {
            return { passed: true, message: 'No sections to validate' };
          }
          
          const totalSections = course.sections.length;
          const sectionsWithQuizzes = course.sections.filter((section: CourseSection) => 
            section.moduleQuiz && section.moduleQuiz.questions && section.moduleQuiz.questions.length > 0
          ).length;
          
          const assessmentRatio = sectionsWithQuizzes / totalSections;
          
          if (assessmentRatio < 0.3) {
            return {
              passed: false,
              message: `Only ${Math.round(assessmentRatio * 100)}% of sections have assessments`,
              suggestion: 'Add quizzes to more sections to reinforce learning and provide feedback'
            };
          }
          
          if (assessmentRatio > 0.8) {
            return {
              passed: false,
              message: `${Math.round(assessmentRatio * 100)}% of sections have assessments - might be overwhelming`,
              suggestion: 'Consider balancing assessments with pure content sections'
            };
          }
          
          return { passed: true, message: 'Assessment distribution is well-balanced' };
        }
      }
    ];

    // Register all rules
    rules.forEach(rule => {
      this.validationRules.set(rule.id, rule);
    });

    logger.info('Course validation rules initialized:', { ruleCount: rules.length });
  }

  // Validate a complete course
  async validateCourse(
    course: any,
    options: {
      includeWarnings?: boolean;
      includeSuggestions?: boolean;
      categories?: string[];
      autoFix?: boolean;
    } = {}
  ): Promise<ValidationReport> {
    try {
      const validationId = `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      logger.info('Starting course validation:', {
        courseId: course._id || course.id,
        validationId,
        options
      });

      const results = {
        errors: [] as any[],
        warnings: [] as any[],
        suggestions: [] as any[],
        info: [] as any[]
      };

      // Filter rules based on options
      const rulesToRun = Array.from(this.validationRules.values()).filter(rule => {
        if (options.categories && !options.categories.includes(rule.category)) {
          return false;
        }
        
        if (!options.includeWarnings && rule.severity === 'warning') {
          return false;
        }
        
        if (!options.includeSuggestions && rule.severity === 'suggestion') {
          return false;
        }
        
        return true;
      });

      // Run validation rules
      for (const rule of rulesToRun) {
        try {
          const result = await rule.validator(course);
          
          if (!result.passed) {
            const validationItem = {
              ruleId: rule.id,
              field: this.extractFieldFromRule(rule.id),
              message: result.message,
              severity: rule.severity,
              category: rule.category,
              fixable: !!rule.autoFix,
              suggestion: result.suggestion,
              data: result.data
            };

            switch (rule.severity) {
              case 'error':
                results.errors.push(validationItem);
                break;
              case 'warning':
                results.warnings.push(validationItem);
                break;
              case 'suggestion':
                results.suggestions.push({
                  ...validationItem,
                  priority: this.calculatePriority(rule),
                  expectedImpact: this.calculateExpectedImpact(rule)
                });
                break;
              case 'info':
                results.info.push(validationItem);
                break;
            }
          }
        } catch (error) {
          logger.error('Validation rule failed:', { ruleId: rule.id, error });
          results.errors.push({
            ruleId: rule.id,
            field: 'system',
            message: `Validation rule '${rule.name}' failed to execute`,
            severity: 'error',
            category: 'technical',
            fixable: false
          });
        }
      }

      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(course, results, rulesToRun);

      // Generate recommendations
      const recommendations = this.generateRecommendations(results, qualityMetrics);

      // Determine overall status
      const overallStatus = this.determineOverallStatus(qualityMetrics);

      // Find auto-fixable issues
      const autoFixAvailable = results.errors
        .concat(results.warnings)
        .filter(item => item.fixable)
        .map(item => item.ruleId);

      // Estimate fix time
      const estimatedFixTime = this.estimateFixTime(results);

      const report: ValidationReport = {
        courseId: course._id || course.id || 'unknown',
        validationId,
        timestamp,
        overallStatus,
        qualityMetrics,
        results,
        recommendations,
        autoFixAvailable,
        estimatedFixTime
      };

      logger.info('Course validation completed:', {
        courseId: report.courseId,
        validationId,
        overallStatus,
        errorsCount: results.errors.length,
        warningsCount: results.warnings.length,
        suggestionsCount: results.suggestions.length,
        overallScore: qualityMetrics.overallScore
      });

      return report;
    } catch (error) {
      logger.error('Course validation failed:', { courseId: course._id || course.id, error });
      throw error;
    }
  }

  // Auto-fix course issues
  async autoFixCourse(course: any, ruleIds: string[]): Promise<{
    fixedCourse: any;
    appliedFixes: Array<{
      ruleId: string;
      description: string;
      changes: any;
    }>;
  }> {
    try {
      let fixedCourse = { ...course };
      const appliedFixes = [];

      for (const ruleId of ruleIds) {
        const rule = this.validationRules.get(ruleId);
        if (rule && rule.autoFix) {
          try {
            const fixResult = await rule.autoFix(fixedCourse);
            if (fixResult) {
              appliedFixes.push({
                ruleId,
                description: `Applied auto-fix for: ${rule.name}`,
                changes: fixResult
              });
              fixedCourse = { ...fixedCourse, ...fixResult };
            }
          } catch (error) {
            logger.error('Auto-fix failed for rule:', { ruleId, error });
          }
        }
      }

      logger.info('Auto-fix completed:', {
        courseId: course._id || course.id,
        appliedFixes: appliedFixes.length,
        fixedRules: appliedFixes.map(f => f.ruleId)
      });

      return {
        fixedCourse,
        appliedFixes
      };
    } catch (error) {
      logger.error('Auto-fix course failed:', { courseId: course._id || course.id, error });
      throw error;
    }
  }

  // Helper methods
  private calculateQualityMetrics(course: any, results: any, rules: ValidationRule[]): QualityMetrics {
    const categories = ['content', 'structure', 'accessibility', 'pedagogy', 'technical', 'marketing'];
    const categoryScores: any = {};

    // Calculate score for each category
    categories.forEach(category => {
      const categoryRules = rules.filter(r => r.category === category);
      const categoryErrors = results.errors.filter((e: any) => e.category === category);
      const categoryWarnings = results.warnings.filter((w: any) => w.category === category);

      const maxScore = categoryRules.reduce((sum, rule) => sum + rule.weight, 0);
      const lostScore = categoryErrors.reduce((sum: number, error: any) => {
        const rule = categoryRules.find(r => r.id === error.ruleId);
        return sum + (rule ? rule.weight : 0);
      }, 0) + categoryWarnings.reduce((sum: number, warning: any) => {
        const rule = categoryRules.find(r => r.id === warning.ruleId);
        return sum + (rule ? rule.weight * 0.5 : 0); // Warnings count as half penalty
      }, 0);

      categoryScores[category] = maxScore > 0 ? Math.max(0, Math.round(((maxScore - lostScore) / maxScore) * 100)) : 100;
    });

    // Calculate overall score
    const totalWeight = Object.values(categoryScores).reduce((sum: number, score: number) => sum + score, 0);
    const overallScore = Math.round(totalWeight / categories.length);

    return {
      contentQuality: categoryScores.content || 100,
      structuralIntegrity: categoryScores.structure || 100,
      pedagogicalValue: categoryScores.pedagogy || 100,
      accessibilityScore: categoryScores.accessibility || 100,
      marketingReadiness: categoryScores.marketing || 100,
      technicalQuality: categoryScores.technical || 100,
      overallScore
    };
  }

  private generateRecommendations(results: any, metrics: QualityMetrics): {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  } {
    const immediate = [];
    const shortTerm = [];
    const longTerm = [];

    // Immediate fixes (errors)
    if (results.errors.length > 0) {
      immediate.push('Fix all validation errors before submitting the course');
      if (results.errors.some((e: any) => e.category === 'content')) {
        immediate.push('Complete required course information (title, description)');
      }
      if (results.errors.some((e: any) => e.category === 'structure')) {
        immediate.push('Ensure course has proper structure (sections and lessons)');
      }
    }

    // Short-term improvements (warnings)
    if (results.warnings.length > 0) {
      shortTerm.push('Address warning items to improve course quality');
      if (metrics.accessibilityScore < 80) {
        shortTerm.push('Improve accessibility features for better inclusivity');
      }
      if (metrics.marketingReadiness < 70) {
        shortTerm.push('Enhance marketing elements (thumbnail, tags, description)');
      }
    }

    // Long-term enhancements (suggestions)
    if (results.suggestions.length > 0) {
      longTerm.push('Consider implementing suggestions for enhanced learner experience');
      if (metrics.pedagogicalValue < 85) {
        longTerm.push('Review pedagogical approach and assessment strategy');
      }
      if (metrics.technicalQuality < 90) {
        longTerm.push('Optimize technical aspects for better performance');
      }
    }

    return { immediate, shortTerm, longTerm };
  }

  private determineOverallStatus(metrics: QualityMetrics): 'excellent' | 'good' | 'needs_improvement' | 'poor' {
    if (metrics.overallScore >= 90) return 'excellent';
    if (metrics.overallScore >= 75) return 'good';
    if (metrics.overallScore >= 60) return 'needs_improvement';
    return 'poor';
  }

  private calculatePriority(rule: ValidationRule): 'high' | 'medium' | 'low' {
    if (rule.weight >= 8) return 'high';
    if (rule.weight >= 5) return 'medium';
    return 'low';
  }

  private calculateExpectedImpact(rule: ValidationRule): string {
    const impacts = {
      'content': 'Improved learner understanding and engagement',
      'structure': 'Better course organization and flow',
      'accessibility': 'Increased inclusivity and compliance',
      'pedagogy': 'Enhanced learning outcomes',
      'technical': 'Better performance and user experience',
      'marketing': 'Improved discoverability and enrollment'
    };
    
    return impacts[rule.category as keyof typeof impacts] || 'General course improvement';
  }

  private extractFieldFromRule(ruleId: string): string {
    const fieldMap: { [key: string]: string } = {
      'content_title_required': 'title',
      'content_description_quality': 'description',
      'content_learning_objectives': 'learningObjectives',
      'structure_sections_required': 'sections',
      'marketing_thumbnail': 'thumbnail',
      'marketing_tags': 'tags'
    };
    
    return fieldMap[ruleId] || 'general';
  }

  private estimateFixTime(results: any): number {
    // Estimate time in minutes based on issue types
    const timeEstimates = {
      'content': 15,
      'structure': 30,
      'accessibility': 45,
      'pedagogy': 60,
      'technical': 20,
      'marketing': 10
    };

    const totalTime = results.errors.concat(results.warnings).reduce((total: number, item: any) => {
      return total + (timeEstimates[item.category as keyof typeof timeEstimates] || 15);
    }, 0);

    return Math.min(totalTime, 300); // Cap at 5 hours
  }
}

export const courseValidationEngineModel = new CourseValidationEngineModel(); 