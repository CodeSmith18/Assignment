import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup({ setView }) {
  const { signup } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);
    try {
      console.debug('[Signup Page] Initiating signup auth call...');
      const res = await signup(email, password, name);
      if (res.success) {
        // Automatically navigated to dashboard by App.jsx auth listener
        setView('dashboard');
      } else {
        setError(res.error?.message || 'Registration failed. Check details.');
      }
    } catch (err) {
      setError('Connection timeout. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create Your TextFlow Account</h2>
        <p className="auth-subtitle">Get started with a Free plan (2,000 characters/mo).</p>

        {error && <div className="auth-error-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
              minLength="6"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-auth-action" disabled={loading}>
            {loading ? 'Registering Account...' : 'Sign Up Free'}
          </button>
        </form>

        <div className="auth-toggle">
          <span>Already have an account? </span>
          <button className="btn-toggle-link" onClick={() => setView('login')}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
