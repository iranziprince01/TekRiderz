import React, { useState, useEffect } from 'react';
import { CoursePermissions } from '../../utils/coursePermissions';
import Header from './Header';
import MinimizedSidebar from './MinimizedSidebar';
import CourseSidebar from './CourseSidebar';

interface CourseLayoutProps {
  children: React.ReactNode;
  courseTitle?: string;
  courseProgress?: number;
  permissions?: CoursePermissions;
}

const CourseLayout: React.FC<CourseLayoutProps> = ({ 
  children, 
  courseTitle,
  courseProgress,
  permissions 
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

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
      />
      
      {/* Main content area - adjusted for both sidebars */}
      <div className="lg:ml-80 ml-0"> {/* ml-80 = ml-16 (minimized) + ml-64 (course sidebar) */}
        <main className="pt-16 min-h-screen">
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