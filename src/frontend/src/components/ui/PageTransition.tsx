import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnimation } from '../../hooks/useAnimation';
import { pageTransitionStyles } from '../../styles/design-system';

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
  const [transitionStage, setTransitionStage] = useState<'entering' | 'entered' | 'exiting'>(
    'entered'
  );

  const entranceKeyframes =
    type === 'fade'
      ? [{ opacity: 0 }, { opacity: 1 }]
      : type === 'scale'
        ? [
            { opacity: 0, transform: 'scale(0.95)' },
            { opacity: 1, transform: 'scale(1)' },
          ]
        : [
            { opacity: 0, transform: 'translateX(20px)' },
            { opacity: 1, transform: 'translateX(0)' },
          ];

  const entranceAnimation = useAnimation<HTMLDivElement>(entranceKeyframes, { duration });

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

  return (
    <div css={pageTransitionStyles.container}>
      <div
        ref={entranceAnimation.ref}
        css={pageTransitionStyles.content(transitionStage, type, duration)}
        key={displayLocation.pathname}
      >
        {children}
      </div>
    </div>
  );
};

export default PageTransition;
