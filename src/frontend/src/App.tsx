import { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import './components/Dashboard.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>AI Agent Governance Platform</h1>
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
            Agents
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
        </nav>
      </header>

      <main className="app-content">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'agents' && <div className="coming-soon">Agents management coming soon</div>}
        {activeTab === 'policies' && (
          <div className="coming-soon">Policy management coming soon</div>
        )}
        {activeTab === 'logs' && <div className="coming-soon">Audit logs coming soon</div>}
      </main>

      <footer className="app-footer">
        <p>© 2025 AI Agent Governance Platform - Powered by Recall Network</p>
      </footer>
    </div>
  );
}

export default App;
