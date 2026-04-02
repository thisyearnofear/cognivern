/**
 * Agent Connection Wizard
 * Multi-step wizard for connecting user agents.
 */

import React, { useState } from "react";
import { css } from "@emotion/react";
import { useNavigate } from "react-router-dom";
import { Bot, TrendingUp, Shield, Search, CheckCircle, ArrowRight, ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { designTokens } from "../../styles/design-system";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { agentApi } from "../../services/apiService";

export type AgentType = "trading" | "governance" | "research" | "custom";

export interface AgentConnectionConfig {
  type: AgentType;
  name: string;
  address: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
}

export interface AgentConnectionWizardProps {
  onComplete?: (config: AgentConnectionConfig) => Promise<void>;
  onCancel: () => void;
}

const containerStyles = css`
  max-width: 720px;
  margin: 0 auto;
  padding: ${designTokens.spacing[8]};
`;

const stepperStyles = css`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${designTokens.spacing[8]};
  position: relative;
  &::before {
    content: "";
    position: absolute;
    top: 20px;
    left: 40px;
    right: 40px;
    height: 2px;
    background: ${designTokens.colors.neutral[200]};
    z-index: 0;
  }
`;

const stepStyles = (isActive: boolean, isCompleted: boolean) => css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  position: relative;
  z-index: 1;
  cursor: ${isCompleted ? "pointer" : "default"};
`;

const stepCircleStyles = (isActive: boolean, isCompleted: boolean) => css`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: ${designTokens.typography.fontSize.sm};
  ${isCompleted ? `background: ${designTokens.colors.semantic.success[500]}; color: white;` : ""}
  ${isActive ? `background: ${designTokens.colors.primary[500]}; color: white; box-shadow: 0 0 0 4px ${designTokens.colors.primary[100]};` : ""}
  ${!isActive && !isCompleted ? `background: white; color: ${designTokens.colors.neutral[400]}; border: 2px solid ${designTokens.colors.neutral[300]};` : ""}
`;

const stepLabelStyles = (isActive: boolean) => css`
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${isActive ? "600" : "400"};
  color: ${isActive ? designTokens.colors.text.primary : designTokens.colors.text.secondary};
`;

const contentStyles = css`
  background: ${designTokens.colors.background.primary};
  border: 1px solid ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.xl};
  padding: ${designTokens.spacing[8]};
  margin-bottom: ${designTokens.spacing[6]};
`;

const titleStyles = css`
  font-size: ${designTokens.typography.fontSize["2xl"]};
  font-weight: bold;
  margin: 0 0 ${designTokens.spacing[2]} 0;
`;

const subtitleStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  color: ${designTokens.colors.text.secondary};
  margin: 0 0 ${designTokens.spacing[6]} 0;
`;

const agentTypeGridStyles = css`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${designTokens.spacing[4]};
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const agentTypeCardStyles = (isSelected: boolean) => css`
  padding: ${designTokens.spacing[6]};
  border: 2px solid ${isSelected ? designTokens.colors.primary[500] : designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.lg};
  cursor: pointer;
  background: ${isSelected ? designTokens.colors.primary[50] : "white"};
  &:hover {
    border-color: ${designTokens.colors.primary[300]};
  }
`;

const formGroupStyles = css`
  margin-bottom: ${designTokens.spacing[6]};
`;

const labelStyles = css`
  display: block;
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: 500;
  color: ${designTokens.colors.text.primary};
  margin-bottom: ${designTokens.spacing[2]};
`;

const inputStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
  border: 1px solid ${designTokens.colors.neutral[300]};
  border-radius: ${designTokens.borderRadius.md};
  font-size: ${designTokens.typography.fontSize.base};
  &:focus {
    outline: none;
    border-color: ${designTokens.colors.primary[500]};
  }
`;

const textareaStyles = css`
  ${inputStyles}
  min-height: 100px;
  resize: vertical;
`;

const radioGroupStyles = css`
  display: flex;
  gap: ${designTokens.spacing[4]};
  flex-wrap: wrap;
`;

