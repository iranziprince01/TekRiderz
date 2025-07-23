import { progressService } from '../services/progressService';

/**
 * Test utility to verify progress tracking functionality
 */
export const testProgressTracking = async (userId: string, courseId: string) => {
  console.log('🧪 Testing progress tracking system...');
  
  try {
    // Test 1: Get unified progress
    console.log('📊 Test 1: Getting unified progress...');
    const progress = await progressService.getUnifiedProgress(userId, courseId);
    console.log('✅ Unified progress:', progress);
    
    // Test 2: Mark a lesson complete
    console.log('📝 Test 2: Marking lesson complete...');
    const testLessonId = `test_lesson_${Date.now()}`;
    const markSuccess = await progressService.markLessonComplete(userId, courseId, testLessonId, 120);
    console.log('✅ Mark lesson complete result:', markSuccess);
    
    // Test 3: Update lesson progress
    console.log('📈 Test 3: Updating lesson progress...');
    const updateSuccess = await progressService.updateLessonProgress(userId, courseId, testLessonId, 75, 90, 45);
    console.log('✅ Update lesson progress result:', updateSuccess);
    
    // Test 4: Get progress again to verify changes
    console.log('🔄 Test 4: Verifying progress changes...');
    const updatedProgress = await progressService.getUnifiedProgress(userId, courseId);
    console.log('✅ Updated progress:', updatedProgress);
    
    console.log('🎉 All progress tracking tests completed successfully!');
    return {
      success: true,
      initialProgress: progress,
      markSuccess,
      updateSuccess,
      finalProgress: updatedProgress
    };
  } catch (error) {
    console.error('❌ Progress tracking test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Test utility to verify course progress calculation
 */
export const testCourseProgressCalculation = (courseData: any) => {
  console.log('🧮 Testing course progress calculation...');
  
  try {
    const { course, modules, userProgress } = courseData;
    
    // Calculate expected progress
    const totalLessons = modules?.length || 0;
    const completedLessons = modules?.filter((m: any) => m.isCompleted)?.length || 0;
    const expectedProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    
    // Compare with actual progress
    const actualProgress = userProgress?.overallProgress || 0;
    const actualCompleted = userProgress?.completedLessons || 0;
    const actualTotal = userProgress?.totalLessons || 0;
    
    console.log('📊 Progress calculation results:', {
      courseId: course?.id,
      courseTitle: course?.title,
      totalLessons,
      completedLessons,
      expectedProgress,
      actualProgress,
      actualCompleted,
      actualTotal,
      progressConsistent: expectedProgress === actualProgress,
      countsConsistent: totalLessons === actualTotal && completedLessons === actualCompleted
    });
    
    return {
      success: true,
      totalLessons,
      completedLessons,
      expectedProgress,
      actualProgress,
      progressConsistent: expectedProgress === actualProgress,
      countsConsistent: totalLessons === actualTotal && completedLessons === actualCompleted
    };
  } catch (error) {
    console.error('❌ Course progress calculation test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Test utility to verify progress persistence
 */
export const testProgressPersistence = async (userId: string, courseId: string) => {
  console.log('💾 Testing progress persistence...');
  
  try {
    // Get initial progress
    const initialProgress = await progressService.getUnifiedProgress(userId, courseId);
    console.log('📊 Initial progress:', initialProgress);
    
    // Mark a lesson complete
    const testLessonId = `persistence_test_${Date.now()}`;
    await progressService.markLessonComplete(userId, courseId, testLessonId, 60);
    
    // Get progress again
    const updatedProgress = await progressService.getUnifiedProgress(userId, courseId);
    console.log('📊 Updated progress:', updatedProgress);
    
    // Verify the lesson was marked complete
    const lessonCompleted = updatedProgress?.lessons[testLessonId]?.isCompleted;
    
    console.log('✅ Persistence test results:', {
      lessonCompleted,
      progressPersisted: !!updatedProgress,
      lessonFound: !!updatedProgress?.lessons[testLessonId]
    });
    
    return {
      success: true,
      initialProgress,
      updatedProgress,
      lessonCompleted,
      progressPersisted: !!updatedProgress
    };
  } catch (error) {
    console.error('❌ Progress persistence test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Export test functions for use in development
export const runAllProgressTests = async (userId: string, courseId: string, courseData?: any) => {
  console.log('🚀 Running all progress tracking tests...');
  
  const results = {
    tracking: await testProgressTracking(userId, courseId),
    persistence: await testProgressPersistence(userId, courseId),
    calculation: courseData ? testCourseProgressCalculation(courseData) : { success: false, error: 'No course data provided' }
  };
  
  const allPassed = results.tracking.success && results.persistence.success && results.calculation.success;
  
  console.log('📋 Test Results Summary:', {
    allPassed,
    trackingTest: results.tracking.success ? '✅ PASSED' : '❌ FAILED',
    persistenceTest: results.persistence.success ? '✅ PASSED' : '❌ FAILED',
    calculationTest: results.calculation.success ? '✅ PASSED' : '❌ FAILED'
  });
  
  return {
    success: allPassed,
    results
  };
}; 