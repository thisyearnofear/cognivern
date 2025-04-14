import { useState, useEffect } from 'react';
import './PolicyManagement.css';

interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
  metadata: Record<string, any>;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface PolicyRule {
  id: string;
  type: 'ALLOW' | 'DENY' | 'REQUIRE' | 'RATE_LIMIT';
  condition: string;
  action: string;
  metadata: Record<string, any>;
}

export default function PolicyManagement() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'editor'>('list');

  useEffect(() => {
    fetchPolicies();
  }, []);

  async function fetchPolicies() {
    try {
      setLoading(true);
      const response = await fetch('/api/policies', {
        headers: {
          'X-API-KEY':
            import.meta.env.VITE_API_KEY || 'Y10tiPBsbyEaZtVEvhu5uRj+YoRRiZQ6m3lsTOky1LQ=',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setPolicies(Array.isArray(data.policies) ? data.policies : []);
      setError(null);
    } catch (err) {
      console.error('Error fetching policies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load policies');
      setPolicies([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }

  function renderPolicyList() {
    if (loading) {
      return <div className="loading">Loading policies...</div>;
    }

    if (error) {
      return <div className="error">Error: {error}</div>;
    }

    if (policies.length === 0) {
      return (
        <div className="empty-state">
          <h3>No Policies Found</h3>
          <p>Get started by creating your first policy.</p>
          <button className="primary-button" onClick={() => setActiveTab('editor')}>
            Create Policy
          </button>
        </div>
      );
    }

    return (
      <div className="policy-list">
        <div className="policy-list-header">
          <h3>Active Policies</h3>
          <button className="primary-button" onClick={() => setActiveTab('editor')}>
            Create New Policy
          </button>
        </div>
        <div className="policy-grid">
          {policies.map((policy) => (
            <div key={policy.id} className="policy-card">
              <div className="policy-card-header">
                <h4>{policy.name}</h4>
                <span className={`status-badge ${policy.status}`}>{policy.status}</span>
              </div>
              <p className="description">{policy.description}</p>
              <div className="metadata">
                <span>Version {policy.version}</span>
                <span>{policy.rules.length} rules</span>
              </div>
              <div className="card-actions">
                <button onClick={() => setSelectedPolicy(policy)}>Edit</button>
                <button className="secondary">Duplicate</button>
                <button className="danger">Archive</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderPolicyEditor() {
    return (
      <div className="policy-editor">
        <div className="editor-header">
          <h3>{selectedPolicy ? 'Edit Policy' : 'Create New Policy'}</h3>
          <button className="secondary-button" onClick={() => setActiveTab('list')}>
            Back to List
          </button>
        </div>
        <div className="editor-form">
          <div className="form-group">
            <label htmlFor="name">Policy Name</label>
            <input
              type="text"
              id="name"
              placeholder="Enter policy name"
              value={selectedPolicy?.name || ''}
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              placeholder="Describe the purpose of this policy"
              value={selectedPolicy?.description || ''}
            />
          </div>
          <div className="form-group">
            <label>Rules</label>
            <div className="rules-list">
              {selectedPolicy?.rules.map((rule, index) => (
                <div key={rule.id} className="rule-item">
                  <div className="rule-header">
                    <span>Rule {index + 1}</span>
                    <select value={rule.type}>
                      <option value="ALLOW">Allow</option>
                      <option value="DENY">Deny</option>
                      <option value="REQUIRE">Require</option>
                      <option value="RATE_LIMIT">Rate Limit</option>
                    </select>
                  </div>
                  <div className="rule-content">
                    <input type="text" placeholder="Condition" value={rule.condition} />
                    <input type="text" placeholder="Action" value={rule.action} />
                  </div>
                </div>
              ))}
              <button className="secondary-button">Add Rule</button>
            </div>
          </div>
          <div className="form-actions">
            <button className="secondary-button">Cancel</button>
            <button className="primary-button">Save Policy</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="policy-management">
      <div className="policy-header">
        <h2>Policy Management</h2>
        <p>Create and manage governance policies for your AI agents</p>
      </div>
      <div className="policy-tabs">
        <button
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          Policy List
        </button>
        <button
          className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          Policy Editor
        </button>
      </div>
      {activeTab === 'list' ? renderPolicyList() : renderPolicyEditor()}
    </div>
  );
}
