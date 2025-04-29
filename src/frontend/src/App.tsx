import { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import AgentWorkshop from './components/AgentWorkshop';
import PolicyManagement from './components/PolicyManagement';
import AuditLogs from './components/AuditLogs';
import AgentMarketplace from './components/AgentMarketplace';
import CaseStudies from './components/CaseStudies';
import ValuePropositionWizard from './components/ValuePropositionWizard';
import LandingDashboard from './components/LandingDashboard';
import ExternalAgentIntegration from './components/ExternalAgentIntegration';
import './components/Dashboard.css';

function App() {
  const [activeTab, setActiveTab] = useState('landing');

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 onClick={() => setActiveTab('landing')} style={{ cursor: 'pointer' }}>
          Cognivern
        </h1>
        {activeTab !== 'landing' && (
          <nav className="main-nav">
            <button
              className={activeTab === 'dashboard' ? 'active' : ''}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={activeTab === 'agents' ? 'active' : ''}
              onClick={() => setActiveTab('agents')}
            >
              Agent Workshop
            </button>
            <button
              className={activeTab === 'marketplace' ? 'active' : ''}
              onClick={() => setActiveTab('marketplace')}
            >
              Agent Marketplace
            </button>
            <button
              className={activeTab === 'value-proposition' ? 'active' : ''}
              onClick={() => setActiveTab('value-proposition')}
            >
              Value Proposition
            </button>
            <button
              className={activeTab === 'case-studies' ? 'active' : ''}
              onClick={() => setActiveTab('case-studies')}
            >
              Case Studies
            </button>
            <button
              className={activeTab === 'policies' ? 'active' : ''}
              onClick={() => setActiveTab('policies')}
            >
              Policies
            </button>
            <button
              className={activeTab === 'logs' ? 'active' : ''}
              onClick={() => setActiveTab('logs')}
            >
              Audit Logs
            </button>
            <button
              className={activeTab === 'external-agents' ? 'active' : ''}
              onClick={() => setActiveTab('external-agents')}
            >
              External Agents
            </button>
          </nav>
        )}
      </header>

      <main className="app-content">
        {activeTab === 'landing' && <LandingDashboard onNavigate={setActiveTab} />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'agents' && <AgentWorkshop />}
        {activeTab === 'marketplace' && <AgentMarketplace />}
        {activeTab === 'value-proposition' && <ValuePropositionWizard />}
        {activeTab === 'case-studies' && <CaseStudies />}
        {activeTab === 'policies' && <PolicyManagement />}
        {activeTab === 'logs' && <AuditLogs />}
        {activeTab === 'external-agents' && <ExternalAgentIntegration />}
      </main>

      <footer className="app-footer">
        <p>© Cognivern - Powered by Recall Network & Bitte Protocol</p>
      </footer>
    </div>
  );
}

export default App;
