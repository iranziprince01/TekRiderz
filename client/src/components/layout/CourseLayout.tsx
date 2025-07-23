import React, { useState, useEffect } from 'react';
import { CoursePermissions } from '../../utils/coursePermissions';
import Header from './Header';
import MinimizedSidebar from './MinimizedSidebar';
import CourseSidebar from './CourseSidebar';
import { CourseAccessibilityBar } from '../accessibility/CourseAccessibilityBar';

interface CourseLayoutProps {
  children: React.ReactNode;
  courseTitle?: string;
  courseProgress?: number;
  permissions?: CoursePermissions;
  isOffline?: boolean;
}

const CourseLayout: React.FC<CourseLayoutProps> = ({ 
  children, 
  courseTitle,
  courseProgress,
  permissions,
  isOffline = false
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [pageContent, setPageContent] = useState<string>('');

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Listen for hash changes to update active tab
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setActiveTab(hash);
      } else {
        setActiveTab('home');
      }
    };

    // Set initial tab based on current hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Auto-detect page content for accessibility
  useEffect(() => {
    const extractPageContent = () => {
      // Wait for content to render
      setTimeout(() => {
        const mainElement = document.querySelector('main');
        if (mainElement) {
          const headings = Array.from(mainElement.querySelectorAll('h1, h2, h3'))
            .map(h => h.textContent)
            .filter(Boolean)
            .join('. ');
          
          const paragraphs = Array.from(mainElement.querySelectorAll('p'))
            .slice(0, 5)
            .map(p => p.textContent)
            .filter(text => text && text.length > 20)
            .join('. ');
            
          const content = `${headings}. ${paragraphs}`.substring(0, 1000);
          setPageContent(content);
        }
      }, 500);
    };

    extractPageContent();
    
    // Re-extract when route changes
    const handleRouteChange = () => {
      extractPageContent();
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, [children]);

  // Pass activeTab to children through context or props
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { activeTab, setActiveTab } as any);
    }
    return child;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        onMobileMenuToggle={toggleMobileMenu}
        isMobileMenuOpen={isMobileMenuOpen}
      />
      
      {/* Minimized Main Sidebar - Only icons */}
      <MinimizedSidebar 
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
      />
      
      {/* Course Sidebar - Full width next to minimized sidebar */}
      <CourseSidebar 
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        courseTitle={courseTitle}
        courseProgress={courseProgress}
        permissions={permissions}
        isOffline={isOffline}
      />
      
      {/* Main content area - adjusted for both sidebars */}
      <div className="lg:ml-80 ml-0"> {/* ml-80 = ml-16 (minimized) + ml-64 (course sidebar) */}
        <main className="pt-16 min-h-screen">
          {/* Accessibility Bar - positioned at the top of content */}
          <CourseAccessibilityBar 
            pageContent={pageContent}
            courseTitle={courseTitle}
          />
          
          <div className="h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="px-4 sm:px-6 lg:px-8 py-4">
              <div className="max-w-7xl mx-auto">
                {childrenWithProps}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile overlay for course sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}
    </div>
  );
};

export default CourseLayout; 