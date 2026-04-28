/** @jsxImportSource @emotion/react */
import React, { useState } from 'react';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { Card, CardContent } from './Card';
import { Button } from './Button';

export interface CarouselItem {
  id: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  icon?: string;
}

interface InteractiveCarouselProps {
  items: CarouselItem[];
  onItemClick?: (id: string) => void;
}

const carouselContainerStyles = css`
  position: relative;
  width: 100%;
  perspective: 1000px;
  padding: ${designTokens.spacing[10]} 0;
  overflow: hidden;
`;

const carouselTrackStyles = (activeIndex: number) => css`
  display: flex;
  transition: transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  transform: translateX(calc(50% - ${activeIndex * 320 + 150}px));
  gap: ${designTokens.spacing[12]};
  padding: 0 ${designTokens.spacing[10]};
  align-items: center;
`;

const carouselItemStyles = (isActive: boolean, index: number, activeIndex: number) => {
  const distance = Math.abs(index - activeIndex);
  const scale = isActive ? 1.25 : 0.85 / (1 + distance * 0.12);
  const rotateY = isActive ? 0 : index < activeIndex ? 35 : -35;
  const translateZ = isActive ? 150 : -120 * distance;
  const blur = isActive ? 0 : distance * 1.5;

  return css`
    min-width: 320px;
    max-width: 320px;
    transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    transform: perspective(1200px) rotateY(${rotateY}deg) scale(${scale})
      translateZ(${translateZ}px);
    opacity: ${isActive ? 1 : 0.5 / (1 + distance * 0.25)};
    cursor: pointer;
    filter: blur(${blur}px);
    z-index: ${100 - distance};

    &:hover {
      transform: perspective(1200px) rotateY(${rotateY * 0.3}deg) scale(${scale * 1.05})
        translateZ(${translateZ + 30}px);
      opacity: ${isActive ? 1 : 0.8};
    }
  `;
};

const controlStyles = css`
  display: flex;
  justify-content: center;
  gap: ${designTokens.spacing[4]};
  margin-top: ${designTokens.spacing[8]};
`;

const cardHeaderStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  margin-bottom: ${designTokens.spacing[4]};
`;

const iconWrapperStyles = css`
  width: 48px;
  height: 48px;
  background: ${designTokens.colors.primary[100]};
  border-radius: ${designTokens.borderRadius.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
`;

export const InteractiveCarousel: React.FC<InteractiveCarouselProps> = ({ items, onItemClick }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  return (
    <div css={carouselContainerStyles}>
      <div css={carouselTrackStyles(activeIndex)}>
        {items.map((item, index) => (
          <div
            key={item.id}
            css={carouselItemStyles(index === activeIndex, index, activeIndex)}
            onClick={() => {
              if (index === activeIndex) {
                onItemClick?.(item.id);
              } else {
                setActiveIndex(index);
              }
            }}
          >
            <Card
              padding="lg"
              variant={index === activeIndex ? 'elevated' : 'outlined'}
              css={css`
                height: 100%;
                background: ${index === activeIndex
                  ? 'rgba(255, 255, 255, 0.9)'
                  : 'rgba(255, 255, 255, 0.6)'};
                backdrop-filter: blur(12px);
                border: 1px solid
                  ${index === activeIndex
                    ? designTokens.colors.primary[300]
                    : designTokens.colors.neutral[200]};
                box-shadow: ${index === activeIndex
                  ? '0 20px 40px -10px rgba(0, 0, 0, 0.1)'
                  : '0 4px 12px rgba(0, 0, 0, 0.05)'};
                transition: all 0.5s ease;
              `}
            >
              <CardContent>
                <div css={cardHeaderStyles}>
                  {item.icon && (
                    <div
                      css={css`
                        ${iconWrapperStyles}
                        background: ${index === activeIndex
                          ? designTokens.colors.primary[600]
                          : designTokens.colors.primary[100]};
                        color: ${index === activeIndex
                          ? 'white'
                          : designTokens.colors.primary[600]};
                        box-shadow: ${index === activeIndex
                          ? '0 8px 16px -4px rgba(37, 99, 235, 0.4)'
                          : 'none'};
                        transition: all 0.5s ease;
                      `}
                    >
                      {item.icon}
                    </div>
                  )}
                  <div>
                    <h3
                      css={css`
                        margin: 0;
                        font-size: ${designTokens.typography.fontSize.xl};
                        font-weight: ${designTokens.typography.fontWeight.bold};
                        color: ${designTokens.colors.neutral[900]};
                      `}
                    >
                      {item.title}
                    </h3>
                    {item.subtitle && (
                      <p
                        css={css`
                          margin: 0;
                          font-size: ${designTokens.typography.fontSize.sm};
                          color: ${designTokens.colors.neutral[500]};
                          font-weight: ${designTokens.typography.fontWeight.medium};
                        `}
                      >
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <div
                  css={css`
                    color: ${designTokens.colors.neutral[600]};
                    line-height: 1.5;
                  `}
                >
                  {item.content}
                </div>
                <div
                  css={css`
                    margin-top: ${designTokens.spacing[6]};
                    display: flex;
                    justify-content: flex-end;
                  `}
                >
                  <Button variant={index === activeIndex ? 'primary' : 'ghost'} size="sm">
                    View Profile →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div css={controlStyles}>
        <Button variant="outline" size="sm" onClick={handlePrev}>
          Prev
        </Button>
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[2]};
          `}
        >
          {items.map((_, index) => (
            <div
              key={index}
              css={css`
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${index === activeIndex
                  ? designTokens.colors.primary[500]
                  : designTokens.colors.neutral[300]};
                transition: background 0.3s ease;
              `}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleNext}>
          Next
        </Button>
      </div>
    </div>
  );
};

export default InteractiveCarousel;
