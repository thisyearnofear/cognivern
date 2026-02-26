import React, { useRef, useEffect, useState } from "react";
import { designTokens } from "../../styles/designTokens";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { chartStyles } from "../../styles/design-system";

export interface ChartDataPoint {
  x: number | string;
  y: number;
  label?: string;
  color?: string;
}

export interface ChartProps {
  data: ChartDataPoint[];
  type: "line" | "bar" | "area" | "pie";
  width?: number;
  height?: number;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  interactive?: boolean;
  colors?: string[];
  animate?: boolean;
}

export const Chart: React.FC<ChartProps> = ({
  data,
  type,
  width,
  height = 300,
  title,
  xAxisLabel,
  yAxisLabel,
  showGrid = true,
  showTooltip = true,
  interactive = true,
  colors = [
    designTokens.colors.primary[500],
    designTokens.colors.semantic.success[500],
    designTokens.colors.semantic.warning[500],
    designTokens.colors.semantic.error[500],
    designTokens.colors.secondary[500],
  ],
  animate = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { isMobile } = useBreakpoint();

  const actualWidth = width || containerRef.current?.clientWidth || 400;
  const actualHeight = height;

  // Chart dimensions with padding
  const padding = {
    top: 40,
    right: 40,
    bottom: 60,
    left: 60,
  };

  const chartWidth = actualWidth - padding.left - padding.right;
  const chartHeight = actualHeight - padding.top - padding.bottom;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = actualWidth;
    canvas.height = actualHeight;

    // Clear canvas
    ctx.clearRect(0, 0, actualWidth, actualHeight);

    // Set up drawing context
    ctx.font = `${designTokens.typography.fontSize.xs} ${designTokens.typography.fontFamily.sans[0]}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Calculate data ranges
    const xValues = data.map((d) => (typeof d.x === "number" ? d.x : 0));
    const yValues = data.map((d) => d.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(0, Math.min(...yValues));
    const yMax = Math.max(...yValues);

    // Scale functions
    const scaleX = (x: number) =>
      padding.left + ((x - xMin) / (xMax - xMin)) * chartWidth;
    const scaleY = (y: number) =>
      padding.top + chartHeight - ((y - yMin) / (yMax - yMin)) * chartHeight;

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = designTokens.colors.neutral[200];
      ctx.lineWidth = 1;

      // Vertical grid lines
      for (let i = 0; i <= 5; i++) {
        const x = padding.left + (i / 5) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
      }

      // Horizontal grid lines
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (i / 5) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }
    }

    // Draw axes
    ctx.strokeStyle = designTokens.colors.neutral[400];
    ctx.lineWidth = 2;

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = designTokens.colors.neutral[600];
    ctx.font = `${designTokens.typography.fontSize.sm} ${designTokens.typography.fontFamily.sans[0]}`;

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const value = yMin + (i / 5) * (yMax - yMin);
      const y = padding.top + chartHeight - (i / 5) * chartHeight;
      ctx.textAlign = "right";
      ctx.fillText(value.toFixed(1), padding.left - 10, y);
    }

    // X-axis labels
    for (let i = 0; i <= 5; i++) {
      const value = xMin + (i / 5) * (xMax - xMin);
      const x = padding.left + (i / 5) * chartWidth;
      ctx.textAlign = "center";
      ctx.fillText(value.toFixed(1), x, padding.top + chartHeight + 20);
    }

    // Draw chart based on type
    switch (type) {
      case "line":
        drawLineChart(ctx, data, scaleX, scaleY, colors[0]);
        break;
      case "bar":
        drawBarChart(ctx, data, scaleX, scaleY, colors);
        break;
      case "area":
        drawAreaChart(ctx, data, scaleX, scaleY, colors[0]);
        break;
      case "pie":
        drawPieChart(
          ctx,
          data,
          actualWidth / 2,
          actualHeight / 2,
          Math.min(chartWidth, chartHeight) / 3,
          colors,
        );
        break;
    }

    // Draw title
    if (title) {
      ctx.fillStyle = designTokens.colors.neutral[900];
      ctx.font = `${designTokens.typography.fontWeight.semibold} ${designTokens.typography.fontSize.lg} ${designTokens.typography.fontFamily.sans[0]}`;
      ctx.textAlign = "center";
      ctx.fillText(title, actualWidth / 2, 20);
    }

    // Draw axis labels
    if (xAxisLabel) {
      ctx.fillStyle = designTokens.colors.neutral[600];
      ctx.font = `${designTokens.typography.fontSize.sm} ${designTokens.typography.fontFamily.sans[0]}`;
      ctx.textAlign = "center";
      ctx.fillText(xAxisLabel, actualWidth / 2, actualHeight - 10);
    }

    if (yAxisLabel) {
      ctx.save();
      ctx.translate(15, actualHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = designTokens.colors.neutral[600];
      ctx.font = `${designTokens.typography.fontSize.sm} ${designTokens.typography.fontFamily.sans[0]}`;
      ctx.textAlign = "center";
      ctx.fillText(yAxisLabel, 0, 0);
      ctx.restore();
    }
  }, [
    data,
    actualWidth,
    actualHeight,
    type,
    colors,
    showGrid,
    title,
    xAxisLabel,
    yAxisLabel,
  ]);

  const drawLineChart = (
    ctx: CanvasRenderingContext2D,
    data: ChartDataPoint[],
    scaleX: (x: number) => number,
    scaleY: (y: number) => number,
    color: string,
  ) => {
    if (data.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    data.forEach((point, index) => {
      const x = scaleX(typeof point.x === "number" ? point.x : index);
      const y = scaleY(point.y);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw points
    ctx.fillStyle = color;
    data.forEach((point, index) => {
      const x = scaleX(typeof point.x === "number" ? point.x : index);
      const y = scaleY(point.y);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const drawBarChart = (
    ctx: CanvasRenderingContext2D,
    data: ChartDataPoint[],
    scaleX: (x: number) => number,
    scaleY: (y: number) => number,
    colors: string[],
  ) => {
    const barWidth = (chartWidth / data.length) * 0.8;

    data.forEach((point, index) => {
      const x =
        scaleX(typeof point.x === "number" ? point.x : index) - barWidth / 2;
      const y = scaleY(point.y);
      const height = scaleY(0) - y;

      ctx.fillStyle = point.color || colors[index % colors.length];
      ctx.fillRect(x, y, barWidth, height);

      // Add border
      ctx.strokeStyle = designTokens.colors.neutral[300];
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, height);
    });
  };

  const drawAreaChart = (
    ctx: CanvasRenderingContext2D,
    data: ChartDataPoint[],
    scaleX: (x: number) => number,
    scaleY: (y: number) => number,
    color: string,
  ) => {
    if (data.length < 2) return;

    // Create gradient
    const gradient = ctx.createLinearGradient(
      0,
      padding.top,
      0,
      padding.top + chartHeight,
    );
    gradient.addColorStop(0, color + "40"); // 25% opacity
    gradient.addColorStop(1, color + "10"); // 6% opacity

    // Draw area
    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Start from bottom-left
    const firstX = scaleX(typeof data[0].x === "number" ? data[0].x : 0);
    ctx.moveTo(firstX, scaleY(0));

    // Draw to first point
    ctx.lineTo(firstX, scaleY(data[0].y));

    // Draw line through all points
    data.forEach((point, index) => {
      const x = scaleX(typeof point.x === "number" ? point.x : index);
      const y = scaleY(point.y);
      ctx.lineTo(x, y);
    });

    // Close area to bottom
    const lastX = scaleX(
      typeof data[data.length - 1].x === "number"
        ? data[data.length - 1].x
        : data.length - 1,
    );
    ctx.lineTo(lastX, scaleY(0));
    ctx.closePath();
    ctx.fill();

    // Draw line on top
    drawLineChart(ctx, data, scaleX, scaleY, color);
  };

  const drawPieChart = (
    ctx: CanvasRenderingContext2D,
    data: ChartDataPoint[],
    centerX: number,
    centerY: number,
    radius: number,
    colors: string[],
  ) => {
    const total = data.reduce((sum, point) => sum + point.y, 0);
    let currentAngle = -Math.PI / 2; // Start from top

    data.forEach((point, index) => {
      const sliceAngle = (point.y / total) * 2 * Math.PI;
      const color = point.color || colors[index % colors.length];

      // Draw slice
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(
        centerX,
        centerY,
        radius,
        currentAngle,
        currentAngle + sliceAngle,
      );
      ctx.closePath();
      ctx.fill();

      // Draw border
      ctx.strokeStyle = designTokens.colors.neutral[0];
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
      const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

      ctx.fillStyle = designTokens.colors.neutral[0];
      ctx.font = `${designTokens.typography.fontWeight.semibold} ${designTokens.typography.fontSize.sm} ${designTokens.typography.fontFamily.sans[0]}`;
      ctx.textAlign = "center";
      ctx.fillText(`${((point.y / total) * 100).toFixed(1)}%`, labelX, labelY);

      currentAngle += sliceAngle;
    });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !showTooltip) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setMousePosition({ x: event.clientX, y: event.clientY });

    // Find closest data point
    let closestPoint: ChartDataPoint | null = null;
    let minDistance = Infinity;

    data.forEach((point, index) => {
      const pointX =
        padding.left +
        ((typeof point.x === "number" ? point.x : index) / (data.length - 1)) *
          chartWidth;
      const pointY =
        padding.top +
        chartHeight -
        (point.y / Math.max(...data.map((d) => d.y))) * chartHeight;

      const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
      if (distance < minDistance && distance < 20) {
        minDistance = distance;
        closestPoint = point;
      }
    });

    setHoveredPoint(closestPoint);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div ref={containerRef} css={chartStyles.container}>
      <canvas
        ref={canvasRef}
        css={chartStyles.canvas}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {hoveredPoint && showTooltip && (
        <div css={chartStyles.tooltip(mousePosition.x, mousePosition.y)}>
          <div>
            <strong>{hoveredPoint.label || "Value"}</strong>
          </div>
          <div>X: {hoveredPoint.x}</div>
          <div>Y: {hoveredPoint.y}</div>
        </div>
      )}
    </div>
  );
};

export default Chart;
