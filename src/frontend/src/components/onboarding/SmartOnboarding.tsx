/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';
import { designTokens } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Button } from '../ui/Button';
import { ConnectionModal } from '../web3/ConnectionModal';
import {
  Brain, ChevronRight, CheckCircle2, Wallet, Zap,
  Shield, Play, Target, Rocket, Eye, Star, Share2,
  Clock, Lock, TrendingUp, Sparkles, ArrowRight, Award,
  DollarSign, BarChart3, Bot, AlertCircle, Stethoscope, Building2, Code2
} from 'lucide-react';

/**
 * SmartOnboarding - Guided progressive onboarding with achievement moments
 *
 * Design principles:
 * 1. Show value FIRST - watch governance work before asking for setup
 * 2. Concrete first action - create a policy, not abstract wallet connection
 * 3. Achievement moments - badges, progress, shareable milestones
 * 4. Engagement hooks - share first governed action (viral)
 * 5. Progressive disclosure - complexity revealed as user progresses
 */
export const SmartOnboarding: React.FC = () => {
  const { user, preferences, completeOnboarding, enterDemoMode } = useAppStore();
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();

  const handleSkipToDemo = () => {
    enterDemoMode();
    navigate('/dashboard');
  };

  // 5-step guided flow: Who are you → See → Create → Connect → Launch
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [achievement, setAchievement] = useState<{ badge: string; message: string } | null>(null);
  const [policyName, setPolicyName] = useState('');
  const [policyCreated, setPolicyCreated] = useState(false);
  const [demoPlaying, setDemoPlaying] = useState(false);

  const steps = [
    { id: 'persona', label: 'Your role', icon: <Brain size={14} /> },
    { id: 'see', label: 'See it', icon: <Eye size={14} /> },
    { id: 'create', label: 'Create', icon: <Target size={14} /> },
    { id: 'connect', label: 'Connect', icon: <Wallet size={14} /> },
    { id: 'launch', label: 'Launch', icon: <Rocket size={14} /> },
  ];

  useEffect(() => {
    const isOnboardingRoute = window.location.pathname === '/onboarding';
    if (isOnboardingRoute && !preferences.onboardingCompleted) {
      setCurrentStep(0);
    }
  }, [preferences.onboardingCompleted]);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreatePolicy = () => {
    if (policyName.trim()) {
      setPolicyCreated(true);
      setAchievement({ badge: 'Policy Pioneer', message: `"${policyName}" is now protecting your treasury!` });
      setTimeout(() => setAchievement(null), 4000);
    }
  };

  const handlePersonaSelect = (persona: string) => {
    setSelectedPersona(persona);
    // Store the user type early so the rest of the app can personalise immediately
    useAppStore.getState().setUser({ userType: persona });
    setCurrentStep(1);
  };

  const handleComplete = () => {
    setAchievement({ badge: 'Governor', message: 'You\'re now controlling agent spend!' });
    completeOnboarding(selectedPersona || 'operator');
    setTimeout(() => navigate('/dashboard'), 2000);
  };

  const handleShareAchievement = () => {
    const text = `Just set up agent governance with @Cognivern! My AI agents now need approval before spending. Built on X Layer, powered by ChainGPT AI 🛡️`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePlayDemo = () => {
    setDemoPlaying(true);
    setTimeout(() => setDemoPlaying(false), 3000);
  };

  // Achievement toast component
  const AchievementToast = () => achievement ? (
    <div
      css={css`
        position: absolute;
        top: -60px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, ${designTokens.colors.primary[500]}, ${designTokens.colors.primary[600]});
        color: white;
        padding: ${designTokens.spacing[3]} ${designTokens.spacing[6]};
        border-radius: ${designTokens.borderRadius.full};
        display: flex;
        align-items: center;
        gap: ${designTokens.spacing[2]};
        box-shadow: 0 8px 32px ${designTokens.colors.primary[500]}50;
        animation: slideDown 0.4s ease-out;
        z-index: 100;

        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}
    >
      <Award size={18} />
      <span css={css`font-weight: ${designTokens.typography.fontWeight.bold};`}>
        {achievement.badge}
      </span>
      <span css={css`opacity: 0.9;`}>— {achievement.message}</span>
    </div>
  ) : null;

  // Progress indicator with steps
  const ProgressIndicator = () => (
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        gap: ${designTokens.spacing[2]};
        padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
        background: ${designTokens.colors.neutral[50]};
        border-radius: ${designTokens.borderRadius.lg};
        margin-bottom: ${designTokens.spacing[6]};
      `}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={step.id}>
            <div
              css={css`
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: ${designTokens.spacing[1]};
              `}
            >
              <div
                css={css`
                  width: ${isMobile ? 28 : 32}px;
                  height: ${isMobile ? 28 : 32}px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  transition: all ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeInOut};
                  background: ${isCompleted
                    ? designTokens.colors.semantic.success[500]
                    : isCurrent
                      ? designTokens.colors.primary[500]
                      : designTokens.colors.neutral[200]};
                  color: ${isCompleted || isCurrent ? 'white' : designTokens.colors.neutral[500]};
                `}
              >
                {isCompleted ? <CheckCircle2 size={16} /> : step.icon}
              </div>
              <span
                css={css`
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: ${isCurrent
                    ? designTokens.colors.primary[600]
                    : designTokens.colors.neutral[400]};
                  font-weight: ${isCurrent ? designTokens.typography.fontWeight.medium : 'normal'};
                `}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                css={css`
                  width: 24px;
                  height: 2px;
                  background: ${isCompleted
                    ? designTokens.colors.semantic.success[200]
                    : designTokens.colors.neutral[200]};
                  border-radius: 1px;
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Step 0: Persona selection — who are you?
  const personas = [
    {
      id: 'healthcare',
      label: 'Healthcare / Clinical',
      description: 'Govern AI agents handling patient data, FHIR records, and clinical workflows.',
      icon: <Stethoscope size={22} />,
      color: designTokens.colors.primary[500],
    },
    {
      id: 'defi',
      label: 'DeFi / Finance',
      description: 'Policy-check agent spend, trades, and on-chain transactions before execution.',
      icon: <TrendingUp size={22} />,
      color: designTokens.colors.warning[500],
    },
    {
      id: 'enterprise',
      label: 'Enterprise / Ops',
      description: 'Audit trails, compliance guardrails, and spend controls for internal AI agents.',
      icon: <Building2 size={22} />,
      color: designTokens.colors.neutral[700],
    },
    {
      id: 'developer',
      label: 'Developer / Builder',
      description: 'Integrate the MCP governance API, test policies, and build on the platform.',
      icon: <Code2 size={22} />,
      color: designTokens.colors.semantic?.success?.[600] ?? '#16a34a',
    },
  ];

  const PersonaStep = () => (
    <div css={css`padding: ${designTokens.spacing[6]} ${designTokens.spacing[4]};`}>
      <div css={css`text-align: center; margin-bottom: ${designTokens.spacing[6]};`}>
        <Brain size={36} color={designTokens.colors.primary[500]} css={css`margin: 0 auto ${designTokens.spacing[3]};`} />
        <h3 css={css`font-size: ${designTokens.typography.fontSize.xl}; font-weight: ${designTokens.typography.fontWeight.bold}; color: ${designTokens.colors.neutral[900]}; margin-bottom: ${designTokens.spacing[2]};`}>
          What best describes you?
        </h3>
        <p css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[500]};`}>
          We'll surface the most relevant features and examples for your use case.
        </p>
      </div>

      <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[3]};`}>
        {personas.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePersonaSelect(p.id)}
            css={css`
              display: flex;
              align-items: flex-start;
              gap: ${designTokens.spacing[4]};
              padding: ${designTokens.spacing[4]};
              border: 2px solid ${selectedPersona === p.id ? p.color : designTokens.colors.neutral[200]};
              border-radius: ${designTokens.borderRadius.lg};
              background: ${selectedPersona === p.id ? `${p.color}10` : 'white'};
              cursor: pointer;
              text-align: left;
              transition: border-color 0.15s, background 0.15s;
              width: 100%;
              &:hover { border-color: ${p.color}; background: ${p.color}08; }
            `}
          >
            <span css={css`color: ${p.color}; flex-shrink: 0; margin-top: 2px;`}>{p.icon}</span>
            <div>
              <p css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: ${designTokens.colors.neutral[900]}; margin-bottom: ${designTokens.spacing[1]};`}>{p.label}</p>
              <p css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[500]};`}>{p.description}</p>
            </div>
          </button>
        ))}
      </div>

      <p css={css`text-align: center; margin-top: ${designTokens.spacing[4]}; font-size: ${designTokens.typography.fontSize.xs}; color: ${designTokens.colors.neutral[400]};`}>
        You can change this any time in Settings.
      </p>
    </div>
  );

  // Step 1: "See it work" - Live demo of governance
  const SeeStep = () => (
    <div css={css`padding: ${designTokens.spacing[6]} ${designTokens.spacing[4]}; position: relative;`}>
      <AchievementToast />

      {/* Hero visual - animated governance demo */}
      <div
        css={css`
          background: linear-gradient(135deg, ${designTokens.colors.neutral[900]}, #1a1a2e);
          border-radius: ${designTokens.borderRadius.lg};
          padding: ${designTokens.spacing[6]};
          margin-bottom: ${designTokens.spacing[6]};
          text-align: center;
          position: relative;
          overflow: hidden;
        `}
      >
        {/* Animated grid background */}
        <div
          css={css`
            position: absolute;
            inset: 0;
            background-image:
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 20px 20px;
          `}
        />

        <div css={css`position: relative; z-index: 1;`}>
          <div
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              gap: ${designTokens.spacing[4]};
              margin-bottom: ${designTokens.spacing[4]};
            `}
          >
            {/* Agent icon */}
            <div
              css={css`
                width: 48px;
                height: 48px;
                border-radius: ${designTokens.borderRadius.lg};
                background: ${designTokens.colors.warning[500]};
                display: flex;
                align-items: center;
                justify-content: center;
                ${demoPlaying ? `animation: pulse 0.5s infinite;` : ''}

                @keyframes pulse {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.05); }
                }
              `}
            >
              <Bot size={24} color="white" />
            </div>

            <ArrowRight size={24} color={designTokens.colors.neutral[500]} />

            {/* Shield icon */}
            <div
              css={css`
                width: 48px;
                height: 48px;
                border-radius: ${designTokens.borderRadius.lg};
                background: ${designTokens.colors.primary[500]};
                display: flex;
                align-items: center;
                justify-content: center;
                ${demoPlaying ? `animation: glow 1s infinite;` : ''}

                @keyframes glow {
                  0%, 100% { box-shadow: 0 0 0 0 ${designTokens.colors.primary[500]}40; }
                  50% { box-shadow: 0 0 20px 4px ${designTokens.colors.primary[500]}40; }
                }
              `}
            >
              <Shield size={24} color="white" />
            </div>
          </div>

          {demoPlaying ? (
            <div css={css`color: ${designTokens.colors.semantic.success[400]}; font-size: ${designTokens.typography.fontSize.sm};`}>
              <Sparkles size={14} css={css`display: inline; vertical-align: middle; margin-right: 4px;`} />
              Governance check passed — spend approved ✓
            </div>
          ) : (
            <p css={css`color: ${designTokens.colors.neutral[400]}; font-size: ${designTokens.typography.fontSize.sm};`}>
              Watch: agent attempts spend → policy check → decision logged
            </p>
          )}
        </div>
      </div>

      <h3
        css={css`
          text-align: center;
          margin-bottom: ${designTokens.spacing[2]};
          font-size: ${designTokens.typography.fontSize.xl};
          color: ${designTokens.colors.neutral[900]};
        `}
      >
        Your AI agents, now with guardrails
      </h3>
      <p
        css={css`
          text-align: center;
          margin-bottom: ${designTokens.spacing[6]};
          color: ${designTokens.colors.neutral[600]};
          font-size: ${designTokens.typography.fontSize.sm};
        `}
      >
        Every spend requires approval. Every decision leaves an audit trail.
      </p>

      <div
        css={css`
          display: flex;
          justify-content: center;
          gap: ${designTokens.spacing[3]};
          flex-wrap: wrap;
        `}
      >
        <Button
          variant="primary"
          size="lg"
          onClick={handlePlayDemo}
          css={css`min-width: 180px;`}
        >
          <Play size={18} css={css`margin-right: 8px;`} />
          Watch Demo
        </Button>
      </div>

      {/* Quick stats */}
      <div
        css={css`
          display: flex;
          justify-content: center;
          gap: ${designTokens.spacing[8]};
          margin-top: ${designTokens.spacing[6]};
          padding-top: ${designTokens.spacing[4]};
          border-top: 1px solid ${designTokens.colors.neutral[100]};
        `}
      >
        {[
          { value: '<100ms', label: 'Policy checks' },
          { value: '7', label: 'AI providers' },
          { value: '∞', label: 'Audit trail' },
        ].map(stat => (
          <div key={stat.label} css={css`text-align: center;`}>
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize['2xl']};
                font-weight: ${designTokens.typography.fontWeight.bold};
                color: ${designTokens.colors.primary[600]};
              `}
            >
              {stat.value}
            </div>
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize.xs};
                color: ${designTokens.colors.neutral[500]};
              `}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Step 1: "Create your first policy" - Concrete first action
  const CreateStep = () => (
    <div css={css`padding: ${designTokens.spacing[6]} ${designTokens.spacing[4]}; position: relative;`}>
      <AchievementToast />

      <div css={css`text-align: center; margin-bottom: ${designTokens.spacing[6]};`}>
        <div
          css={css`
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, ${designTokens.colors.semantic.success[400]}, ${designTokens.colors.semantic.success[500]});
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto ${designTokens.spacing[4]};
          `}
        >
          <Target size={28} color="white" />
        </div>
        <h3
          css={css`
            font-size: ${designTokens.typography.fontSize.xl};
            color: ${designTokens.colors.neutral[900]};
            margin-bottom: ${designTokens.spacing[2]};
          `}
        >
          Create your first policy
        </h3>
        <p css={css`color: ${designTokens.colors.neutral[600]}; font-size: ${designTokens.typography.fontSize.sm};`}>
          A policy controls what your agents can spend
        </p>
      </div>

      {/* Policy name input */}
      <div css={css`margin-bottom: ${designTokens.spacing[4]};`}>
        <label
          css={css`
            display: block;
            font-size: ${designTokens.typography.fontSize.sm};
            font-weight: ${designTokens.typography.fontWeight.medium};
            color: ${designTokens.colors.neutral[700]};
            margin-bottom: ${designTokens.spacing[2]};
          `}
        >
          Policy name
        </label>
        <input
          type="text"
          value={policyName}
          onChange={(e) => setPolicyName(e.target.value)}
          placeholder="e.g., Daily trading limit"
          css={css`
            width: 100%;
            padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
            border: 2px solid ${designTokens.colors.neutral[200]};
            border-radius: ${designTokens.borderRadius.lg};
            font-size: ${designTokens.typography.fontSize.base};
            transition: border-color ${designTokens.animation.duration.fast};

            &:focus {
              outline: none;
              border-color: ${designTokens.colors.primary[500]};
            }
          `}
        />
      </div>

      {/* Pre-built policy templates */}
      <div
        css={css`
          margin-bottom: ${designTokens.spacing[6]};
        `}
      >
        <label
          css={css`
            display: block;
            font-size: ${designTokens.typography.fontSize.sm};
            font-weight: ${designTokens.typography.fontWeight.medium};
            color: ${designTokens.colors.neutral[700]};
            margin-bottom: ${designTokens.spacing[2]};
          `}
        >
          Or start with a template
        </label>
        <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[2]};`}>
          {[
            { name: 'Daily spend limit', desc: '$500/day per agent', icon: <DollarSign size={16} /> },
            { name: 'High-value require approval', desc: '>$50 needs review', icon: <AlertCircle size={16} /> },
            { name: 'Vendor whitelist', desc: 'Only approved contracts', icon: <Lock size={16} /> },
          ].map(template => (
            <button
              key={template.name}
              onClick={() => setPolicyName(template.name)}
              css={css`
                display: flex;
                align-items: center;
                gap: ${designTokens.spacing[3]};
                padding: ${designTokens.spacing[3]};
                background: ${policyName === template.name ? designTokens.colors.primary[50] : designTokens.colors.neutral[50]};
                border: 2px solid ${policyName === template.name ? designTokens.colors.primary[200] : 'transparent'};
                border-radius: ${designTokens.borderRadius.lg};
                cursor: pointer;
                text-align: left;
                transition: all ${designTokens.animation.duration.fast};

                &:hover {
                  background: ${designTokens.colors.neutral[100]};
                }
              `}
            >
              <div
                css={css`
                  width: 32px;
                  height: 32px;
                  border-radius: ${designTokens.borderRadius.md};
                  background: ${designTokens.colors.primary[100]};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: ${designTokens.colors.primary[600]};
                `}
              >
                {template.icon}
              </div>
              <div>
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    font-weight: ${designTokens.typography.fontWeight.medium};
                    color: ${designTokens.colors.neutral[900]};
                  `}
                >
                  {template.name}
                </div>
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.xs};
                    color: ${designTokens.colors.neutral[500]};
                  `}
                >
                  {template.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={handleCreatePolicy}
        disabled={!policyName.trim() || policyCreated}
        css={css`width: 100%;`}
      >
        {policyCreated ? (
          <>
            <CheckCircle2 size={18} css={css`margin-right: 8px;`} />
            Policy created!
          </>
        ) : (
          <>
            Create Policy <ArrowRight size={18} css={css`margin-left: 8px;`} />
          </>
        )}
      </Button>

      <div css={css`text-align: center; margin-top: ${designTokens.spacing[4]};`}>
        <Button variant="ghost" size="sm" onClick={handleSkipToDemo}>
          Skip — try with demo data →
        </Button>
      </div>
    </div>
  );

  // Step 2: "Connect" - Wallet connection (progressive)
  const ConnectStep = () => (
    <div css={css`padding: ${designTokens.spacing[6]} ${designTokens.spacing[4]}; position: relative;`}>
      <AchievementToast />

      <div css={css`text-align: center; margin-bottom: ${designTokens.spacing[6]};`}>
        <div
          css={css`
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, ${designTokens.colors.primary[400]}, ${designTokens.colors.primary[500]});
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto ${designTokens.spacing[4]};
          `}
        >
          <Wallet size={28} color="white" />
        </div>
        <h3
          css={css`
            font-size: ${designTokens.fontSize.xl};
            color: ${designTokens.colors.neutral[900]};
            margin-bottom: ${designTokens.spacing[2]};
          `}
        >
          {user.isConnected ? 'Wallet connected!' : 'Connect your wallet'}
        </h3>
        <p
          css={css`
            color: ${designTokens.colors.neutral[600]};
            font-size: ${designTokens.typography.fontSize.sm};
          `}
        >
          {user.isConnected
            ? 'Your treasury is now protected by your policies'
            : 'Your agents will spend from this wallet — it stays encrypted and audited'}
        </p>
      </div>

      {!user.isConnected && (
        <>
          <ConnectionModal mode="embedded" connectionsToShow={['wallet', 'treasury']} />

          <div
            css={css`
              margin-top: ${designTokens.spacing[4]};
              padding: ${designTokens.spacing[4]};
              background: ${designTokens.colors.neutral[50]};
              border-radius: ${designTokens.borderRadius.lg};
              text-align: center;
            `}
          >
            <p css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[600]}; margin-bottom: ${designTokens.spacing[3]};`}>
              Want to explore first?
            </p>
            <Button variant="secondary" size="sm" onClick={handleSkipToDemo}>
              Try with sample wallet →
            </Button>
          </div>
        </>
      )}

      {user.isConnected && (
        <div css={css`text-align: center;`}>
          <Button variant="primary" size="lg" onClick={handleNext}>
            Continue <ChevronRight size={18} css={css`margin-left: 8px;`} />
          </Button>
        </div>
      )}
    </div>
  );

  // Step 3: "Launch" - Achievement + shareable moment
  const LaunchStep = () => (
    <div css={css`padding: ${designTokens.spacing[6]} ${designTokens.spacing[4]}; position: relative; text-align: center;`}>
      <AchievementToast />

      {/* Big achievement moment */}
      <div
        css={css`
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${designTokens.colors.warning[400]}, ${designTokens.colors.warning[500]});
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto ${designTokens.spacing[6]};
          box-shadow: 0 12px 40px ${designTokens.colors.warning[400]}40;
          animation: bounce 0.6s ease-out;

          @keyframes bounce {
            0% { transform: scale(0); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `}
      >
        <Sparkles size={48} color="white" />
      </div>

      <h2
        css={css`
          font-size: ${designTokens.typography.fontSize['2xl']};
          font-weight: ${designTokens.typography.fontWeight.bold};
          color: ${designTokens.colors.neutral[900]};
          margin-bottom: ${designTokens.spacing[2]};
        `}
      >
        You're now a Governor!
      </h2>
      <p
        css={css`
          font-size: ${designTokens.typography.fontSize.lg};
          color: ${designTokens.colors.neutral[600]};
          margin-bottom: ${designTokens.spacing[6]};
        `}
      >
        Your agents are protected. Every spend needs your approval.
      </p>

      {/* Achievement badge */}
      <div
        css={css`
          display: inline-flex;
          align-items: center;
          gap: ${designTokens.spacing[2]};
          padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
          background: linear-gradient(135deg, ${designTokens.colors.primary[50]}, ${designTokens.colors.primary[100]});
          border: 2px solid ${designTokens.colors.primary[200]};
          border-radius: ${designTokens.borderRadius.full};
          margin-bottom: ${designTokens.spacing[6]};
        `}
      >
        <Award size={18} color={designTokens.colors.primary[600]} />
        <span css={css`font-weight: ${designTokens.typography.fontWeight.bold}; color: ${designTokens.colors.primary[700]};`}>
          Governor Badge
        </span>
        <Star size={14} fill={designTokens.colors.warning[500]} color={designTokens.colors.warning[500]} />
      </div>

      {/* What's next */}
      <div
        css={css`
          background: ${designTokens.colors.neutral[50]};
          border-radius: ${designTokens.borderRadius.lg};
          padding: ${designTokens.spacing[4]};
          margin-bottom: ${designTokens.spacing[6]};
          text-align: left;
        `}
      >
        <h4 css={css`font-size: ${designTokens.typography.fontSize.sm}; font-weight: ${designTokens.typography.fontWeight.bold}; color: ${designTokens.colors.neutral[900]}; margin-bottom: ${designTokens.spacing[3]};`}>
          What's next?
        </h4>
        <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[2]};`}>
          {[
            { icon: <Bot size={16} />, text: 'Connect your first AI agent' },
            { icon: <BarChart3 size={16} />, text: 'View your governance dashboard' },
            { icon: <Shield size={16} />, text: 'Add more policies' },
          ].map(item => (
            <div
              key={item.text}
              css={css`
                display: flex;
                align-items: center;
                gap: ${designTokens.spacing[2]};
                font-size: ${designTokens.typography.fontSize.sm};
                color: ${designTokens.colors.neutral[600]};
              `}
            >
              <span css={css`color: ${designTokens.colors.primary[500]};`}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div css={css`display: flex; gap: ${designTokens.spacing[3]}; justify-content: center; flex-wrap: wrap;`}>
        <Button variant="secondary" onClick={handleShareAchievement}>
          <Share2 size={16} css={css`margin-right: 8px;`} />
          Share achievement
        </Button>
        <Button variant="primary" size="lg" onClick={handleComplete}>
          Go to Dashboard <ChevronRight size={18} css={css`margin-left: 8px;`} />
        </Button>
      </div>
    </div>
  );

  return (
    <div
      css={css`
        max-width: 480px;
        margin: 0 auto;
        padding: ${designTokens.spacing[4]};
      `}
    >
      <ProgressIndicator />

      <div
        css={css`
          background: white;
          border-radius: ${designTokens.borderRadius.xl};
          box-shadow: ${designTokens.shadows.lg};
          padding: ${isMobile ? designTokens.spacing[4] : designTokens.spacing[6]};
          margin-bottom: ${designTokens.spacing[4]};
          position: relative;
          min-height: 400px;
        `}
      >
        {currentStep === 0 && <PersonaStep />}
        {currentStep === 1 && <SeeStep />}
        {currentStep === 2 && <CreateStep />}
        {currentStep === 3 && <ConnectStep />}
        {currentStep === 4 && <LaunchStep />}
      </div>

      {/* Navigation */}
      <div
        css={css`
          display: flex;
          justify-content: ${currentStep <= 1 ? 'flex-end' : 'space-between'};
          align-items: center;
        `}
      >
        {currentStep > 1 && (
          <Button variant="ghost" onClick={handlePrevious}>
            Back
          </Button>
        )}
        {currentStep === 0 && (
          <Button variant="ghost" onClick={handleSkipToDemo}>
            Skip — explore demo →
          </Button>
        )}
        {currentStep === 1 && (
          <Button variant="ghost" onClick={handleSkipToDemo}>
            Skip — explore demo →
          </Button>
        )}
      </div>
    </div>
  );
};

export default SmartOnboarding;
