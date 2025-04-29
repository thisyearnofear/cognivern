import { useState } from 'react';
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
}

export default function ValuePropositionWizard() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<string>('healthcare');
  
  // Key value metrics
  const valueMetrics: ValueMetric[] = [
    {
      title: 'Time Savings',
      value: '75%',
      description: 'Average reduction in time spent on routine tasks',
      icon: '⏱️'
    },
    {
      title: 'Cost Reduction',
      value: '65%',
      description: 'Average cost savings compared to manual processes',
      icon: '💰'
    },
    {
      title: 'Error Reduction',
      value: '90%',
      description: 'Decrease in errors and compliance issues',
      icon: '✓'
    },
    {
      title: 'Scalability',
      value: '10x',
      description: 'Increase in processing capacity without adding staff',
      icon: '📈'
    }
  ];
  
  // Case study metrics
  const caseStudyMetrics: Record<string, CaseMetric[]> = {
    'healthcare': [
      {
        title: 'Document Processing Time',
        before: '45',
        after: '5',
        improvement: '89%',
        unit: 'minutes'
      },
      {
        title: 'Staff Hours per Week',
        before: '120',
        after: '30',
        improvement: '75%',
        unit: 'hours'
      },
      {
        title: 'Error Rate',
        before: '8.5',
        after: '0.5',
        improvement: '94%',
        unit: '%'
      },
      {
        title: 'Annual Cost',
        before: '250,000',
        after: '75,000',
        improvement: '70%',
        unit: '$'
      }
    ],
    'finance': [
      {
        title: 'Transaction Processing',
        before: '15',
        after: '2',
        improvement: '87%',
        unit: 'minutes'
      },
      {
        title: 'Compliance Checks',
        before: '120',
        after: '10',
        improvement: '92%',
        unit: 'minutes'
      },
      {
        title: 'Audit Preparation',
        before: '40',
        after: '8',
        improvement: '80%',
        unit: 'hours'
      },
      {
        title: 'Annual Cost',
        before: '380,000',
        after: '95,000',
        improvement: '75%',
        unit: '$'
      }
    ],
    'retail': [
      {
        title: 'Inventory Management',
        before: '25',
        after: '5',
        improvement: '80%',
        unit: 'hours/week'
      },
      {
        title: 'Customer Response Time',
        before: '24',
        after: '2',
        improvement: '92%',
        unit: 'hours'
      },
      {
        title: 'Order Processing',
        before: '12',
        after: '3',
        improvement: '75%',
        unit: 'minutes'
      },
      {
        title: 'Annual Cost',
        before: '210,000',
        after: '65,000',
        improvement: '69%',
        unit: '$'
      }
    ]
  };

  const nextStep = () => {
    setActiveStep(prev => prev < 4 ? (prev + 1) as 1 | 2 | 3 | 4 : prev);
  };

  const prevStep = () => {
    setActiveStep(prev => prev > 1 ? (prev - 1) as 1 | 2 | 3 | 4 : prev);
  };

  const toggleAdvancedTools = () => {
    setShowAdvancedTools(prev => !prev);
  };

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
                      <div className="value">{metric.before} {metric.unit}</div>
                    </div>
                    <div className="arrow">→</div>
                    <div className="after-value">
                      <div className="value-label">After</div>
                      <div className="value">{metric.after} {metric.unit}</div>
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
          
          <div className="step-actions">
            <button className="next-button" onClick={nextStep}>
              Calculate Your ROI →
            </button>
            <button className="advanced-toggle" onClick={toggleAdvancedTools}>
              {showAdvancedTools ? 'Hide Advanced Tools' : 'Show Advanced Tools'}
            </button>
          </div>
          
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
                  <p>Schedule a call with our experts to discuss your specific needs and challenges</p>
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
            <button className="start-trial-button">
              Start Free Trial
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
