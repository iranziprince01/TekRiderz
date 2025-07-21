import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';


interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header 
        onMobileMenuToggle={toggleMobileMenu}
        isMobileMenuOpen={isMobileMenuOpen}
      />
      
      {/* Sidebar - Fixed position */}
      <Sidebar 
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
      />
      
      {/* Main content area - scrollable with proper margin for fixed sidebar */}
      <div className="lg:ml-64 ml-0">
        <main className="pt-16 min-h-screen">
          <div className="h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="px-4 sm:px-6 lg:px-8 py-4">
              <div className="max-w-7xl mx-auto">

                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;