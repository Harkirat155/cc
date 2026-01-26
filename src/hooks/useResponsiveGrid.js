/**
 * useResponsiveGrid - Responsive Grid Configuration Hook
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Only calculates grid-related responsive values
 * - Open/Closed: Extend by adding new grid sizes, not modifying existing
 * - Dependency Inversion: Components depend on abstract config, not hard-coded values
 * 
 * Supports extensible grid configurations (3x3, 4x4, 5x5, etc.)
 * Based on industry UX best practices for touch targets and readability.
 */

import { useMemo } from 'react';
import useWindowSize from './useWindowSize';

/**
 * Grid configuration presets
 * Easily extensible - add new grid types without modifying hook logic
 */
const GRID_CONFIGS = {
  '3x3': {
    size: 3,
    /** Minimum cell size for touch accuracy (px) */
    minCellSize: 70,
    /** Ideal cell size at medium screens (px) */
    idealCellSize: 90,
    /** Maximum cell size to prevent oversized grids (px) */
    maxCellSize: 110,
    /** Gap between cells (px) */
    gap: 12,
    /** Container padding (px) */
    padding: 20,
    /** Mark font scale relative to cell size */
    markScale: 0.45,
  },
  '4x4': {
    size: 4,
    minCellSize: 55,
    idealCellSize: 70,
    maxCellSize: 90,
    gap: 10,
    padding: 16,
    markScale: 0.4,
  },
  '5x5': {
    size: 5,
    minCellSize: 48,
    idealCellSize: 60,
    maxCellSize: 80,
    gap: 8,
    padding: 14,
    markScale: 0.35,
  },
};

/**
 * Breakpoint definitions (in pixels)
 * Matches CSS design tokens for consistency
 */
