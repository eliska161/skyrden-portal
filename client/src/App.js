import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';

// Configuration
const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://skd-portal.up.railway.app'
};

// Simple Loading Component
const Loading = ({ onForceLoad }) => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
    <button 
      onClick={onForceLoad} 
      className="force-load-btn"
    >
      Click here if loading takes too long
    </button>
  </div>
);

// Landing Page Component
const LandingPage = ({ user, loginWithDiscord, connectRoblox }) => {
  console.log('Rendering LandingPage with user:', user);
  
  return (
    <div className="landing-page">
      <section className="hero">
        <h1>Welcome to Skyrden Portal</h1>
        <p>Your gateway to the Skyrden gaming ecosystem</p>
        
        {!user ? (
          <button onClick={loginWithDiscord} className="discord-login-btn">
            Login with Discord
          </button>
        ) : !user.roblox_username ? (
          <div className="roblox-connect">
            <p>Connect your Roblox account to access all features</p>
            <button onClick={connectRoblox} className="roblox-connect-btn">
              Connect Roblox Account
            </button>
          </div>
        ) : (
          <div className="account-connected">
            <h3>Your accounts are connected!</h3>
            <p>Discord: <strong>{user.discord_username}</strong></p>
            <p>Roblox: <strong>{user.roblox_username}</strong></p>
          </div>
        )}
      </section>
      
      <section className="features">
        <h2>Features</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>Cross-Platform Integration</h3>
            <p>Connect your Discord and Roblox accounts for a seamless gaming experience</p>
          </div>
          <div className="feature-card">
            <h3>Game Statistics</h3>
            <p>Track your progress and achievements across Skyrden games</p>
          </div>
          <div className="feature-card">
            <h3>Community Hub</h3>
            <p>Connect with other players and join special events</p>
          </div>
        </div>
      </section>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ user }) => {
  if (!user) {
    return (
      <div className="not-logged-in">
        <h2>Please log in to view your dashboard</h2>
        <Link to="/">Return to Home</Link>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="dashboard-welcome">
        <h2>Welcome, {user.discord_username}!</h2>
        {user.roblox_username ? (
          <p>Your Roblox account <strong>{user.roblox_username}</strong> is connected.</p>
        ) : (
          <p>Please connect your Roblox account to access all features.</p>
        )}
      </div>
      
      <div className="dashboard-stats">
        <h3>Your Statistics</h3>
        <p>Statistics will be available once you play our games.</p>
      </div>
    </div>
  );
};

// Profile Component
const Profile = ({ user }) => {
  if (!user) {
    return (
      <div className="not-logged-in">
        <h2>Please log in to view your profile</h2>
        <Link to="/">Return to Home</Link>
      </div>
    );
  }

  return (
    <div className="profile">
      <h1>User Profile</h1>
      
      <div className="profile-card">
        <div className="profile-header">
          <h2>{user.discord_username}</h2>
          {user.is_admin && <span className="admin-badge">Admin</span>}
        </div>
        
        <div className="profile-details">
          <div className="detail-row">
            <span className="detail-label">Discord ID:</span>
            <span className="detail-value">{user.discord_id}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Discord Username:</span>
            <span className="detail-value">{user.discord_username}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Roblox Username:</span>
            <span className="detail-value">
              {user.roblox_username || 'Not connected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// NotFound Component
const NotFound = () => (
  <div className="not-found">
    <h1>404 - Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <Link to="/">Return to Home</Link>
  </div>
);

function App() {
  // State variables
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Debug log user state changes
  useEffect(() => {
    console.log('User state changed:', user);
  }, [user]);

  // Force loading to false
  const forceLoadingFalse = () => {
    setLoading(false);
    setMessage('Loading skipped. Using local data if available.');
    setTimeout(() => setMessage(''), 5000);
  };

  // Set up auto-timeout for loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.log('Auto-timeout: Setting loading to false after delay');
        setLoading(false);
      }
    }, 5000); // 5 seconds max loading time
    
    return () => clearTimeout(timer);
  }, [loading]);

  // Initialize the app - check auth and load user
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing app...');
        
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        
        // Handle Discord auth success
        if (urlParams.get('auth') === 'success') {
          const token = urlParams.get('token');
          const discordId = urlParams.get('id');
          const username = urlParams.get('username') || 'Discord User';
          
          console.log('Auth success detected in URL parameters');
          
          // Create temp user from URL params
          const tempUser = {
            discord_id: discordId,
            discord_username: decodeURIComponent(username),
            roblox_username: null,
            is_admin: false
          };
          
          setUser(tempUser);
          localStorage.setItem('skyrden_user', JSON.stringify(tempUser));
          setMessage('Successfully logged in with Discord!');
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          setLoading(false);
          return;
        }
        
        // Handle Roblox linking success
        if (urlParams.get('roblox_linked') === 'true') {
          const username = urlParams.get('username');
          const storedUser = localStorage.getItem('skyrden_user');
          
          console.log('Roblox linking detected in URL parameters');
          
          if (storedUser && username) {
            const parsedUser = JSON.parse(storedUser);
            const updatedUser = {
              ...parsedUser,
              roblox_username: decodeURIComponent(username)
            };
            
            setUser(updatedUser);
            localStorage.setItem('skyrden_user', JSON.stringify(updatedUser));
            setMessage(`Successfully connected Roblox account: ${username}`);
          }
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          setLoading(false);
          return;
        }

        // Check for errors in URL
        if (urlParams.get('error')) {
          const errorMsg = urlParams.get('message') || `Error: ${urlParams.get('error')}`;
          setError(errorMsg);
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Try to restore from localStorage
        const storedUser = localStorage.getItem('skyrden_user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            console.log('Restored user from localStorage', parsedUser);
            setUser(parsedUser);
          } catch (e) {
            console.error('Error parsing stored user', e);
            localStorage.removeItem('skyrden_user');
          }
        }
          
        // Try to validate with API
        try {
          const response = await fetch(`${config.API_URL}/api/auth/status`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });

          if (response.ok) {
            const data = await response.json();
            console.log('API auth status response:', data);
            
            if (data.authenticated && data.user) {
              console.log('User authenticated with API', data.user);
              setUser(data.user);
              localStorage.setItem('skyrden_user', JSON.stringify(data.user));
            }
          } else {
            console.log('API returned status', response.status);
          }
        } catch (apiError) {
          console.error('API check failed', apiError);
          // Continue with localStorage user if available
        }

        // Finished initialization
        setLoading(false);
      } catch (e) {
        console.error('Error during app initialization', e);
        setError('An error occurred while loading the application.');
        setLoading(false);
      }
    };
    
    initializeApp();
  }, []);
  
  // Login with Discord
  const loginWithDiscord = () => {
    console.log('Redirecting to Discord auth...');
    window.location.href = `${config.API_URL}/api/auth/discord`;
  };
  
  // Connect Roblox account
  const connectRoblox = () => {
    if (!user) {
      setError('Please log in with Discord first');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    console.log('Connecting Roblox account...');
    window.location.href = `${config.API_URL}/api/auth/direct-roblox-link?discord_id=${user.discord_id}&username=${encodeURIComponent(user.discord_username || 'Discord User')}`;
  };
  
  // Alternative Roblox connection method
  const connectRobloxAlternative = () => {
    if (!user || !user.discord_id) {
      setError('No user logged in to link Roblox account');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    console.log('Using alternative Roblox connection method...');
    window.location.href = `${config.API_URL}/api/auth/direct-roblox-link?discord_id=${user.discord_id}&username=${encodeURIComponent(user.discord_username || 'Discord User')}`;
  };
  
  // Logout
  const logout = () => {
    console.log('Logging out...');
    
    // Clear localStorage
    localStorage.removeItem('skyrden_user');
    setUser(null);
    
    // Try API logout
    fetch(`${config.API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    }).catch(err => {
      console.error('Logout API error:', err);
    });
    
    setMessage('Logged out successfully');
    setTimeout(() => setMessage(''), 3000);
  };

  // Debug: Show active cookies
  const debugCookies = () => {
    const cookies = document.cookie.split(';').map(c => c.trim());
    console.log('Current cookies:', cookies);
    setMessage(`Cookies: ${cookies.join(', ') || 'None'}`);
    setTimeout(() => setMessage(''), 10000);
  };

  // Debug functions
  const clearData = () => {
    localStorage.removeItem('skyrden_user');
    setUser(null);
    setMessage('Local data cleared');
    setTimeout(() => setMessage(''), 3000);
  };

  const updateUsername = () => {
    if (!user) {
      setError('No user logged in');
      return;
    }
    
    const newUsername = prompt('Enter new username:', user.discord_username);
    if (newUsername) {
      const updatedUser = {...user, discord_username: newUsername};
      setUser(updatedUser);
      localStorage.setItem('skyrden_user', JSON.stringify(updatedUser));
      setMessage(`Username updated to ${newUsername}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Render loading state
  if (loading) {
    console.log('Rendering loading state');
    return <Loading onForceLoad={forceLoadingFalse} />;
  }

  return (
    <Router>
      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="header-logo">
            <Link to="/">
              <h1>Skyrden Portal</h1>
            </Link>
          </div>
          <div className="header-nav">
            <Link to="/">Home</Link>
            {user && <Link to="/dashboard">Dashboard</Link>}
            {user && <Link to="/profile">Profile</Link>}
          </div>
          <div className="header-auth">
            {user ? (
              <div className="user-menu">
                <span>Welcome, {user.discord_username}</span>
                <button onClick={logout} className="logout-btn">Logout</button>
              </div>
            ) : (
              <button onClick={loginWithDiscord} className="discord-login-btn">
                Login with Discord
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        {message && (
          <div className="message-container success">
            {message}
            <button onClick={() => setMessage('')} className="close-btn">×</button>
          </div>
        )}
        
        {error && (
          <div className="message-container error">
            {error}
            <button onClick={() => setError('')} className="close-btn">×</button>
          </div>
        )}

        {/* Main Content */}
        <main className="app-content">
          <Routes>
            <Route path="/" element={
              <LandingPage 
                user={user} 
                loginWithDiscord={loginWithDiscord}
                connectRoblox={connectRoblox}
              />
            } />
            
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/profile" element={<Profile user={user} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        
        {/* Roblox Connection Alternative */}
        {user && !user.roblox_username && (
          <div className="alt-connection-panel">
            <p>Having trouble connecting your Roblox account?</p>
            <button onClick={connectRobloxAlternative} className="alt-connect-btn">
              Try Alternative Roblox Connection
            </button>
          </div>
        )}
        
        {/* Debug Panel */}
        <details className="debug-panel">
          <summary>Debug Options</summary>
          <div className="debug-controls">
            <button onClick={debugCookies}>Show Cookies</button>
            <button onClick={clearData}>Clear Local Data</button>
            <button onClick={updateUsername}>Change Username</button>
            <button onClick={forceLoadingFalse}>Force Loading Off</button>
          </div>
          <div className="user-data">
            <pre>{JSON.stringify(user, null, 2)}</pre>
          </div>
        </details>

        {/* Footer */}
        <footer className="app-footer">
          <p>© 2025 Skyrden Portal - All rights reserved</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;