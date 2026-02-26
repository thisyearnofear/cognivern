import React, { useState } from "react";
import { css } from "@emotion/react";
import { designTokens, shadowSystem } from "../../styles/design-system";
import { Card, CardContent } from "./Card";
import { Button } from "./Button";

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
  const scale = isActive ? 1.2 : 0.8 / (1 + distance * 0.1);
  const rotateY = isActive ? 0 : (index < activeIndex ? 30 : -30);
  const translateZ = isActive ? 100 : -100 * distance;
  const blur = isActive ? 0 : distance * 2;

  return css`
    min-width: 300px;
    max-width: 300px;
    transition: all 0.7s cubic-bezier(0.23, 1, 0.32, 1);
    transform: perspective(1000px) rotateY(${rotateY}deg) scale(${scale}) translateZ(${translateZ}px);
    opacity: ${isActive ? 1 : 0.4 / (1 + distance * 0.2)};
    cursor: pointer;
    filter: blur(${blur}px) ${isActive ? "none" : "grayscale(0.8)"};
    z-index: ${10 - distance};

    &:hover {
      transform: perspective(1000px) rotateY(${rotateY * 0.5}deg) scale(${scale * 1.05}) translateZ(${translateZ + 20}px);
      opacity: ${isActive ? 1 : 0.7};
      filter: blur(${blur * 0.5}px) ${isActive ? "none" : "grayscale(0.3)"};
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

export const InteractiveCarousel: React.FC<InteractiveCarouselProps> = ({
  items,
  onItemClick,
}) => {
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
            <Card padding="lg" variant={index === activeIndex ? "elevated" : "outline"}>
              <CardContent>
                <div css={cardHeaderStyles}>
                  {item.icon && <div css={iconWrapperStyles}>{item.icon}</div>}
                  <div>
                    <h3 css={css`margin: 0; font-size: ${designTokens.typography.fontSize.lg};`}>
                      {item.title}
                    </h3>
                    {item.subtitle && (
                      <p css={css`margin: 0; font-size: ${designTokens.typography.fontSize.xs}; color: ${designTokens.colors.neutral[500]};`}>
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                {item.content}
                <div css={css`margin-top: ${designTokens.spacing[4]}; display: flex; justify-content: flex-end;`}>
                  <Button variant="ghost" size="sm">
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
        <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[2]};`}>
          {items.map((_, index) => (
            <div
              key={index}
              css={css`
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${index === activeIndex ? designTokens.colors.primary[500] : designTokens.colors.neutral[300]};
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
