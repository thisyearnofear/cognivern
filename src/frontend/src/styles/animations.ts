import { designTokens } from './designTokens';

// Animation utilities and keyframes
export const animations = {
  // Entrance animations
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: designTokens.animation.duration.normal,
    easing: designTokens.animation.easing.easeOut,
  },
  
  slideInUp: {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
    duration: designTokens.animation.duration.normal,
    easing: designTokens.animation.easing.easeOut,
  },
  
  slideInDown: {
    from: { opacity: 0, transform: 'translateY(-20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
    duration: designTokens.animation.duration.normal,
    easing: designTokens.animation.easing.easeOut,
  },
  
  slideInLeft: {
    from: { opacity: 0, transform: 'translateX(-20px)' },
    to: { opacity: 1, transform: 'translateX(0)' },
    duration: designTokens.animation.duration.normal,
    easing: designTokens.animation.easing.easeOut,
  },
  
  slideInRight: {
    from: { opacity: 0, transform: 'translateX(20px)' },
    to: { opacity: 1, transform: 'translateX(0)' },
    duration: designTokens.animation.duration.normal,
    easing: designTokens.animation.easing.easeOut,
  },
  
  scaleIn: {
    from: { opacity: 0, transform: 'scale(0.9)' },
    to: { opacity: 1, transform: 'scale(1)' },
    duration: designTokens.animation.duration.normal,
    easing: designTokens.animation.easing.easeOut,
  },
  
  // Exit animations
  fadeOut: {
    from: { opacity: 1 },
    to: { opacity: 0 },
    duration: designTokens.animation.duration.fast,
    easing: designTokens.animation.easing.easeIn,
  },
  
  slideOutUp: {
    from: { opacity: 1, transform: 'translateY(0)' },
    to: { opacity: 0, transform: 'translateY(-20px)' },
    duration: designTokens.animation.duration.fast,
    easing: designTokens.animation.easing.easeIn,
  },
  
  slideOutRight: {
    from: { opacity: 1, transform: 'translateX(0)' },
    to: { opacity: 0, transform: 'translateX(100%)' },
    duration: designTokens.animation.duration.normal,
    easing: designTokens.animation.easing.easeIn,
  },
  
  scaleOut: {
    from: { opacity: 1, transform: 'scale(1)' },
    to: { opacity: 0, transform: 'scale(0.9)' },
    duration: designTokens.animation.duration.fast,
    easing: designTokens.animation.easing.easeIn,
  },
  
  // Micro-interactions
  bounce: {
    keyframes: [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.05)', offset: 0.5 },
      { transform: 'scale(1)', offset: 1 },
    ],
    duration: designTokens.animation.duration.fast,
    easing: designTokens.animation.easing.easeInOut,
  },
  
  pulse: {
    keyframes: [
      { opacity: 1, offset: 0 },
      { opacity: 0.7, offset: 0.5 },
      { opacity: 1, offset: 1 },
    ],
    duration: '2s',
    easing: designTokens.animation.easing.easeInOut,
    iterationCount: 'infinite',
  },
  
  shake: {
    keyframes: [
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(-5px)', offset: 0.25 },
      { transform: 'translateX(5px)', offset: 0.75 },
      { transform: 'translateX(0)', offset: 1 },
    ],
    duration: designTokens.animation.duration.normal,
    easing: designTokens.animation.easing.easeInOut,
  },
  
  // Loading animations
  spin: {
    keyframes: [
      { transform: 'rotate(0deg)', offset: 0 },
      { transform: 'rotate(360deg)', offset: 1 },
    ],
    duration: '1s',
    easing: designTokens.animation.easing.linear,
    iterationCount: 'infinite',
  },
  
  shimmer: {
    keyframes: [
      { backgroundPosition: '-200px 0', offset: 0 },
      { backgroundPosition: 'calc(200px + 100%) 0', offset: 1 },
    ],
    duration: '2s',
    easing: designTokens.animation.easing.easeInOut,
    iterationCount: 'infinite',
  },
  
  // Page transitions
  pageSlideIn: {
    from: { opacity: 0, transform: 'translateX(30px)' },
    to: { opacity: 1, transform: 'translateX(0)' },
    duration: designTokens.animation.duration.slow,
    easing: designTokens.animation.easing.easeOut,
  },
  
  pageSlideOut: {
    from: { opacity: 1, transform: 'translateX(0)' },
    to: { opacity: 0, transform: 'translateX(-30px)' },
    duration: designTokens.animation.duration.normal,
    easing: designTokens.animation.easing.easeIn,
  },
};

