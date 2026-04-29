import React from 'react';
import { css } from '@emotion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../stores/appStore';
import { designTokens, easings } from '../../styles/design-system';
import { mobileNavItems } from './routeMeta';

export const MobileBottomTabNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTheme } = useTheme();

   const navStyles = css`
     position: fixed;
     bottom: 0;
     left: 0;
     right: 0;
     height: 64px;
     background: ${effectiveTheme === 'dark'
       ? 'rgba(15, 23, 42, 0.85)'
       : 'rgba(255, 255, 255, 0.9)'};
     backdrop-filter: blur(16px);
     -webkit-backdrop-filter: blur(16px);
     border-top: 1px solid
       ${effectiveTheme === 'dark'
         ? designTokens.colors.neutral[800]
         : designTokens.colors.neutral[200]};
     display: flex;
     align-items: center;
     justify-content: space-around;
     padding: 0 ${designTokens.spacing[2]};
     z-index: ${designTokens.zIndex.sticky};
     box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);

    @media (min-width: ${designTokens.breakpoints.md}) {
      display: none;
    }
  `;

  const tabStyles = (isActive: boolean) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: ${isActive ? designTokens.colors.primary[500] : designTokens.colors.neutral[500]};
    text-decoration: none;
    font-size: 10px;
    font-weight: ${isActive ? '600' : '500'};
    transition: all 150ms ease-out;
    padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
    border-radius: ${designTokens.borderRadius.sm};
    flex: 1;
    min-width: 0;
    -webkit-tap-highlight-color: transparent;

    &:active {
      transform: scale(0.92);
      background: ${effectiveTheme === 'dark'
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.05)'};
    }
  `;

  const iconContainerStyles = (isActive: boolean) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    transition: ${easings.smooth};
    ${isActive
      ? `
      transform: translateY(-2px);
      color: ${designTokens.colors.primary[500]};
    `
      : ''}
  `;

  return (
    <nav css={navStyles} aria-label="Main navigation">
      {mobileNavItems.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.id}
            css={tabStyles(isActive)}
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div css={iconContainerStyles(isActive)}>{tab.icon}</div>
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
                textAlign: 'center',
              }}
            >
              {tab.shortLabel || tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomTabNav;
