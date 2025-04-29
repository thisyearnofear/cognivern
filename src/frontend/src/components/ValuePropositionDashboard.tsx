import { useState } from 'react';
import './ValuePropositionDashboard.css';
import ROICalculator from './ROICalculator';
import AgentSimulation from './AgentSimulation';
import ResultsReport from './ResultsReport';

interface ValueMetric {
  title: string;
  value: string;
  description: string;
  icon: string;
}

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  industry: string;
}

interface CaseMetric {
  title: string;
  before: string;
  after: string;
  improvement: string;
  unit: string;
}

export default function ValuePropositionDashboard() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);

  // Key value metrics
  const valueMetrics: ValueMetric[] = [
    {
      title: 'Time Savings',
      value: '75%',
      description: 'Average reduction in time spent on routine tasks',
      icon: '⏱️',
    },
    {
      title: 'Cost Reduction',
      value: '65%',
      description: 'Average cost savings compared to manual processes',
      icon: '💰',
    },
    {
      title: 'Error Reduction',
      value: '90%',
      description: 'Decrease in errors and compliance issues',
      icon: '✓',
    },
    {
      title: 'Scalability',
      value: '10x',
      description: 'Increase in processing capacity without adding staff',
      icon: '📈',
    },
  ];

  // Case study metrics
  const caseStudyMetrics: Record<string, CaseMetric[]> = {
    healthcare: [
      {
        title: 'Document Processing Time',
        before: '45',
        after: '5',
        improvement: '89%',
        unit: 'minutes',
      },
      {
        title: 'Staff Hours per Week',
        before: '120',
        after: '30',
        improvement: '75%',
        unit: 'hours',
      },
      {
        title: 'Error Rate',
        before: '8.5',
        after: '0.5',
        improvement: '94%',
        unit: '%',
      },
      {
        title: 'Annual Cost',
        before: '250,000',
        after: '75,000',
        improvement: '70%',
        unit: '$',
      },
    ],
    finance: [
      {
        title: 'Transaction Processing',
        before: '15',
        after: '2',
        improvement: '87%',
        unit: 'minutes',
      },
      {
        title: 'Compliance Checks',
        before: '120',
        after: '10',
        improvement: '92%',
        unit: 'minutes',
      },
      {
        title: 'Audit Preparation',
        before: '40',
        after: '8',
        improvement: '80%',
        unit: 'hours',
      },
      {
        title: 'Annual Cost',
        before: '380,000',
        after: '95,000',
        improvement: '75%',
        unit: '$',
      },
    ],
    retail: [
      {
        title: 'Inventory Management',
        before: '25',
        after: '5',
        improvement: '80%',
        unit: 'hours/week',
      },
      {
        title: 'Customer Response Time',
        before: '24',
        after: '2',
        improvement: '92%',
        unit: 'hours',
      },
      {
        title: 'Order Processing',
        before: '12',
        after: '3',
        improvement: '75%',
        unit: 'minutes',
      },
      {
        title: 'Annual Cost',
        before: '210,000',
        after: '65,000',
        improvement: '69%',
        unit: '$',
      },
    ],
  };

  // Testimonials
  const testimonials: Testimonial[] = [
    {
      quote:
        "The agent governance stack has transformed our operations. We've reduced processing time by 85% while maintaining complete compliance with healthcare regulations.",
      author: 'Dr. Sarah Johnson',
      role: 'CTO',
      company: 'MedTech Solutions',
      industry: 'Healthcare',
    },
    {
      quote:
        'Our financial advisory team now handles 3x the client load with better accuracy. The governance controls give us confidence that all recommendations meet regulatory requirements.',
      author: 'Michael Chen',
      role: 'Director of Operations',
      company: 'Apex Financial',
      industry: 'Finance',
    },
    {
      quote:
        'The ROI was immediate. Within 3 months, we recouped our investment and now save over $200,000 annually while providing faster, more consistent service.',
      author: 'Jessica Williams',
      role: 'VP of Customer Experience',
      company: 'RetailNow',
      industry: 'Retail',
    },
  ];

  const [selectedCaseStudy, setSelectedCaseStudy] = useState<string>('healthcare');

  return (
    <div className="value-proposition-dashboard">
      <div className="value-header">
        <h2>The Business Case for Agent Governance</h2>
        <p>Quantifiable benefits of implementing our agent governance stack</p>

        <div className="value-tabs">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Value Overview
          </button>
          <button
            className={activeTab === 'roi' ? 'active' : ''}
            onClick={() => setActiveTab('roi')}
          >
            ROI Calculator
          </button>
          <button
            className={activeTab === 'simulation' ? 'active' : ''}
            onClick={() => setActiveTab('simulation')}
          >
            Live Simulation
          </button>
          <button
            className={activeTab === 'report' ? 'active' : ''}
            onClick={() => setActiveTab('report')}
          >
            Custom Report
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="overview-content">
          <div className="value-metrics">
            <h3>Key Performance Improvements</h3>
            <div className="metrics-grid">
              {valueMetrics.map((metric, index) => (
                <div key={index} className="metric-card">
                  <div className="metric-icon">{metric.icon}</div>
                  <div className="metric-title">{metric.title}</div>
                  <div className="metric-value">{metric.value}</div>
                  <div className="metric-description">{metric.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="case-studies-section">
            <h3>Real-World Results</h3>
            <div className="case-study-tabs">
              <button
                className={selectedCaseStudy === 'healthcare' ? 'active' : ''}
                onClick={() => setSelectedCaseStudy('healthcare')}
              >
                Healthcare
              </button>
              <button
                className={selectedCaseStudy === 'finance' ? 'active' : ''}
                onClick={() => setSelectedCaseStudy('finance')}
              >
                Finance
              </button>
              <button
                className={selectedCaseStudy === 'retail' ? 'active' : ''}
                onClick={() => setSelectedCaseStudy('retail')}
              >
                Retail
              </button>
            </div>

            <div className="case-metrics">
              {caseStudyMetrics[selectedCaseStudy].map((metric, index) => (
                <div key={index} className="case-metric-card">
                  <div className="case-metric-title">{metric.title}</div>
                  <div className="case-metric-comparison">
                    <div className="before-value">
                      <div className="value-label">Before</div>
                      <div className="value">
                        {metric.before} {metric.unit}
                      </div>
                    </div>
                    <div className="arrow">→</div>
                    <div className="after-value">
                      <div className="value-label">After</div>
                      <div className="value">
                        {metric.after} {metric.unit}
                      </div>
                    </div>
                    <div className="improvement">
                      <div className="improvement-label">Improvement</div>
                      <div className="improvement-value">{metric.improvement}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="testimonials-section">
            <h3>Customer Testimonials</h3>
            <div className="testimonials-grid">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="testimonial-card">
                  <div className="testimonial-quote">"{testimonial.quote}"</div>
                  <div className="testimonial-author">
                    <div className="author-name">{testimonial.author}</div>
                    <div className="author-role">
                      {testimonial.role}, {testimonial.company}
                    </div>
                    <div className="author-industry">{testimonial.industry}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="value-summary">
            <h3>Why Choose Our Agent Governance Stack</h3>
            <div className="summary-points">
              <div className="summary-point">
                <div className="point-icon">🔍</div>
                <div className="point-content">
                  <h4>Complete Transparency</h4>
                  <p>
                    Every agent action is logged with detailed reasoning and policy checks, ensuring
                    you always know what's happening and why.
                  </p>
                </div>
              </div>
              <div className="summary-point">
                <div className="point-icon">🛡️</div>
                <div className="point-content">
                  <h4>Robust Governance</h4>
                  <p>
                    Enforce policies automatically, prevent unauthorized actions, and maintain
                    compliance with industry regulations.
                  </p>
                </div>
              </div>
              <div className="summary-point">
                <div className="point-icon">💰</div>
                <div className="point-content">
                  <h4>Significant Cost Savings</h4>
                  <p>
                    Reduce operational costs by automating routine tasks while maintaining or
                    improving quality and compliance.
                  </p>
                </div>
              </div>
              <div className="summary-point">
                <div className="point-icon">⚡</div>
                <div className="point-content">
                  <h4>Rapid Implementation</h4>
                  <p>
                    Deploy agents quickly with our pre-built templates and governance frameworks,
                    seeing ROI in weeks, not months.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="cta-section">
            <h3>Ready to Transform Your Operations?</h3>
            <p>
              Start with a free trial and see the benefits of agent governance in your organization
            </p>
            <div className="cta-buttons">
              <button className="primary-cta">Start Free Trial</button>
              <button className="secondary-cta">Schedule Demo</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'roi' && (
        <div className="roi-content">
          <ROICalculator />
        </div>
      )}

      {activeTab === 'simulation' && (
        <div className="simulation-content">
          <AgentSimulation />
        </div>
      )}

      {activeTab === 'report' && (
        <div className="report-content">
          <ResultsReport />
        </div>
      )}
    </div>
  );
}
