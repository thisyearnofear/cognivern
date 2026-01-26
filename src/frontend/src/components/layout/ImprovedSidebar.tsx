import React, { useEffect, useRef } from "react";
import { css } from "@emotion/react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppStore, useTheme } from "../../stores/appStore";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { designTokens } from "../../styles/designTokens";
import { useLayout } from "./ResponsiveLayout";
import { useSidebarState } from "../../hooks/useSidebarState";
import { Button } from "../ui/Button";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  description?: string;
  badge?: string | number;
}

const navigationItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "📊",
    path: "/",
    description: "Overview and metrics",
  },
  {
    id: "trading",
    label: "Trading",
    icon: "💹",
    path: "/trading",
    description: "Trading agents",
  },
  {
    id: "policies",
    label: "Policies",
    icon: "📋",
    path: "/policies",
    description: "Governance rules",
  },
  {
    id: "audit",
    label: "Audit Logs",
    icon: "📝",
    path: "/audit",
    description: "Activity history",
  },
];

export const ImprovedSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { preferences, updatePreferences, user } = useAppStore();
  const { effectiveTheme } = useTheme();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const { sidebarWidth } = useLayout();
  const {
    sidebarState,
    toggleSidebar,
    hideSidebarOnMobile,
    isCollapsed,
    isHidden,
    isOverlay,
  } = useSidebarState();
  const sidebarRef = useRef<HTMLElement>(null);

  // Handle click outside to close sidebar on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMobile &&
        isOverlay &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        hideSidebarOnMobile();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, isOverlay, hideSidebarOnMobile]);

  // Handle escape key to close sidebar
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (isOverlay || (isMobile && !isHidden))) {
        hideSidebarOnMobile();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOverlay, isMobile, isHidden, hideSidebarOnMobile]);

  // Auto-close sidebar on mobile navigation
  useEffect(() => {
    hideSidebarOnMobile();
  }, [location.pathname, hideSidebarOnMobile]);

  if (isHidden && !isMobile) return null;

  const sidebarStyles = css`
    grid-area: sidebar;
    background: ${effectiveTheme === "dark"
      ? `linear-gradient(180deg, ${designTokens.colors.neutral[900]} 0%, ${designTokens.colors.neutral[800]} 100%)`
      : `linear-gradient(180deg, ${designTokens.colors.neutral[0]} 0%, ${designTokens.colors.neutral[50]} 100%)`};
    border-right: 1px solid
      ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[700]
        : designTokens.colors.neutral[200]};
    display: flex;
    flex-direction: column;
    transition: all ${designTokens.animation.duration.normal}
      ${designTokens.animation.easing.easeInOut};
    overflow: hidden;
    position: relative;

    /* Mobile overlay styles */
    ${isOverlay
      ? `
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: ${sidebarWidth}px;
      z-index: ${designTokens.zIndex.modal};
      box-shadow: ${designTokens.shadows["2xl"]};
      transform: translateX(0);
    `
      : ""}

    /* Hidden state for mobile */
    ${isHidden && isMobile
      ? `
      transform: translateX(-100%);
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: ${sidebarWidth}px;
      z-index: ${designTokens.zIndex.modal};
    `
      : ""}
    
    /* Collapsed state */
    ${isCollapsed && !isMobile
      ? `
      width: 80px;
    `
      : ""}
    
    /* Smooth width transitions for desktop */
    @media (min-width: ${designTokens.breakpoints.lg}) {
      width: ${isCollapsed ? "80px" : `${sidebarWidth}px`};
    }
  `;

  const logoStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
    padding: ${designTokens.spacing[6]} ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[4]};
    border-bottom: 1px solid
      ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[700]
        : designTokens.colors.neutral[200]};
    min-height: 80px;

    ${isCollapsed
      ? `
      justify-content: center;
      padding: ${designTokens.spacing[6]} ${designTokens.spacing[2]};
    `
      : ""}
  `;

  const logoIconStyles = css`
    font-size: ${designTokens.typography.fontSize["2xl"]};
    flex-shrink: 0;
  `;

  const logoTextStyles = css`
    opacity: ${isCollapsed ? "0" : "1"};
    transform: ${isCollapsed ? "translateX(-10px)" : "translateX(0)"};
    transition: all ${designTokens.animation.duration.normal}
      ${designTokens.animation.easing.easeInOut};

    h2 {
      margin: 0;
      font-size: ${designTokens.typography.fontSize.xl};
      font-weight: ${designTokens.typography.fontWeight.bold};
      color: ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[100]
        : designTokens.colors.neutral[900]};
      line-height: ${designTokens.typography.lineHeight.tight};
    }

    p {
      margin: 0;
      font-size: ${designTokens.typography.fontSize.sm};
      color: ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[400]
        : designTokens.colors.neutral[500]};
      line-height: ${designTokens.typography.lineHeight.snug};
    }
  `;

  const userInfoStyles = css`
    padding: ${designTokens.spacing[4]};
    background: ${effectiveTheme === "dark"
      ? designTokens.colors.neutral[800]
      : designTokens.colors.neutral[50]};
    border-radius: ${designTokens.borderRadius.lg};
    margin: 0 ${designTokens.spacing[4]} ${designTokens.spacing[6]};
    opacity: ${isCollapsed ? "0" : "1"};
    transform: ${isCollapsed ? "scale(0.9)" : "scale(1)"};
    transition: all ${designTokens.animation.duration.normal}
      ${designTokens.animation.easing.easeInOut};

    ${isCollapsed ? "pointer-events: none;" : ""}
  `;

  const navStyles = css`
    flex: 1;
    padding: 0 ${designTokens.spacing[2]};
    overflow-y: auto;

    /* Custom scrollbar */
    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[600]
        : designTokens.colors.neutral[300]};
      border-radius: ${designTokens.borderRadius.full};
    }
  `;

  const navItemStyles = (isActive: boolean) => css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[1]};
    border-radius: ${designTokens.borderRadius.lg};
    cursor: pointer;
    transition: all ${designTokens.animation.duration.fast}
      ${designTokens.animation.easing.easeInOut};
    border: 1px solid transparent;
    position: relative;

    ${isCollapsed
      ? `
      justify-content: center;
      padding: ${designTokens.spacing[3]} ${designTokens.spacing[2]};
    `
      : ""}

    &:hover {
      background: ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[700]
        : designTokens.colors.neutral[100]};
      transform: translateY(-1px);
    }

    ${isActive
      ? `
      background: ${
        effectiveTheme === "dark"
          ? designTokens.colors.primary[800]
          : designTokens.colors.primary[100]
      };
      color: ${
        effectiveTheme === "dark"
          ? designTokens.colors.primary[200]
          : designTokens.colors.primary[700]
      };
      border-color: ${
        effectiveTheme === "dark"
          ? designTokens.colors.primary[700]
          : designTokens.colors.primary[300]
      };
      box-shadow: ${designTokens.shadows.sm};
    `
      : ""}
  `;

  const navIconStyles = css`
    font-size: ${designTokens.typography.fontSize.xl};
    min-width: ${designTokens.typography.fontSize.xl};
    text-align: center;
    flex-shrink: 0;
  `;

  const navContentStyles = css`
    opacity: ${isCollapsed ? "0" : "1"};
    transform: ${isCollapsed ? "translateX(-10px)" : "translateX(0)"};
    transition: all ${designTokens.animation.duration.normal}
      ${designTokens.animation.easing.easeInOut};
    min-width: 0;
    flex: 1;

    ${isCollapsed ? "pointer-events: none;" : ""}
  `;

  const navLabelStyles = css`
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    line-height: ${designTokens.typography.lineHeight.snug};
    margin-bottom: 2px;
  `;

  const navDescriptionStyles = css`
    font-size: ${designTokens.typography.fontSize.xs};
    opacity: 0.7;
    line-height: ${designTokens.typography.lineHeight.tight};
  `;

  const badgeStyles = css`
    position: absolute;
    top: ${designTokens.spacing[2]};
    right: ${designTokens.spacing[2]};
    background: ${designTokens.colors.semantic.warning[500]};
    color: white;
    font-size: ${designTokens.typography.fontSize.xs};
    font-weight: ${designTokens.typography.fontWeight.bold};
    padding: 2px ${designTokens.spacing[1]};
    border-radius: ${designTokens.borderRadius.full};
    line-height: 1;
    opacity: ${isCollapsed ? "0" : "1"};
    transition: opacity ${designTokens.animation.duration.normal};
  `;

  const toggleStyles = css`
    border-top: 1px solid
      ${effectiveTheme === "dark"
        ? designTokens.colors.neutral[700]
        : designTokens.colors.neutral[200]};
    padding: ${designTokens.spacing[4]};
  `;

  return (
    <>
      <aside ref={sidebarRef} css={sidebarStyles}>
        {/* Logo and Brand */}
        <div css={logoStyles}>
          <span css={logoIconStyles}>🧠</span>
          {!isCollapsed && (
            <div css={logoTextStyles}>
              <h2>Cognivern</h2>
              <p>AI Governance</p>
            </div>
          )}
        </div>

        {/* User Info */}
        {user.isConnected && !isCollapsed && (
          <div css={userInfoStyles}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: designTokens.spacing[3],
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${designTokens.colors.primary[500]}, ${designTokens.colors.primary[600]})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: designTokens.typography.fontSize.sm,
                  fontWeight: designTokens.typography.fontWeight.bold,
                  boxShadow: designTokens.shadows.md,
                }}
              >
                {user.userType?.charAt(0).toUpperCase() || "U"}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: designTokens.typography.fontSize.sm,
                    fontWeight: designTokens.typography.fontWeight.medium,
                    color:
                      effectiveTheme === "dark"
                        ? designTokens.colors.neutral[100]
                        : designTokens.colors.neutral[900],
                    marginBottom: "2px",
                  }}
                >
                  {user.userType || "User"}
                </div>
                {user.address && (
                  <div
                    style={{
                      fontSize: designTokens.typography.fontSize.xs,
                      color:
                        effectiveTheme === "dark"
                          ? designTokens.colors.neutral[400]
                          : designTokens.colors.neutral[500],
                      fontFamily:
                        designTokens.typography.fontFamily.mono.join(", "),
                    }}
                  >
                    {user.address.slice(0, 6)}...{user.address.slice(-4)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav css={navStyles}>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <div
                key={item.id}
                css={navItemStyles(isActive)}
                onClick={() => navigate(item.path)}
                title={isCollapsed ? item.label : undefined}
              >
                <span css={navIconStyles}>{item.icon}</span>
                <div css={navContentStyles}>
                  <div css={navLabelStyles}>{item.label}</div>
                  {item.description && (
                    <div css={navDescriptionStyles}>{item.description}</div>
                  )}
                </div>
                {item.badge && <span css={badgeStyles}>{item.badge}</span>}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Toggle */}
        <div css={toggleStyles}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            style={{
              width: "100%",
              justifyContent: isCollapsed ? "center" : "flex-start",
              gap: isCollapsed ? "0" : designTokens.spacing[2],
            }}
          >
            <span>{isCollapsed ? "→" : "←"}</span>
            {!isCollapsed && <span>Collapse</span>}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default ImprovedSidebar;
