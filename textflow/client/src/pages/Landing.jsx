import React from 'react';

export default function Landing({ setView }) {
  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-section">
        <h1>TextFlow</h1>
        <p className="hero-tagline">AI-Powered Text Summarization & Tone Paraphrasing SaaS</p>
        <p className="hero-desc">
          Refine your writing, generate concise bullet points, and adjust the professional tone of your documents in seconds. Protected by real-time entitlement validation and usage limit gates.
        </p>
        <div className="hero-cta">
          <button className="btn-cta-primary" onClick={() => setView('signup')}>
            Get Started for Free
          </button>
          <button className="btn-cta-secondary" onClick={() => setView('login')}>
            Sign In to Account
          </button>
        </div>
      </section>

      {/* Feature Plan Grid */}
      <section className="features-grid-section">
        <h2>Flexible Subscription Plans</h2>
        <p className="section-desc">Choose the plan that fits your text processing requirements.</p>

        <div className="landing-plan-grid">
          {/* Free Plan */}
          <div className="landing-plan-card">
            <h3>Free Plan</h3>
            <div className="plan-badge-label">BASIC ACCESS</div>
            <div className="price-tag">$0.00 <span className="period">/ month</span></div>
            <ul className="feature-list">
              <li>✅ 2,000 characters per month limit</li>
              <li>✅ Basic summarization (BART)</li>
              <li>✅ Basic paraphrasing (T5)</li>
              <li>❌ Tone selectors locked (Default tone only)</li>
              <li>❌ High volume limits</li>
            </ul>
            <button className="btn-plan-select" onClick={() => setView('signup')}>
              Sign Up Free
            </button>
          </div>

          {/* Pro Plan */}
          <div className="landing-plan-card premium-card">
            <div className="premium-ribbon">RECOMMENDED</div>
            <h3>Pro Plan</h3>
            <div className="plan-badge-label">PREMIUM POWER</div>
            <div className="price-tag">$9.00 <span className="period">/ month</span></div>
            <ul className="feature-list">
              <li>🚀 50,000+ characters per month limit</li>
              <li>🚀 Professional Tone selector unlocked</li>
              <li>🚀 Casual Tone selector unlocked</li>
              <li>🚀 Creative Tone selector unlocked</li>
              <li>🚀 Academic Tone selector unlocked</li>
              <li>🚀 Usage-based overage ($0.50 per 1k chars)</li>
            </ul>
            <button className="btn-plan-select premium-btn" onClick={() => setView('signup')}>
              Go Pro Now
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
