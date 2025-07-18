import { useEffect, useCallback } from 'react';
import { useLayout } from '../components/layout/ResponsiveLayout';
import { useBreakpoint } from './useMediaQuery';
import { useAppStore } from '../stores/appStore';

/**
 * Enhanced sidebar state management hook
 * Provides intelligent sidebar behavior based on viewport and user preferences
 */
export const useSidebarState = () => {
  const { sidebarState, setSidebarState } = useLayout();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const { preferences, updatePreferences } = useAppStore();

  // Save user's sidebar preference for desktop
  const saveSidebarPreference = useCallback((state: 'expanded' | 'collapsed') => {
    if (isDesktop) {
      updatePreferences({
        ...preferences,
        sidebarState: state,
      });
    }
  }, [isDesktop, preferences, updatePreferences]);

  // Intelligent sidebar toggle based on context
  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      // Mobile: toggle between hidden and overlay
      const newState = sidebarState === 'hidden' ? 'overlay' : 'hidden';
      setSidebarState(newState);
    } else if (isTablet) {
      // Tablet: toggle between collapsed and overlay
      const newState = sidebarState === 'collapsed' ? 'overlay' : 'collapsed';
      setSidebarState(newState);
    } else {
      // Desktop: toggle between expanded and collapsed, save preference
      const newState = sidebarState === 'expanded' ? 'collapsed' : 'expanded';
      setSidebarState(newState);
      saveSidebarPreference(newState);
    }
  }, [isMobile, isTablet, sidebarState, setSidebarState, saveSidebarPreference]);

  // Auto-hide sidebar on mobile when navigating
  const hideSidebarOnMobile = useCallback(() => {
    if (isMobile && sidebarState === 'overlay') {
      setSidebarState('hidden');
    }
  }, [isMobile, sidebarState, setSidebarState]);

  // Restore user's sidebar preference on desktop
  useEffect(() => {
    if (isDesktop && preferences.sidebarState) {
      setSidebarState(preferences.sidebarState);
    }
  }, [isDesktop, preferences.sidebarState, setSidebarState]);

  // Auto-adjust sidebar for optimal space utilization
  const optimizeSidebarForContent = useCallback((contentType?: 'dashboard' | 'form' | 'table' | 'chart') => {
    if (!isDesktop) return;

    switch (contentType) {
      case 'dashboard':
      case 'chart':
        // Dashboards and charts benefit from more space
        if (sidebarState === 'expanded') {
          setSidebarState('collapsed');
        }
        break;
      case 'form':
        // Forms can work well with expanded sidebar for navigation
        if (sidebarState === 'collapsed') {
          setSidebarState('expanded');
        }
        break;
      case 'table':
        // Tables need maximum horizontal space
        if (sidebarState === 'expanded') {
          setSidebarState('collapsed');
        }
        break;
      default:
        // Use user preference
        break;
    }
  }, [isDesktop, sidebarState, setSidebarState]);

  return {
    sidebarState,
    setSidebarState,
    toggleSidebar,
    hideSidebarOnMobile,
    optimizeSidebarForContent,
    isCollapsed: sidebarState === 'collapsed',
    isExpanded: sidebarState === 'expanded',
    isHidden: sidebarState === 'hidden',
    isOverlay: sidebarState === 'overlay',
    canToggle: true,
  };
};

export default useSidebarState;