import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center font-medium rounded-lg 
    transition-colors duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    relative
  `;
  
  const variantClasses = {
    primary: `
      bg-primary-600 text-white hover:bg-primary-700 
      border border-primary-600 hover:border-primary-700
    `,
    secondary: `
      bg-gray-100 text-gray-900 hover:bg-gray-200 
      border border-gray-300 hover:border-gray-400
      dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700
      dark:hover:bg-gray-700 dark:hover:border-gray-600
    `,
    outline: `
      border border-gray-300 text-gray-700 hover:bg-gray-50 
      dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800
    `,
    ghost: `
      text-gray-600 hover:text-gray-900 hover:bg-gray-100 
      border border-transparent
      dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800
    `,
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
      
      {/* Button content */}
      <span className={`flex items-center ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {Icon && iconPosition === 'left' && (
          <Icon className={`${iconSizeClasses[size]} ${children ? 'mr-2' : ''}`} />
        )}
        {children}
        {Icon && iconPosition === 'right' && (
          <Icon className={`${iconSizeClasses[size]} ${children ? 'ml-2' : ''}`} />
        )}
      </span>
    </button>
  );
};