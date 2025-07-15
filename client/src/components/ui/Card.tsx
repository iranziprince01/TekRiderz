import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  variant?: 'default' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hover = false,
  variant = 'default',
  padding = 'md'
}) => {
  const baseClasses = `
    rounded-lg transition-shadow duration-200 ease-in-out
    ${hover ? 'hover:shadow-md' : ''}
  `;

  const variantClasses = {
    default: `
      bg-white dark:bg-gray-800 
      border border-gray-200 dark:border-gray-700
      shadow-sm
    `,
    bordered: `
      bg-white dark:bg-gray-800 
      border-2 border-primary-200 dark:border-primary-800
      shadow-sm
    `,
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`
        ${baseClasses} 
        ${variantClasses[variant]} 
        ${paddingClasses[padding]} 
        ${className}
      `}
    >
      {children}
    </div>
  );
};