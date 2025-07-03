import { useState, useEffect } from 'react';
import './ValuePropositionWizard.css';
import ROICalculator from './ROICalculator';
import ResultsReport from './ResultsReport';
import AgentSimulation from './AgentSimulation';

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
  hasDemo?: boolean;
}

export default function ValuePropositionWizard({
  onNavigate,
}: {
  onNavigate: (route: string) => void;
}) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<string>('ecom');
  const [userEngagement, setUserEngagement] = useState<number>(0);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState<boolean>(false);

  // Track user engagement to progressively reveal more features
  useEffect(() => {
    // Increment engagement when user changes steps or interacts with the wizard
    if (activeStep > 1) {
      setUserEngagement((prev) => Math.min(prev + 1, 5));
    }
  }, [activeStep]);

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

  // Case study metrics with demo availability flags
  const caseStudyMetrics: Record<string, CaseMetric[]> = {
    healthcare: [
      {
        title: 'Document Processing Time',
        before: '45',
        after: '5',
        improvement: '89%',
        unit: 'minutes',
        hasDemo: false,
      },
      {
        title: 'Staff Hours per Week',
        before: '120',
        after: '30',
        improvement: '75%',
        unit: 'hours',
        hasDemo: false,
      },
      {
        title: 'Error Rate',
        before: '8.5',
        after: '0.5',
        improvement: '94%',
        unit: '%',
        hasDemo: false,
      },
      {
        title: 'Annual Cost',
        before: '250,000',
        after: '75,000',
        improvement: '70%',
        unit: '$',
        hasDemo: false,
      },
    ],
    accounting: [
      {
        title: 'Transaction Processing',
        before: '15',
        after: '2',
        improvement: '87%',
        unit: 'minutes',
        hasDemo: true,
      },
      {
        title: 'Compliance Checks',
        before: '120',
        after: '10',
        improvement: '92%',
        unit: 'minutes',
        hasDemo: false,
      },
      {
        title: 'Audit Preparation',
        before: '40',
        after: '8',
        improvement: '80%',
        unit: 'hours',
        hasDemo: false,
      },
      {
        title: 'Annual Cost',
        before: '380,000',
        after: '95,000',
        improvement: '75%',
        unit: '$',
        hasDemo: false,
      },
    ],
    ecom: [
      {
        title: 'Inventory Management',
        before: '25',
        after: '5',
        improvement: '80%',
        unit: 'hours/week',
        hasDemo: true,
      },
      {
        title: 'Customer Response Time',
        before: '24',
        after: '2',
        improvement: '92%',
        unit: 'hours',
        hasDemo: true,
      },
      {
        title: 'Order Processing',
        before: '12',
        after: '3',
        improvement: '75%',
        unit: 'minutes',
        hasDemo: false,
      },
      {
        title: 'Annual Cost',
        before: '210,000',
        after: '65,000',
        improvement: '69%',
        unit: '$',
        hasDemo: false,
      },
    ],
  };

  const nextStep = () => {
    setActiveStep((prev) => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : prev));
    // Increment engagement when user moves forward
    setUserEngagement((prev) => Math.min(prev + 1, 5));
  };

  const prevStep = () => {
    setActiveStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev));
  };

  const toggleAdvancedTools = () => {
    setShowAdvancedTools((prev) => !prev);
    // Increment engagement when user explores advanced tools
    setUserEngagement((prev) => Math.min(prev + 2, 5));
  };

  const toggleDetailedMetrics = () => {
    setShowDetailedMetrics((prev) => !prev);
    // Increment engagement when user explores detailed metrics
    setUserEngagement((prev) => Math.min(prev + 1, 5));
  };

  // Determine if advanced features should be shown based on user engagement
  const shouldShowAdvancedFeatures = userEngagement >= 3 || showAdvancedTools;

  return (
    <div className="value-proposition-wizard">
      <div className="wizard-header">
        <h2>The Business Case for Agent Governance</h2>
        <p>Discover how our platform can transform your operations</p>

        <div className="progress-indicator">
          <div className={`progress-step ${activeStep >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Overview</div>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${activeStep >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">ROI Calculator</div>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${activeStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Custom Report</div>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${activeStep >= 4 ? 'active' : ''}`}>
            <div className="step-number">4</div>
            <div className="step-label">Next Steps</div>
          </div>
        </div>
      </div>

      {activeStep === 1 && (
        <div className="step-content">
          <div className="case-studies-section">
            <h3>Real-World Results</h3>
            <div className="case-study-tabs">
              <button
                className={selectedCaseStudy === 'ecom' ? 'active' : ''}
                onClick={() => setSelectedCaseStudy('ecom')}
              >
                E-Commerce
              </button>
              <button
                className={selectedCaseStudy === 'accounting' ? 'active' : ''}
                onClick={() => setSelectedCaseStudy('accounting')}
              >
                Accounting
              </button>
              <button
                className={selectedCaseStudy === 'healthcare' ? 'active' : ''}
                onClick={() => setSelectedCaseStudy('healthcare')}
              >
                Healthcare
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
                  {metric.hasDemo && (
                    <div className="demo-button-container">
                      <button
                        className="try-demo-button"
                        onClick={() => {
                          // Route to the appropriate demo based on the metric
                          if (selectedCaseStudy === 'ecom') {
                            if (metric.title === 'Inventory Management') {
                              onNavigate('marketplace');
                            } else {
                              onNavigate('agents');
                            }
                          } else if (selectedCaseStudy === 'accounting') {
                            onNavigate('marketplace');
                          } else {
                            onNavigate('agents');
                          }
                        }}
                      >
                        Try Demo
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

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

          <div className="step-actions">
            <button className="next-button" onClick={nextStep}>
              Calculate Your ROI →
            </button>

            {/* Show the toggle button based on user engagement */}
            {(userEngagement >= 1 || showAdvancedTools) && (
              <button className="advanced-toggle" onClick={toggleAdvancedTools}>
                {showAdvancedTools ? 'Hide Advanced Tools' : 'Show Advanced Tools'}
              </button>
            )}

            {/* Show detailed metrics toggle based on user engagement */}
            {userEngagement >= 2 && (
              <button className="detailed-toggle" onClick={toggleDetailedMetrics}>
                {showDetailedMetrics ? 'Show Summary' : 'Show Detailed Metrics'}
              </button>
            )}
          </div>

          {/* Progressive hint for new users */}
          {userEngagement === 0 && (
            <div className="progressive-hint">
              <p>
                <span className="hint-icon">💡</span>
                Continue to the ROI calculator to unlock additional tools and detailed metrics.
              </p>
            </div>
          )}

          {/* Advanced tools section */}
          {showAdvancedTools && (
            <div className="advanced-tools">
              <h3>Advanced Tools</h3>
              <div className="tools-grid">
                <div className="tool-card" onClick={() => setActiveStep(2)}>
                  <div className="tool-icon">🧮</div>
                  <h4>ROI Calculator</h4>
                  <p>Calculate potential savings and ROI for your specific use case</p>
                </div>
                <div className="tool-card simulation-tool">
                  <div className="tool-icon">⏱️</div>
                  <h4>Live Simulation</h4>
                  <p>See a real-time comparison of agent vs. human performance</p>
                  <div className="simulation-container">
                    <AgentSimulation />
                  </div>
                </div>

                {/* Show additional advanced tools based on user engagement */}
                {userEngagement >= 4 && (
                  <div className="tool-card">
                    <div className="tool-icon">📊</div>
                    <h4>Custom Analysis</h4>
                    <p>Create a tailored analysis for your specific industry and use case</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detailed metrics section */}
          {showDetailedMetrics && (
            <div className="detailed-metrics">
              <h3>Detailed Performance Metrics</h3>
              <div className="metrics-table">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Small Business</th>
                      <th>Mid-Market</th>
                      <th>Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Time Savings</td>
                      <td>65%</td>
                      <td>75%</td>
                      <td>85%</td>
                    </tr>
                    <tr>
                      <td>Cost Reduction</td>
                      <td>55%</td>
                      <td>65%</td>
                      <td>75%</td>
                    </tr>
                    <tr>
                      <td>Error Reduction</td>
                      <td>85%</td>
                      <td>90%</td>
                      <td>95%</td>
                    </tr>
                    <tr>
                      <td>ROI (1 year)</td>
                      <td>180%</td>
                      <td>220%</td>
                      <td>280%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeStep === 2 && (
        <div className="step-content">
          <ROICalculator />

          <div className="step-actions">
            <button className="back-button" onClick={prevStep}>
              ← Back to Overview
            </button>
            <button className="next-button" onClick={nextStep}>
              Generate Custom Report →
            </button>
          </div>
        </div>
      )}

      {activeStep === 3 && (
        <div className="step-content">
          <ResultsReport />

          <div className="step-actions">
            <button className="back-button" onClick={prevStep}>
              ← Back to ROI Calculator
            </button>
            <button className="next-button" onClick={nextStep}>
              Next Steps →
            </button>
          </div>
        </div>
      )}

      {activeStep === 4 && (
        <div className="step-content">
          <div className="next-steps-section">
            <h3>Your Path to Implementation</h3>
            <div className="implementation-path">
              <div className="path-step">
                <div className="path-number">1</div>
                <div className="path-details">
                  <h4>Free Consultation</h4>
                  <p>
                    Schedule a call with our experts to discuss your specific needs and challenges
                  </p>
                  <button className="action-button">Schedule Call</button>
                </div>
              </div>

              <div className="path-step">
                <div className="path-number">2</div>
                <div className="path-details">
                  <h4>Pilot Program</h4>
                  <p>Start with a focused pilot to demonstrate value in your environment</p>
                  <button className="action-button">Design Pilot</button>
                </div>
              </div>

              <div className="path-step">
                <div className="path-number">3</div>
                <div className="path-details">
                  <h4>Full Implementation</h4>
                  <p>Roll out the complete solution with our implementation team's support</p>
                  <button className="action-button">Learn More</button>
                </div>
              </div>
            </div>

            <div className="additional-resources">
              <h3>Additional Resources</h3>
              <div className="resources-grid">
                <div className="resource-card">
                  <div className="resource-icon">📚</div>
                  <h4>Implementation Guide</h4>
                  <p>Step-by-step guide to implementing agent governance</p>
                  <button className="resource-button">Download PDF</button>
                </div>

                <div className="resource-card">
                  <div className="resource-icon">🎥</div>
                  <h4>Demo Videos</h4>
                  <p>See the platform in action with guided demonstrations</p>
                  <button className="resource-button">Watch Videos</button>
                </div>

                <div className="resource-card">
                  <div className="resource-icon">📝</div>
                  <h4>Case Studies</h4>
                  <p>Detailed case studies from organizations like yours</p>
                  <button className="resource-button">View Case Studies</button>
                </div>
              </div>
            </div>
          </div>

          <div className="step-actions">
            <button className="back-button" onClick={prevStep}>
              ← Back to Custom Report
            </button>
            <button className="start-trial-button">Start Free Trial</button>
          </div>
        </div>
      )}
    </div>
  );
}
