import React, { useState } from 'react';
import { cleanInstructorName } from '../../utils/api';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = ''
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

  // Get user initials for fallback
  const getUserInitials = (name: string): string => {
    if (!name || typeof name !== 'string') return 'U';
    // Always clean the name before generating initials
    return cleanInstructorName(name)
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

  // Detect fallback SVG avatar (with 'User' text)
  const isFallbackAvatar = src?.startsWith('data:image/svg+xml') && src.includes('User');
  const displayImage = src && !imageError && src.length > 0 && !isFallbackAvatar;

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
      

    </div>
  );
};

export default Avatar; 