import { useState } from 'react';
import './CaseStudies.css';

interface CaseStudy {
  id: string;
  icon: string;
  title: string;
  scenario: string;
  benefits: {
    title: string;
    description: string;
  }[];
}

export default function CaseStudies() {
  const [activeStudy, setActiveStudy] = useState<string | null>(null);

  const caseStudies: CaseStudy[] = [
    {
      id: 'healthcare',
      icon: '🏥',
      title: 'Healthcare System',
      scenario: 'AI agents assist in diagnosing patients, recommending treatments, and managing hospital logistics.',
      benefits: [
        {
          title: 'Verifiable Decision Logs',
          description: 'Doctors can see why an AI recommended a specific diagnosis/treatment (e.g. chain-of-thought: symptoms → diagnostic probabilities → treatment rationale).'
        },
        {
          title: 'Governance Protocols',
          description: 'Ensure AI follows legal and ethical boundaries (e.g. no opioid prescriptions without human confirmation).'
        },
        {
          title: 'Audit Logs',
          description: 'In case of malpractice litigation, provide proof that AI acted within policy.'
        },
        {
          title: 'Metrics',
          description: 'Track which agents have the highest diagnostic accuracy over time.'
        }
      ]
    },
    {
      id: 'government',
      icon: '🏛️',
      title: 'Government Services',
      scenario: 'Agents review applications for benefits or flag tax fraud.',
      benefits: [
        {
          title: 'Compliance Monitoring',
          description: 'Prevent bias in AI decisions (e.g. rejecting applications based on protected attributes).'
        },
        {
          title: 'Real-time Performance Metrics',
          description: 'Detect bottlenecks or unusually high false-positive rates in fraud detection models.'
        },
        {
          title: 'Multi-Agent Governance',
          description: 'Cross-verification of outcomes from multiple agents before triggering audits or actions.'
        },
        {
          title: 'Tamper-Proof Logs',
          description: 'Required for public transparency and legal defensibility.'
        }
      ]
    },
    {
      id: 'finance',
      icon: '💸',
      title: 'Financial Services',
      scenario: 'AI agents provide investment advice or automatically rebalance portfolios.',
      benefits: [
        {
          title: 'Marketplace of Reasoning Patterns',
          description: 'Share winning strategies or analysis models across teams.'
        },
        {
          title: 'Chain-of-Thought Logs',
          description: 'Explain to clients why an AI agent shifted their portfolio — improving trust and compliance.'
        },
        {
          title: 'Policy Guardrails',
          description: 'Prevent excessive risk-taking or violations of financial regulations (e.g. insider trading policies).'
        },
        {
          title: 'ZK Proofs (Future)',
          description: 'Clients or regulators can verify agent behavior without revealing proprietary logic.'
        }
      ]
    },
    {
      id: 'enterprise',
      icon: '🏢',
      title: 'Enterprise AI Ops',
      scenario: 'AI agents automatically provision cloud resources, handle outages, or enforce security policies.',
      benefits: [
        {
          title: 'Policy Enforcement',
          description: 'Block unauthorized actions (e.g. spinning up GPU clusters during cost control mode).'
        },
        {
          title: 'Audit Trail',
          description: 'Know which agent caused a service interruption and why.'
        },
        {
          title: 'Real-time Monitoring',
          description: 'Alert ops teams when anomalies or policy violations occur.'
        },
        {
          title: 'Rate Limiting Policies',
          description: 'Prevent agents from overwhelming infrastructure.'
        }
      ]
    },
    {
      id: 'autonomous',
      icon: '🚗',
      title: 'Autonomous Vehicles',
      scenario: 'Autonomous delivery drones or self-driving vehicles make real-time decisions in public environments.',
      benefits: [
        {
          title: 'Governance Controls',
          description: 'Prevent dangerous maneuvers (e.g. speeding near schools).'
        },
        {
          title: 'Chain-of-Thought Logging',
          description: 'Post-incident review of how decisions were made (e.g. to swerve or stop).'
        },
        {
          title: 'Consensus Protocols',
          description: 'Require agreement from multiple subsystems for high-risk actions.'
        },
        {
          title: 'Performance Metrics',
          description: 'Monitor error rates, latency, and safety rule violations over time.'
        }
      ]
    },
    {
      id: 'pharma',
      icon: '🧪',
      title: 'Pharmaceutical R&D',
      scenario: 'AI agents assist with drug discovery, simulation, or regulatory submissions.',
      benefits: [
        {
          title: 'Intelligence Marketplace',
          description: 'Share and monetize research agents or logic patterns.'
        },
        {
          title: 'Policy Enforcement',
          description: 'Prevent models from generating non-compliant trial data.'
        },
        {
          title: 'Audit Logs',
          description: 'Prove to regulators how compounds were recommended or discarded.'
        }
      ]
    }
  ];

  const handleStudyClick = (id: string) => {
    setActiveStudy(activeStudy === id ? null : id);
  };

  return (
    <div className="case-studies">
      <div className="case-studies-header">
        <h2>Real-World Applications</h2>
        <p>See how Cognivern + Bitte Protocol integration solves critical challenges across industries</p>
      </div>

      <div className="case-studies-grid">
        {caseStudies.map((study) => (
          <div 
            key={study.id}
            className={`case-study-card ${activeStudy === study.id ? 'active' : ''}`}
            onClick={() => handleStudyClick(study.id)}
          >
            <div className="case-study-icon">{study.icon}</div>
            <h3>{study.title}</h3>
            
            <div className="case-study-content">
              <div className="case-study-scenario">
                <h4>Scenario</h4>
                <p>{study.scenario}</p>
              </div>
              
              <div className="case-study-benefits">
                <h4>How Cognivern + Bitte Protocol Helps</h4>
                <ul>
                  {study.benefits.map((benefit, index) => (
                    <li key={index}>
                      <strong>{benefit.title}:</strong> {benefit.description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
