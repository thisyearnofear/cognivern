import { useState, useEffect } from "react";
import "./LandingDashboard.css";

interface UserPath {
  id: string;
  title: string;
  description: string;
  icon: string;
  primaryCTA: string;
  route: string;
  complexity: "basic" | "intermediate" | "advanced";
}

export default function LandingDashboard({
  onNavigate,
}: {
  onNavigate: (route: string) => void;
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<
    "beginner" | "intermediate" | "advanced"
  >("beginner");
  const [showAllPaths, setShowAllPaths] = useState(false);

  const userPaths: UserPath[] = [
    {
      id: "evaluate",
      title: "Evaluate the ROI",
      description:
        "Calculate potential cost savings and efficiency gains for your organization",
      icon: "💰",
      primaryCTA: "Calculate Your ROI",
      route: "value-proposition",
      complexity: "basic",
    },
    {
      id: "explore",
      title: "Explore Use Cases",
      description:
        "See how agent governance solves real problems across different industries",
      icon: "🔍",
      primaryCTA: "View Case Studies",
      route: "case-studies",
      complexity: "basic",
    },
    {
      id: "experience",
      title: "Experience the Platform",
      description: "Try our interactive demos and see the platform in action",
      icon: "🚀",
      primaryCTA: "Try Trading Demo",
      route: "trading",
      complexity: "intermediate",
    },
    {
      id: "implement",
      title: "Implement a Solution",
      description:
        "Deploy and manage your own agents with full governance controls",
      icon: "⚙️",
      primaryCTA: "Deploy Your First Agent",
      route: "agents",
      complexity: "advanced",
    },
  ];

  // Filter paths based on user level unless showAllPaths is true
  const visiblePaths = showAllPaths
    ? userPaths
    : userPaths.filter((path) => {
        if (userLevel === "beginner") return path.complexity === "basic";
        if (userLevel === "intermediate") return path.complexity !== "advanced";
        return true; // Show all paths for advanced users
      });

  const handlePathSelect = (pathId: string) => {
    setSelectedPath(pathId);

    // Update user level based on selected path
    const selectedPathObj = userPaths.find((p) => p.id === pathId);
    if (selectedPathObj) {
      if (selectedPathObj.complexity === "advanced") {
        setUserLevel("advanced");
      } else if (selectedPathObj.complexity === "intermediate") {
        setUserLevel((prev) => (prev === "beginner" ? "intermediate" : prev));
      }
    }
  };

  const handleNavigate = (route: string) => {
    onNavigate(route);
  };

  const toggleShowAllPaths = () => {
    setShowAllPaths((prev) => !prev);
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
        <div className="path-header">
          <h2>What would you like to do today?</h2>
          <div className="path-controls">
            <button
              className={`toggle-paths-button ${showAllPaths ? "active" : ""}`}
              onClick={toggleShowAllPaths}
            >
              {showAllPaths ? "Show Recommended" : "Show All Options"}
            </button>
          </div>
        </div>

        <div className="paths-grid">
          {visiblePaths.map((path) => (
            <div
              key={path.id}
              className={`path-card ${selectedPath === path.id ? "selected" : ""} ${path.complexity}`}
              onClick={() => handlePathSelect(path.id)}
            >
              <div className="path-icon">{path.icon}</div>
              {path.complexity !== "basic" && (
                <div className="path-complexity-badge">
                  {path.complexity === "intermediate"
                    ? "Intermediate"
                    : "Advanced"}
                </div>
              )}
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

        {!showAllPaths && userLevel === "beginner" && (
          <div className="progressive-hint">
            <p>
              <span className="hint-icon">💡</span>
              Start with these options to learn the basics. More advanced
              features will become available as you explore.
            </p>
          </div>
        )}
      </div>

      <div className="quick-value-prop">
        <h2>Why Choose Our Agent Governance Platform?</h2>
        <div className="value-grid">
          <div className="value-item">
            <div className="value-icon">🔍</div>
            <h3>Complete Transparency</h3>
            <p>
              Every agent action is logged with detailed reasoning and policy
              checks
            </p>
          </div>
          <div className="value-item">
            <div className="value-icon">🛡️</div>
            <div className="value-content">
              <h3>Robust Governance</h3>
              <p>
                Enforce policies automatically and maintain compliance with
                regulations
              </p>
            </div>
          </div>
          <div className="value-item">
            <div className="value-icon">💰</div>
            <div className="value-content">
              <h3>Significant Cost Savings</h3>
              <p>
                Reduce operational costs while maintaining or improving quality
              </p>
            </div>
          </div>
          <div className="value-item">
            <div className="value-icon">⚡</div>
            <div className="value-content">
              <h3>Rapid Implementation</h3>
              <p>
                Deploy agents quickly with our pre-built templates and
                frameworks
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="testimonial-highlight">
        <div className="testimonial-content">
          <div className="quote-mark">"</div>
          <p className="quote-text">
            AI agents represent a significant evolution beyond current
            generative AI systems. While generative AI tools like LLMs respond
            to individual prompts, AI agents can autonomously pursue goals over
            hours or days, interacting with multiple systems and tools. They can
            execute actions, observe results, and adjust their approach
            accordingly-all with minimal human supervision.
          </p>
          <div className="quote-author">
            <strong>Rebecca Hawkins</strong>, UK Parliamentary Evidence
          </div>
          <div className="quote-source">
            <a
              href="https://committees.parliament.uk/writtenevidence/135611/html/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source
            </a>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <h2>Ready to Get Started?</h2>
        <p>Choose the path that best fits your current needs</p>
        <div className="cta-buttons">
          <button
            className="primary-cta"
            onClick={() => handleNavigate("value-proposition")}
          >
            Calculate Your ROI
          </button>
          <button
            className="secondary-cta"
            onClick={() => handleNavigate("case-studies")}
          >
            Explore Use Cases
          </button>
        </div>
      </div>
    </div>
  );
}
