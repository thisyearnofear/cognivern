import React from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  keyframeAnimations,
  easings,
} from "../../styles/design-system";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

interface InteractiveAgentDemoProps {
  agentId: string;
  agentName: string;
  agentDescription: string;
  onClose: () => void;
  onDeploy: () => void;
}

export default function InteractiveAgentDemo({
  agentName,
  agentDescription,
  onClose,
  onDeploy,
}: InteractiveAgentDemoProps) {
  const [step, setStep] = React.useState(0);
  const [interactions, setInteractions] = React.useState<string[]>([]);

  const demoSteps = [
    {
      action: "System Initialization",
      response: `${agentName} is coming online. All governance protocols verified.`,
    },
    {
      action: "Policy Check",
      response: "Analyzing input against ERC-8004 standards... Compliance: 100%.",
    },
    {
      action: "Strategic Analysis",
      response: "Identifying optimal pathing for current market conditions.",
    },
  ];

  const handleNext = () => {
    if (step < demoSteps.length) {
      setInteractions((prev) => [...prev, demoSteps[step].response]);
      setStep(step + 1);
    }
  };

  return (
    <Card
      variant="elevated"
      css={css`
        width: 100%;
        max-width: 600px;
        border: 1px solid ${designTokens.colors.primary[200]};
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      `}
    >
      <CardHeader
        css={css`
          background: ${designTokens.colors.primary[50]};
          display: flex;
          justify-content: space-between;
          align-items: center;
        `}
      >
        <div>
          <CardTitle>Demo: {agentName}</CardTitle>
          <p
            css={css`
              font-size: 10px;
              color: ${designTokens.colors.primary[600]};
              text-transform: uppercase;
              letter-spacing: 0.1em;
              font-weight: bold;
              margin-top: 4px;
            `}
          >
            Interactive Simulation
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          ✕
        </Button>
      </CardHeader>
      <CardContent
        css={css`
          min-height: 300px;
          display: flex;
          flex-direction: column;
        `}
      >
        <div
          css={css`
            flex: 1;
            background: ${designTokens.colors.neutral[900]};
            border-radius: ${designTokens.borderRadius.md};
            padding: ${designTokens.spacing[4]};
            font-family: ${designTokens.typography.fontFamily.mono};
            font-size: ${designTokens.typography.fontSize.xs};
            color: ${designTokens.colors.neutral[300]};
            margin-bottom: ${designTokens.spacing[6]};
            overflow-y: auto;
          `}
        >
          <div
            css={css`
              color: ${designTokens.colors.primary[400]};
              margin-bottom: ${designTokens.spacing[4]};
            `}
          >
            > Initializing {agentName} interactive session...
          </div>
          {interactions.map((msg, i) => (
            <div
              key={i}
              css={css`
                margin-bottom: ${designTokens.spacing[2]};
                animation: ${keyframeAnimations.reveal} 0.3s ${easings.out};
              `}
            >
              <span
                css={css`
                  color: ${designTokens.colors.semantic.success[400]};
                  margin-right: 8px;
                `}
              >
                ✓
              </span>
              {msg}
            </div>
          ))}
          {step < demoSteps.length && (
            <div
              css={css`
                animation: ${keyframeAnimations.shimmer} 2s infinite;
                color: white;
              `}
            >
              ▋
            </div>
          )}
        </div>

        <div
          css={css`
            text-align: center;
          `}
        >
          <p
            css={css`
              font-size: ${designTokens.typography.fontSize.sm};
              color: ${designTokens.colors.neutral[500]};
              margin-bottom: ${designTokens.spacing[4]};
            `}
          >
            {step === 0
              ? "Start the simulation to see how this agent operates."
              : step < demoSteps.length
                ? "Simulating agent logic and governance checks..."
                : "Simulation complete. This agent is ready for deployment."}
          </p>
        </div>
      </CardContent>
      <CardFooter
        css={css`
          display: flex;
          justify-content: center;
          gap: ${designTokens.spacing[4]};
          border-top: 1px solid ${designTokens.colors.neutral[100]};
        `}
      >
        {step < demoSteps.length ? (
          <Button onClick={handleNext}>
            {step === 0 ? "Begin Simulation" : "Next Step"}
          </Button>
        ) : (
          <Button onClick={onDeploy}>Deploy Now</Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Close Demo
        </Button>
      </CardFooter>
    </Card>
  );
}
