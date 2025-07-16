import api from './api';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  duration: number;
  details: string;
  data?: any;
}

interface PerformanceMetrics {
  apiResponseTime: number;
  componentRenderTime: number;
  memoryUsage: number;
  networkRequests: number;
  errorRate: number;
}

interface IntegrationTestSuite {
  name: string;
  tests: (() => Promise<TestResult>)[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

class IntegrationTestRunner {
  private results: TestResult[] = [];
  private performance: PerformanceMetrics = {
    apiResponseTime: 0,
    componentRenderTime: 0,
    memoryUsage: 0,
    networkRequests: 0,
    errorRate: 0
  };

  async runTest(testFunction: () => Promise<TestResult>): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      const result = await testFunction();
      result.duration = performance.now() - startTime;
      this.results.push(result);
      return result;
    } catch (error) {
      const failedResult: TestResult = {
        name: 'Unknown Test',
        status: 'fail',
        duration: performance.now() - startTime,
        details: `Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      this.results.push(failedResult);
      return failedResult;
    }
  }

  async runSuite(suite: IntegrationTestSuite): Promise<TestResult[]> {
    console.log(`Running test suite: ${suite.name}`);
    
    // Setup
    if (suite.setup) {
      await suite.setup();
    }

    const suiteResults: TestResult[] = [];

    // Run tests
    for (const test of suite.tests) {
      const result = await this.runTest(test);
      suiteResults.push(result);
    }

    // Teardown
    if (suite.teardown) {
      await suite.teardown();
    }

    return suiteResults;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.performance;
  }

  generateReport(): string {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    
    return `
Integration Test Report
======================
Total Tests: ${this.results.length}
Passed: ${passed}
Failed: ${failed}
Warnings: ${warnings}
Success Rate: ${((passed / this.results.length) * 100).toFixed(2)}%

Performance Metrics:
- Average API Response Time: ${this.performance.apiResponseTime.toFixed(2)}ms
- Component Render Time: ${this.performance.componentRenderTime.toFixed(2)}ms
- Memory Usage: ${this.performance.memoryUsage.toFixed(2)}MB
- Network Requests: ${this.performance.networkRequests}
- Error Rate: ${this.performance.errorRate.toFixed(2)}%

Failed Tests:
${this.results.filter(r => r.status === 'fail').map(r => `- ${r.name}: ${r.details}`).join('\n')}
`;
  }
}

// Test Suites
export const authenticationTestSuite: IntegrationTestSuite = {
  name: 'Authentication Tests',
  tests: [
    async (): Promise<TestResult> => {
      try {
        const response = await api.healthCheck();
        return {
          name: 'API Health Check',
          status: response.success ? 'pass' : 'fail',
          duration: 0,
          details: response.success ? 'API is healthy' : 'API health check failed'
        };
      } catch (error) {
        return {
          name: 'API Health Check',
          status: 'fail',
          duration: 0,
          details: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },

    async (): Promise<TestResult> => {
      try {
        // Test login with mock credentials
        const startTime = performance.now();
        const response = await api.login('test@example.com', 'password');
        const duration = performance.now() - startTime;
        
        return {
          name: 'User Login',
          status: response.success ? 'pass' : 'fail',
          duration,
          details: response.success ? 'Login successful' : 'Login failed',
          data: { responseTime: duration }
        };
      } catch (error) {
        return {
          name: 'User Login',
          status: 'fail',
          duration: 0,
          details: `Login test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },

    async (): Promise<TestResult> => {
      try {
        const response = await api.getCurrentUser();
        return {
          name: 'Get Current User',
          status: response.success ? 'pass' : 'fail',
          duration: 0,
          details: response.success ? 'User data retrieved' : 'Failed to get user data'
        };
      } catch (error) {
        return {
          name: 'Get Current User',
          status: 'fail',
          duration: 0,
          details: `Get user test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  ]
};

export const courseManagementTestSuite: IntegrationTestSuite = {
  name: 'Course Management Tests',
  tests: [
    async (): Promise<TestResult> => {
      try {
        const startTime = performance.now();
        const response = await api.getCourses();
        const duration = performance.now() - startTime;
        
        return {
          name: 'Get Courses',
          status: response.success ? 'pass' : 'fail',
          duration,
          details: response.success ? `Retrieved ${response.data?.courses?.length || 0} courses` : 'Failed to get courses',
          data: { responseTime: duration, coursesCount: response.data?.courses?.length || 0 }
        };
      } catch (error) {
        return {
          name: 'Get Courses',
          status: 'fail',
          duration: 0,
          details: `Get courses test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },

    async (): Promise<TestResult> => {
      try {
        const response = await api.getPublishedCourses();
        return {
          name: 'Get Published Courses',
          status: response.success ? 'pass' : 'fail',
          duration: 0,
          details: response.success ? 'Published courses retrieved' : 'Failed to get published courses'
        };
      } catch (error) {
        return {
          name: 'Get Published Courses',
          status: 'fail',
          duration: 0,
          details: `Published courses test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },

    async (): Promise<TestResult> => {
      try {
        const response = await api.searchCourses('javascript');
        return {
          name: 'Search Courses',
          status: response.success ? 'pass' : 'fail',
          duration: 0,
          details: response.success ? 'Course search working' : 'Course search failed'
        };
      } catch (error) {
        return {
          name: 'Search Courses',
          status: 'fail',
          duration: 0,
          details: `Course search test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  ]
};

export const assessmentTestSuite: IntegrationTestSuite = {
  name: 'Assessment System Tests',
  tests: [
    async (): Promise<TestResult> => {
      try {
        const response = await api.getUserAssessments();
        return {
          name: 'Get User Assessments',
          status: response.success ? 'pass' : 'fail',
          duration: 0,
          details: response.success ? 'Assessments retrieved' : 'Failed to get assessments'
        };
      } catch (error) {
        return {
          name: 'Get User Assessments',
          status: 'fail',
          duration: 0,
          details: `Assessment test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },

    async (): Promise<TestResult> => {
      try {
        // Test with mock assessment ID
        const response = await api.getAssessment('assessment_1');
        return {
          name: 'Get Assessment Details',
          status: response.success ? 'pass' : 'fail',
          duration: 0,
          details: response.success ? 'Assessment details retrieved' : 'Failed to get assessment details'
        };
      } catch (error) {
        return {
          name: 'Get Assessment Details',
          status: 'fail',
          duration: 0,
          details: `Assessment details test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  ]
};

export const performanceTestSuite: IntegrationTestSuite = {
  name: 'Performance Tests',
  tests: [
    async (): Promise<TestResult> => {
      const startTime = performance.now();
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      try {
        // Simulate heavy operations
        await Promise.all([
          api.getCourses(),
          api.getUserProfile(),
          api.getPerformanceMetrics()
        ]);
        
        const endTime = performance.now();
        const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
        
        const duration = endTime - startTime;
        const status = duration > 3000 ? 'warning' : duration > 5000 ? 'fail' : 'pass';
        
        return {
          name: 'Concurrent API Calls Performance',
          status,
          duration,
          details: `Completed in ${duration.toFixed(2)}ms, Memory increase: ${memoryIncrease.toFixed(2)}MB`,
          data: { responseTime: duration, memoryIncrease }
        };
      } catch (error) {
        return {
          name: 'Concurrent API Calls Performance',
          status: 'fail',
          duration: performance.now() - startTime,
          details: `Performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },

    async (): Promise<TestResult> => {
      const startTime = performance.now();
      
      try {
        const response = await api.getAdvancedAnalytics({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });
        
        const duration = performance.now() - startTime;
        const status = duration > 2000 ? 'warning' : duration > 4000 ? 'fail' : 'pass';
        
        return {
          name: 'Analytics API Performance',
          status,
          duration,
          details: `Analytics loaded in ${duration.toFixed(2)}ms`
        };
      } catch (error) {
        return {
          name: 'Analytics API Performance',
          status: 'fail',
          duration: performance.now() - startTime,
          details: `Analytics performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  ]
};

export const mobileOptimizationTestSuite: IntegrationTestSuite = {
  name: 'Mobile Optimization Tests',
  tests: [
    async (): Promise<TestResult> => {
      try {
        // Test mobile detection
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const hasTouch = 'ontouchstart' in window;
        
        return {
          name: 'Mobile Detection',
          status: 'pass',
          duration: 0,
          details: `Mobile: ${isMobile}, Touch: ${hasTouch}`,
          data: { isMobile, hasTouch }
        };
      } catch (error) {
        return {
          name: 'Mobile Detection',
          status: 'fail',
          duration: 0,
          details: `Mobile detection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },

    async (): Promise<TestResult> => {
      try {
        // Test offline capabilities
        const offlineSupport = 'serviceWorker' in navigator && 'caches' in window;
        
        return {
          name: 'Offline Support Check',
          status: offlineSupport ? 'pass' : 'warning',
          duration: 0,
          details: offlineSupport ? 'Offline features supported' : 'Limited offline support',
          data: { offlineSupport }
        };
      } catch (error) {
        return {
          name: 'Offline Support Check',
          status: 'fail',
          duration: 0,
          details: `Offline support test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },

    async (): Promise<TestResult> => {
      try {
        // Test PWA capabilities
        const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
        const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
        
        return {
          name: 'PWA Features Check',
          status: hasManifest ? 'pass' : 'warning',
          duration: 0,
          details: `Standalone: ${isStandalone}, Manifest: ${hasManifest}`,
          data: { isStandalone, hasManifest }
        };
      } catch (error) {
        return {
          name: 'PWA Features Check',
          status: 'fail',
          duration: 0,
          details: `PWA features test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  ]
};

export const securityTestSuite: IntegrationTestSuite = {
  name: 'Security Tests',
  tests: [
    async (): Promise<TestResult> => {
      try {
        // Test HTTPS
        const isHTTPS = location.protocol === 'https:';
        
        return {
          name: 'HTTPS Check',
          status: isHTTPS ? 'pass' : 'fail',
          duration: 0,
          details: isHTTPS ? 'HTTPS enabled' : 'HTTPS not enabled'
        };
      } catch (error) {
        return {
          name: 'HTTPS Check',
          status: 'fail',
          duration: 0,
          details: `HTTPS test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },

    async (): Promise<TestResult> => {
      try {
        // Test CSP headers
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        const hasCSP = cspMeta !== null;
        
        return {
          name: 'Content Security Policy Check',
          status: hasCSP ? 'pass' : 'warning',
          duration: 0,
          details: hasCSP ? 'CSP headers present' : 'No CSP headers found'
        };
      } catch (error) {
        return {
          name: 'Content Security Policy Check',
          status: 'fail',
          duration: 0,
          details: `CSP test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  ]
};

// Main test runner
export const runAllTests = async (): Promise<{
  results: TestResult[];
  performance: PerformanceMetrics;
  report: string;
}> => {
  const runner = new IntegrationTestRunner();
  
  const testSuites = [
    authenticationTestSuite,
    courseManagementTestSuite,
    assessmentTestSuite,
    performanceTestSuite,
    mobileOptimizationTestSuite,
    securityTestSuite
  ];

  console.log('Starting comprehensive integration tests...');
  
  for (const suite of testSuites) {
    await runner.runSuite(suite);
  }

  const results = runner.getResults();
  const performance = runner.getPerformanceMetrics();
  const report = runner.generateReport();

  // Log results to console
  console.log(report);

  return { results, performance, report };
};

// Performance monitoring utilities
export const monitorPerformance = () => {
  // Monitor API call performance
  const originalFetch = window.fetch;
  let apiCallCount = 0;
  let totalResponseTime = 0;

  window.fetch = async (...args) => {
    const startTime = performance.now();
    const response = await originalFetch(...args);
    const endTime = performance.now();
    
    apiCallCount++;
    totalResponseTime += (endTime - startTime);
    
    // Log slow API calls
    if (endTime - startTime > 1000) {
      console.warn(`Slow API call detected: ${args[0]} took ${(endTime - startTime).toFixed(2)}ms`);
    }
    
    return response;
  };

  // Monitor memory usage
  if ((performance as any).memory) {
    setInterval(() => {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
      
      if (usedMB > limitMB * 0.8) {
        console.warn(`High memory usage: ${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB`);
      }
    }, 30000); // Check every 30 seconds
  }

  // Monitor render performance
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 16) { // Slower than 60fps
        console.warn(`Slow render detected: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
      }
    }
  });
  
  observer.observe({ entryTypes: ['measure'] });

  return {
    getAverageResponseTime: () => apiCallCount > 0 ? totalResponseTime / apiCallCount : 0,
    getApiCallCount: () => apiCallCount,
    resetStats: () => {
      apiCallCount = 0;
      totalResponseTime = 0;
    }
  };
};

// Auto-optimization utilities
export const applyOptimizations = () => {
  // Lazy load images
  const images = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        img.src = img.dataset.src || '';
        img.removeAttribute('data-src');
        imageObserver.unobserve(img);
      }
    });
  });

  images.forEach((img) => imageObserver.observe(img));

  // Preload critical resources
  const criticalResources = [
    '/api/v1/health',
    '/api/v1/auth/me'
  ];

  criticalResources.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  });

  // Optimize form submissions
  const forms = document.querySelectorAll('form');
  forms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (submitButton) {
        submitButton.disabled = true;
        setTimeout(() => {
          submitButton.disabled = false;
        }, 3000);
      }
    });
  });
};

export default {
  runAllTests,
  monitorPerformance,
  applyOptimizations,
  IntegrationTestRunner
}; 