import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login({ setView }) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      console.debug('[Login Page] Initiating login auth call...');
      const res = await login(email, password);
      if (res.success) {
        setView('dashboard');
      } else {
        setError(res.error?.message || 'Invalid email or password.');
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
        <h2>Sign In to TextFlow</h2>
        <p className="auth-subtitle">Enter your credentials to access your dashboard.</p>

        {error && <div className="auth-error-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
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
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-auth-action" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-toggle">
          <span>Don't have an account? </span>
          <button className="btn-toggle-link" onClick={() => setView('signup')}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
