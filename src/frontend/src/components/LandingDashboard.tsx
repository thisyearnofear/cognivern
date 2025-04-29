import { useState } from 'react';
import './LandingDashboard.css';

interface UserPath {
  id: string;
  title: string;
  description: string;
  icon: string;
  primaryCTA: string;
  route: string;
}

export default function LandingDashboard({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  
  const userPaths: UserPath[] = [
    {
      id: 'evaluate',
      title: 'Evaluate the ROI',
      description: 'Calculate potential cost savings and efficiency gains for your organization',
      icon: '💰',
      primaryCTA: 'Calculate Your ROI',
      route: 'value-proposition'
    },
    {
      id: 'explore',
      title: 'Explore Use Cases',
      description: 'See how agent governance solves real problems across different industries',
      icon: '🔍',
      primaryCTA: 'View Case Studies',
      route: 'case-studies'
    },
    {
      id: 'experience',
      title: 'Experience the Platform',
      description: 'Try our interactive demos and see the platform in action',
      icon: '🚀',
      primaryCTA: 'Try Interactive Demo',
      route: 'marketplace'
    },
    {
      id: 'implement',
      title: 'Implement a Solution',
      description: 'Deploy and manage your own agents with full governance controls',
      icon: '⚙️',
      primaryCTA: 'Deploy Your First Agent',
      route: 'agents'
    }
  ];
  
  const handlePathSelect = (pathId: string) => {
    setSelectedPath(pathId);
  };
  
  const handleNavigate = (route: string) => {
    onNavigate(route);
  };
  
  return (
    <div className="landing-dashboard">
      <div className="hero-section">
        <h1>Agent Governance Made Simple</h1>
        <p className="hero-subtitle">
          Deploy, manage, and govern AI agents with confidence and transparency
        </p>
        
        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-value">75%</div>
            <div className="stat-label">Average Cost Savings</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">90%</div>
            <div className="stat-label">Error Reduction</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">100%</div>
            <div className="stat-label">Governance & Compliance</div>
          </div>
        </div>
      </div>
      
      <div className="path-selection">
        <h2>What would you like to do today?</h2>
        <div className="paths-grid">
          {userPaths.map((path) => (
            <div 
              key={path.id}
              className={`path-card ${selectedPath === path.id ? 'selected' : ''}`}
              onClick={() => handlePathSelect(path.id)}
            >
              <div className="path-icon">{path.icon}</div>
              <h3>{path.title}</h3>
              <p>{path.description}</p>
              <button 
                className="path-cta"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigate(path.route);
                }}
              >
                {path.primaryCTA}
              </button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="quick-value-prop">
        <h2>Why Choose Our Agent Governance Platform?</h2>
        <div className="value-grid">
          <div className="value-item">
            <div className="value-icon">🔍</div>
            <h3>Complete Transparency</h3>
            <p>Every agent action is logged with detailed reasoning and policy checks</p>
          </div>
          <div className="value-item">
            <div className="value-icon">🛡️</div>
            <div className="value-content">
              <h3>Robust Governance</h3>
              <p>Enforce policies automatically and maintain compliance with regulations</p>
            </div>
          </div>
          <div className="value-item">
            <div className="value-icon">💰</div>
            <div className="value-content">
              <h3>Significant Cost Savings</h3>
              <p>Reduce operational costs while maintaining or improving quality</p>
            </div>
          </div>
          <div className="value-item">
            <div className="value-icon">⚡</div>
            <div className="value-content">
              <h3>Rapid Implementation</h3>
              <p>Deploy agents quickly with our pre-built templates and frameworks</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="testimonial-highlight">
        <div className="testimonial-content">
          <div className="quote-mark">"</div>
          <p className="quote-text">
            The agent governance stack has transformed our operations. We've reduced processing time by 85% 
            while maintaining complete compliance with healthcare regulations.
          </p>
          <div className="quote-author">
            <strong>Dr. Sarah Johnson</strong>, CTO at MedTech Solutions
          </div>
        </div>
      </div>
      
      <div className="cta-section">
        <h2>Ready to Get Started?</h2>
        <p>Choose the path that best fits your current needs</p>
        <div className="cta-buttons">
          <button 
            className="primary-cta"
            onClick={() => handleNavigate('value-proposition')}
          >
            Calculate Your ROI
          </button>
          <button 
            className="secondary-cta"
            onClick={() => handleNavigate('case-studies')}
          >
            Explore Use Cases
          </button>
        </div>
      </div>
    </div>
  );
}
