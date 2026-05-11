/** @jsxImportSource @emotion/react */
import React, { useRef, useEffect, useState } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens, chartColors, chartStyles } from '../../styles/design-system';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Maximize2,
  Minimize2,
  Download,
  Info,
  ChevronDown,
} from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';

export interface ChartDataPoint {
  x: number | string;
  y: number;
  label?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface ChartSeries {
  id: string;
  name: string;
  data: ChartDataPoint[];
  color?: string;
  visible?: boolean;
}

export interface DrilldownConfig {
  enabled: boolean;
  onDrilldown?: (point: ChartDataPoint, series: ChartSeries) => void;
  drilldownLabel?: string;
}

export interface ChartProps {
  data?: ChartDataPoint[];
  series?: ChartSeries[];
  type?: 'line' | 'bar' | 'area' | 'pie' | 'donut' | 'stacked-bar';
  width?: number;
  height?: number;
  title?: string;
  subtitle?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  interactive?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  colors?: string[];
  animate?: boolean;
  drilldown?: DrilldownConfig;
  compact?: boolean;
  showValues?: boolean;
  comparisonMode?: boolean;
  comparisonLabel?: string;
  onExport?: () => void;
  trend?: number;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
`;

// Trend indicator component
const TrendIndicator: React.FC<{ value: number; unit?: string }> = ({ value, unit = '%' }) => {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div
      css={css`
        display: inline-flex;
        align-items: center;
        gap: ${designTokens.spacing[1]};
        padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
        border-radius: ${designTokens.borderRadius.sm};
        font-size: ${designTokens.typography.fontSize.xs};
        font-weight: ${designTokens.typography.fontWeight.medium};
        background: ${isNeutral
          ? 'var(--bg-secondary)'
          : isPositive
            ? designTokens.colors.semantic.success[100]
            : designTokens.colors.semantic.error[100]};
        color: ${isNeutral
          ? 'var(--text-muted)'
          : isPositive
            ? designTokens.colors.semantic.success[700]
            : designTokens.colors.semantic.error[700]};
      `}
    >
      {isNeutral ? (
        <Minus size={12} />
      ) : isPositive ? (
        <TrendingUp size={12} />
      ) : (
        <TrendingDown size={12} />
      )}
      {Math.abs(value).toFixed(1)}
      {unit}
    </div>
  );
};

// Sparkline for inline display
export const Sparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ data, width = 60, height = 24, color, trend = 'neutral' }) => {
  const strokeColor =
    color ||
    (trend === 'up'
      ? designTokens.colors.semantic.success[500]
      : trend === 'down'
        ? designTokens.colors.semantic.error[500]
        : designTokens.colors.neutral[500]);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// Chart tooltip
const ChartTooltip: React.FC<{
  point: ChartDataPoint;
  series?: ChartSeries;
  position: { x: number; y: number };
}> = ({ point, series, position }) => (
  <div
    css={css`
      position: fixed;
      left: ${position.x + 12}px;
      top: ${position.y - 12}px;
      z-index: ${designTokens.zIndex.tooltip};
      padding: ${designTokens.spacing[3]};
      background: var(--bg-primary);
      border: 1px solid var(--border-subtle);
      border-radius: ${designTokens.borderRadius.md};
      box-shadow: ${designTokens.shadows.lg};
      min-width: 140px;
      animation: ${fadeIn} 0.15s ease-out;
    `}
  >
    {series && (
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[2]};
          margin-bottom: ${designTokens.spacing[2]};
          padding-bottom: ${designTokens.spacing[2]};
          border-bottom: 1px solid var(--border-subtle);
        `}
      >
        <div
          css={css`
            width: 8px;
            height: 8px;
            border-radius: 2px;
            background: ${series.color};
          `}
        />
        <span
          css={css`
            font-size: ${designTokens.typography.fontSize.xs};
            color: var(--text-muted);
          `}
        >
          {series.name}
        </span>
      </div>
    )}
    <div
      css={css`
        font-size: ${designTokens.typography.fontSize.xs};
        color: var(--text-secondary);
        margin-bottom: ${designTokens.spacing[1]};
      `}
    >
      {point.label || point.x}
    </div>
    <div
      css={css`
        font-size: ${designTokens.typography.fontSize.base};
        font-weight: ${designTokens.typography.fontWeight.semibold};
        color: var(--text-primary);
      `}
    >
      {typeof point.y === 'number' ? point.y.toLocaleString() : point.y}
    </div>
  </div>
);

