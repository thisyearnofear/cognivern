import { useState, useRef, useEffect } from 'react';
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
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Toggle dropdown menu
  const toggleDropdown = (menu: string) => {
    setActiveDropdown(activeDropdown === menu ? null : menu);
  };

  // Navigation structure with primary and secondary items
  const navigation = {
    primary: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'agents', label: 'Agents', hasSubmenu: true },
      { id: 'value-proposition', label: 'Value' },
    ],
    agents: [
      { id: 'agents', label: 'Agent Workshop' },
      { id: 'marketplace', label: 'Agent Marketplace' },
      { id: 'external-agents', label: 'External Agents' },
    ],
    advanced: [
      { id: 'policies', label: 'Policies' },
      { id: 'logs', label: 'Audit Logs' },
      { id: 'case-studies', label: 'Case Studies' },
    ],
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 onClick={() => setActiveTab('landing')} style={{ cursor: 'pointer' }}>
            Cognivern
          </h1>
          {activeTab !== 'landing' && (
            <nav className="main-nav">
              {/* Primary Navigation */}
              {navigation.primary.map((item) => (
                <div key={item.id} className="nav-item-container">
                  {item.hasSubmenu ? (
                    <div className="dropdown-container" ref={dropdownRef}>
                      <button
                        className={`nav-button ${activeTab.startsWith(item.id) ? 'active' : ''} ${activeDropdown === item.id ? 'dropdown-active' : ''}`}
                        onClick={() => toggleDropdown(item.id)}
                      >
                        {item.label} <span className="dropdown-arrow">▾</span>
                      </button>
                      {activeDropdown === item.id && (
                        <div className="dropdown-menu">
                          {navigation.agents.map((subItem) => (
                            <button
                              key={subItem.id}
                              className={activeTab === subItem.id ? 'active' : ''}
                              onClick={() => {
                                setActiveTab(subItem.id);
                                setActiveDropdown(null);
                              }}
                            >
                              {subItem.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      className={activeTab === item.id ? 'active' : ''}
                      onClick={() => setActiveTab(item.id)}
                    >
                      {item.label}
                    </button>
                  )}
                </div>
              ))}

              {/* Advanced Options Dropdown */}
              <div className="dropdown-container" ref={dropdownRef}>
                <button
                  className={`nav-button ${activeDropdown === 'advanced' ? 'dropdown-active' : ''}`}
                  onClick={() => toggleDropdown('advanced')}
                >
                  Advanced <span className="dropdown-arrow">▾</span>
                </button>
                {activeDropdown === 'advanced' && (
                  <div className="dropdown-menu">
                    {navigation.advanced.map((item) => (
                      <button
                        key={item.id}
                        className={activeTab === item.id ? 'active' : ''}
                        onClick={() => {
                          setActiveTab(item.id);
                          setActiveDropdown(null);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          )}
        </div>
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
