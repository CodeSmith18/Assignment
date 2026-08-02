import React, { useState } from 'react';
import { billingAPI } from '../api.js';

export default function UpgradeModal({ isOpen, onClose, currentPlan, onUpgradeSuccess }) {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const activePlan = (currentPlan || 'free').toLowerCase();

  const handleAction = async (targetPlan) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      let res;
      if (targetPlan === 'free') {
        console.debug('[Upgrade Modal] Calling billing downgrade api to free...');
        res = await billingAPI.downgrade();
      } else {
        console.debug(`[Upgrade Modal] Calling billing upgrade api to ${targetPlan}...`);
        res = await billingAPI.upgrade(targetPlan);
      }

      if (res.success) {
        setSuccessMsg(`Success! Your plan has been changed to ${targetPlan === 'payg' ? 'Pay-As-You-Go' : targetPlan.toUpperCase()}.`);
        setTimeout(() => {
          onUpgradeSuccess(targetPlan);
          setSuccessMsg('');
          onClose();
        }, 2000);
      } else {
        setError(res.error?.message || 'Transaction failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Connection issue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '900px' }}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        
        <h2>🚀 TextFlow Subscription Plans</h2>
        <p className="modal-subtitle">Choose the plan that best fits your AI writing needs.</p>

        {error && <div className="modal-error-alert">{error}</div>}
        {successMsg && <div className="modal-success-alert">{successMsg}</div>}

        <div className="plans-comparison" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
          {/* Free Plan Card */}
          <div className={`plan-card ${activePlan === 'free' ? 'active-plan' : ''}`}>
            {activePlan === 'free' && <span className="current-badge">CURRENT PLAN</span>}
            <h3>Free Plan</h3>
            <div className="plan-price">$0.00 <span className="period">/ month</span></div>
            <ul className="plan-features">
              <li>✅ 2,000 characters per month</li>
              <li>✅ Basic BART text summarization</li>
              <li>✅ Basic T5 paraphrasing</li>
              <li>❌ Tone selection locked</li>
              <li>❌ Standard support</li>
            </ul>
            <button 
              type="button" 
              className="plan-action-btn"
              disabled={loading || activePlan === 'free'}
              onClick={() => handleAction('free')}
              style={{
                marginTop: 'auto',
                width: '100%',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                backgroundColor: activePlan === 'free' ? '#374151' : '#4b5563',
                color: '#fff',
                cursor: activePlan === 'free' ? 'not-allowed' : 'pointer'
              }}
            >
              {activePlan === 'free' ? 'Active' : 'Downgrade to Free'}
            </button>
          </div>

          {/* Pro Plan Card */}
          <div className={`plan-card pro ${activePlan === 'pro' ? 'active-plan' : ''}`}>
            {activePlan === 'pro' && <span className="current-badge">CURRENT PLAN</span>}
            <h3>Pro Plan</h3>
            <div className="plan-price">$9.00 <span className="period">/ month</span></div>
            <ul className="plan-features">
              <li>🚀 50,000 characters per month</li>
              <li>🚀 All 5 rewrite tones unlocked</li>
              <li>🚀 BART large summarization</li>
              <li>🚀 Priority server processing</li>
              <li>🚀 Overage: $0.50 per 1k chars</li>
            </ul>
            <button 
              type="button" 
              className="plan-action-btn"
              disabled={loading || activePlan === 'pro'}
              onClick={() => handleAction('pro')}
              style={{
                marginTop: 'auto',
                width: '100%',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                backgroundColor: activePlan === 'pro' ? '#059669' : '#10b981',
                color: '#fff',
                cursor: activePlan === 'pro' ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {activePlan === 'pro' ? 'Active' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Pay-As-You-Go Plan Card */}
          <div className={`plan-card payg ${activePlan === 'payg' ? 'active-plan' : ''}`} style={{ borderColor: activePlan === 'payg' ? '#2563eb' : '#374151', borderStyle: 'solid', borderWidth: '2px' }}>
            {activePlan === 'payg' && <span className="current-badge" style={{ backgroundColor: '#2563eb' }}>CURRENT PLAN</span>}
            <h3>Pay-As-You-Go</h3>
            <div className="plan-price">$0.00 <span className="period">/ month</span></div>
            <ul className="plan-features">
              <li>⚡ Pay only for what you use</li>
              <li>⚡ Summarization: $0.80 / 1k chars</li>
              <li>⚡ Rewrite: $1.00 / 1k chars</li>
              <li>⚡ All 5 rewrite tones unlocked</li>
              <li>⚡ No monthly usage cap</li>
            </ul>
            <button 
              type="button" 
              className="plan-action-btn"
              disabled={loading || activePlan === 'payg'}
              onClick={() => handleAction('payg')}
              style={{
                marginTop: 'auto',
                width: '100%',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                backgroundColor: activePlan === 'payg' ? '#1d4ed8' : '#2563eb',
                color: '#fff',
                cursor: activePlan === 'payg' ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {activePlan === 'payg' ? 'Active' : 'Choose Pay-As-You-Go'}
            </button>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="button" 
            className="btn-action-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
