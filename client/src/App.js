import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import './App.css';

// Import your components here
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import NotFound from './components/NotFound';
import Loading from './components/Loading';

// Configuration
const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://skd-portal.up.railway.app',
  DISCORD_CLIENT_ID: process.env.REACT_APP_DISCORD_CLIENT_ID || '1408435014613602355'
};

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
              user ? <Dashboard user={user} /> : <Navigate to="/" />
            } />
            
            <Route path="/profile" element={
              user ? <Profile user={user} /> : <Navigate to="/" />
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

// Helper component for redirects
function Navigate({ to }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
}

export default App;