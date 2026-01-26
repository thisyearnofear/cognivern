import { useState, useRef } from "react";
import { css } from "@emotion/react";
import { designTokens } from "../../styles/designTokens";

interface ReportInput {
  companyName: string;
  industry: string;
  currentProcesses: string[];
  employeeCost: number;
  taskVolume: number;
  taskComplexity: "low" | "medium" | "high";
}

interface ReportResult {
  annualSavings: number;
  timeReduction: number;
  errorReduction: number;
  roi: number;
  paybackPeriod: number;
  recommendations: string[];
}

export default function ResultsReport() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reportInput, setReportInput] = useState<ReportInput>({
    companyName: "",
    industry: "",
    currentProcesses: [
      "Document Processing",
      "Customer Support",
      "Data Analysis",
    ],
    employeeCost: 75000,
    taskVolume: 1000,
    taskComplexity: "medium",
  });
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Industry options
  const industries = [
    "Healthcare",
    "Finance",
    "Retail",
    "Manufacturing",
    "Technology",
    "Education",
    "Government",
    "Legal",
    "Insurance",
    "Other",
  ];

  // Process options
  const processOptions = [
    "Document Processing",
    "Customer Support",
    "Data Analysis",
    "Compliance Monitoring",
    "Inventory Management",
    "Order Processing",
    "Invoice Processing",
    "HR Onboarding",
    "IT Support",
    "Quality Assurance",
  ];

  // Handle input changes
  const handleInputChange = (field: keyof ReportInput, value: any) => {
    setReportInput((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle process selection
  const toggleProcess = (process: string) => {
    setReportInput((prev) => {
      if (prev.currentProcesses.includes(process)) {
        return {
          ...prev,
          currentProcesses: prev.currentProcesses.filter((p) => p !== process),
        };
      } else {
        return {
          ...prev,
          currentProcesses: [...prev.currentProcesses, process],
        };
      }
    });
  };

  // Generate report
  const generateReport = () => {
    // Calculate results based on input
    const { employeeCost, taskVolume, taskComplexity, currentProcesses } =
      reportInput;

    // Base calculations
    let timeReductionFactor = 0.65; // 65% time reduction
    let errorReductionFactor = 0.85; // 85% error reduction
    let costPerTask =
      (employeeCost / 2080) *
      (taskComplexity === "low" ? 0.5 : taskComplexity === "medium" ? 1 : 2);

    // Adjust based on complexity
    if (taskComplexity === "low") {
      timeReductionFactor = 0.75;
      errorReductionFactor = 0.9;
    } else if (taskComplexity === "high") {
      timeReductionFactor = 0.55;
      errorReductionFactor = 0.8;
    }

    // Adjust based on process types
    if (currentProcesses.includes("Document Processing")) {
      timeReductionFactor += 0.05;
    }
    if (currentProcesses.includes("Data Analysis")) {
      timeReductionFactor -= 0.05;
      costPerTask *= 1.2;
    }
    if (currentProcesses.includes("Compliance Monitoring")) {
      errorReductionFactor += 0.05;
    }

    // Calculate savings
    const annualHumanCost = costPerTask * taskVolume;
    const annualAgentCost = annualHumanCost * (1 - timeReductionFactor) * 0.4; // Agent cost is 40% of equivalent human time
    const annualSavings = annualHumanCost - annualAgentCost;

    // Calculate ROI and payback
    const implementationCost = annualAgentCost * 1.5; // Initial setup cost
    const firstYearSavings = annualSavings - implementationCost;
    const threeYearSavings = annualSavings * 3 - implementationCost;
    const roi = (threeYearSavings / implementationCost) * 100;
    const paybackPeriod = implementationCost / (annualSavings / 12); // in months

    // Generate recommendations
    const recommendations = [];
    if (currentProcesses.includes("Document Processing")) {
      recommendations.push(
        "Deploy document processing agents with OCR capabilities to maximize efficiency",
      );
    }
    if (currentProcesses.includes("Customer Support")) {
      recommendations.push(
        "Implement tiered support with agents handling Tier 1 inquiries and humans focusing on complex issues",
      );
    }
    if (currentProcesses.includes("Data Analysis")) {
      recommendations.push(
        "Use agents for data preparation and initial analysis, with human experts reviewing insights",
      );
    }
    if (currentProcesses.includes("Compliance Monitoring")) {
      recommendations.push(
        "Implement comprehensive governance policies to ensure all agent actions meet regulatory requirements",
      );
    }

    // Add general recommendations
    recommendations.push(
      "Start with a pilot program focused on highest-volume processes to demonstrate value",
    );
    recommendations.push(
      "Implement robust governance controls to maintain compliance and quality",
    );

    // Set results
    setReportResult({
      annualSavings,
      timeReduction: timeReductionFactor * 100,
      errorReduction: errorReductionFactor * 100,
      roi,
      paybackPeriod,
      recommendations,
    });

    // Move to next step
    setStep(3);
  };

  // Print report
  const printReport = () => {
    if (reportRef.current) {
      const printContents = reportRef.current.innerHTML;
      const originalContents = document.body.innerHTML;

      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;

      // Reload the page to restore functionality
      window.location.reload();
    }
  };

  // Download as PDF
  const downloadPDF = () => {
    alert("PDF download functionality would be implemented here");
    // In a real implementation, this would use a library like jsPDF or call a backend service
  };

  return (
    <div className="results-report">
      <div className="report-header">
        <h2>Custom ROI & Benefits Report</h2>
        <p>
          Generate a personalized report showing the potential impact of agent
          governance in your organization
        </p>
      </div>

      {step === 1 && (
        <div className="report-step">
          <h3>Step 1: Company Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                value={reportInput.companyName}
                onChange={(e) =>
                  handleInputChange("companyName", e.target.value)
                }
                placeholder="Enter your company name"
              />
            </div>

            <div className="form-group">
              <label>Industry</label>
              <select
                value={reportInput.industry}
                onChange={(e) => handleInputChange("industry", e.target.value)}
              >
                <option value="">Select your industry</option>
                {industries.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="next-button"
              onClick={() => setStep(2)}
              disabled={!reportInput.companyName || !reportInput.industry}
            >
              Next Step
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="report-step">
          <h3>Step 2: Process Information</h3>

          <div className="form-section">
            <h4>Current Processes</h4>
            <p>Select the processes you're considering for automation</p>
            <div className="process-options">
              {processOptions.map((process) => (
                <div
                  key={process}
                  className={`process-option ${reportInput.currentProcesses.includes(process) ? "selected" : ""}`}
                  onClick={() => toggleProcess(process)}
                >
                  <div className="checkbox">
                    {reportInput.currentProcesses.includes(process) && (
                      <span className="checkmark">✓</span>
                    )}
                  </div>
                  <span>{process}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h4>Process Details</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Average Annual Cost per Employee ($)</label>
                <input
                  type="number"
                  value={reportInput.employeeCost}
                  onChange={(e) =>
                    handleInputChange("employeeCost", Number(e.target.value))
                  }
                  min="0"
                />
                <div className="input-hint">
                  Include salary, benefits, training, and overhead
                </div>
              </div>

              <div className="form-group">
                <label>Monthly Task Volume</label>
                <input
                  type="number"
                  value={reportInput.taskVolume}
                  onChange={(e) =>
                    handleInputChange("taskVolume", Number(e.target.value))
                  }
                  min="0"
                />
                <div className="input-hint">
                  Number of tasks processed per month
                </div>
              </div>

              <div className="form-group">
                <label>Average Task Complexity</label>
                <div className="complexity-options">
                  <button
                    className={
                      reportInput.taskComplexity === "low" ? "selected" : ""
                    }
                    onClick={() => handleInputChange("taskComplexity", "low")}
                  >
                    Low
                  </button>
                  <button
                    className={
                      reportInput.taskComplexity === "medium" ? "selected" : ""
                    }
                    onClick={() =>
                      handleInputChange("taskComplexity", "medium")
                    }
                  >
                    Medium
                  </button>
                  <button
                    className={
                      reportInput.taskComplexity === "high" ? "selected" : ""
                    }
                    onClick={() => handleInputChange("taskComplexity", "high")}
                  >
                    High
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="back-button" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="generate-button"
              onClick={generateReport}
              disabled={reportInput.currentProcesses.length === 0}
            >
              Generate Report
            </button>
          </div>
        </div>
      )}

      {step === 3 && reportResult && (
        <div className="report-step">
          <div className="report-actions">
            <button className="back-button" onClick={() => setStep(2)}>
              Edit Inputs
            </button>
            <button className="print-button" onClick={printReport}>
              Print Report
            </button>
            <button className="download-button" onClick={downloadPDF}>
              Download PDF
            </button>
          </div>

          <div className="report-document" ref={reportRef}>
            <div className="report-branding">
              <h2>Agent Governance ROI Report</h2>
              <div className="report-meta">
                <div>Prepared for: {reportInput.companyName}</div>
                <div>Industry: {reportInput.industry}</div>
                <div>Date: {new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <div className="report-summary">
              <h3>Executive Summary</h3>
              <p>
                Based on your inputs, implementing agent governance for your{" "}
                {reportInput.currentProcesses.join(", ")} processes could yield
                significant benefits. Our analysis shows potential for
                substantial cost savings, efficiency improvements, and error
                reduction while maintaining full governance and compliance.
              </p>
            </div>

            <div className="report-highlights">
              <div className="highlight-card">
                <div className="highlight-title">Annual Savings</div>
                <div className="highlight-value">
                  ${reportResult.annualSavings.toLocaleString()}
                </div>
              </div>
              <div className="highlight-card">
                <div className="highlight-title">Time Reduction</div>
                <div className="highlight-value">
                  {reportResult.timeReduction.toFixed(0)}%
                </div>
              </div>
              <div className="highlight-card">
                <div className="highlight-title">Error Reduction</div>
                <div className="highlight-value">
                  {reportResult.errorReduction.toFixed(0)}%
                </div>
              </div>
              <div className="highlight-card">
                <div className="highlight-title">3-Year ROI</div>
                <div className="highlight-value">
                  {reportResult.roi.toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="report-section">
              <h3>Financial Analysis</h3>
              <div className="financial-details">
                <div className="financial-row">
                  <div className="financial-label">Payback Period</div>
                  <div className="financial-value">
                    {reportResult.paybackPeriod.toFixed(1)} months
                  </div>
                </div>
                <div className="financial-row">
                  <div className="financial-label">Monthly Task Volume</div>
                  <div className="financial-value">
                    {reportInput.taskVolume.toLocaleString()}
                  </div>
                </div>
                <div className="financial-row">
                  <div className="financial-label">
                    Current Process Cost (Annual)
                  </div>
                  <div className="financial-value">
                    $
                    {(
                      (reportInput.employeeCost / 2080) *
                      (reportInput.taskComplexity === "low"
                        ? 0.5
                        : reportInput.taskComplexity === "medium"
                          ? 1
                          : 2) *
                      reportInput.taskVolume *
                      12
                    ).toLocaleString()}
                  </div>
                </div>
                <div className="financial-row">
                  <div className="financial-label">
                    Projected Agent Cost (Annual)
                  </div>
                  <div className="financial-value">
                    ${(reportResult.annualSavings * 0.4).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="report-section">
              <h3>Recommendations</h3>
              <ul className="recommendations-list">
                {reportResult.recommendations.map((recommendation, index) => (
                  <li key={index}>{recommendation}</li>
                ))}
              </ul>
            </div>

            <div className="report-section">
              <h3>Next Steps</h3>
              <ol className="next-steps-list">
                <li>
                  Schedule a detailed assessment with our team to validate these
                  projections
                </li>
                <li>
                  Identify a pilot process to demonstrate value in your specific
                  environment
                </li>
                <li>
                  Develop a governance framework tailored to your industry
                  requirements
                </li>
                <li>
                  Create an implementation roadmap with clear milestones and
                  success metrics
                </li>
              </ol>
            </div>

            <div className="report-footer">
              <p>
                This report was generated based on industry benchmarks and your
                provided information. Actual results may vary based on specific
                implementation details and organizational factors.
              </p>
              <div className="report-contact">
                <p>
                  For more information, contact us at{" "}
                  <strong>sales@cognivern.com</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
