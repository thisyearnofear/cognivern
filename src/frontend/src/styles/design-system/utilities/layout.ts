import { css } from '@emotion/react';
import { designTokens } from '../../designTokens';

// Reusable layout utilities
export const layoutUtils = {
  container: css`
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 ${designTokens.spacing[4]};
    
    @media (min-width: ${designTokens.breakpoints.md}) {
      padding: 0 ${designTokens.spacing[6]};
    }
    
    @media (min-width: ${designTokens.breakpoints.lg}) {
      padding: 0 ${designTokens.spacing[8]};
    }
  `,
  
  grid: css`
    display: grid;
    gap: ${designTokens.spacing[6]};
    
    @media (min-width: ${designTokens.breakpoints.md}) {
      grid-template-columns: repeat(2, 1fr);
    }
    
    @media (min-width: ${designTokens.breakpoints.lg}) {
      grid-template-columns: repeat(3, 1fr);
    }
  `,
  
  flexCenter: css`
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  
  flexBetween: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  
  flexColumn: css`
    display: flex;
    flex-direction: column;
  `,
  
  absoluteCenter: css`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  `,
} as const;

// Responsive utilities
export const responsiveUtils = {
  hideOnMobile: css`
    @media (max-width: ${designTokens.breakpoints.md}) {
      display: none;
    }
  `,
  
  showOnMobile: css`
    display: none;
    
    @media (max-width: ${designTokens.breakpoints.md}) {
      display: block;
    }
  `,
  
  mobileFirst: css`
    @media (min-width: ${designTokens.breakpoints.sm}) {
      /* Tablet styles */
    }
    
    @media (min-width: ${designTokens.breakpoints.lg}) {
      /* Desktop styles */
    }
  `,
} as const;