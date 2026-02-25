import React, { useId } from "react";
import styled from "@emotion/styled";

interface GenerativeRevealProps {
  children: React.ReactNode;
  active?: boolean;
  duration?: number;
  className?: string;
}

const Container = styled.div<{ active: boolean; duration: number; filterId: string }>`
  position: relative;
  will-change: filter, transform, opacity;
  transition: opacity ${({ duration }) => duration * 0.5}ms ease-out;
  opacity: ${({ active }) => (active ? 1 : 0)};
  filter: ${({ active, filterId }) => (active ? `url(#distort-${filterId})` : "none")};
`;

/**
 * GenerativeReveal provides a high-end, "liquid" reveal effect for agentic UI components.
 * It uses SVG filters to create a morphing/distortion effect during entry,
 * delivering the "wow factor" inspired by composite rendering techniques.
 *
 * ENHANCEMENT FIRST: This component enhances standard component entries with
 * fluid, organic motion.
 */
export const GenerativeReveal: React.FC<GenerativeRevealProps> = ({
  children,
  active = true,
  duration = 1000,
  className,
}) => {
  // Use a unique ID for the SVG filter to allow multiple instances on the same page
  const rawId = useId();
  const filterId = rawId.replace(/:/g, "");

  return (
    <>
      <svg
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          pointerEvents: "none",
          visibility: "hidden",
        }}
        aria-hidden="true"
      >
        <defs>
          <filter id={`distort-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015"
              numOctaves="3"
              result="noise"
              seed="1"
            >
              <animate
                attributeName="baseFrequency"
                values="0.015; 0.06; 0.015"
                dur={`${duration}ms`}
                repeatCount="1"
                calcMode="spline"
                keySplines="0.42, 0, 0.58, 1; 0.42, 0, 0.58, 1"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            >
              <animate
                attributeName="scale"
                values="40; 60; 0"
                dur={`${duration}ms`}
                repeatCount="1"
                fill="freeze"
                calcMode="spline"
                keySplines="0.42, 0, 0.58, 1; 0.42, 0, 0.58, 1"
              />
            </feDisplacementMap>
            <feGaussianBlur in="displaced" stdDeviation="0">
              <animate
                attributeName="stdDeviation"
                values="5; 0"
                dur={`${duration * 0.4}ms`}
                repeatCount="1"
                fill="freeze"
              />
            </feGaussianBlur>
          </filter>
        </defs>
      </svg>
      <Container
        active={active}
        duration={duration}
        filterId={filterId}
        className={className}
      >
        {children}
      </Container>
    </>
  );
};

export default GenerativeReveal;
