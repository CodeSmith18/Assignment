import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { processAPI, usageAPI } from '../api.js';
import UsageBar from '../components/UsageBar.jsx';
import ToneSelector from '../components/ToneSelector.jsx';
import UpgradeModal from '../components/UpgradeModal.jsx';

export default function Dashboard() {
  const { user, logout, setUser } = useAuth();
  
  // Dashboard state
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [operation, setOperation] = useState('summarize'); // summarize, rewrite
  const [tone, setTone] = useState('default');
  
  const [processing, setProcessing] = useState(false);
  const [apiResultStats, setApiResultStats] = useState(null);
  
  // Usage & Subscription state
  const [usageData, setUsageData] = useState(null);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [history, setHistory] = useState([]);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modal control
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Status/Alert messages
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch initial usage dashboard data on mount
  const fetchDashboardData = async (limit = 10, offset = 0) => {
    setHistoryLoading(true);
    try {
      console.debug('[Dashboard] Querying api usage data...');
      const res = await usageAPI.getUsage(limit, offset);
      if (res.success) {
        setUsageData({
          charactersProcessed: res.usage.charactersProcessed
        });
        setCurrentPlan(res.plan.name);
        setHistory(res.history || []);
        
        // Sync plan back to AuthContext user object
        if (user && user.plan !== res.plan.name) {
          setUser({ ...user, plan: res.plan.name });
        }
      } else {
        setErrorMessage(res.error?.message || 'Failed to sync account usage metrics.');
      }
    } catch (err) {
      setErrorMessage('Network connection lost. Check server status.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(historyLimit, historyOffset);
  }, [historyLimit, historyOffset]);

  const handleProcess = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    
    if (!inputText.trim()) {
      setErrorMessage('Please type or paste some text to process.');
      return;
    }

    setProcessing(true);
    try {
      console.debug('[Dashboard] Initiating text processing api call...');
      const res = await processAPI.processText(inputText, operation, tone);
      
      if (res.success) {
        // Output AI results
        if (operation === 'summarize') {
          setOutputText(res.result.summary);
          setApiResultStats({
            model: res.result.model,
            processingTime: res.result.processingTime,
            compressionRatio: res.result.compressionRatio,
            originalLength: res.result.originalLength,
            summaryLength: res.result.summaryLength
          });
        } else {
          setOutputText(res.result.rewrittenText);
          setApiResultStats({
            model: res.result.model,
            processingTime: res.result.processingTime,
            originalLength: res.result.originalLength,
            rewrittenLength: res.result.rewrittenLength
          });
        }

        // Live update usage stats from response
        if (res.usage) {
          setUsageData({
            charactersProcessed: res.usage.charactersProcessed
          });
        }
        
        setSuccessMessage('Text processed successfully!');
        
        // Reload dashboard logs and metrics
        fetchDashboardData(historyLimit, historyOffset);
      } else {
        // Check if blocked by Billing / Quotas
        if (res.blocked) {
          if (res.reason === 'quota_exceeded' || res.reason === 'feature_locked') {
            setIsUpgradeModalOpen(true);
            setErrorMessage(`${res.message}`);
          } else {
            setErrorMessage(res.error?.message || 'Access blocked.');
          }
          if (res.usage) {
            setUsageData({
              charactersProcessed: res.usage.charactersProcessed
            });
          }
        } else {
          setErrorMessage(res.error?.message || 'AI service failed to respond.');
        }
      }
    } catch (err) {
      setErrorMessage('Request timed out or connection was aborted.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setSuccessMessage('Copied output text to clipboard!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handlePlanSync = (newPlan) => {
    setCurrentPlan(newPlan);
    fetchDashboardData(historyLimit, historyOffset);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      setErrorMessage('Logout request failed.');
    }
  };

  const isPro = currentPlan.toLowerCase() === 'pro';

  return (
    <div className="dashboard-container">
      {/* Top Banner Header */}
      <header className="dashboard-header">
        <div className="logo-group">
          <h1>TextFlow</h1>
          <span className="subtitle">SaaS Dashboard</span>
        </div>
        
        <div className="user-profile">
          <span className="user-name">Welcome, <strong>{user?.name || 'User'}</strong></span>
          <span className={`plan-badge ${isPro ? 'pro' : 'free'}`}>
            {isPro ? 'PRO SUBSCRIPTION' : 'FREE ACCOUNT'}
          </span>
          <button className="upgrade-btn-header" onClick={() => setIsUpgradeModalOpen(true)}>
            {isPro ? 'Manage Plan' : 'Upgrade to Pro'}
          </button>
          <button className="logout-btn" onClick={handleLogout}>Log Out</button>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="dashboard-grid">
        
        {/* Left Column: Text Inputs and Control Settings */}
        <div className="left-panel">
          <form onSubmit={handleProcess} className="process-form">
            <div className="form-group">
              <div className="textarea-header">
                <label className="section-label">Source Text</label>
                <span className="character-count">
                  Characters: <strong>{inputText.length}</strong> 
                  {currentPlan === 'free' ? ' / 1,000 max' : ' / 8,000 max'}
                </span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or paste your content here (min 50 characters for summarization, min 10 for rewriting)..."
                className="input-textarea"
                rows="10"
                disabled={processing}
              />
            </div>

            {/* Operation Type selection */}
            <div className="form-group operation-selector">
              <label className="section-label">Select Operation</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={`btn-toggle ${operation === 'summarize' ? 'active' : ''}`}
                  onClick={() => setOperation('summarize')}
                  disabled={processing}
                >
                  📝 Summarize text
                </button>
                <button
                  type="button"
                  className={`btn-toggle ${operation === 'rewrite' ? 'active' : ''}`}
                  onClick={() => setOperation('rewrite')}
                  disabled={processing}
                >
                  ⚡ Paraphrase / Rewrite
                </button>
              </div>
            </div>

            {/* Tone Selector Component (Only evaluated for Rewrite operations) */}
            {operation === 'rewrite' && (
              <div className="form-group">
                <ToneSelector
                  selectedTone={tone}
                  onToneSelect={setTone}
                  isPro={isPro}
                  onUpgradePrompt={() => setIsUpgradeModalOpen(true)}
                />
              </div>
            )}

            {errorMessage && <div className="error-alert-banner">{errorMessage}</div>}
            {successMessage && <div className="success-alert-banner">{successMessage}</div>}

            <button 
              type="submit" 
              className="btn-process-action" 
              disabled={processing}
            >
              {processing ? (
                <span className="spinner-loader">Processing text...</span>
              ) : (
                `Process with AI (${operation === 'summarize' ? 'Summarize' : 'Rewrite'})`
              )}
            </button>
          </form>
        </div>

        {/* Right Column: AI Outputs and Live Billing Quota Stats */}
        <div className="right-panel">
          {/* Outputs */}
          <div className="output-card">
            <div className="output-card-header">
              <label className="section-label">AI Output Results</label>
              {outputText && (
                <button className="copy-btn" onClick={handleCopy}>
                  📋 Copy to clipboard
                </button>
              )}
            </div>
            <div className="output-content">
              {outputText ? (
                <p className="output-text">{outputText}</p>
              ) : (
                <p className="output-placeholder">
                  Generated text summary or tone modifications will be displayed here.
                </p>
              )}
            </div>
          </div>

          {/* AI statistics */}
          {apiResultStats && (
            <div className="stats-card">
              <div className="stats-header">AI Performance metrics</div>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Model Used</span>
                  <span className="stat-value">{apiResultStats.model || 'N/A'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Latency</span>
                  <span className="stat-value">{apiResultStats.processingTime || 0}s</span>
                </div>
                {apiResultStats.compressionRatio && (
                  <div className="stat-item">
                    <span className="stat-label">Compression Ratio</span>
                    <span className="stat-value">{Math.round((1 - apiResultStats.compressionRatio) * 100)}% smaller</span>
                  </div>
                )}
                <div className="stat-item">
                  <span className="stat-label">Processed characters</span>
                  <span className="stat-value">{apiResultStats.originalLength || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Usage Stats Visualizer card */}
          <UsageBar 
            usageData={usageData} 
            onUpgradeClick={() => setIsUpgradeModalOpen(true)} 
          />
        </div>
      </div>

      {/* Operations logs logs section */}
      <section className="history-section">
        <h2>Operation Logs & Audit Trail</h2>
        <p className="section-subtitle">Real-time local operations history logged for this account.</p>

        {historyLoading && history.length === 0 ? (
          <p className="loading-label">Loading history logs...</p>
        ) : history.length === 0 ? (
          <p className="empty-label">No operations processed yet. Try running an AI summary above!</p>
        ) : (
          <div className="table-responsive">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Tone Setting</th>
                  <th>Input Length</th>
                  <th>Input Preview</th>
                  <th>Output Result Preview</th>
                  <th>Flexprice ID</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr key={log.id}>
                    <td className="timestamp-col">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className={`operation-badge ${log.operation_type}`}>
                        {log.operation_type}
                      </span>
                    </td>
                    <td>
                      <span className="tone-badge">{log.tone || 'default'}</span>
                    </td>
                    <td>{log.input_chars} chars</td>
                    <td className="preview-text-col" title={log.input_preview}>
                      {log.input_preview}
                    </td>
                    <td className="preview-text-col" title={log.output_preview}>
                      {log.output_preview}
                    </td>
                    <td className="event-id-col" title={log.flexprice_event_id}>
                      <code>{log.flexprice_event_id}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Plan Checkout & Subscription Management Overlay Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentPlan={currentPlan}
        onUpgradeSuccess={handlePlanSync}
      />
    </div>
  );
}
