import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const { theme } = useTheme();
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div 
      className={`${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <div className={`animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-primary-500`}></div>
    </div>
  );
};