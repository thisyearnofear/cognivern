import { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/designTokens';

interface ROIData {
  humanCost: number;
  agentCost: number;
  timeSavings: number;
  qualityImprovement: number;
  complianceImprovement: number;
}

interface IndustryPreset {
  name: string;
  description: string;
  data: ROIData;
}

export default function ROICalculator() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'comparison'>('calculator');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<ROIData>({
    humanCost: 75000, // Annual cost of human employee
    agentCost: 15000, // Annual cost of agent solution
    timeSavings: 65, // Percentage time savings
    qualityImprovement: 35, // Percentage quality improvement
    complianceImprovement: 90, // Percentage compliance improvement
  });
  const [showResults, setShowResults] = useState(false);

  // Industry-specific presets
  const industryPresets: IndustryPreset[] = [
    {
      name: 'Healthcare',
      description: 'Medical record processing and patient scheduling',
      data: {
        humanCost: 85000,
        agentCost: 18000,
        timeSavings: 70,
        qualityImprovement: 45,
        complianceImprovement: 95,
      },
    },
    {
      name: 'Finance',
      description: 'Transaction processing and compliance monitoring',
      data: {
        humanCost: 95000,
        agentCost: 22000,
        timeSavings: 75,
        qualityImprovement: 40,
        complianceImprovement: 98,
      },
    },
    {
      name: 'Legal',
      description: 'Document review and contract analysis',
      data: {
        humanCost: 120000,
        agentCost: 25000,
        timeSavings: 65,
        qualityImprovement: 30,
        complianceImprovement: 85,
      },
    },
    {
      name: 'Customer Service',
      description: 'Tier 1 support and inquiry handling',
      data: {
        humanCost: 55000,
        agentCost: 12000,
        timeSavings: 80,
        qualityImprovement: 25,
        complianceImprovement: 90,
      },
    },
    {
      name: 'E-commerce',
      description: 'Inventory management and order processing',
      data: {
        humanCost: 65000,
        agentCost: 14000,
        timeSavings: 75,
        qualityImprovement: 35,
        complianceImprovement: 80,
      },
    },
  ];

  // Apply preset values
  const applyPreset = (presetName: string) => {
    const preset = industryPresets.find((p) => p.name === presetName);
    if (preset) {
      setCustomValues(preset.data);
      setSelectedPreset(presetName);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof ROIData, value: number) => {
    setCustomValues((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSelectedPreset(null); // Clear preset selection when custom values are entered
  };

  // Calculate ROI
  const calculateROI = () => {
    setShowResults(true);
  };

  // Calculate annual savings
  const calculateAnnualSavings = () => {
    const { humanCost, agentCost, timeSavings } = customValues;
    const humanHourlyRate = humanCost / 2080; // 2080 = 40 hours * 52 weeks
    const timeValue = (humanCost * timeSavings) / 100;
    return humanCost - agentCost + timeValue;
  };

  // Calculate 3-year ROI
  const calculateThreeYearROI = () => {
    const annualSavings = calculateAnnualSavings();
    const threeYearSavings = annualSavings * 3;
    const initialInvestment = customValues.agentCost * 1.5; // Assuming 1.5x first year cost for implementation
    return ((threeYearSavings - initialInvestment) / initialInvestment) * 100;
  };

  // Calculate payback period in months
  const calculatePaybackPeriod = () => {
    const annualSavings = calculateAnnualSavings();
    const initialInvestment = customValues.agentCost * 1.5;
    const monthlyPayback = annualSavings / 12;
    return initialInvestment / monthlyPayback;
  };

  return (
    <div className="roi-calculator">
      <div className="roi-header">
        <h2>Agent ROI Calculator</h2>
        <p>Estimate the return on investment from implementing agent solutions</p>
        
        <div className="roi-tabs">
          <button 
            className={activeTab === 'calculator' ? 'active' : ''}
            onClick={() => setActiveTab('calculator')}
          >
            Calculator
          </button>
          <button 
            className={activeTab === 'comparison' ? 'active' : ''}
            onClick={() => setActiveTab('comparison')}
          >
            Human vs Agent Comparison
          </button>
        </div>
      </div>

      {activeTab === 'calculator' && (
        <div className="calculator-container">
          <div className="presets-section">
            <h3>Industry Presets</h3>
            <p>Select an industry to use typical values or customize below</p>
            <div className="preset-buttons">
              {industryPresets.map((preset) => (
                <button
                  key={preset.name}
                  className={selectedPreset === preset.name ? 'active' : ''}
                  onClick={() => applyPreset(preset.name)}
                >
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-desc">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="calculator-inputs">
            <div className="input-group">
              <label>Annual Cost per Human Employee ($)</label>
              <input
                type="number"
                value={customValues.humanCost}
                onChange={(e) => handleInputChange('humanCost', Number(e.target.value))}
                min="0"
              />
            </div>
            <div className="input-group">
              <label>Annual Cost per Agent Solution ($)</label>
              <input
                type="number"
                value={customValues.agentCost}
                onChange={(e) => handleInputChange('agentCost', Number(e.target.value))}
                min="0"
              />
            </div>
            <div className="input-group">
              <label>Time Savings (%)</label>
              <input
                type="number"
                value={customValues.timeSavings}
                onChange={(e) => handleInputChange('timeSavings', Number(e.target.value))}
                min="0"
                max="100"
              />
              <div className="input-hint">Percentage of time saved by using agents</div>
            </div>
            <div className="input-group">
              <label>Quality Improvement (%)</label>
              <input
                type="number"
                value={customValues.qualityImprovement}
                onChange={(e) => handleInputChange('qualityImprovement', Number(e.target.value))}
                min="0"
                max="100"
              />
              <div className="input-hint">Percentage improvement in output quality</div>
            </div>
            <div className="input-group">
              <label>Compliance Improvement (%)</label>
              <input
                type="number"
                value={customValues.complianceImprovement}
                onChange={(e) => handleInputChange('complianceImprovement', Number(e.target.value))}
                min="0"
                max="100"
              />
              <div className="input-hint">Percentage improvement in regulatory compliance</div>
            </div>

            <button className="calculate-button" onClick={calculateROI}>
              Calculate ROI
            </button>
          </div>

          {showResults && (
            <div className="roi-results">
              <h3>ROI Analysis</h3>
              
              <div className="results-grid">
                <div className="result-card">
                  <div className="result-title">Annual Savings</div>
                  <div className="result-value">${calculateAnnualSavings().toLocaleString()}</div>
                  <div className="result-desc">Per agent deployed</div>
                </div>
                
                <div className="result-card">
                  <div className="result-title">3-Year ROI</div>
                  <div className="result-value">{calculateThreeYearROI().toFixed(0)}%</div>
                  <div className="result-desc">Return on investment</div>
                </div>
                
                <div className="result-card">
                  <div className="result-title">Payback Period</div>
                  <div className="result-value">{calculatePaybackPeriod().toFixed(1)} months</div>
                  <div className="result-desc">Time to recoup investment</div>
                </div>
              </div>
              
              <div className="savings-breakdown">
                <h4>Savings Breakdown</h4>
                <div className="breakdown-item">
                  <div className="breakdown-label">Direct Cost Savings</div>
                  <div className="breakdown-value">
                    ${(customValues.humanCost - customValues.agentCost).toLocaleString()}
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-label">Time Efficiency Value</div>
                  <div className="breakdown-value">
                    ${((customValues.humanCost * customValues.timeSavings) / 100).toLocaleString()}
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-label">Quality Improvement Value</div>
                  <div className="breakdown-value">
                    Reduced errors and rework
                  </div>
                </div>
                <div className="breakdown-item">
                  <div className="breakdown-label">Compliance Value</div>
                  <div className="breakdown-value">
                    Reduced risk and audit costs
                  </div>
                </div>
              </div>
              
              <div className="roi-cta">
                <p>Ready to see these savings in your organization?</p>
                <button className="deploy-button">Deploy Your First Agent</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="comparison-container">
          <div className="comparison-header">
            <h3>Human vs Agent Performance Comparison</h3>
            <p>See how agent solutions compare to human workers across key metrics</p>
          </div>
          
          <div className="comparison-grid">
            <div className="comparison-category">
              <h4>Speed & Efficiency</h4>
              <div className="comparison-item">
                <div className="comparison-label">Processing Time</div>
                <div className="comparison-bars">
                  <div className="human-bar" style={{ width: '80%' }}>
                    <span>Human: 25 min</span>
                  </div>
                  <div className="agent-bar" style={{ width: '20%' }}>
                    <span>Agent: 5 min</span>
                  </div>
                </div>
              </div>
              <div className="comparison-item">
                <div className="comparison-label">Availability</div>
                <div className="comparison-bars">
                  <div className="human-bar" style={{ width: '33%' }}>
                    <span>Human: 8 hrs/day</span>
                  </div>
                  <div className="agent-bar" style={{ width: '100%' }}>
                    <span>Agent: 24 hrs/day</span>
                  </div>
                </div>
              </div>
              <div className="comparison-item">
                <div className="comparison-label">Scalability</div>
                <div className="comparison-bars">
                  <div className="human-bar" style={{ width: '30%' }}>
                    <span>Human: Limited</span>
                  </div>
                  <div className="agent-bar" style={{ width: '90%' }}>
                    <span>Agent: Highly Scalable</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="comparison-category">
              <h4>Quality & Compliance</h4>
              <div className="comparison-item">
                <div className="comparison-label">Error Rate</div>
                <div className="comparison-bars">
                  <div className="human-bar" style={{ width: '65%' }}>
                    <span>Human: 3-5%</span>
                  </div>
                  <div className="agent-bar" style={{ width: '25%' }}>
                    <span>Agent: 0.5-1%</span>
                  </div>
                </div>
              </div>
              <div className="comparison-item">
                <div className="comparison-label">Policy Compliance</div>
                <div className="comparison-bars">
                  <div className="human-bar" style={{ width: '75%' }}>
                    <span>Human: 85-90%</span>
                  </div>
                  <div className="agent-bar" style={{ width: '98%' }}>
                    <span>Agent: 99%+</span>
                  </div>
                </div>
              </div>
              <div className="comparison-item">
                <div className="comparison-label">Consistency</div>
                <div className="comparison-bars">
                  <div className="human-bar" style={{ width: '60%' }}>
                    <span>Human: Variable</span>
                  </div>
                  <div className="agent-bar" style={{ width: '95%' }}>
                    <span>Agent: Highly Consistent</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="comparison-category">
              <h4>Cost Structure</h4>
              <div className="comparison-item">
                <div className="comparison-label">Annual Cost</div>
                <div className="comparison-bars">
                  <div className="human-bar" style={{ width: '100%' }}>
                    <span>Human: $75,000+</span>
                  </div>
                  <div className="agent-bar" style={{ width: '20%' }}>
                    <span>Agent: $15,000</span>
                  </div>
                </div>
              </div>
              <div className="comparison-item">
                <div className="comparison-label">Training Cost</div>
                <div className="comparison-bars">
                  <div className="human-bar" style={{ width: '80%' }}>
                    <span>Human: High</span>
                  </div>
                  <div className="agent-bar" style={{ width: '30%' }}>
                    <span>Agent: Low</span>
                  </div>
                </div>
              </div>
              <div className="comparison-item">
                <div className="comparison-label">Scaling Cost</div>
                <div className="comparison-bars">
                  <div className="human-bar" style={{ width: '90%' }}>
                    <span>Human: Linear</span>
                  </div>
                  <div className="agent-bar" style={{ width: '30%' }}>
                    <span>Agent: Diminishing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="comparison-summary">
            <h4>Key Takeaways</h4>
            <ul>
              <li>Agents operate 24/7 without fatigue or performance degradation</li>
              <li>Agents maintain consistent quality and 99%+ policy compliance</li>
              <li>Cost per task decreases as agent deployment scales</li>
              <li>Human workers can be reallocated to higher-value strategic tasks</li>
              <li>Governance framework ensures all agent actions are auditable and compliant</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
