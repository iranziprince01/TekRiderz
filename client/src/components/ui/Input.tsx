import React, { useState, useRef, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  variant?: 'default' | 'glass' | 'minimal' | 'floating';
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon: Icon,
  iconPosition = 'left',
  variant = 'default',
  animated = true,
  size = 'md',
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      setHasValue(!!inputRef.current.value);
    }
  }, [props.value, props.defaultValue]);

  const baseClasses = `
    block w-full rounded-xl transition-all duration-300 ease-out
    ${animated ? 'transform-gpu' : ''}
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900
    disabled:opacity-50 disabled:cursor-not-allowed
    placeholder:text-gray-400 dark:placeholder:text-gray-500
  `;

  const variantClasses = {
    default: `
      bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
      text-gray-900 dark:text-white
      focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 dark:focus:ring-blue-400/20
      hover:border-gray-400 dark:hover:border-gray-500
      shadow-sm hover:shadow-md
      ${error ? 'border-red-500/60 dark:border-red-400/60 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-500/20 dark:focus:ring-red-400/20' : ''}
    `,
    glass: `
      bg-white/20 dark:bg-gray-800/20 backdrop-blur-lg 
      border border-white/30 dark:border-gray-700/30 
      text-gray-900 dark:text-white
      focus:border-blue-500/60 dark:focus:border-blue-400/60 focus:ring-blue-500/20 dark:focus:ring-blue-400/20
      hover:bg-white/30 dark:hover:bg-gray-800/30
      shadow-lg hover:shadow-xl
      ${error ? 'border-red-500/60 dark:border-red-400/60 focus:border-red-500/60 dark:focus:border-red-400/60 focus:ring-red-500/20 dark:focus:ring-red-400/20' : ''}
    `,
    minimal: `
      bg-transparent border-b-2 border-gray-300/40 dark:border-gray-600/40 rounded-none
      text-gray-900 dark:text-white
      focus:border-blue-500 dark:focus:border-blue-400 focus:ring-0
      hover:border-gray-400/60 dark:hover:border-gray-500/60
      transition-colors
      ${error ? 'border-red-500/60 dark:border-red-400/60 focus:border-red-500 dark:focus:border-red-400' : ''}
    `,
    floating: `
      bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
      text-gray-900 dark:text-white
      focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 dark:focus:ring-blue-400/20
      hover:border-gray-400 dark:hover:border-gray-500
      shadow-sm hover:shadow-md
      ${error ? 'border-red-500/60 dark:border-red-400/60 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-500/20 dark:focus:ring-red-400/20' : ''}
    `,
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="w-full">
      {/* Traditional label for non-floating variants */}
      {label && variant !== 'floating' && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}

      {/* Input container */}
      <div 
        className={`
          relative
          ${animated ? 'transform-gpu' : ''}
          ${isFocused ? 'scale-[1.01]' : ''}
          transition-transform duration-200
        `}
      >
        {/* Left icon */}
        {Icon && iconPosition === 'left' && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className={`${iconSizeClasses[size]} text-gray-400 dark:text-gray-500`} />
          </div>
        )}

        {/* Main input */}
        <input
          ref={inputRef}
          className={`
            ${baseClasses} 
            ${variantClasses[variant]} 
            ${sizeClasses[size]}
            ${Icon && iconPosition === 'left' ? 'pl-10' : ''}
            ${Icon && iconPosition === 'right' ? 'pr-10' : ''}
            ${variant === 'floating' ? 'placeholder-transparent' : ''}
            ${className}
          `}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            setHasValue(!!e.target.value);
            props.onBlur?.(e);
          }}
          onChange={(e) => {
            setHasValue(!!e.target.value);
            props.onChange?.(e);
          }}
          {...props}
        />

        {/* Floating label */}
        {label && variant === 'floating' && (
          <label
            className={`
              absolute left-4 transition-all duration-200 pointer-events-none
              ${isFocused || hasValue || props.value || props.defaultValue
                ? 'top-2 text-xs text-blue-500 dark:text-blue-400 scale-90'
                : 'top-1/2 -translate-y-1/2 text-base text-gray-400 dark:text-gray-500'
              }
            `}
          >
            {label}
          </label>
        )}

        {/* Right icon */}
        {Icon && iconPosition === 'right' && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Icon className={`${iconSizeClasses[size]} text-gray-400 dark:text-gray-500`} />
          </div>
        )}

        {/* Focus ring enhancement */}
        {isFocused && animated && (
          <div className="absolute inset-0 rounded-xl ring-2 ring-blue-500/20 dark:ring-blue-400/20 animate-pulse" />
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center animate-slide-in">
          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};