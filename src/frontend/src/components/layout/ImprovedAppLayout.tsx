import React, { useEffect } from "react";
import { css } from "@emotion/react";
import { Outlet } from "react-router-dom";
import { useAppStore, useTheme } from "../../stores/appStore";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { usePerformanceMonitor } from "../../hooks/usePerformanceMonitor";
import { designTokens } from "../../styles/designTokens";
import { LayoutProvider, useLayout } from "./ResponsiveLayout";
import ImprovedSidebar from "./ImprovedSidebar";
import Header from "./Header";
import Toast from "../ui/Toast";
import NotificationCenter from "../ui/NotificationCenter";

// Main layout component with responsive behavior
const AppLayoutContent: React.FC = () => {
  const { preferences, error, setError } = useAppStore();
  const { effectiveTheme } = useTheme();
  const { metrics, alerts } = usePerformanceMonitor();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const { sidebarState, sidebarWidth } = useLayout();

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.documentElement.style.colorScheme = effectiveTheme;
  }, [effectiveTheme]);

  // Calculate layout dimensions
  const getSidebarWidth = () => {
    switch (sidebarState) {
      case "expanded":
        return sidebarWidth;
      case "collapsed":
        return 80;
      case "overlay":
        return 0; // Sidebar overlays content, doesn't affect layout
      case "hidden":
        return 0;
      default:
        return 0;
    }
  };

  const layoutStyles = css`
    display: grid;
    min-height: 100vh;
    width: 100vw;
    background: ${effectiveTheme === "dark"
      ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
      : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"};
    transition: grid-template-columns ${designTokens.animation.duration.normal}
      ${designTokens.animation.easing.easeInOut};
    position: relative;
    overflow: hidden; /* Prevent horizontal scroll */

    /* Improved responsive grid system */
    grid-template-rows: 60px 1fr;

    /* Dynamic grid columns based on sidebar state */
    grid-template-columns: ${sidebarState === "hidden" ||
    sidebarState === "overlay"
      ? "1fr"
      : `${getSidebarWidth()}px 1fr`};

    grid-template-areas: ${sidebarState === "hidden" ||
    sidebarState === "overlay"
      ? '"header" "main"'
      : '"sidebar header" "sidebar main"'};

    /* Mobile-specific adjustments */
    @media (max-width: ${designTokens.breakpoints.md}) {
      grid-template-columns: 1fr;
      grid-template-areas:
        "header"
        "main";
    }

    /* Ensure proper viewport utilization on all screen sizes */
    @media (min-width: ${designTokens.breakpoints["2xl"]}) {
      max-width: none; /* Remove any max-width constraints */
    }
  `;

  const mainStyles = css`
    grid-area: main;
    overflow-y: auto;
    overflow-x: hidden;
    background: transparent;
    position: relative;
    width: 100%;
    height: 100%;

    /* Smooth scrolling */
    scroll-behavior: smooth;

    /* Better space utilization */
    display: flex;
    flex-direction: column;

    /* Custom scrollbar */
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[800]
        : designTokens.colors.neutral[100]};
    }

    &::-webkit-scrollbar-thumb {
      background: ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[600]
        : designTokens.colors.neutral[400]};
      border-radius: ${designTokens.borderRadius.full};
    }

    &::-webkit-scrollbar-thumb:hover {
      background: ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[500]
        : designTokens.colors.neutral[500]};
    }

    /* Ensure content uses full available space */
    & > * {
      flex: 1;
      min-height: 0; /* Allow flex items to shrink */
    }
  `;

  const contentWrapperStyles = css`
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;

    /* Ensure content fills available space */
    flex: 1;
    min-height: 0;

    /* Add backdrop for mobile when sidebar is overlay */
    ${isMobile && sidebarState === "overlay"
      ? `
      &::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: ${designTokens.zIndex.overlay};
        backdrop-filter: blur(4px);
        pointer-events: auto;
      }
    `
      : ""}

    /* Optimize for different content types */
    & > * {
      width: 100%;
      flex-shrink: 0;
    }

    /* Special handling for dashboard content */
    & > [data-dashboard="true"] {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
  `;

  return (
    <div css={layoutStyles}>
      <ImprovedSidebar />
      <Header />
      <main css={mainStyles}>
        <div css={contentWrapperStyles}>
          <Outlet />
        </div>
      </main>

      {/* Global Toast Notifications */}
      {error && (
        <Toast
          type="error"
          message={error}
          onClose={() => setError(null)}
          duration={5000}
        />
      )}

      {/* Performance Alerts */}
      {alerts.map((alert, index) => (
        <Toast
          key={index}
          type="warning"
          message={`Performance Alert: ${alert.message}`}
          duration={8000}
        />
      ))}

      {/* Notification Center */}
      <NotificationCenter />
    </div>
  );
};

// Main layout wrapper with provider
export const ImprovedAppLayout: React.FC = () => {
  const { preferences } = useAppStore();

  return (
    <LayoutProvider
      initialSidebarState={
        preferences.sidebarCollapsed ? "collapsed" : "expanded"
      }
    >
      <AppLayoutContent />
    </LayoutProvider>
  );
};

export default ImprovedAppLayout;
