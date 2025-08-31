import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './App.css';

// Configuration
const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://skd-portal.up.railway.app',
  DISCORD_CLIENT_ID: process.env.REACT_APP_DISCORD_CLIENT_ID || '1408435014613602355'
};

// Simple Loading Component
const Loading = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
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
    return <Navigate to="/" />;
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
    return <Navigate to="/" />;
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

// Helper component for redirects
function Navigate({ to }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Debug log user state changes
  useEffect(() => {
    console.log('User state changed:', user);
  }, [user]);

  // Check for auth in URL parameters on initial load
  useEffect(() => {
    // Check for Discord auth success
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('auth') === 'success') {
      console.log('Auth success detected in URL');
      handleDiscordAuthSuccess();
      return;
    }

    // Check for Roblox linking success
    if (urlParams.get('roblox_linked') === 'true') {
      const username = urlParams.get('username');
      console.log('Roblox linking success detected in URL', { username });
      handleRobloxLinkSuccess(username);
      return;
    }

    // Check for errors
    const errorParam = urlParams.get('error');
    if (errorParam) {
      const errorMessage = urlParams.get('message') || `Error: ${errorParam}`;
      console.error('Auth error detected in URL:', errorParam, errorMessage);
      setError(errorMessage);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Load user from local storage or API
    loadUser();
  }, []);

  // Load user from local storage or API
  const loadUser = async () => {
    console.log('Loading user...');
    setLoading(true);
    
    try {
      // Try to restore from localStorage first (for faster rendering)
      const localUser = localStorage.getItem('skyrden_fallback_user');
      if (localUser) {
        const parsedUser = JSON.parse(localUser);
        console.log('Found user in localStorage:', parsedUser);
        setUser(parsedUser);
      }
      
      // Then try to get fresh data from API
      console.log('Checking auth status with API...');
      const response = await fetch(`${config.API_URL}/api/auth/status`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('API auth status response:', data);
        
        if (data.authenticated && data.user) {
          console.log('Setting user from API:', data.user);
          setUser(data.user);
          
          // Save to localStorage for fast loading next time
          localStorage.setItem('skyrden_fallback_user', JSON.stringify(data.user));
        } else if (localUser) {
          console.log('API says not authenticated, but we have a local user');
          // Try token login if we have a stored user
          attemptTokenLogin();
        } else {
          console.log('User not authenticated');
          setUser(null);
        }
      } else {
        console.error('API error checking auth status:', response.status);
        // Keep using localStorage user if API fails
      }
    } catch (error) {
      console.error('Error loading user:', error);
      // Keep using localStorage user if API fails
    } finally {
      setLoading(false);
    }
  };
  
  // Try to login using stored token or user ID
  const attemptTokenLogin = async () => {
    console.log('Attempting token login...');
    
    // Try to extract token from cookie
    let token = null;
    try {
      const tokenMatch = document.cookie.match(/skyrden_auth=([^;]+)/);
      if (tokenMatch) {
        token = tokenMatch[1];
        console.log('Found token in cookie');
      }
    } catch (e) {
      console.error('Error reading cookie:', e);
    }
    
    // If no token in cookie, check localStorage for user ID
    if (!token) {
      const localUser = localStorage.getItem('skyrden_fallback_user');
      if (!localUser) return;
      
      const parsedUser = JSON.parse(localUser);
      if (!parsedUser.discord_id) return;
      
      // Generate a token for the stored user
      token = btoa(JSON.stringify({
        id: parsedUser.discord_id,
        username: parsedUser.discord_username || 'Discord User'
      }));
      
      console.log('Generated token from stored user ID');
    }
    
    if (!token) return;
    
    try {
      const response = await fetch(`${config.API_URL}/api/auth/token-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ token })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Token login response:', data);
        
        if (data.authenticated && data.user) {
          console.log('Setting user from token login:', data.user);
          setUser(data.user);
          
          // Save to localStorage
          localStorage.setItem('skyrden_fallback_user', JSON.stringify(data.user));
          return true;
        }
      }
    } catch (error) {
      console.error('Token login error:', error);
    }
    
    return false;
  };

  // Handle Discord authentication success
  const handleDiscordAuthSuccess = async () => {
    console.log('Handling Discord auth success');
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const discordId = urlParams.get('id');
    const username = urlParams.get('username') || 'Discord User';
    
    // Generate a temporary user until we verify with the backend
    const tempUser = {
      discord_id: discordId || 'discord_' + Date.now(),
      discord_username: decodeURIComponent(username),
      roblox_username: null,
      is_admin: false
    };
    
    // Set the temporary user immediately for better UX
    setUser(tempUser);
    setMessage('Successfully connected with Discord!');
    setTimeout(() => setMessage(''), 5000);
    
    // Store fallback user in case of refresh
    localStorage.setItem('skyrden_fallback_user', JSON.stringify(tempUser));
    
    // If we have a token, use it to login with the backend
    if (token) {
      try {
        const response = await fetch(`${config.API_URL}/api/auth/token-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ token })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Token login response:', data);
          
          if (data.authenticated && data.user) {
            console.log('Setting user from token login:', data.user);
            setUser(data.user);
            
            // Save to localStorage
            localStorage.setItem('skyrden_fallback_user', JSON.stringify(data.user));
          }
        } else {
          console.error('Token login failed:', response.status);
        }
      } catch (error) {
        console.error('Token login error:', error);
      }
    }
    
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // Handle Roblox linking success
  const handleRobloxLinkSuccess = (robloxUsername) => {
    console.log('Handling Roblox linking success', { robloxUsername });
    
    // Update user state with Roblox username
    if (user) {
      const updatedUser = {
        ...user,
        roblox_username: robloxUsername
      };
      
      setUser(updatedUser);
      
      // Update localStorage
      localStorage.setItem('skyrden_fallback_user', JSON.stringify(updatedUser));
    }
    
    setMessage(`Successfully linked Roblox account: ${robloxUsername}`);
    setTimeout(() => setMessage(''), 5000);
    
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // Login with Discord
  const loginWithDiscord = () => {
    console.log('Redirecting to Discord auth...');
    window.location.href = `${config.API_URL}/api/auth/discord`;
  };

  // Connect Roblox account
  const connectRoblox = () => {
    console.log('Redirecting to Roblox auth...');
    window.location.href = `${config.API_URL}/api/auth/roblox`;
  };
  
  // Alternative Roblox connection method
  const connectRobloxAlternative = () => {
    console.log('Using alternative Roblox connection method...');
    
    if (!user || !user.discord_id) {
      setError('No user logged in to link Roblox account');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    window.location.href = `${config.API_URL}/api/auth/direct-roblox-link?discord_id=${user.discord_id}&username=${encodeURIComponent(user.discord_username || 'Discord User')}`;
  };

  // Logout
  const logout = async () => {
    console.log('Logging out...');
    
    try {
      await fetch(`${config.API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout API error:', error);
    }
    
    // Always clear local data regardless of API success
    localStorage.removeItem('skyrden_fallback_user');
    setUser(null);
    
    // Try to clear cookies manually as well
    document.cookie = 'skyrden_auth=; Max-Age=0; path=/; domain=skd-portal.up.railway.app; secure; samesite=none';
    
    console.log('Logout complete');
  };
  
  // Debug: Show active cookies
  const debugCookies = () => {
    const cookies = document.cookie.split(';').map(c => c.trim());
    console.log('Current cookies:', cookies);
    setMessage(`Cookies: ${cookies.join(', ') || 'None'}`);
    setTimeout(() => setMessage(''), 10000);
  };
  
  // Debug: Manual token login
  const manualTokenLogin = async () => {
    // Get current user data
    if (!user || !user.discord_id) {
      setError('No user data available for token login');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    const token = btoa(JSON.stringify({
      id: user.discord_id,
      username: user.discord_username || 'Discord User'
    }));
    
    try {
      const response = await fetch(`${config.API_URL}/api/auth/token-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ token })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Manual token login response:', data);
        
        if (data.authenticated) {
          setMessage('Manual token login successful');
        } else {
          setError('Manual token login failed');
        }
      } else {
        setError(`Manual token login failed: ${response.status}`);
      }
    } catch (error) {
      setError(`Manual token login error: ${error.message}`);
    }
    
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

  // Render loading state
  if (loading) {
    console.log('Rendering App with loading: true');
    return <Loading />;
  }

  console.log('Rendering App with loading: false user:', user);

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
                <button onClick={logout}>Logout</button>
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
            
            <Route path="/dashboard" element={
              <Dashboard user={user} />
            } />
            
            <Route path="/profile" element={
              <Profile user={user} />
            } />
            
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
        {process.env.NODE_ENV !== 'production' && (
          <details className="debug-panel">
            <summary>Debug Options</summary>
            <div className="debug-controls">
              <button onClick={debugCookies}>Show Cookies</button>
              <button onClick={manualTokenLogin}>Manual Token Login</button>
              <button onClick={loadUser}>Refresh User</button>
              <button onClick={() => {
                const username = prompt('Enter custom username:', user?.discord_username || '');
                if (username && user) {
                  const updatedUser = {...user, discord_username: username};
                  setUser(updatedUser);
                  localStorage.setItem('skyrden_fallback_user', JSON.stringify(updatedUser));
                  setMessage(`Username changed to ${username}`);
                  setTimeout(() => setMessage(''), 3000);
                }
              }}>Change Username</button>
            </div>
            <div className="user-data">
              <pre>{JSON.stringify(user, null, 2)}</pre>
            </div>
          </details>
        )}

        {/* Footer */}
        <footer className="app-footer">
          <p>© 2025 Skyrden Portal - All rights reserved</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;