import { css } from "@emotion/react";
import { designTokens } from "../../designTokens";

export const pageTransitionStyles = {
  container: css`
    position: relative;
    width: 100%;
    min-height: 100%;
    overflow-x: hidden;
  `,
  content: (
    stage: "entering" | "entered" | "exiting",
    type: "fade" | "slide" | "scale" = "fade",
    duration: number = 300,
  ) => {
    const transition = `all ${duration}ms ${designTokens.animation.easing.easeInOut}`;

    const stages = {
      fade: {
        entering: css`
          opacity: 0;
          transition: ${transition};
        `,
        entered: css`
          opacity: 1;
          transition: ${transition};
        `,
        exiting: css`
          opacity: 0;
          transition: ${transition};
        `,
      },
      slide: {
        entering: css`
          opacity: 0;
          transform: translateX(20px);
          transition: ${transition};
        `,
        entered: css`
          opacity: 1;
          transform: translateX(0);
          transition: ${transition};
        `,
        exiting: css`
          opacity: 0;
          transform: translateX(-20px);
          transition: ${transition};
        `,
      },
      scale: {
        entering: css`
          opacity: 0;
          transform: scale(0.98);
          transition: ${transition};
        `,
        entered: css`
          opacity: 1;
          transform: scale(1);
          transition: ${transition};
        `,
        exiting: css`
          opacity: 0;
          transform: scale(1.02);
          transition: ${transition};
        `,
      },
    };

    return stages[type][stage];
  },
};
