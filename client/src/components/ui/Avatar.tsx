import React, { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
  showOnlineStatus = false,
  isOnline = false
}) => {
  const [imageError, setImageError] = useState(false);

  // Size configurations
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  };

  const statusSizeClasses = {
    xs: 'w-1.5 h-1.5 border',
    sm: 'w-2 h-2 border',
    md: 'w-2.5 h-2.5 border-2',
    lg: 'w-3 h-3 border-2',
    xl: 'w-4 h-4 border-2'
  };

  // Get user initials for fallback
  const getUserInitials = (name: string): string => {
    if (!name || typeof name !== 'string') return 'U';
    
    return name
      .trim()
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const displayImage = src && !imageError && src.length > 0;

  return (
    <div className={`relative inline-block ${className}`}>
      <div className={`
        ${sizeClasses[size]} 
        rounded-full 
        overflow-hidden 
        border-2 
        border-white 
        shadow-sm 
        bg-gradient-to-br 
        from-blue-400 
        to-blue-600
        flex 
        items-center 
        justify-center 
        text-white 
        font-semibold
      `}>
        {displayImage ? (
          <img
            src={src}
            alt={`${name}'s avatar`}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <span className="select-none">
            {getUserInitials(name)}
          </span>
        )}
      </div>
      
      {/* Online Status Indicator */}
      {showOnlineStatus && (
        <div 
          className={`
            absolute 
            bottom-0 
            right-0 
            ${statusSizeClasses[size]}
            rounded-full 
            border-white
            ${isOnline ? 'bg-green-500' : 'bg-gray-400'}
          `}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default Avatar; 