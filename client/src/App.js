import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Import application components
import ApplicationList from './pages/ApplicationList';
import ApplicationForm from './pages/ApplicationForm';
import ApplicationSubmitted from './pages/ApplicationSubmitted';
import MyApplications from './pages/MyApplications';

// Admin components
import AdminDashboard from './pages/admin/AdminDashboard';
import ApplicationBuilder from './pages/admin/ApplicationBuilder';
import ReviewSubmission from './pages/admin/ReviewSubmission';

// Configuration
const config = {
  API_URL: process.env.REACT_APP_API_URL || 'https://skd-portal.up.railway.app'
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
const LandingPage = ({ user, loginWithDiscord }) => {
  console.log('Rendering LandingPage with user:', user);
  
  return (
    <div className="landing-page">
      <section className="hero">
        <h1>Welcome to Skyrden Application Portal</h1>
        <p>Apply for positions and opportunities at Skyrden</p>
        
        {!user ? (
          <button onClick={loginWithDiscord} className="start-btn">
            Start Application
          </button>
        ) : (
          <div className="action-buttons">
            <Link to="/applications" className="btn-primary">
              View Applications
            </Link>
            <Link to="/my-applications" className="btn-secondary">
              My Applications
            </Link>
          </div>
        )}
      </section>
      
      <section className="features">
        <h2>How It Works</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">1</div>
            <h3>Create an Account</h3>
            <p>Sign in with Discord and connect your Roblox account</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">2</div>
            <h3>Choose an Application</h3>
            <p>Browse available applications and select one to apply</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">3</div>
            <h3>Submit Your Application</h3>
            <p>Fill out the form and submit your application for review</p>
          </div>
        </div>
      </section>
    </div>
  );
};

// Application Submitted Confirmation Component
const ApplicationSubmittedPage = () => (
  <div className="application-submitted">
    <div className="success-icon">✓</div>
    <h1>Application Submitted!</h1>
    <p>Thank you for your application. Our team will review it and get back to you soon.</p>
    <div className="action-buttons">
      <Link to="/my-applications" className="btn-primary">
        View My Applications
      </Link>
      <Link to="/applications" className="btn-secondary">
        Apply for Another Position
      </Link>
    </div>
  </div>
);

// NotFound Component
const NotFound = () => (
  <div className="not-found">
    <h1>404 - Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <Link to="/">Return to Home</Link>
  </div>
);

// Unauthorized Access Component
const Unauthorized = () => (
  <div className="unauthorized">
    <h1>Access Denied</h1>
    <p>You do not have permission to access this area.</p>
    <Link to="/">Return to Home</Link>
  </div>
);

function App() {
  // State variables
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Check if user is admin
  const isAdmin = user && user.is_admin === true;

  // Setup axios defaults
  useEffect(() => {
    axios.defaults.baseURL = config.API_URL;
    axios.defaults.withCredentials = true;
  }, []);

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
          const response = await axios.get(`${config.API_URL}/api/auth/status`, {
            withCredentials: true,
            headers: { 'Accept': 'application/json' }
          });

          if (response.data && response.data.authenticated && response.data.user) {
            console.log('User authenticated with API', response.data.user);
            setUser(response.data.user);
            localStorage.setItem('skyrden_user', JSON.stringify(response.data.user));
          } else {
            console.log('User not authenticated with API');
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
  
  // Login with Discord (stateless)
  const loginWithDiscord = () => {
    console.log('Redirecting to Discord auth...');
    window.location.href = `${config.API_URL}/api/auth/discord-stateless?redirect=${encodeURIComponent(window.location.origin)}`;
  };
  
  // Connect Roblox account (stateless)
  const connectRoblox = () => {
    if (!user) {
      setError('Please log in with Discord first');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    console.log('Connecting Roblox account using stateless approach...');
    window.location.href = `${config.API_URL}/api/auth/stateless-roblox-link?discord_id=${user.discord_id}&username=${encodeURIComponent(user.discord_username || 'Discord User')}`;
  };
  
  // Logout
  const logout = async () => {
    console.log('Logging out...');
    
    // Clear localStorage
    localStorage.removeItem('skyrden_user');
    setUser(null);
    
    // Try API logout
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
      console.log('Logout API call successful');
    } catch (err) {
      console.error('Logout API error:', err);
    }
    
    setMessage('Logged out successfully');
    setTimeout(() => setMessage(''), 3000);
  };

  // Protected route component
  const ProtectedRoute = ({ element }) => {
    if (loading) {
      return <Loading onForceLoad={forceLoadingFalse} />;
    }
    
    if (!user) {
      return <Navigate to="/" replace />;
    }
    
    // Check if user has Roblox connected
    if (!user.roblox_username) {
      return <RobloxConnectPrompt connectRoblox={connectRoblox} />;
    }
    
    return element;
  };
  
  // Admin route component
  const AdminRoute = ({ element }) => {
    if (loading) {
      return <Loading onForceLoad={forceLoadingFalse} />;
    }
    
    if (!user) {
      return <Navigate to="/" replace />;
    }
    
    if (!isAdmin) {
      return <Unauthorized />;
    }
    
    return element;
  };
  
  // Roblox connection prompt component
  const RobloxConnectPrompt = ({ connectRoblox }) => (
    <div className="connect-roblox-prompt">
      <h2>Connect Your Roblox Account</h2>
      <p>To continue with your application, please connect your Roblox account.</p>
      <button onClick={connectRoblox} className="roblox-connect-btn">
        Connect Roblox Account
      </button>
    </div>
  );

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
            {user && <Link to="/applications">Applications</Link>}
            {user && <Link to="/my-applications">My Applications</Link>}
            {user && user.roblox_username && <Link to="/profile">Profile</Link>}
          </div>
          <div className="header-auth">
            {user ? (
              <div className="user-menu">
                <span>Welcome, {user.discord_username}</span>
                <button onClick={logout} className="logout-btn">Logout</button>
              </div>
            ) : (
              <button onClick={loginWithDiscord} className="discord-login-btn">
                Start Application
              </button>
            )}
            {isAdmin && (
              <Link to="/admin" className="admin-gear" title="Admin Dashboard">
                ⚙️
              </Link>
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
            {/* Public Routes */}
            <Route path="/" element={<LandingPage user={user} loginWithDiscord={loginWithDiscord} />} />
            
            {/* User Routes */}
            <Route path="/applications" element={<ProtectedRoute element={<ApplicationList />} />} />
            <Route path="/apply/:id" element={<ProtectedRoute element={<ApplicationForm user={user} />} />} />
            <Route path="/application-submitted" element={<ProtectedRoute element={<ApplicationSubmittedPage />} />} />
            <Route path="/my-applications" element={<ProtectedRoute element={<MyApplications />} />} />
            <Route path="/profile" element={<ProtectedRoute element={<Profile user={user} />} />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminRoute element={<AdminDashboard />} />} />
            <Route path="/admin/applications/new" element={<AdminRoute element={<ApplicationBuilder />} />} />
            <Route path="/admin/applications/edit/:id" element={<AdminRoute element={<ApplicationBuilder />} />} />
            <Route path="/admin/submissions/:id" element={<AdminRoute element={<ReviewSubmission />} />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        
        {/* Roblox Connection Reminder */}
        {user && !user.roblox_username && (
          <div className="connection-reminder">
            <p>Please connect your Roblox account to access all features</p>
            <button onClick={connectRoblox} className="roblox-connect-btn">
              Connect Roblox Account
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
          <div className="footer-content">
            <div className="footer-logo">
              <h3>Skyrden</h3>
              <p>Application Portal</p>
            </div>
            
            <div className="footer-links">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/">Home</Link></li>
                <li><a href="#about">About Us</a></li>
                <li><a href="#faq">FAQ</a></li>
                <li><a href="#contact">Contact</a></li>
              </ul>
            </div>
            
            <div className="footer-social">
              <h4>Connect With Us</h4>
              <div className="social-icons">
                <a href="https://discord.gg/skyrden" className="social-icon">Discord</a>
                <a href="https://roblox.com/groups/skyrden" className="social-icon">Roblox</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} Skyrden - All rights reserved</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

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
        
        <div className="profile-applications">
          <h3>My Applications</h3>
          <Link to="/my-applications" className="btn-primary">View My Applications</Link>
        </div>
      </div>
    </div>
  );
};

export default App;