const radioOptionStyles = (isSelected: boolean) => css`
  flex: 1;
  min-width: 100px;
  padding: ${designTokens.spacing[4]};
  border: 2px solid ${isSelected ? designTokens.colors.primary[500] : designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.md};
  cursor: pointer;
  text-align: center;
  background: ${isSelected ? designTokens.colors.primary[50] : "white"};
`;

const actionsStyles = css`
  display: flex;
  justify-content: space-between;
  gap: ${designTokens.spacing[4]};
  padding-top: ${designTokens.spacing[4]};
  border-top: 1px solid ${designTokens.colors.neutral[200]};
`;

const successStyles = css`
  text-align: center;
  padding: ${designTokens.spacing[8]};
`;

const successIconStyles = css`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${designTokens.colors.semantic.success[100]};
  color: ${designTokens.colors.semantic.success[500]};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto ${designTokens.spacing[6]} auto;
`;

const summaryStyles = css`
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.lg};
  padding: ${designTokens.spacing[6]};
  margin-top: ${designTokens.spacing[6]};
  text-align: left;
`;

const summaryRowStyles = css`
  display: flex;
  justify-content: space-between;
  padding: ${designTokens.spacing[2]} 0;
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
  &:last-child { border-bottom: none; }
`;

const AGENT_TYPES = [
  { type: "trading" as AgentType, title: "Trading Agent", description: "Automated trading strategies with risk management", icon: <TrendingUp size={24} /> },
  { type: "governance" as AgentType, title: "Governance Agent", description: "Policy enforcement and compliance monitoring", icon: <Shield size={24} /> },
  { type: "research" as AgentType, title: "Research Agent", description: "Data analysis and market research", icon: <Search size={24} /> },
  { type: "custom" as AgentType, title: "Custom Agent", description: "Connect any agent type with custom settings", icon: <Bot size={24} /> },
];

const STEPS = [
  { id: 1, label: "Agent Type" },
  { id: 2, label: "Details" },
  { id: 3, label: "Risk Level" },
  { id: 4, label: "Complete" },
];

