import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useMediaQuery';

export interface AnimationOptions {
  duration?: number;
  delay?: number;
  easing?: string;
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  iterationCount?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
}

export const useAnimation = (
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: AnimationOptions = {}
) => {
  const elementRef = useRef<HTMLElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const defaultOptions: KeyframeAnimationOptions = {
    duration: 300,
    easing: 'ease-out',
    fill: 'forwards',
    ...options,
  };

  const play = () => {
    if (!elementRef.current || prefersReducedMotion) return;

    // Cancel any existing animation
    if (animationRef.current) {
      animationRef.current.cancel();
    }

    try {
      const animation = elementRef.current.animate(keyframes, defaultOptions);
      animationRef.current = animation;
      setIsAnimating(true);

      animation.addEventListener('finish', () => {
        setIsAnimating(false);
      });

      animation.addEventListener('cancel', () => {
        setIsAnimating(false);
      });

      return animation;
    } catch (error) {
      console.warn('Animation failed:', error);
      setIsAnimating(false);
    }
  };

  const pause = () => {
    if (animationRef.current) {
      animationRef.current.pause();
    }
  };

  const resume = () => {
    if (animationRef.current) {
      animationRef.current.play();
    }
  };

  const cancel = () => {
    if (animationRef.current) {
      animationRef.current.cancel();
      setIsAnimating(false);
    }
  };

  const reverse = () => {
    if (animationRef.current) {
      animationRef.current.reverse();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.cancel();
      }
    };
  }, []);

  return {
    ref: elementRef,
    play,
    pause,
    resume,
    cancel,
    reverse,
    isAnimating,
    animation: animationRef.current,
  };
};

// Hook for entrance animations
export const useEntranceAnimation = (
  type: 'fadeIn' | 'slideInUp' | 'slideInDown' | 'slideInLeft' | 'slideInRight' | 'scaleIn' = 'fadeIn',
  options: AnimationOptions = {}
) => {
  const keyframesMap = {
    fadeIn: [
      { opacity: 0 },
      { opacity: 1 }
    ],
    slideInUp: [
      { opacity: 0, transform: 'translateY(20px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    slideInDown: [
      { opacity: 0, transform: 'translateY(-20px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    slideInLeft: [
      { opacity: 0, transform: 'translateX(-20px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ],
    slideInRight: [
      { opacity: 0, transform: 'translateX(20px)' },
      { opacity: 1, transform: 'translateX(0)' }
    ],
    scaleIn: [
      { opacity: 0, transform: 'scale(0.9)' },
      { opacity: 1, transform: 'scale(1)' }
    ],
  };

  return useAnimation(keyframesMap[type], {
    duration: 300,
    easing: 'ease-out',
    ...options,
  });
};

// Hook for hover animations
export const useHoverAnimation = (
  hoverKeyframes: Keyframe[] | PropertyIndexedKeyframes,
  restKeyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: AnimationOptions = {}
) => {
  const elementRef = useRef<HTMLElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const defaultOptions: KeyframeAnimationOptions = {
    duration: 200,
    easing: 'ease-out',
    fill: 'forwards',
    ...options,
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element || prefersReducedMotion) return;

    const handleMouseEnter = () => {
      setIsHovered(true);
      element.animate(hoverKeyframes, defaultOptions);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      element.animate(restKeyframes, defaultOptions);
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hoverKeyframes, restKeyframes, defaultOptions, prefersReducedMotion]);

  return {
    ref: elementRef,
    isHovered,
  };
};

// Hook for staggered animations
export const useStaggeredAnimation = (
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  itemCount: number,
  staggerDelay: number = 100,
  options: AnimationOptions = {}
) => {
  const [playAnimation, setPlayAnimation] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const createItemAnimation = (index: number) => {
    return useAnimation(keyframes, {
      duration: 300,
      delay: index * staggerDelay,
      easing: 'ease-out',
      ...options,
    });
  };

  const animations = Array.from({ length: itemCount }, (_, index) => 
    createItemAnimation(index)
  );

  const playAll = () => {
    if (prefersReducedMotion) return;
    
    setPlayAnimation(true);
    animations.forEach(animation => animation.play());
  };

  const cancelAll = () => {
    setPlayAnimation(false);
    animations.forEach(animation => animation.cancel());
  };

  return {
    animations,
    playAll,
    cancelAll,
    isPlaying: playAnimation,
  };
};

// Hook for scroll-triggered animations
export const useScrollAnimation = (
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: AnimationOptions & { threshold?: number } = {}
) => {
  const elementRef = useRef<HTMLElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const { threshold = 0.1, ...animationOptions } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element || prefersReducedMotion || hasAnimated) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            element.animate(keyframes, {
              duration: 600,
              easing: 'ease-out',
              fill: 'forwards',
              ...animationOptions,
            });
            setHasAnimated(true);
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [keyframes, animationOptions, threshold, prefersReducedMotion, hasAnimated]);

  const reset = () => {
    setHasAnimated(false);
  };

  return {
    ref: elementRef,
    hasAnimated,
    reset,
  };
};

// Hook for loading animations
export const useLoadingAnimation = (isLoading: boolean) => {
  const skeletonAnimation = useAnimation([
    { backgroundPosition: '-200px 0' },
    { backgroundPosition: 'calc(200px + 100%) 0' }
  ], {
    duration: 2000,
    iterationCount: Infinity,
    easing: 'ease-in-out',
  });

  const spinnerAnimation = useAnimation([
    { transform: 'rotate(0deg)' },
    { transform: 'rotate(360deg)' }
  ], {
    duration: 1000,
    iterationCount: Infinity,
    easing: 'linear',
  });

  useEffect(() => {
    if (isLoading) {
      skeletonAnimation.play();
      spinnerAnimation.play();
    } else {
      skeletonAnimation.cancel();
      spinnerAnimation.cancel();
    }
  }, [isLoading, skeletonAnimation, spinnerAnimation]);

  return {
    skeletonRef: skeletonAnimation.ref,
    spinnerRef: spinnerAnimation.ref,
  };
};