// CSS-in-JS animation utilities
export const createAnimation = (name: keyof typeof animations) => {
  const anim = animations[name];
  
  if ('keyframes' in anim) {
    return {
      animation: `${name} ${anim.duration} ${anim.easing} ${anim.iterationCount || '1'}`,
    };
  }
  
  return {
    transition: `all ${anim.duration} ${anim.easing}`,
  };
};

// Generate CSS keyframes
export const generateKeyframes = () => {
  const keyframeStyles: string[] = [];
  
  Object.entries(animations).forEach(([name, anim]) => {
    if ('keyframes' in anim) {
      const keyframeRule = `
        @keyframes ${name} {
          ${anim.keyframes.map(frame => 
            `${(frame.offset * 100)}% { ${Object.entries(frame).filter(([key]) => key !== 'offset').map(([prop, value]) => `${prop}: ${value}`).join('; ')} }`
          ).join('\n          ')}
        }
      `;
      keyframeStyles.push(keyframeRule);
    } else {
      // For simple from/to animations
      const keyframeRule = `
        @keyframes ${name} {
          from { ${Object.entries(anim.from).map(([prop, value]) => `${prop}: ${value}`).join('; ')} }
          to { ${Object.entries(anim.to).map(([prop, value]) => `${prop}: ${value}`).join('; ')} }
        }
      `;
      keyframeStyles.push(keyframeRule);
    }
  });
  
  return keyframeStyles.join('\n');
};

// Stagger animation utility
export const createStaggeredAnimation = (
  baseAnimation: keyof typeof animations,
  itemCount: number,
  staggerDelay: number = 50
) => {
  const styles: React.CSSProperties[] = [];
  
  for (let i = 0; i < itemCount; i++) {
    styles.push({
      ...createAnimation(baseAnimation),
      animationDelay: `${i * staggerDelay}ms`,
    });
  }
  
  return styles;
};

// Reduced motion utilities
export const respectsReducedMotion = (animation: React.CSSProperties) => {
  return {
    ...animation,
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
      transition: 'none',
    },
  };
};

// Hover animation utilities
export const hoverAnimations = {
  lift: {
    transform: 'translateY(-2px)',
    boxShadow: designTokens.shadows.lg,
    transition: `all ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeOut}`,
  },
  
  scale: {
    transform: 'scale(1.02)',
    transition: `transform ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeOut}`,
  },
  
  glow: {
    boxShadow: `0 0 20px ${designTokens.colors.primary[300]}`,
    transition: `box-shadow ${designTokens.animation.duration.normal} ${designTokens.animation.easing.easeOut}`,
  },
  
  slideRight: {
    transform: 'translateX(4px)',
    transition: `transform ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeOut}`,
  },
};

// Focus animations
export const focusAnimations = {
  ring: {
    outline: 'none',
    boxShadow: `0 0 0 3px ${designTokens.colors.primary[200]}`,
    transition: `box-shadow ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeOut}`,
  },
  
  scale: {
    transform: 'scale(1.02)',
    outline: 'none',
    transition: `transform ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeOut}`,
  },
};

// Loading state animations
export const loadingAnimations = {
  skeleton: {
    background: `linear-gradient(90deg, ${designTokens.colors.neutral[200]} 25%, ${designTokens.colors.neutral[100]} 50%, ${designTokens.colors.neutral[200]} 75%)`,
    backgroundSize: '200px 100%',
    animation: 'shimmer 2s ease-in-out infinite',
  },
  
  dots: {
    display: 'inline-block',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  
  spinner: {
    display: 'inline-block',
    width: '20px',
    height: '20px',
    border: `2px solid ${designTokens.colors.neutral[300]}`,
    borderTop: `2px solid ${designTokens.colors.primary[500]}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};