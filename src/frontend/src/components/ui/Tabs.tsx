import { useState, createContext, useContext, ReactNode } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

// Spring-like keyframes for smooth tab indicator
const slideIn = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Tab components with modern, compact design
interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md';
}

interface TabListProps {
  children: ReactNode;
  className?: string;
}

interface TabProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  badge?: string | number;
}

interface TabContentProps {
  value: string;
  children: ReactNode;
}

const TabsContext = createContext<{
  value: string;
  onValueChange: (value: string) => void;
  variant: 'default' | 'pills' | 'underline';
  size: 'sm' | 'md';
} | null>(null);

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  variant = 'underline',
  size = 'md',
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  const value = controlledValue ?? internalValue;
  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange, variant, size }}>
      <div css={styles.tabsContainer}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className }: TabListProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabList must be used within Tabs');

  const { variant, size } = context;

  return (
    <div
      role="tablist"
      className={className}
      css={[
        styles.tabListBase,
        variant === 'underline' && styles.tabListUnderline,
        variant === 'pills' && styles.tabListPills,
        size === 'sm' && styles.tabListSm,
      ]}
    >
      {children}
    </div>
  );
}

export function Tab({ value, children, disabled, icon, badge }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab must be used within Tabs');

  const { value: selectedValue, onValueChange, variant, size } = context;
  const isSelected = selectedValue === value;

  const handleClick = () => {
    if (!disabled) onValueChange(value);
  };

  return (
    <button
      role="tab"
      type="button"
      disabled={disabled}
      aria-selected={isSelected}
      data-state={isSelected ? 'active' : 'inactive'}
      onClick={handleClick}
      css={[
        styles.tabBase,
        variant === 'underline' && styles.tabUnderline(isSelected),
        variant === 'pills' && styles.tabPills(isSelected),
        size === 'sm' && styles.tabSm,
        disabled && styles.tabDisabled,
      ]}
    >
      {icon && <span css={styles.tabIcon}>{icon}</span>}
      <span>{children}</span>
      {badge !== undefined && <span css={styles.tabBadge}>{badge}</span>}
    </button>
  );
}

export function TabContent({ value, children }: TabContentProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabContent must be used within Tabs');

  const { value: selectedValue } = context;
  const isSelected = selectedValue === value;

  if (!isSelected) return null;

  return (
    <div role="tabpanel" data-state="active" css={styles.tabContent} key={value}>
      {children}
    </div>
  );
}

const styles = {
  tabsContainer: css`
    display: flex;
    flex-direction: column;
    width: 100%;
  `,

  tabListBase: css`
    display: flex;
    gap: ${designTokens.spacing[1]};
    position: relative;
  `,

  tabListUnderline: css`
    border-bottom: 1px solid ${designTokens.colors.border.primary};
    gap: 0;
    padding-bottom: 0;
  `,

  tabListPills: css`
    gap: ${designTokens.spacing[2]};
    padding: ${designTokens.spacing[1]};
    background: ${designTokens.colors.background.tertiary};
    border-radius: ${designTokens.borderRadius.lg};
  `,

  tabListSm: css`
    gap: ${designTokens.spacing[1]};
  `,

  tabBase: css`
    display: inline-flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    color: ${designTokens.colors.text.secondary};
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 150ms ease-out;
    position: relative;
    white-space: nowrap;

    &:focus-visible {
      outline: 2px solid ${designTokens.colors.primary[500]};
      outline-offset: 2px;
      border-radius: ${designTokens.borderRadius.sm};
    }

    &:hover:not(:disabled) {
      color: ${designTokens.colors.text.primary};
    }
  `,

  tabUnderline: (isSelected: boolean) => css`
    color: ${isSelected ? designTokens.colors.text.primary : designTokens.colors.text.secondary};
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    margin-bottom: -1px;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: ${designTokens.colors.primary[500]};
      border-radius: ${designTokens.borderRadius.full};
      opacity: ${isSelected ? 1 : 0};
      transform-origin: left;
      transition:
        opacity 200ms ease-out,
        transform 200ms ease-out;
    }

    &:hover::after {
      opacity: ${isSelected ? 1 : 0.5};
    }
  `,

  tabPills: (isSelected: boolean) => css`
    color: ${isSelected ? designTokens.colors.text.primary : designTokens.colors.text.secondary};
    background: ${isSelected ? designTokens.colors.background.primary : 'transparent'};
    border-radius: ${designTokens.borderRadius.md};
    box-shadow: ${isSelected ? designTokens.shadows.sm : 'none'};
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
    transition: all 150ms ease-out;
  `,

  tabSm: css`
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    font-size: ${designTokens.typography.fontSize.xs};
  `,

  tabDisabled: css`
    opacity: 0.5;
    cursor: not-allowed;
  `,

  tabIcon: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 14px;
      height: 14px;
    }
  `,

  tabBadge: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 ${designTokens.spacing[1]};
    font-size: 10px;
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: ${designTokens.colors.text.secondary};
    background: ${designTokens.colors.background.tertiary};
    border-radius: ${designTokens.borderRadius.full};
  `,

  tabContent: css`
    padding-top: ${designTokens.spacing[3]};
    animation: ${fadeIn} 200ms ease-out;
  `,
};

export default { Tabs, TabList, Tab, TabContent };
