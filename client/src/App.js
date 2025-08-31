import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';

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
const LandingPage = ({ user, loginWithDiscord, connectGitHub }) => {
  console.log('Rendering LandingPage with user:', user);
  
  return (
    <div className="landing-page">
      <section className="hero">
        <h1>Welcome to Skyrden Recruitment Portal</h1>
        <p>Your gateway to applying for positions at Skyrden</p>
        
        {!user ? (
          <button onClick={loginWithDiscord} className="discord-login-btn">
            Login with Discord
          </button>
        ) : !user.github_username ? (
          <div className="github-connect">
            <p>Connect your GitHub account to complete your profile</p>
            <button onClick={connectGitHub} className="github-connect-btn">
              Connect GitHub Account
            </button>
          </div>
        ) : (
          <div className="account-connected">
            <h3>Your accounts are connected!</h3>
            <p>Discord: <strong>{user.discord_username}</strong></p>
            <p>GitHub: <strong>{user.github_username}</strong></p>
            <Link to="/apply" className="apply-btn">Apply for Positions</Link>
          </div>
        )}
      </section>
      
      <section className="features">
        <h2>Why Join Us</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>Innovative Projects</h3>
            <p>Work on cutting-edge technology and creative solutions</p>
          </div>
          <div className="feature-card">
            <h3>Growth Opportunities</h3>
            <p>Develop your skills with mentorship and professional development</p>
          </div>
          <div className="feature-card">
            <h3>Collaborative Environment</h3>
            <p>Join a team that values your input and creative ideas</p>
          </div>
        </div>
      </section>
      
      <section className="positions">
        <h2>Open Positions</h2>
        <div className="position-grid">
          <div className="position-card">
            <h3>Frontend Developer</h3>
            <p>Create exceptional user experiences with modern frameworks</p>
            <Link to={user ? "/apply" : "#"} onClick={!user && loginWithDiscord} className="view-position-btn">
              {user ? "Apply Now" : "Login to Apply"}
            </Link>
          </div>
          <div className="position-card">
            <h3>Backend Engineer</h3>
            <p>Build robust APIs and server infrastructure</p>
            <Link to={user ? "/apply" : "#"} onClick={!user && loginWithDiscord} className="view-position-btn">
              {user ? "Apply Now" : "Login to Apply"}
            </Link>
          </div>
          <div className="position-card">
            <h3>DevOps Specialist</h3>
            <p>Streamline our CI/CD pipeline and infrastructure management</p>
            <Link to={user ? "/apply" : "#"} onClick={!user && loginWithDiscord} className="view-position-btn">
              {user ? "Apply Now" : "Login to Apply"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

// Application Form Component
const ApplicationForm = ({ user }) => {
  if (!user) {
    return (
      <div className="not-logged-in">
        <h2>Please log in to access the application form</h2>
        <Link to="/">Return to Home</Link>
      </div>
    );
  }

  if (!user.github_username) {
    return (
      <div className="not-complete">
        <h2>Please connect your GitHub account to apply</h2>
        <p>We need to review your GitHub profile as part of the application process.</p>
        <Link to="/">Return to Home</Link>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    position: '',
    experience: '',
    skills: '',
    whyJoin: '',
    availability: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Thank you for your application! We will review it and contact you soon.');
    // In a real app, you would submit this data to your backend
  };

  return (
    <div className="application-form">
      <h1>Application Form</h1>
      
      <div className="user-profile-summary">
        <h2>Your Profile</h2>
        <p><strong>Discord:</strong> {user.discord_username}</p>
        <p><strong>GitHub:</strong> {user.github_username}</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="position">Position</label>
          <select 
            id="position" 
            name="position" 
            value={formData.position} 
            onChange={handleChange}
            required
          >
            <option value="">Select a position</option>
            <option value="frontend">Frontend Developer</option>
            <option value="backend">Backend Engineer</option>
            <option value="devops">DevOps Specialist</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="experience">Years of Experience</label>
          <select 
            id="experience" 
            name="experience" 
            value={formData.experience} 
            onChange={handleChange}
            required
          >
            <option value="">Select experience level</option>
            <option value="0-1">Less than 1 year</option>
            <option value="1-3">1-3 years</option>
            <option value="3-5">3-5 years</option>
            <option value="5+">5+ years</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="skills">Key Skills (comma separated)</label>
          <input 
            type="text" 
            id="skills" 
            name="skills" 
            value={formData.skills} 
            onChange={handleChange}
            placeholder="e.g., React, Node.js, AWS"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="whyJoin">Why do you want to join Skyrden?</label>
          <textarea 
            id="whyJoin" 
            name="whyJoin" 
            value={formData.whyJoin} 
            onChange={handleChange}
            placeholder="Tell us why you're interested in joining our team..."
            required
            rows="5"
          ></textarea>
        </div>
        
        <div className="form-group">
          <label htmlFor="availability">Availability</label>
          <select 
            id="availability" 
            name="availability" 
            value={formData.availability} 
            onChange={handleChange}
            required
          >
            <option value="">Select availability</option>
            <option value="immediate">Immediate</option>
            <option value="2weeks">2 weeks notice</option>
            <option value="1month">1 month notice</option>
            <option value="3months">3+ months notice</option>
          </select>
        </div>
        
        <button type="submit" className="submit-btn">Submit Application</button>
      </form>
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
      <h1>Applicant Dashboard</h1>
      <div className="dashboard-welcome">
        <h2>Welcome, {user.discord_username}!</h2>
        {user.github_username ? (
          <p>Your GitHub account <strong>{user.github_username}</strong> is connected.</p>
        ) : (
          <p>Please connect your GitHub account to complete your profile.</p>
        )}
      </div>
      
      <div className="dashboard-status">
        <h3>Application Status</h3>
        <div className="status-card">
          <p className="status-label">Frontend Developer:</p>
          <p className="status-value pending">Under Review</p>
        </div>
        
        <p className="status-note">Our team is reviewing your application. We'll contact you soon for next steps.</p>
      </div>
      
      <div className="dashboard-links">
        <Link to="/apply" className="dashboard-link">Submit New Application</Link>
        <Link to="/profile" className="dashboard-link">Edit Profile</Link>
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
      <h1>Applicant Profile</h1>
      
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
            <span className="detail-label">GitHub Username:</span>
            <span className="detail-value">
              {user.github_username || 'Not connected'}
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
          const username = urlParams.get('username') || 'User';
          
          console.log('Auth success detected in URL parameters');
          
          // Create temp user from URL params
          const tempUser = {
            discord_id: discordId,
            discord_username: decodeURIComponent(username),
            github_username: null,
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
        
        // Handle GitHub linking success
        if (urlParams.get('github_linked') === 'true') {
          const username = urlParams.get('username');
          const storedUser = localStorage.getItem('skyrden_user');
          
          console.log('GitHub linking detected in URL parameters');
          
          if (storedUser && username) {
            const parsedUser = JSON.parse(storedUser);
            const updatedUser = {
              ...parsedUser,
              github_username: decodeURIComponent(username)
            };
            
            setUser(updatedUser);
            localStorage.setItem('skyrden_user', JSON.stringify(updatedUser));
            setMessage(`Successfully connected GitHub account: ${username}`);
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
  
  // Connect GitHub account
  const connectGitHub = () => {
    if (!user) {
      setError('Please log in with Discord first');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    console.log('Connecting GitHub account...');
    window.location.href = `${config.API_URL}/api/auth/github-link?discord_id=${user.discord_id}&username=${encodeURIComponent(user.discord_username || 'User')}`;
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
              <h1>Skyrden Recruitment</h1>
            </Link>
          </div>
          <div className="header-nav">
            <Link to="/">Home</Link>
            {user && <Link to="/dashboard">Dashboard</Link>}
            {user && <Link to="/apply">Apply</Link>}
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
                connectGitHub={connectGitHub}
              />
            } />
            
            <Route path="/apply" element={<ApplicationForm user={user} />} />
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/profile" element={<Profile user={user} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        
        {/* GitHub Connection Reminder */}
        {user && !user.github_username && (
          <div className="connection-reminder">
            <p>Complete your profile by connecting your GitHub account</p>
            <button onClick={connectGitHub} className="github-connect-btn">
              Connect GitHub Account
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
              <p>Empowering innovation through technology</p>
            </div>
            
            <div className="footer-links">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/">Home</Link></li>
                <li><a href="#">About Us</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            
            <div className="footer-social">
              <h4>Connect With Us</h4>
              <div className="social-icons">
                <a href="#" className="social-icon">GitHub</a>
                <a href="#" className="social-icon">LinkedIn</a>
                <a href="#" className="social-icon">Twitter</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>© 2025 Skyrden Technologies - All rights reserved</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;