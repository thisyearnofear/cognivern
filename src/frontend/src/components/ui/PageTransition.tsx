import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useEntranceAnimation } from "../../hooks/useAnimation";
import {
  pageTransitionContainerStyles,
  getPageTransitionContentStyles,
} from "../../styles/styles";

export interface PageTransitionProps {
  children: React.ReactNode;
  type?: "fade" | "slide" | "scale";
  duration?: number;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type = "slide",
  duration = 300,
}) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<
    "entering" | "entered" | "exiting"
  >("entered");

  const entranceAnimation = useEntranceAnimation(
    type === "fade" ? "fadeIn" : type === "scale" ? "scaleIn" : "slideInRight",
    { duration },
  );

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage("exiting");

      // Start exit animation
      setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage("entering");

        // Start entrance animation
        entranceAnimation.play();

        setTimeout(() => {
          setTransitionStage("entered");
        }, duration);
      }, duration / 2);
    }
  }, [location, displayLocation, duration, entranceAnimation]);

  return (
    <div css={pageTransitionContainerStyles}>
      <div
        ref={entranceAnimation.ref}
        css={getPageTransitionContentStyles(transitionStage, type, duration)}
        key={displayLocation.pathname}
      >
        {children}
      </div>
    </div>
  );
};

export default PageTransition;
