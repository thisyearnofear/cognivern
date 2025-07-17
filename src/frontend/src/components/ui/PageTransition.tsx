import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useEntranceAnimation } from '../../hooks/useAnimation';
import { designTokens } from '../../styles/designTokens';

export interface PageTransitionProps {
  children: React.ReactNode;
  type?: 'fade' | 'slide' | 'scale';
  duration?: number;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type = 'slide',
  duration = 300,
}) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<'entering' | 'entered' | 'exiting'>('entered');

  const entranceAnimation = useEntranceAnimation(
    type === 'fade' ? 'fadeIn' : type === 'scale' ? 'scaleIn' : 'slideInRight',
    { duration }
  );

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage('exiting');
      
      // Start exit animation
      setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage('entering');
        
        // Start entrance animation
        entranceAnimation.play();
        
        setTimeout(() => {
          setTransitionStage('entered');
        }, duration);
      }, duration / 2);
    }
  }, [location, displayLocation, duration, entranceAnimation]);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  const contentStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    opacity: transitionStage === 'exiting' ? 0 : 1,
    transform: transitionStage === 'exiting' 
      ? (type === 'slide' ? 'translateX(-30px)' : type === 'scale' ? 'scale(0.9)' : 'none')
      : 'none',
    transition: `all ${duration / 2}ms ease-in-out`,
  };

  return (
    <div style={containerStyle}>
      <div
        ref={entranceAnimation.ref}
        style={contentStyle}
        key={displayLocation.pathname}
      >
        {children}
      </div>
    </div>
  );
};

export default PageTransition;