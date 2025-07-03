import { useState, useRef, useEffect } from 'react';
import './App.css';
import UnifiedDashboard from './components/dashboard/UnifiedDashboard';
import PolicyManagement from './components/policies/PolicyManagement';
import AuditLogs from './components/AuditLogs';
import LandingDashboard from './components/dashboard/LandingDashboard';
import SimplifiedDashboard from './components/dashboard/SimplifiedDashboard';
import WelcomeFlow from './components/onboarding/WelcomeFlow';
import Web3Auth from './components/auth/Web3Auth';
import WalletConnect from './components/web3/WalletConnect';
import './components/dashboard/Dashboard.css';

function App() {
  const [activeTab, setActiveTab] = useState('welcome');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<string>('');
  const [userType, setUserType] = useState<string>('');
  const [hasCompletedWelcome, setHasCompletedWelcome] = useState(false);
  const agentsDropdownRef = useRef<HTMLDivElement>(null);
  const advancedDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Check if click is outside both dropdowns
      const isOutsideAgentsDropdown =
        !agentsDropdownRef.current || !agentsDropdownRef.current.contains(event.target as Node);
      const isOutsideAdvancedDropdown =
        !advancedDropdownRef.current || !advancedDropdownRef.current.contains(event.target as Node);

      if (isOutsideAgentsDropdown && isOutsideAdvancedDropdown) {
        setActiveDropdown(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Toggle dropdown menu
  const toggleDropdown = (menu: string, event?: React.MouseEvent) => {
    // Prevent event from bubbling up to document click handler
    if (event) {
      event.stopPropagation();
    }
    setActiveDropdown(activeDropdown === menu ? null : menu);
  };

  // Handle wallet connection
  const handleWalletConnect = (address: string) => {
    setConnectedWallet(address);
    console.log('Wallet connected:', address);
  };

  const handleWalletDisconnect = () => {
    setConnectedWallet('');
    console.log('Wallet disconnected');
  };

  // Handle welcome flow completion
  const handleWelcomeComplete = (selectedUserType: string) => {
    setUserType(selectedUserType);
    setHasCompletedWelcome(true);
    setActiveTab('dashboard');
  };

  // Simplified navigation structure
  const navigation = {
    primary: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'policies', label: 'Policies' },
      { id: 'logs', label: 'Audit Logs' },
    ],
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 onClick={() => setActiveTab('landing')} style={{ cursor: 'pointer' }}>
            Cognivern
          </h1>
          <Web3Auth 
            onConnect={handleWalletConnect} 
            onDisconnect={handleWalletDisconnect} 
          />
          {activeTab !== 'landing' && (
            <nav className="main-nav">
              {navigation.primary.map((item) => (
                <button
                  key={item.id}
                  className={activeTab === item.id ? 'active' : ''}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="app-content">
        {activeTab === 'welcome' && !hasCompletedWelcome && (
          <WelcomeFlow onComplete={handleWelcomeComplete} />
        )}
        {activeTab === 'landing' && <LandingDashboard onNavigate={setActiveTab} />}
        {activeTab === 'dashboard' && hasCompletedWelcome && (
          <SimplifiedDashboard userType={userType} />
        )}
        {activeTab === 'advanced' && <UnifiedDashboard />}
        {activeTab === 'policies' && <PolicyManagement />}
        {activeTab === 'logs' && <AuditLogs />}
      </main>

      <footer className="app-footer">
        <p>© Cognivern - Powered by Recall Network & Bitte Protocol</p>
      </footer>
    </div>
  );
}

export default App;
