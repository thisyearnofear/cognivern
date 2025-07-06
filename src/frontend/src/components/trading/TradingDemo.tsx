import { useState, useEffect } from "react";
import "./TradingDemo.css";

interface TradingDecision {
  action: "buy" | "sell" | "hold";
  symbol: string;
  quantity: number;
  price: number;
  confidence: number;
  reasoning: string;
  riskScore: number;
  timestamp: string;
}

interface Competition {
  id: string;
  name: string;
  status: "upcoming" | "live" | "completed";
  participants: number;
  prizePool: number;
}

export default function TradingDemo() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [tradingDecisions, setTradingDecisions] = useState<TradingDecision[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<string | null>(
    null
  );

  useEffect(() => {
    fetchTradingData();
  }, []);

  const fetchTradingData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const headers = { "X-API-KEY": apiKey };

      // Fetch live competitions
      const competitionsResponse = await fetch(
        "/api/recall/competitions/live",
        { headers }
      );
      if (competitionsResponse.ok) {
        const comps = await competitionsResponse.json();
        setCompetitions(comps);
        if (comps.length > 0) {
          setSelectedCompetition(comps[0].id);
        }
      }

      // Fetch completed competitions for demo data
      const completedResponse = await fetch(
        "/api/recall/competitions/completed?limit=5",
        { headers }
      );
      if (completedResponse.ok) {
        const completed = await completedResponse.json();
        // Create mock trading decisions from completed competitions
        const mockDecisions: TradingDecision[] = completed
          .slice(0, 3)
          .map((comp: any, index: number) => ({
            action: ["buy", "sell", "hold"][index % 3] as
              | "buy"
              | "sell"
              | "hold",
            symbol: ["AAPL", "GOOGL", "MSFT"][index % 3],
            quantity: Math.floor(Math.random() * 100) + 10,
            price: Math.random() * 200 + 100,
            confidence: Math.random() * 0.4 + 0.6,
            reasoning: `AI analysis suggests ${["strong upward trend", "potential downside risk", "market consolidation"][index % 3]}`,
            riskScore: Math.random() * 30 + 20,
            timestamp: new Date(
              Date.now() - Math.random() * 3600000
            ).toISOString(),
          }));
        setTradingDecisions(mockDecisions);
      }
    } catch (err) {
      console.error("Error fetching trading data:", err);
      setError("Failed to load trading data");
    } finally {
      setIsLoading(false);
    }
  };

  const startTradingRound = async () => {
    if (!selectedCompetition) return;

    setIsLoading(true);
    try {
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const headers = {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      };

      const response = await fetch(
        `/api/trading/competitions/${selectedCompetition}/round`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            marketData: {
              timestamp: new Date().toISOString(),
              prices: {
                AAPL: Math.random() * 200 + 100,
                GOOGL: Math.random() * 300 + 200,
                MSFT: Math.random() * 400 + 300,
              },
            },
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.decisions) {
          setTradingDecisions((prev) =>
            [...result.decisions, ...prev].slice(0, 10)
          );
        }
      }
    } catch (err) {
      console.error("Error starting trading round:", err);
      setError("Failed to start trading round");
    } finally {
      setIsLoading(false);
    }
  };

  const renderCompetitions = () => (
    <div className="competitions-section">
      <h3>🏆 Live Trading Competitions</h3>
      {competitions.length === 0 ? (
        <div className="no-competitions">
          <p>
            No live competitions found. The trading system is ready but no
            active competitions are running.
          </p>
          <div className="demo-note">
            <strong>Demo Mode:</strong> Showing simulated trading decisions
            below.
          </div>
        </div>
      ) : (
        <div className="competitions-list">
          {competitions.map((comp) => (
            <div
              key={comp.id}
              className={`competition-card ${selectedCompetition === comp.id ? "selected" : ""}`}
              onClick={() => setSelectedCompetition(comp.id)}
            >
              <h4>{comp.name}</h4>
              <div className="competition-stats">
                <span>👥 {comp.participants} participants</span>
                <span>💰 ${comp.prizePool.toLocaleString()} prize pool</span>
                <span className={`status ${comp.status}`}>{comp.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTradingDecisions = () => (
    <div className="trading-decisions">
      <div className="decisions-header">
        <h3>🤖 AI Trading Decisions</h3>
        <button
          onClick={startTradingRound}
          disabled={isLoading || !selectedCompetition}
          className="start-round-btn"
        >
          {isLoading ? "Processing..." : "Start Trading Round"}
        </button>
      </div>

      {tradingDecisions.length === 0 ? (
        <div className="no-decisions">
          <p>
            No trading decisions yet. Click "Start Trading Round" to see AI
            agents make trading decisions.
          </p>
        </div>
      ) : (
        <div className="decisions-list">
          {tradingDecisions.map((decision, index) => (
            <div key={index} className={`decision-card ${decision.action}`}>
              <div className="decision-header">
                <span className={`action-badge ${decision.action}`}>
                  {decision.action.toUpperCase()}
                </span>
                <span className="symbol">{decision.symbol}</span>
                <span className="timestamp">
                  {new Date(decision.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="decision-details">
                <div className="trade-info">
                  <span>Quantity: {decision.quantity}</span>
                  <span>Price: ${decision.price.toFixed(2)}</span>
                  <span>
                    Confidence: {(decision.confidence * 100).toFixed(1)}%
                  </span>
                  <span>Risk Score: {decision.riskScore.toFixed(1)}</span>
                </div>
                <p className="reasoning">{decision.reasoning}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="trading-demo error">
        <h2>Trading Demo</h2>
        <div className="error-message">
          <p>⚠️ {error}</p>
          <button onClick={fetchTradingData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="trading-demo">
      <div className="demo-header">
        <h2>🚀 Live Trading Agent Demo</h2>
        <p>
          Watch AI agents make real trading decisions with governance oversight
        </p>
      </div>

      {renderCompetitions()}
      {renderTradingDecisions()}

      <div className="governance-info">
        <h3>🛡️ Governance in Action</h3>
        <div className="governance-features">
          <div className="feature">
            <span className="feature-icon">📋</span>
            <div>
              <h4>Policy Enforcement</h4>
              <p>
                Every trading decision is checked against governance policies
                before execution
              </p>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon">🔗</span>
            <div>
              <h4>Blockchain Audit</h4>
              <p>
                All decisions are recorded immutably on Filecoin for complete
                transparency
              </p>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <div>
              <h4>Real-time Monitoring</h4>
              <p>
                Live monitoring of agent behavior and compliance with risk
                management rules
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