// Chart legend
const ChartLegend: React.FC<{
  series: ChartSeries[];
  colors: string[];
  onToggleSeries?: (id: string) => void;
}> = ({ series, colors, onToggleSeries }) => (
  <div
    css={css`
      display: flex;
      flex-wrap: wrap;
      gap: ${designTokens.spacing[4]};
      padding: ${designTokens.spacing[3]} 0;
      border-top: 1px solid var(--border-subtle);
      margin-top: ${designTokens.spacing[4]};
    `}
  >
    {series.map((s, index) => (
      <button
        key={s.id}
        onClick={() => onToggleSeries?.(s.id)}
        css={css`
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[2]};
          padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
          background: ${s.visible === false ? 'transparent' : 'var(--bg-secondary)'};
          border: 1px solid ${s.visible === false ? 'var(--border-subtle)' : 'transparent'};
          border-radius: ${designTokens.borderRadius.sm};
          cursor: pointer;
          opacity: ${s.visible === false ? 0.5 : 1};
          transition: all 0.15s;
          &:hover {
            background: var(--bg-tertiary);
          }
        `}
      >
        <div
          css={css`
            width: 12px;
            height: 12px;
            border-radius: 2px;
            background: ${s.color || colors[index % colors.length]};
          `}
        />
        <span
          css={css`
            font-size: ${designTokens.typography.fontSize.xs};
            color: var(--text-secondary);
          `}
        >
          {s.name}
        </span>
      </button>
    ))}
  </div>
);

