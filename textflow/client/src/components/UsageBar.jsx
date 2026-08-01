import React from 'react';

export default function UsageBar({ usageData, onUpgradeClick }) {
  if (!usageData || !usageData.charactersProcessed) {
    return (
      <div className="usage-bar-skeleton">
        <p>Loading usage stats...</p>
      </div>
    );
  }

  const { current, limit, remaining, percent, resetDate } = usageData.charactersProcessed;

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Determine indicator color
  let barColor = '#10b981'; // Green (low usage)
  if (percent >= 90) {
    barColor = '#ef4444'; // Red (critical)
  } else if (percent >= 70) {
    barColor = '#f59e0b'; // Amber (warning)
  }

  const isNearLimit = percent >= 80;

  return (
    <div className="usage-card">
      <div className="usage-header">
        <span className="usage-title">Usage & Quota</span>
        <span className="usage-percentage">{percent}% Used</span>
      </div>

      <div className="bar-container">
        <div 
          className="bar-fill" 
          style={{ 
            width: `${Math.min(100, percent)}%`, 
            backgroundColor: barColor 
          }}
        />
      </div>

      <div className="usage-stats">
        <span>{current.toLocaleString()} / {limit.toLocaleString()} characters processed</span>
        <span>{remaining.toLocaleString()} characters left</span>
      </div>

      {resetDate && (
        <div className="usage-reset">
          <span>Resets on: <strong>{formatDate(resetDate)}</strong></span>
        </div>
      )}

      {isNearLimit && (
        <div className="usage-alert">
          <p>⚠️ You are approaching your monthly limit. Upgrade to Pro to avoid interruption!</p>
          <button className="upgrade-inline-btn" onClick={onUpgradeClick}>Upgrade Now</button>
        </div>
      )}
    </div>
  );
}
