import { useState } from 'react';
import './styles/index.css';

function App() {
  const [view, setView] = useState('landing'); // landing, signup, login, dashboard

  return (
    <div className="app">
      <header>
        <h1>TextFlow</h1>
        <nav>
          <button onClick={() => setView('landing')}>Home</button>
          <button onClick={() => setView('signup')}>Sign Up</button>
          <button onClick={() => setView('login')}>Login</button>
        </nav>
      </header>
      
      <main>
        {view === 'landing' && <LandingPage />}
        {view === 'signup' && <SignupPage />}
        {view === 'login' && <LoginPage />}
        {view === 'dashboard' && <DashboardPage />}
      </main>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="landing">
      <h2>AI-Powered Text Processing</h2>
      <p>Summarize and rewrite text with advanced AI models.</p>
      <div className="features">
        <div className="feature">
          <h3>Free Plan</h3>
          <p>2,000 characters/month</p>
          <p>Basic summarize & rewrite</p>
        </div>
        <div className="feature">
          <h3>Pro Plan</h3>
          <p>50,000 characters/month</p>
          <p>Tone selector + advanced features</p>
        </div>
      </div>
    </div>
  );
}

function SignupPage() {
  return <div>Signup Page - TODO</div>;
}

function LoginPage() {
  return <div>Login Page - TODO</div>;
}

function DashboardPage() {
  return <div>Dashboard Page - TODO</div>;
}

export default App;
