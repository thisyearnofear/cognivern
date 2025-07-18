# Responsive Layout System

This document outlines the improved responsive layout architecture for the Cognivern frontend, designed to address viewport utilization and sidebar consistency issues while maintaining DRY, clean, organized, and modular code principles.

## Overview

The new layout system provides:
- **Consistent viewport utilization** across all screen sizes
- **Reliable sidebar behavior** with proper responsive states
- **Modular layout components** for reusable patterns
- **Performance-optimized** responsive behavior
- **Accessibility-first** design approach

## Architecture

### Core Components

#### 1. ResponsiveLayout.tsx
The foundation of the responsive system, providing:

- **LayoutProvider**: Context provider for layout state management
- **Container**: Responsive container with optimal max-widths
- **Grid/GridItem**: Flexible grid system with responsive columns
- **Flex**: Utility component for flexbox layouts
- **Spacer**: Consistent spacing component

```tsx
import { LayoutProvider, Container, Grid, GridItem } from './ResponsiveLayout';

// Usage example
<LayoutProvider>
  <Container>
    <Grid columns={{ xs: 1, md: 2, lg: 3 }}>
      <GridItem span={{ xs: 1, lg: 2 }}>Content</GridItem>
    </Grid>
  </Container>
</LayoutProvider>
```

#### 2. ImprovedAppLayout.tsx
Enhanced main layout component featuring:

- **Responsive grid system** that adapts to screen size
- **Smart sidebar management** with proper state handling
- **Performance optimizations** with smooth transitions
- **Accessibility features** including focus management

#### 3. ImprovedSidebar.tsx
Redesigned sidebar with:

- **Consistent visibility states**: expanded, collapsed, hidden, overlay
- **Touch-friendly interactions** for mobile devices
- **Keyboard navigation support**
- **Smooth animations** and transitions

#### 4. ContentWrapper.tsx
Specialized wrapper components:

- **ContentWrapper**: General-purpose content container
- **DashboardWrapper**: Optimized for dashboard layouts
- **PageWrapper**: Full-page content with background
- **ModalContentWrapper**: Modal-specific content handling

### Responsive Breakpoints

The system uses a mobile-first approach with the following breakpoints:

```typescript
const breakpoints = {
  sm: '640px',   // Small tablets and large phones
  md: '768px',   // Tablets
  lg: '1024px',  // Small desktops
  xl: '1280px',  // Large desktops
  '2xl': '1536px' // Extra large screens
};
```

### Layout States

#### Sidebar States
- **expanded**: Full width sidebar (280-320px depending on screen size)
- **collapsed**: Minimal sidebar (80px) with icons only
- **hidden**: Sidebar completely hidden (mobile)
- **overlay**: Sidebar overlays content (tablet touch devices)

#### Responsive Behavior
- **Mobile (< 1024px)**: Sidebar hidden by default, overlay when opened
- **Tablet (768px - 1024px)**: Collapsed sidebar or overlay for touch devices
- **Desktop (≥ 1024px)**: Expanded sidebar with collapse option

## Usage Examples

### Basic Layout Setup

```tsx
import { ImprovedAppLayout } from './components/layout/ImprovedAppLayout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ImprovedAppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="trading" element={<Trading />} />
        </Route>
      </Routes>
    </Router>
  );
}
```

### Dashboard with Responsive Grid

```tsx
import { DashboardWrapper, Grid, GridItem } from './components/layout/ResponsiveLayout';

function Dashboard() {
  return (
    <DashboardWrapper
      title="Dashboard"
      subtitle="System overview and metrics"
      actions={<Button>New Agent</Button>}
    >
      <Grid columns={{ xs: 1, sm: 2, lg: 4 }}>
        <GridItem><MetricCard /></GridItem>
        <GridItem><MetricCard /></GridItem>
        <GridItem span={{ xs: 1, lg: 2 }}><ChartCard /></GridItem>
      </Grid>
    </DashboardWrapper>
  );
}
```

### Custom Responsive Component

```tsx
import { useLayout } from './components/layout/ResponsiveLayout';
import { responsive } from './utils/responsive';

function CustomComponent() {
  const { isCompactMode, sidebarState } = useLayout();
  
  const columns = responsive.getValue({
    sm: 1,
    md: 2,
    lg: sidebarState === 'expanded' ? 2 : 3,
    xl: 4
  });
  
  return (
    <Grid columns={columns}>
      {/* Content */}
    </Grid>
  );
}
```

## Utility Functions

### Responsive Utilities (`utils/responsive.ts`)

#### Viewport Detection
```typescript
import { viewport } from './utils/responsive';

// Check current breakpoint
const breakpoint = viewport.getCurrentBreakpoint(); // 'sm' | 'md' | 'lg' | 'xl' | '2xl'

// Device type detection
const isMobile = viewport.isMobile();
const isTablet = viewport.isTablet();
const isDesktop = viewport.isDesktop();
const isTouch = viewport.isTouch();
```