const BREAKPOINTS = {
  xs: 320,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

/**
 * Calculate responsive grid dimensions
 * @param {object} config - Grid configuration
 * @param {number} viewportWidth - Current viewport width
 * @returns {object} Calculated dimensions
 */
const calculateGridDimensions = (config, viewportWidth) => {
  const { size, minCellSize, maxCellSize, gap, padding } = config;
  
  // Available width: 90% of viewport minus padding
  const availableWidth = Math.min(viewportWidth * 0.9, 520);
  
  // Calculate cell size that fits the viewport
  const totalGaps = (size - 1) * gap;
  const calculatedCellSize = (availableWidth - totalGaps - padding * 2) / size;
  
  // Clamp cell size within bounds
  const cellSize = Math.max(minCellSize, Math.min(calculatedCellSize, maxCellSize));
  
  // Calculate actual grid width
  const gridWidth = cellSize * size + totalGaps + padding * 2;
  
  return {
    cellSize,
    gridWidth,
    gap,
    padding,
    totalSize: gridWidth,
  };
};

/**
 * Get current breakpoint name
 * @param {number} width - Viewport width
 * @returns {string} Breakpoint name
 */
const getBreakpoint = (width) => {
  if (width < BREAKPOINTS.sm) return 'xs';
  if (width < BREAKPOINTS.md) return 'sm';
  if (width < BREAKPOINTS.lg) return 'md';
  if (width < BREAKPOINTS.xl) return 'lg';
  return 'xl';
};

/**
 * Responsive sizing hook for game grid and related elements
 * 
 * @param {object} options - Configuration options
 * @param {string} options.gridType - Grid type key ('3x3', '4x4', '5x5')
 * @returns {object} Responsive configuration values
 * 
 * @example
 * const { cellSize, gridWidth, breakpoint, isCompact } = useResponsiveGrid({ gridType: '3x3' });
 */
export const useResponsiveGrid = ({ gridType = '3x3' } = {}) => {
  const { width: viewportWidth, height: viewportHeight } = useWindowSize();
  
  return useMemo(() => {
    const config = GRID_CONFIGS[gridType] || GRID_CONFIGS['3x3'];
    const breakpoint = getBreakpoint(viewportWidth);
    
    // Calculate grid dimensions
    const dimensions = calculateGridDimensions(config, viewportWidth);
    
    // Determine layout mode based on available height
    // Compact mode when height is constrained (e.g., landscape mobile)
    const isCompact = viewportHeight < 710;
    const isLandscape = viewportWidth > viewportHeight;
    
    // Calculate responsive text sizes based on cell size
    const markSize = Math.round(dimensions.cellSize * config.markScale);
    
    // Touch target validation (ensure minimum 44px)
    const touchTargetValid = dimensions.cellSize >= 44;
    
    return {
      // Grid configuration
      gridType,
      gridSize: config.size,
      
      // Calculated dimensions
      cellSize: dimensions.cellSize,
      cellSizePx: `${dimensions.cellSize}px`,
      gridWidth: dimensions.gridWidth,
      gridWidthPx: `${dimensions.gridWidth}px`,
      gap: dimensions.gap,
      gapPx: `${dimensions.gap}px`,
      padding: dimensions.padding,
      paddingPx: `${dimensions.padding}px`,
      
      // Mark sizing
      markSize,
      markSizePx: `${markSize}px`,
      
      // Layout context
      breakpoint,
      isCompact,
      isLandscape,
      isMobile: breakpoint === 'xs' || breakpoint === 'sm',
      isTablet: breakpoint === 'md',
      isDesktop: breakpoint === 'lg' || breakpoint === 'xl',
      
      // Viewport info
      viewportWidth,
      viewportHeight,
      
      // Validation
      touchTargetValid,
      
      // Raw config for advanced usage
      config,
    };
  }, [viewportWidth, viewportHeight, gridType]);
};

/**
 * Responsive text sizing hook
 * Returns CSS class strings for fluid typography
 * 
 * @returns {object} Typography utility classes and values
 */
export const useResponsiveText = () => {
  const { width } = useWindowSize();
  
  return useMemo(() => {
    const breakpoint = getBreakpoint(width);
    const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
    
    return {
      breakpoint,
      isMobile,
      
      // Returns appropriate Tailwind classes based on breakpoint
      // Can be used directly in className props
      label: isMobile ? 'text-xs' : 'text-sm',
      body: isMobile ? 'text-sm' : 'text-base',
      heading: isMobile ? 'text-lg' : 'text-xl',
      title: isMobile ? 'text-xl' : 'text-2xl',
      display: isMobile ? 'text-2xl' : 'text-3xl',
      
      // Raw size values for inline styles
      sizes: {
        label: isMobile ? 12 : 14,
        body: isMobile ? 14 : 16,
        heading: isMobile ? 18 : 20,
        title: isMobile ? 20 : 24,
        score: isMobile ? 24 : 30,
      },
    };
  }, [width]);
};

/**
 * Responsive touch target hook
 * Ensures elements meet minimum touch target requirements
 * 
 * @param {object} options - Configuration
 * @param {number} options.baseSize - Base element size
 * @returns {object} Touch-optimized dimensions
 */
export const useResponsiveTouchTarget = ({ baseSize = 24 } = {}) => {
  const MIN_TOUCH_TARGET = 44;
  
  return useMemo(() => {
    const needsPadding = baseSize < MIN_TOUCH_TARGET;
    const padding = needsPadding ? Math.ceil((MIN_TOUCH_TARGET - baseSize) / 2) : 0;
    const effectiveSize = Math.max(baseSize, MIN_TOUCH_TARGET);
    
    return {
      size: baseSize,
      padding,
      paddingPx: `${padding}px`,
      effectiveSize,
      effectiveSizePx: `${effectiveSize}px`,
      needsPadding,
    };
  }, [baseSize]);
};

export default useResponsiveGrid;

// Export config for testing and advanced usage
export { GRID_CONFIGS, BREAKPOINTS };