export const Chart: React.FC<ChartProps> = ({
  data = [],
  series = [],
  type = 'line',
  width,
  height = 300,
  title,
  subtitle,
  xAxisLabel,
  yAxisLabel,
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  interactive = true,
  colors = chartColors,
  animate = true,
  drilldown,
  compact = false,
  showValues = false,
  comparisonMode = false,
  comparisonLabel,
  onExport,
  trend,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: ChartDataPoint;
    series?: ChartSeries;
    position: { x: number; y: number };
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({});

  const actualWidth = width || containerRef.current?.clientWidth || 400;
  const actualHeight = isExpanded ? height * 1.5 : height;

  // Chart dimensions
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = actualWidth - padding.left - padding.right;
  const chartHeight = actualHeight - padding.top - padding.bottom;

  // Merge data into series format
  const chartSeries: ChartSeries[] = useMemo(() => {
    if (series.length > 0) {
      return series.map((s) => ({ ...s, visible: visibleSeries[s.id] !== false }));
    }
    if (data.length > 0) {
      return [
        {
          id: 'primary',
          name: 'Value',
          data,
          color: colors[0],
          visible: visibleSeries['primary'] !== false,
        },
      ];
    }
    return [];
  }, [series, data, colors, visibleSeries]);

  const handleToggleSeries = (id: string) => {
    setVisibleSeries((prev) => ({ ...prev, [id]: prev[id] === false }));
  };

  // Canvas rendering logic (simplified from original)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartSeries.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = actualWidth;
    canvas.height = actualHeight;
    ctx.clearRect(0, 0, actualWidth, actualHeight);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = designTokens.colors.neutral[100];
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (i / 5) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }
    }

    // Draw series
    chartSeries
      .filter((s) => s.visible !== false)
      .forEach((s, seriesIndex) => {
        const seriesColor = s.color || colors[seriesIndex % colors.length];
        const points = s.data.map((point, i) => ({
          x: padding.left + (i / Math.max(s.data.length - 1, 1)) * chartWidth,
          y:
            padding.top +
            chartHeight -
            (point.y /
              Math.max(...chartSeries.flatMap((s) => s.data.map((d) => Math.abs(d.y))), 1)) *
              chartHeight,
        }));

        // Draw line
        ctx.strokeStyle = seriesColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();

        // Draw points
        ctx.fillStyle = seriesColor;
        points.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
      });

    // Draw axes
    ctx.strokeStyle = designTokens.colors.neutral[300];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();
  }, [chartSeries, actualWidth, actualHeight, colors, showGrid]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !showTooltip) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setMousePosition({ x: event.clientX, y: event.clientY });

    // Find closest point
    chartSeries
      .filter((s) => s.visible !== false)
      .forEach((s) => {
        s.data.forEach((point, index) => {
          const pointX = padding.left + (index / Math.max(s.data.length - 1, 1)) * chartWidth;
          const maxY = Math.max(...chartSeries.flatMap((s) => s.data.map((d) => Math.abs(d.y))), 1);
          const pointY = padding.top + chartHeight - (point.y / maxY) * chartHeight;
          const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
          if (distance < 20) {
            setHoveredPoint({ point, series: s, position: { x: event.clientX, y: event.clientY } });
          }
        });
      });
  };

  const handleMouseLeave = () => setHoveredPoint(null);

  if (chartSeries.length === 0 || chartSeries.every((s) => !s.visible && s.data.length === 0)) {
    return (
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: center;
          height: ${height}px;
          background: var(--bg-secondary);
          border-radius: ${designTokens.borderRadius.lg};
          color: var(--text-muted);
          font-size: ${designTokens.typography.fontSize.sm};
        `}
      >
        No data available
      </div>
    );
  }

  return (
    <div
      css={css`
        position: relative;
        width: ${width || '100%'};
        background: var(--bg-primary);
        border: 1px solid var(--border-subtle);
        border-radius: ${designTokens.borderRadius.lg};
        padding: ${compact ? designTokens.spacing[4] : designTokens.spacing[6]};
        animation: ${animate ? fadeIn : 'none'} 0.3s ease-out;
      `}
    >
      {/* Header */}
      {(title || subtitle || onExport) && (
        <div
          css={css`
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: ${designTokens.spacing[4]};
          `}
        >
          <div
            css={css`
              flex: 1;
            `}
          >
            {title && (
              <h3
                css={css`
                  font-size: ${compact
                    ? designTokens.typography.fontSize.sm
                    : designTokens.typography.fontSize.base};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  color: var(--text-primary);
                  margin: 0;
                `}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                css={css`
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: var(--text-muted);
                  margin: ${designTokens.spacing[1]} 0 0 0;
                `}
              >
                {subtitle}
              </p>
            )}
          </div>
          {trend !== undefined && <TrendIndicator value={trend} />}
          {!compact && (
            <div
              css={css`
                display: flex;
                gap: ${designTokens.spacing[1]};
              `}
            >
              {onExport && (
                <button
                  onClick={onExport}
                  css={css`
                    padding: ${designTokens.spacing[1]};
                    color: var(--text-muted);
                    background: transparent;
                    border: none;
                    border-radius: ${designTokens.borderRadius.sm};
                    cursor: pointer;
                    &:hover {
                      color: var(--text-primary);
                      background: var(--bg-secondary);
                    }
                  `}
                >
                  <Download size={16} />
                </button>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                css={css`
                  padding: ${designTokens.spacing[1]};
                  color: var(--text-muted);
                  background: transparent;
                  border: none;
                  border-radius: ${designTokens.borderRadius.sm};
                  cursor: pointer;
                  &:hover {
                    color: var(--text-primary);
                    background: var(--bg-secondary);
                  }
                `}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          )}
        </div>
      )}

      {comparisonMode && comparisonLabel && (
        <Badge
          variant="info"
          css={css`
            margin-bottom: ${designTokens.spacing[3]};
          `}
        >
          {comparisonLabel}
        </Badge>
      )}

      {/* Canvas chart */}
      <div ref={containerRef} css={chartStyles.container}>
        <canvas
          ref={canvasRef}
          css={chartStyles.canvas}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Axis labels */}
      {xAxisLabel && (
        <div
          css={css`
            text-align: center;
            font-size: ${designTokens.typography.fontSize.xs};
            color: var(--text-muted);
            margin-top: ${designTokens.spacing[2]};
          `}
        >
          {xAxisLabel}
        </div>
      )}
      {yAxisLabel && (
        <div
          css={css`
            position: absolute;
            left: 4px;
            top: 50%;
            transform: rotate(-90deg) translateX(-50%);
            font-size: ${designTokens.typography.fontSize.xs};
            color: var(--text-muted);
          `}
        >
          {yAxisLabel}
        </div>
      )}

      {/* Legend */}
      {showLegend && chartSeries.length > 1 && (
        <ChartLegend series={chartSeries} colors={colors} onToggleSeries={handleToggleSeries} />
      )}

      {/* Tooltip */}
      {hoveredPoint && showTooltip && (
        <ChartTooltip
          point={hoveredPoint.point}
          series={hoveredPoint.series}
          position={hoveredPoint.position}
        />
      )}

      {/* Drilldown */}
      {drilldown?.enabled && (
        <button
          css={css`
            position: absolute;
            top: ${designTokens.spacing[2]};
            right: ${designTokens.spacing[2]};
            padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
            font-size: ${designTokens.typography.fontSize.xs};
            color: ${designTokens.colors.primary[600]};
            background: ${designTokens.colors.primary[50]};
            border: 1px solid ${designTokens.colors.primary[200]};
            border-radius: ${designTokens.borderRadius.sm};
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[1]};
            &:hover {
              background: ${designTokens.colors.primary[100]};
            }
          `}
        >
          <Info size={12} />
          {drilldown.drilldownLabel || 'View details'}
        </button>
      )}
    </div>
  );
};

export default Chart;