#### Responsive Values
```typescript
import { responsive } from './utils/responsive';

// Get value based on current breakpoint
const padding = responsive.getValue({
  sm: '16px',
  md: '24px',
  lg: '32px'
});

// Generate responsive CSS
const css = responsive.css('padding', {
  sm: '16px',
  md: '24px',
  lg: '32px'
});
```

#### Layout Calculations
```typescript
import { layout } from './utils/responsive';

// Get optimal layout configuration
const config = layout.getOptimalLayout(800); // min content width
// Returns: { sidebarState, sidebarWidth, contentMaxWidth, containerPadding, ... }

// Check if sidebar should collapse
const shouldCollapse = layout.shouldCollapseSidebar(800, 280);
```

## Performance Optimizations

### 1. Lazy Loading
Components are lazy-loaded to reduce initial bundle size:

```tsx
const Dashboard = lazy(() => import('./components/dashboard/ResponsiveDashboard'));
```

### 2. Debounced Resize Handling
Resize events are debounced to prevent excessive re-renders:

```typescript
import { performance } from './utils/responsive';

const debouncedResize = performance.debounceResize(() => {
  // Handle resize
}, 150);
```

### 3. Efficient State Management
Layout state is managed efficiently with context to prevent unnecessary re-renders.

### 4. CSS-in-JS Optimizations
Emotion CSS-in-JS is used for dynamic styling with proper caching.

## Accessibility Features

### 1. Keyboard Navigation
- Sidebar can be toggled with keyboard shortcuts
- Focus management when sidebar state changes
- Proper tab order maintained

### 2. Screen Reader Support
- Semantic HTML structure
- Proper ARIA labels and roles
- Descriptive text for interactive elements

### 3. Reduced Motion Support
- Respects `prefers-reduced-motion` setting
- Smooth transitions that can be disabled

### 4. High Contrast Support
- Adapts to `prefers-contrast: high`
- Sufficient color contrast ratios

## Migration Guide

### From Old Layout System

1. **Replace AppLayout import**:
   ```tsx
   // Old
   import AppLayout from './components/layout/AppLayout';
   
   // New
   import ImprovedAppLayout from './components/layout/ImprovedAppLayout';
   ```

2. **Wrap content with responsive containers**:
   ```tsx
   // Old
   <div className="content">
     <div className="grid">
       <div className="card">Content</div>
     </div>
   </div>
   
   // New
   <DashboardWrapper title="Page Title">
     <Grid columns={{ xs: 1, md: 2, lg: 3 }}>
       <GridItem><Card>Content</Card></GridItem>
     </Grid>
   </DashboardWrapper>
   ```

3. **Update responsive logic**:
   ```tsx
   // Old
   const { isMobile } = useBreakpoint();
   
   // New
   const { isCompactMode, sidebarState } = useLayout();
   const isMobile = viewport.isMobile();
   ```

## Best Practices

### 1. Mobile-First Design
Always design for mobile first, then enhance for larger screens:

```tsx
<Grid columns={{ xs: 1, sm: 2, lg: 3 }}>
```

### 2. Content-Aware Layouts
Consider content requirements when choosing layout:

```tsx
// For data-heavy content
<Container maxWidth="1600px">

// For reading content
<Container maxWidth="800px">
```

### 3. Consistent Spacing
Use the spacing scale consistently:

```tsx
<Grid gap={designTokens.spacing[6]}>
<Spacer size={8} />
```

### 4. Performance Considerations
- Use `useLayout` hook sparingly to avoid unnecessary re-renders
- Prefer CSS-based responsive design over JavaScript when possible
- Implement proper loading states for dynamic content

## Testing

### Responsive Testing Checklist
- [ ] Layout works on all breakpoints (320px - 2560px)
- [ ] Sidebar behavior is consistent across devices
- [ ] Content is readable and accessible at all sizes
- [ ] Touch targets are appropriately sized (≥44px)
- [ ] Keyboard navigation works properly
- [ ] Performance is acceptable on slower devices

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Common Issues

1. **Sidebar not responding on mobile**
   - Check if `LayoutProvider` is properly wrapping the app
   - Verify touch event handlers are not being blocked

2. **Content overflow on small screens**
   - Ensure proper `Container` usage with responsive max-widths
   - Check for fixed-width elements that don't scale

3. **Performance issues with frequent re-renders**
   - Use `React.memo` for expensive components
   - Optimize `useLayout` hook usage
   - Check for unnecessary state updates

4. **Accessibility issues**
   - Verify proper semantic HTML structure
   - Test with screen readers
   - Check keyboard navigation flow

## Future Enhancements

- [ ] Add animation presets for common transitions
- [ ] Implement virtual scrolling for large lists
- [ ] Add support for custom breakpoints
- [ ] Create layout templates for common patterns
- [ ] Add RTL (right-to-left) language support
- [ ] Implement advanced grid features (subgrid, masonry)

## Contributing

When contributing to the layout system:

1. Follow the established patterns and naming conventions
2. Add proper TypeScript types for all new components
3. Include responsive behavior in all new components
4. Test across all supported breakpoints and devices
5. Update documentation for any new features or changes
6. Ensure accessibility standards are maintained