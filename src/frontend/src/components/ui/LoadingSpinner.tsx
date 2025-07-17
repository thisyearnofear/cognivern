import React from 'react';
import { designTokens } from '../../styles/designTokens';
import { useAnimation } from '../../hooks/useAnimation';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  type?: 'spinner' | 'dots' | 'pulse' | 'bars' | 'skeleton';
  text?: string;
  // Skeleton-specific props
  width?: string | number;
  height?: string | number;
  lines?: number;
  variant?: 'text' | 'rectangular' | 'circular' | 'card';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = designTokens.colors.primary[500],
  type = 'spinner',
  text,
}) => {
  const sizes = {
    sm: { width: '16px', height: '16px', fontSize: designTokens.typography.fontSize.xs },
    md: { width: '24px', height: '24px', fontSize: designTokens.typography.fontSize.sm },
    lg: { width: '32px', height: '32px', fontSize: designTokens.typography.fontSize.base },
  };

  const spinAnimation = useAnimation([
    { transform: 'rotate(0deg)' },
    { transform: 'rotate(360deg)' }
  ], {
    duration: 1000,
    iterationCount: Infinity,
    easing: 'linear',
  });

  const pulseAnimation = useAnimation([
    { opacity: 1, transform: 'scale(1)' },
    { opacity: 0.5, transform: 'scale(1.1)' },
    { opacity: 1, transform: 'scale(1)' }
  ], {
    duration: 1500,
    iterationCount: Infinity,
    easing: 'ease-in-out',
  });

  React.useEffect(() => {
    if (type === 'spinner') {
      spinAnimation.play();
    } else if (type === 'pulse') {
      pulseAnimation.play();
    }
  }, [type, spinAnimation, pulseAnimation]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: designTokens.spacing[2],
  };

  const renderSpinner = () => {
    switch (type) {
      case 'spinner':
        return (
          <div
            ref={spinAnimation.ref}
            style={{
              ...sizes[size],
              border: `2px solid ${designTokens.colors.neutral[200]}`,
              borderTop: `2px solid ${color}`,
              borderRadius: '50%',
            }}
          />
        );

      case 'dots':
        return (
          <div style={{ display: 'flex', gap: '4px' }}>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                style={{
                  width: parseInt(sizes[size].width) / 2,
                  height: parseInt(sizes[size].width) / 2,
                  backgroundColor: color,
                  borderRadius: '50%',
                  animation: `dotPulse 1.4s ease-in-out ${index * 0.16}s infinite both`,
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <div
            ref={pulseAnimation.ref}
            style={{
              ...sizes[size],
              backgroundColor: color,
              borderRadius: '50%',
            }}
          />
        );

      case 'bars':
        return (
          <div style={{ display: 'flex', gap: '2px', alignItems: 'end' }}>
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                style={{
                  width: '3px',
                  height: parseInt(sizes[size].height),
                  backgroundColor: color,
                  animation: `barPulse 1.2s ease-in-out ${index * 0.1}s infinite`,
                }}
              />
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      {renderSpinner()}
      {text && (
        <span style={{
          fontSize: sizes[size].fontSize,
          color: designTokens.colors.neutral[600],
          fontWeight: designTokens.typography.fontWeight.medium,
        }}>
          {text}
        </span>
      )}
      
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes barPulse {
          0%, 40%, 100% {
            transform: scaleY(0.4);
          }
          20% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;