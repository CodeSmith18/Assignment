import React from 'react';

export default function UsageBar({ usageData, currentPlan, onUpgradeClick }) {
  if (!usageData || !usageData.charactersProcessed) {
    return (
      <div className="usage-bar-skeleton">
        <p>Loading usage stats...</p>
      </div>
    );
  }

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isPayg = currentPlan?.toLowerCase() === 'payg';

  if (isPayg) {
    const cost = usageData.accumulatedCost ?? 0.00;
    const sumCount = usageData.charactersSummarized?.current ?? 0;
    const rewriteCount = usageData.charactersRewritten?.current ?? 0;
    const resetDate = usageData.charactersProcessed.resetDate;

    return (
      <div className="usage-card payg-card">
        <div className="usage-header">
          <span className="usage-title">Real-Time Cost</span>
          <span className="usage-percentage" style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.25rem' }}>
            ${cost.toFixed(2)}
          </span>
        </div>

        <div className="bar-container" style={{ backgroundColor: '#10b98122' }}>
          <div 
            className="bar-fill" 
            style={{ 
              width: '100%', 
              backgroundColor: '#10b981' 
            }}
          />
        </div>

        <div className="usage-stats-payg" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Summarized:</span>
            <strong>{sumCount.toLocaleString()} chars ($0.80/1k)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Paraphrased/Rewritten:</span>
            <strong>{rewriteCount.toLocaleString()} chars ($1.00/1k)</strong>
          </div>
        </div>

        {resetDate && (
          <div className="usage-reset" style={{ marginTop: '1rem', borderTop: '1px solid #374151', paddingTop: '0.5rem', fontSize: '0.75rem', opacity: 0.8 }}>
            <span>Next billing invoice resets: <strong>{formatDate(resetDate)}</strong></span>
          </div>
        )}
      </div>
    );
  }

  const { current, limit, remaining, percent, resetDate } = usageData.charactersProcessed;

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
