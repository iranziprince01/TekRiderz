import React, { useState, useRef, useEffect } from 'react';

interface SliderProps {
  value: number | [number, number];
  onValueChange: (value: number | [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  disabled = false
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<number | null>(null);

  const isRange = Array.isArray(value);
  const minValue = isRange ? value[0] : min;
  const maxValue = isRange ? value[1] : value as number;

  const getPercentage = (val: number) => {
    return ((val - min) / (max - min)) * 100;
  };

  const getValueFromEvent = (event: MouseEvent | TouchEvent): number => {
    if (!sliderRef.current) return min;

    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const rawValue = min + (percentage / 100) * (max - min);
    
    return Math.round(rawValue / step) * step;
  };

  const handleMouseDown = (thumbIndex: number) => (event: React.MouseEvent) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragging(thumbIndex);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (isDragging === null || disabled) return;

    const newValue = getValueFromEvent(event);

    if (isRange) {
      const [currentMin, currentMax] = value as [number, number];
      if (isDragging === 0) {
        // Dragging min thumb
        const clampedValue = Math.min(newValue, currentMax);
        onValueChange([clampedValue, currentMax]);
      } else {
        // Dragging max thumb
        const clampedValue = Math.max(newValue, currentMin);
        onValueChange([currentMin, clampedValue]);
      }
    } else {
      onValueChange(newValue);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove as any);
      document.addEventListener('touchend', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleMouseMove as any);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging]);

  const handleTrackClick = (event: React.MouseEvent) => {
    if (disabled || isDragging !== null) return;

    const newValue = getValueFromEvent(event.nativeEvent);

    if (isRange) {
      const [currentMin, currentMax] = value as [number, number];
      const distanceToMin = Math.abs(newValue - currentMin);
      const distanceToMax = Math.abs(newValue - currentMax);

      if (distanceToMin < distanceToMax) {
        onValueChange([newValue, currentMax]);
      } else {
        onValueChange([currentMin, newValue]);
      }
    } else {
      onValueChange(newValue);
    }
  };

  const thumbBaseClasses = `
    absolute w-5 h-5 bg-white border-2 border-primary-500 rounded-full 
    cursor-pointer transform -translate-x-1/2 -translate-y-1/2 top-1/2
    hover:scale-110 transition-transform duration-200 ease-out
    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
    shadow-lg hover:shadow-xl
  `;

  const trackClasses = `
    w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full relative cursor-pointer
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  return (
    <div className={`slider-container ${className}`}>
      <div
        ref={sliderRef}
        className={trackClasses}
        onClick={handleTrackClick}
      >
        {/* Track fill */}
        <div
          className="absolute h-full bg-primary-500 rounded-full transition-all duration-200"
          style={{
            left: `${isRange ? getPercentage(minValue) : 0}%`,
            width: `${isRange 
              ? getPercentage(maxValue) - getPercentage(minValue)
              : getPercentage(maxValue)
            }%`
          }}
        />

        {/* Thumbs */}
        {isRange ? (
          <>
            {/* Min thumb */}
            <div
              className={`${thumbBaseClasses} ${isDragging === 0 ? 'scale-110 shadow-xl' : ''}`}
              style={{ left: `${getPercentage(minValue)}%` }}
              onMouseDown={handleMouseDown(0)}
              onTouchStart={(e) => {
                e.preventDefault();
                setIsDragging(0);
              }}
              tabIndex={disabled ? -1 : 0}
              role="slider"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={minValue}
              aria-label="Minimum value"
            />
            {/* Max thumb */}
            <div
              className={`${thumbBaseClasses} ${isDragging === 1 ? 'scale-110 shadow-xl' : ''}`}
              style={{ left: `${getPercentage(maxValue)}%` }}
              onMouseDown={handleMouseDown(1)}
              onTouchStart={(e) => {
                e.preventDefault();
                setIsDragging(1);
              }}
              tabIndex={disabled ? -1 : 0}
              role="slider"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={maxValue}
              aria-label="Maximum value"
            />
          </>
        ) : (
          <div
            className={`${thumbBaseClasses} ${isDragging === 0 ? 'scale-110 shadow-xl' : ''}`}
            style={{ left: `${getPercentage(maxValue)}%` }}
            onMouseDown={handleMouseDown(0)}
            onTouchStart={(e) => {
              e.preventDefault();
              setIsDragging(0);
            }}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={maxValue}
            aria-label="Slider value"
          />
        )}
      </div>
    </div>
  );
}; 