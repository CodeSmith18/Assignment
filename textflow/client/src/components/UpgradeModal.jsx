import React, { useState } from 'react';
import { billingAPI } from '../api.js';

export default function UpgradeModal({ isOpen, onClose, currentPlan, onUpgradeSuccess }) {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isFree = (currentPlan || 'free').toLowerCase() === 'free';

  const handleAction = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      let res;
      if (isFree) {
        console.debug('[Upgrade Modal] Calling billing upgrade api...');
        res = await billingAPI.upgrade();
      } else {
        console.debug('[Upgrade Modal] Calling billing downgrade api...');
        res = await billingAPI.downgrade();
      }

      if (res.success) {
        setSuccessMsg(
          isFree 
            ? 'Success! You have been upgraded to the Pro plan. All premium tone features are now unlocked!'
            : 'Success! Your plan has been downgraded to the Free plan.'
        );
        setTimeout(() => {
          onUpgradeSuccess(isFree ? 'pro' : 'free');
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
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        
        <h2>{isFree ? '🚀 Upgrade to TextFlow Pro' : 'Plan Management'}</h2>
        <p className="modal-subtitle">
          {isFree 
            ? 'Unlock the full potential of AI-powered text processing.' 
            : 'Manage or update your subscription plan.'
          }
        </p>

        {error && <div className="modal-error-alert">{error}</div>}
        {successMsg && <div className="modal-success-alert">{successMsg}</div>}

        <div className="plans-comparison">
          {/* Free Plan Card */}
          <div className={`plan-card ${isFree ? 'active-plan' : ''}`}>
            {isFree && <span className="current-badge">CURRENT PLAN</span>}
            <h3>Free Plan</h3>
            <div className="plan-price">$0.00 <span className="period">/ month</span></div>
            <ul className="plan-features">
              <li>✅ 2,000 characters per month</li>
              <li>✅ Basic BART text summarization</li>
              <li>✅ Basic T5 paraphrasing</li>
              <li>❌ Tone selection locked</li>
              <li>❌ Standard support</li>
            </ul>
          </div>

          {/* Pro Plan Card */}
          <div className={`plan-card pro ${!isFree ? 'active-plan' : ''}`}>
            {!isFree && <span className="current-badge">CURRENT PLAN</span>}
            <h3>Pro Plan</h3>
            <div className="plan-price">$9.00 <span className="period">/ month</span></div>
            <ul className="plan-features">
              <li>🚀 50,000+ characters per month</li>
              <li>🚀 All 5 rewrite tones unlocked</li>
              <li>🚀 BART large summarization</li>
              <li>🚀 Priority server processing</li>
              <li>🚀 Overage: $0.50 per 1k chars</li>
            </ul>
          </div>
        </div>

        <div className="modal-actions">
          <button 
            type="button" 
            className={`btn-action-primary ${isFree ? 'upgrade-btn' : 'downgrade-btn'}`}
            disabled={loading || successMsg}
            onClick={handleAction}
          >
            {loading ? 'Processing...' : isFree ? 'Upgrade to Pro ($9/mo)' : 'Downgrade to Free'}
          </button>
          <button 
            type="button" 
            className="btn-action-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
