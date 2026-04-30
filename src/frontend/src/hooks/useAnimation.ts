import { useEffect, useRef, useState } from 'react';
import { css } from '@emotion/react';
import { useReducedMotion } from './useMediaQuery';

export interface AnimationOptions {
  duration?: number;
  delay?: number;
  easing?: string;
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  iterationCount?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
}

export const useAnimation = <T extends HTMLElement = HTMLElement>(
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: AnimationOptions = {},
) => {
  const elementRef = useRef<T>(null);
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

// Entrance animation CSS helper — returns an Emotion CSS object
// for use in arrays: css={[baseStyles, getEntranceAnimationCSS({ delay, mode })]}
export const getEntranceAnimationCSS = (options: AnimationOptions & { mode?: AnimationType } = {}) => {
  const { delay = 0, mode = 'slideInUp', ...rest } = options;
  const keyframesMap = {
    fadeIn: [{ opacity: 0 }, { opacity: 1 }],
    slideInUp: [
      { opacity: 0, transform: 'translateY(20px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    slideInDown: [
      { opacity: 0, transform: 'translateY(-20px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    slideInLeft: [
      { opacity: 0, transform: 'translateX(-20px)' },
      { opacity: 1, transform: 'translateX(0)' },
    ],
    slideInRight: [
      { opacity: 0, transform: 'translateX(20px)' },
      { opacity: 1, transform: 'translateX(0)' },
    ],
    scaleIn: [
      { opacity: 0, transform: 'scale(0.9)' },
      { opacity: 1, transform: 'scale(1)' },
    ],
  };

  const keyframes = keyframesMap[mode as AnimationType] ?? keyframesMap.slideInUp;
  const duration = rest.duration ?? 300;

  // Build @keyframes rule for this animation
  const animName = `entrance_${mode}_${delay}`;
  const easing = rest.easing ?? 'ease-out';

  return css`
    @keyframes ${animName} {
      from { opacity: 0; transform: ${(keyframes[0] as { transform?: string }).transform ?? 'translateY(20px)'}; }
      to   { opacity: 1; transform: ${(keyframes[1] as { transform?: string }).transform ?? 'translateY(0)'}; }
    }
    animation: ${animName} ${duration}ms ${easing} ${delay}ms forwards;
  `;
};

type AnimationType = 'fadeIn' | 'slideInUp' | 'slideInDown' | 'slideInLeft' | 'slideInRight' | 'scaleIn';

// Hook for hover animations
export const useHoverAnimation = <T extends HTMLElement = HTMLElement>(
  hoverKeyframes: Keyframe[] | PropertyIndexedKeyframes,
  restKeyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: AnimationOptions = {},
) => {
  const elementRef = useRef<T>(null);
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
  options: AnimationOptions = {},
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

  const animations = Array.from({ length: itemCount }, (_, index) => createItemAnimation(index));

  const playAll = () => {
    if (prefersReducedMotion) return;

    setPlayAnimation(true);
    animations.forEach((animation) => animation.play());
  };

  const cancelAll = () => {
    setPlayAnimation(false);
    animations.forEach((animation) => animation.cancel());
  };

  return {
    animations,
    playAll,
    cancelAll,
    isPlaying: playAnimation,
  };
};

// Hook for scroll-triggered animations
export const useScrollAnimation = <T extends HTMLElement = HTMLElement>(
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: AnimationOptions & { threshold?: number } = {},
) => {
  const elementRef = useRef<T>(null);
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
      { threshold },
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

// Count-up animation for numeric values
export const useCountUpAnimation = (target: number, options: AnimationOptions & { trigger?: boolean } = {}) => {
  const { duration = 600, delay = 0, trigger = true } = options;
  const [current, setCurrent] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!trigger) return;

    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out curve
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    if (prefersReducedMotion) {
      setCurrent(target);
      return;
    }

    const timer = setTimeout(() => requestAnimationFrame(tick), delay);
    return () => clearTimeout(timer);
  }, [target, duration, delay, trigger, prefersReducedMotion]);

  return current;
};