export const AgentConnectionWizard: React.FC<AgentConnectionWizardProps> = ({ onComplete, onCancel }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<AgentConnectionConfig>({
    type: "trading",
    name: "",
    address: "",
    description: "",
    riskLevel: "medium",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConfig = (updates: Partial<AgentConnectionConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await agentApi.registerAgent(config);

      if (!response.success) {
        throw new Error(response.error || "Failed to register agent");
      }

      if (onComplete) {
        await onComplete(config);
      }

      navigate("/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect agent");
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return config.type !== undefined;
      case 2: return config.name.trim() !== "" && config.address.trim() !== "";
      case 3: return config.riskLevel !== undefined;
      default: return true;
    }
  };

  return (
    <div css={containerStyles}>
      <div css={stepperStyles}>
        {STEPS.map((step) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          return (
            <div key={step.id} css={stepStyles(isActive, isCompleted)} onClick={() => isCompleted && setCurrentStep(step.id)}>
              <div css={stepCircleStyles(isActive, isCompleted)}>
                {isCompleted ? <Check size={18} /> : step.id}
              </div>
              <span css={stepLabelStyles(isActive)}>{step.label}</span>
            </div>
          );
        })}
      </div>

      <div css={contentStyles}>
        {currentStep === 1 && (
          <>
            <h2 css={titleStyles}>What type of agent?</h2>
            <p css={subtitleStyles}>Choose the type that best describes your agent</p>
            <div css={agentTypeGridStyles}>
              {AGENT_TYPES.map((agentType) => (
                <div key={agentType.type} css={agentTypeCardStyles(config.type === agentType.type)} onClick={() => updateConfig({ type: agentType.type })}>
                  <div css={`width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: ${designTokens.colors.primary[100]}; color: ${designTokens.colors.primary[600]}; margin-bottom: 12px;`}>
                    {agentType.icon}
                  </div>
                  <h3 css={`font-size: ${designTokens.typography.fontSize.lg}; font-weight: 600; margin: 0 0 4px 0;`}>{agentType.title}</h3>
                  <p css={`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.text.secondary}; margin: 0;`}>{agentType.description}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {currentStep === 2 && (
          <>
            <h2 css={titleStyles}>Agent Details</h2>
            <p css={subtitleStyles}>Enter your agent's connection information</p>
            <div css={formGroupStyles}>
              <label css={labelStyles}>Agent Name *</label>
              <input css={inputStyles} type="text" placeholder="e.g., Alpha Trading Bot" value={config.name} onChange={(e) => updateConfig({ name: e.target.value })} />
            </div>
            <div css={formGroupStyles}>
              <label css={labelStyles}>Agent Address *</label>
              <input css={inputStyles} type="text" placeholder="e.g., 0x... or agent-id" value={config.address} onChange={(e) => updateConfig({ address: e.target.value })} />
            </div>
            <div css={formGroupStyles}>
              <label css={labelStyles}>Description</label>
              <textarea css={textareaStyles} placeholder="Brief description..." value={config.description} onChange={(e) => updateConfig({ description: e.target.value })} />
            </div>
          </>
        )}

        {currentStep === 3 && (
          <>
            <h2 css={titleStyles}>Risk Level</h2>
            <p css={subtitleStyles}>Set the risk tolerance for this agent</p>
            <div css={radioGroupStyles}>
              {(["low", "medium", "high"] as const).map((level) => (
                <div key={level} css={radioOptionStyles(config.riskLevel === level)} onClick={() => updateConfig({ riskLevel: level })}>
                  <div css="font-weight: 600; text-transform: capitalize; margin-bottom: 4px;">{level}</div>
                  <div css={`font-size: 12px; color: ${designTokens.colors.text.secondary};`}>
                    {level === "low" && "Conservative trades, strict limits"}
                    {level === "medium" && "Balanced approach"}
                    {level === "high" && "Aggressive strategies, higher limits"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {currentStep === 4 && (
          <div css={successStyles}>
            <div css={successIconStyles}><CheckCircle size={40} /></div>
            <h2 css={titleStyles}>Ready to Connect!</h2>
            <p css={subtitleStyles}>Your agent is configured and ready to be added</p>
            <div css={summaryStyles}>
              <div css={summaryRowStyles}>
                <span css={`color: ${designTokens.colors.text.secondary};`}>Name</span>
                <span css="font-weight: 500;">{config.name}</span>
              </div>
              <div css={summaryRowStyles}>
                <span css={`color: ${designTokens.colors.text.secondary};`}>Type</span>
                <Badge variant="primary">{config.type}</Badge>
              </div>
              <div css={summaryRowStyles}>
                <span css={`color: ${designTokens.colors.text.secondary};`}>Risk Level</span>
                <Badge variant={config.riskLevel === "low" ? "success" : config.riskLevel === "medium" ? "warning" : "error"}>{config.riskLevel}</Badge>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div css={`margin-top: 16px; padding: 12px 16px; background: ${designTokens.colors.semantic.error[50]}; border: 1px solid ${designTokens.colors.semantic.error[200]}; border-radius: ${designTokens.borderRadius.md}; color: ${designTokens.colors.semantic.error[700]}; font-size: 14px; display: flex; align-items: center; gap: 8px;`}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
      </div>

      <div css={actionsStyles}>
        <Button variant="ghost" onClick={currentStep === 1 ? onCancel : handleBack} icon={<ArrowLeft size={16} />}>
          {currentStep === 1 ? "Cancel" : "Back"}
        </Button>
        {currentStep < 4 ? (
          <Button variant="primary" onClick={handleNext} disabled={!canProceed()} icon={<ArrowRight size={16} />}>
            Continue
          </Button>
        ) : (
          <Button variant="primary" onClick={handleComplete} isLoading={isLoading} icon={<Check size={16} />}>
            Connect Agent
          </Button>
        )}
      </div>
    </div>
  );
};

export default AgentConnectionWizard;
