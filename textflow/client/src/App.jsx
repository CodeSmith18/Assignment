import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import Signup from './pages/Signup.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import './styles/index.css';

function MainApp() {
  const { user, loading } = useAuth();
  const [view, setView] = useState('landing');

  // React to authentication status
  useEffect(() => {
    if (user) {
      setView('dashboard');
    } else if (view === 'dashboard') {
      setView('landing');
    }
  }, [user]);

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner-large"></div>
        <p>Loading TextFlow App...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="app-main-content">
        {view === 'landing' && <Landing setView={setView} />}
        {view === 'signup' && <Signup setView={setView} />}
        {view === 'login' && <Login setView={setView} />}
        {view === 'dashboard' && <Dashboard />}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
