/**
 * LazyLoadImage Component
 * Optimizes image loading for mobile performance
 * Uses IntersectionObserver for efficient lazy loading
 */

import React, { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react';

export interface LazyLoadImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Placeholder content while image loads */
  placeholder?: React.ReactNode;
  /** Fallback image if src fails */
  fallback?: string;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Whether to use blur effect during loading */
  useBlur?: boolean;
}

export const LazyLoadImage: React.FC<LazyLoadImageProps> = ({
  src,
  alt,
  placeholder,
  fallback,
  rootMargin = '50px',
  useBlur = true,
  className = '',
  style,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Only use IntersectionObserver if supported
    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      { rootMargin }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [rootMargin]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true); // Still mark as loaded to show fallback
  };

  // Don't render anything if no src and no fallback
  if (!src && !fallback) {
    return null;
  }

  // Show placeholder while not in view
  if (!isInView && placeholder) {
    return <>{placeholder}</>;
  }

  const imageStyle = css`
    display: block;
    max-width: 100%;
    height: auto;
    transition: opacity ${useBlur ? '0.3s ease' : '0s'};
    opacity: ${isLoaded ? 1 : 0};
    ${useBlur && !isLoaded ? 'filter: blur(10px);' : ''}
    ${useBlur && isLoaded ? 'filter: blur(0);' : ''}
  `;

  const containerStyle = css`
    position: relative;
    background: #f5f5f5;
    overflow: hidden;
  `;

  const placeholderStyle = css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    transition: opacity 0.3s ease;
    opacity: ${isLoaded ? 0 : 1};
    pointer-events: none;
  `;

  return (
    <div css={containerStyle} style={style} className={className}>
      {/* Placeholder */}
      {!isLoaded && placeholder && (
        <div css={placeholderStyle}>{placeholder}</div>
      )}

      {/* Main Image */}
      {(isInView && src && !hasError) && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          css={imageStyle}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}

      {/* Fallback Image */}
      {hasError && fallback && (
        <img
          src={fallback}
          alt={`Fallback: ${alt}`}
          onLoad={handleLoad}
          css={imageStyle}
          loading="lazy"
        />
      )}
    </div>
  );
};

// Optimized Avatar component for mobile
export const OptimizedAvatar: React.FC<{
  src?: string;
  alt: string;
  size?: number;
  fallback?: string;
}> = ({ src, alt, size = 40, fallback }) => {
  const [isLoaded, setIsLoaded] = useState(!src);

  const handleLoad = () => setIsLoaded(true);
  const handleError = () => setIsLoaded(true);

  return (
    <div
      css={css`
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      `}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          css={css`
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: ${isLoaded ? 1 : 0};
            transition: opacity 0.2s ease;
          `}
          loading="lazy"
        />
      )}
      {!isLoaded && (
        <div
          css={css`
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          `}
        />
      )}
    </div>
  );
};

// Responsive image wrapper
export const ResponsiveImage: React.FC<{
  srcSet: string;
  sizes: string;
  src: string;
  alt: string;
  className?: string;
}> = ({ srcSet, sizes, src, alt, className = '' }) => {
  return (
    <img
      srcSet={srcSet}
      sizes={sizes}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      css={css`
        width: 100%;
        height: auto;
        display: block;
      `}
    />
  );
};
