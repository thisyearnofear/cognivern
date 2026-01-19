import React, { useState } from "react";
import { css } from "@emotion/react";
import { designTokens, keyframeAnimations } from "../../styles/design-system";

interface ConnectionStatusProps {
  isConnected: boolean;
  apiUrl?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  apiUrl = "API Server",
}) => {
  const [showStatus, setShowStatus] = useState(true);

  if (!showStatus && isConnected) {
    return null;
  }

  const statusContainerStyles = css`
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    border-radius: ${designTokens.borderRadius.lg};
    background: ${isConnected
      ? designTokens.colors.semantic.success[50]
      : designTokens.colors.semantic.error[50]};
    border: 1px solid
      ${isConnected
        ? designTokens.colors.semantic.success[200]
        : designTokens.colors.semantic.error[200]};
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.3s ease-out;

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;

  const statusIndicatorStyles = css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${isConnected
      ? designTokens.colors.semantic.success[500]
      : designTokens.colors.semantic.error[500]};
    ${isConnected && keyframeAnimations.pulse}
  `;

  const statusTextStyles = css`
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    color: ${isConnected
      ? designTokens.colors.semantic.success[700]
      : designTokens.colors.semantic.error[700]};
  `;

  const closeButtonStyles = css`
    background: none;
    border: none;
    cursor: pointer;
    font-size: ${designTokens.typography.fontSize.lg};
    color: ${isConnected
      ? designTokens.colors.semantic.success[600]
      : designTokens.colors.semantic.error[600]};
    padding: 0;
    display: flex;
    align-items: center;

    &:hover {
      opacity: 0.7;
    }
  `;

  return (
    <div css={statusContainerStyles}>
      <div css={statusIndicatorStyles} />
      <div css={statusTextStyles}>
        {isConnected ? `Connected to ${apiUrl}` : `Disconnected from ${apiUrl}`}
      </div>
      <button
        css={closeButtonStyles}
        onClick={() => setShowStatus(false)}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};

export default ConnectionStatus;
