import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import config from './config';

// Import your pages
import AdminDashboard from './pages/AdminDashboard';
import ApplicationPortal from './pages/ApplicationPortal';
import MyApplications from './pages/MyApplications';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [bypassMode, setBypassMode] = useState(false);
    
    // Logo paths
    const logoIcon = `${process.env.PUBLIC_URL}/logos/icon.png`;
    const logoTextBlue = `${process.env.PUBLIC_URL}/logos/text-blue.png`;
    const logoTextWhite = `${process.env.PUBLIC_URL}/logos/text-white.png`;

    // Debug user state changes
    useEffect(() => {
        console.log('User state changed:', user);
    }, [user]);

    // Format Discord username helper
    const formatDiscordUsername = (username) => {
        return username || 'User';
    };
    
    // Check for bypass login on initial load
    useEffect(() => {
        if (!user) {
            const storedUser = localStorage.getItem('skyrden_bypass_user');
            if (storedUser) {
                try {
                    console.log('Loading bypass user from storage');
                    setUser(JSON.parse(storedUser));
                    setLoading(false);
                } catch (e) {
                    console.error('Failed to parse stored bypass user');
                }
            }
        }
    }, []);

    // Auth functions
    const startDiscordLogin = () => {
        localStorage.setItem('discord_auth_started', Date.now().toString());
        window.location.href = `${config.API_URL}/api/auth/discord`;
    };

    const startRobloxLogin = () => {
        window.location.href = `${config.API_URL}/api/auth/roblox`;
    };

    const startAdminLogin = () => {
        window.location.href = `${config.API_URL}/api/auth/admin`;
    };

    const handleLogout = async () => {
        try {
            // Clear bypass login if it exists
            localStorage.removeItem('skyrden_bypass_user');
            
            await fetch(`${config.API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            setUser(null);
            console.log('Logout successful, user state cleared');
        } catch (error) {
            console.error('Logout failed:', error);
            // Still clear user even if API call fails
            setUser(null);
        }
    };
    
    // Bypass login function for development
    const bypassLogin = (username = 'TestUser') => {
        const testUser = {
            discord_id: 'bypass_' + Date.now(),
            discord_username: username,
            roblox_username: null,
            is_admin: false
        };
        
        // Set user state
        setUser(testUser);
        setLoading(false);
        
        // Store in localStorage for persistence
        localStorage.setItem('skyrden_bypass_user', JSON.stringify(testUser));
        console.log('Bypass login complete:', testUser);
    };

    // Check authentication status
    const checkAuthStatus = async (retries = 3) => {
        try {
            console.log('Checking auth status... (retries left:', retries, ')');
            
            // Check if we're using a bypass user
            if (localStorage.getItem('skyrden_bypass_user')) {
                console.log('Using bypass user, skipping auth check');
                setLoading(false);
                return;
            }
            
            const response = await fetch(`${config.API_URL}/api/auth/status`, {
                method: 'GET',
                credentials: 'include',  // Essential for cross-domain cookies
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log('Auth response status:', response.status, response.ok);
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('User not authenticated (401)');
                    setUser(null);
                    setLoading(false);
                    return;
                }
                
                if (retries > 0) {
                    console.log('Auth check failed, retrying...');
                    setTimeout(() => checkAuthStatus(retries - 1), 1000);
                    return;
                }
                
                // If out of retries
                console.log('Auth check failed after all retries');
                setUser(null);
                setLoading(false);
                return;
            }
            
            const data = await response.json();
            console.log('Auth data received:', data);
            
            if (data.authenticated && data.user) {
                console.log('Setting user from auth check:', data.user);
                setUser(data.user);
            } else {
                console.log('No authenticated user found in response');
                setUser(null);
            }
            
            // CRITICAL: Always set loading to false after processing auth response
            setLoading(false);
            
        } catch (error) {
            console.error('Auth check failed with error:', error);
            if (retries > 0) {
                setTimeout(() => checkAuthStatus(retries - 1), 1000);
            } else {
                // If out of retries on error
                console.log('Out of retries after errors, setting loading to false');
                setUser(null);
                setLoading(false);
            }
        }
    };

    // Handle Discord auth success
    const handleDiscordAuthSuccess = () => {
  // Get token from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  let username = 'Discord User';
  
  // Try to extract username from token
  if (token) {
    try {
      // JWT tokens have 3 parts separated by dots
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        // The middle part contains the payload
        const payload = JSON.parse(atob(tokenParts[1]));
        if (payload.username) {
          username = payload.username;
        }
      }
    } catch (e) {
      console.error('Failed to decode token:', e);
    }
  }
  
  // Generate a temporary user until we can get the real data
  const tempUser = {
    discord_id: urlParams.get('id') || 'discord_' + Date.now(),
    discord_username: username,
    roblox_username: null,
    is_admin: false
  };
  
  // Set the temporary user immediately for better UX
  setUser(tempUser);
  
  // Store fallback user in case of refresh
  localStorage.setItem('skyrden_fallback_user', JSON.stringify(tempUser));
  
  // Try to get the real user data
  (async () => {
    try {
      const response = await fetch(`${config.API_URL}/api/auth/status`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Auth check after Discord login:', data);
        
        if (data.authenticated && data.user) {
          console.log('Setting user from auth check:', data.user);
          setUser(data.user);
          
          // Update stored fallback with real data
          localStorage.setItem('skyrden_fallback_user', JSON.stringify(data.user));
        }
      }
    } catch (error) {
      console.error('Failed to check auth status after Discord login:', error);
    }
  })();
};

    // Check URL parameters and initial auth
    useEffect(() => {
        // Initial auth check - only if we don't have a bypass or fallback user
        if (!localStorage.getItem('skyrden_bypass_user') && !localStorage.getItem('skyrden_fallback_user')) {
            checkAuthStatus();
        } else if (localStorage.getItem('skyrden_fallback_user') && !user) {
            // If we have a fallback user but no current user, load it
            try {
                setUser(JSON.parse(localStorage.getItem('skyrden_fallback_user')));
            } catch (e) {
                console.error('Failed to parse fallback user');
            }
            setLoading(false);
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        
        // Handle Discord auth success
        if (urlParams.get('auth') === 'success') {
            setMessage('Successfully logged in with Discord!');
            
            // Use our dedicated handler
            handleDiscordAuthSuccess();
            
            // Clean up URL params
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Clear message after 5 seconds
            setTimeout(() => setMessage(''), 5000);
            
            // Ensure loading is set to false
            setLoading(false);
        }
        
        // Handle Roblox linking success
        if (urlParams.get('roblox_linked') === 'true') {
            const username = urlParams.get('username');
            setMessage(username ? `Successfully connected Roblox account: ${username}` : 'Roblox account connected successfully!');
            
            // Update user with Roblox info
            if (user) {
                const updatedUser = {
                    ...user,
                    roblox_username: username || 'Roblox User'
                };
                setUser(updatedUser);
                
                // Update stored user if using fallback or bypass
                if (localStorage.getItem('skyrden_fallback_user')) {
                    localStorage.setItem('skyrden_fallback_user', JSON.stringify(updatedUser));
                }
                if (localStorage.getItem('skyrden_bypass_user')) {
                    localStorage.setItem('skyrden_bypass_user', JSON.stringify(updatedUser));
                }
            }
            
            // Clean up URL params
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Clear message after 5 seconds
            setTimeout(() => setMessage(''), 5000);
        }
        
        // Handle authentication errors
        if (urlParams.get('error')) {
            if (urlParams.get('error') === 'not_admin') {
                setMessage('Access denied: You are not an administrator');
            } else {
                setMessage(`Error: ${urlParams.get('error')}`);
            }
            setTimeout(() => setMessage(''), 5000);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // Monitor for URL changes to detect auth callback
    useEffect(() => {
        const authStarted = localStorage.getItem('discord_auth_started');
        const urlParams = new URLSearchParams(window.location.search);
        
        if (authStarted && urlParams.get('auth') === 'success') {
            console.log('Detected return from Discord auth with success');
            localStorage.removeItem('discord_auth_started');
        }
    }, [window.location.search]);

    // Landing Page Component - Define it inline to ensure it exists
    const LandingPage = () => {
        console.log("Rendering LandingPage with user:", user);
        
        return (
            <>
                {/* Header with Skyrden Blue */}
                <header style={{ 
                    padding: '15px 30px', 
                    background: '#002244', 
                    color: 'white', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    boxShadow: '0 2px 10px rgba(0, 34, 68, 0.3)',
                    borderBottom: '3px solid #003366'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {/* Text Logo - White version for dark background */}
                        <img 
                            src={logoTextWhite} 
                            alt="Skyrden Airlines" 
                            style={{
                                height: '30px',
                                width: 'auto'
                            }}
                        />
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {/* Admin Cogwheel - Visible to everyone */}
                        <button 
                            onClick={startAdminLogin}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '5px',
                                borderRadius: '4px',
                                transition: 'all 0.2s ease',
                                fontSize: '18px'
                            }}
                            title="Admin Login"
                            onMouseEnter={(e) => {
                                e.target.style.background = 'rgba(255,255,255,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'transparent';
                            }}
                        >
                            ⚙️
                        </button>
                        
                        {user ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '14px', opacity: 0.9, fontFamily: 'Source Sans Pro, sans-serif' }}>
                                        Welcome, {formatDiscordUsername(user.discord_username)}
                                    </div>
                                    <div style={{ 
                                        fontSize: '12px', 
                                        opacity: 0.7,
                                        color: user.roblox_username ? '#4ADE80' : '#FBBF24',
                                        fontFamily: 'Source Sans Pro, sans-serif'
                                    }}>
                                        Status: {user.roblox_username ? '✓ Ready to apply' : '✓ Discord connected'}
                                        {user.is_admin && ' • Admin'}
                                    </div>
                                </div>
                                
                                {!user.roblox_username && (
                                    <button onClick={startRobloxLogin} style={{ 
                                        padding: '8px 16px', 
                                        background: 'white', 
                                        color: '#002244', 
                                        border: 'none', 
                                        borderRadius: '6px', 
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        fontFamily: 'Source Sans Pro, sans-serif',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        Connect Roblox
                                    </button>
                                )}
                                
                                <button onClick={handleLogout} style={{ 
                                    padding: '8px 16px', 
                                    background: 'transparent', 
                                    color: 'white', 
                                    border: '1px solid rgba(255,255,255,0.3)', 
                                    borderRadius: '6px', 
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontFamily: 'Source Sans Pro, sans-serif',
                                    transition: 'all 0.2s ease'
                                }}>
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <button onClick={startDiscordLogin} style={{ 
                                padding: '10px 20px', 
                                background: '#5865F2', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '14px',
                                fontFamily: 'Source Sans Pro, sans-serif',
                                transition: 'all 0.2s ease'
                            }}>
                                <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M15.248 1.158C14.098 0.621 12.8593 0.2282 11.5643 0C11.3743 0.34 11.1552 0.799 11.002 1.164C9.62428 0.948 8.25756 0.948 6.91381 1.164C6.76058 0.799 6.53568 0.34 6.34368 0C5.04563 0.2292 3.80507 0.6232 2.65298 1.163C0.381641 4.524 -0.234359 7.807 0.0736407 11.044C1.66064 12.2293 3.18674 12.9399 4.686 13.413C5.05397 12.902 5.38273 12.3571 5.66799 11.786C5.13025 11.573 4.61751 11.315 4.13577 11.011C4.26799 10.912 4.39799 10.809 4.52299 10.702C7.53339 12.126 10.8404 12.126 13.813 10.702C13.939 10.809 14.069 10.912 14.2 11.011C13.717 11.316 13.203 11.574 12.664 11.787C12.9496 12.3578 13.2783 12.9026 13.646 13.413C15.1473 12.9399 16.6753 12.2293 18.262 11.044C18.6253 7.283 17.6633 4.031 15.248 1.158ZM6.13133 9.046C5.22697 9.046 4.48133 8.201 4.48133 7.17C4.48133 6.139 5.20997 5.294 6.13133 5.294C7.05269 5.294 7.79833 6.139 7.78133 7.17C7.78133 8.201 7.05269 9.046 6.13133 9.046ZM12.2043 9.046C11.2999 9.046 10.5543 8.201 10.5543 7.17C10.5543 6.139 11.2829 5.294 12.2043 5.294C13.1257 5.294 13.8713 6.139 13.8543 7.17C13.8543 8.201 13.1257 9.046 12.2043 9.046Z" fill="white"/>
                                </svg>
                                Login with Discord
                            </button>
                        )}
                    </div>
                </header>
                
                {/* Main Content */}
                <div style={{ 
                    background: 'linear-gradient(135deg, #002244 0%, #001122 100%)', 
                    minHeight: 'calc(100vh - 60px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '40px 20px',
                    color: 'white',
                    textAlign: 'center'
                }}>
                    <img src={logoIcon} alt="Skyrden Airlines Logo" style={{ width: '120px', marginBottom: '30px' }} />
                    <h1 style={{ 
                        fontSize: '2.5rem', 
                        marginBottom: '20px',
                        fontFamily: '"Source Sans Pro", sans-serif',
                        fontWeight: '800'
                    }}>
                        Welcome to Skyrden Airlines
                    </h1>
                    
                    <p style={{ 
                        fontSize: '1.2rem', 
                        maxWidth: '700px', 
                        marginBottom: '40px',
                        lineHeight: '1.6',
                        opacity: '0.9',
                        fontFamily: '"Source Sans Pro", sans-serif'
                    }}>
                        Join our dedicated flight crew by applying through our recruitment portal. Connect with Discord to get started.
                    </p>
                    
                    {user ? (
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '20px',
                            maxWidth: '700px',
                            width: '100%'
                        }}>
                            {user.roblox_username ? (
                                <>
                                    <div style={{ 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        padding: '30px',
                                        background: 'rgba(0,0,0,0.3)',
                                        borderRadius: '10px',
                                        width: '100%',
                                        marginBottom: '20px',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        <h2 style={{ 
                                            fontSize: '1.8rem', 
                                            marginBottom: '10px',
                                            fontFamily: '"Source Sans Pro", sans-serif',
                                            fontWeight: '700'
                                        }}>
                                            Ready to Apply
                                        </h2>
                                        
                                        <p style={{ 
                                            fontSize: '1.1rem', 
                                            marginBottom: '25px',
                                            opacity: '0.8',
                                            fontFamily: '"Source Sans Pro", sans-serif',
                                            lineHeight: '1.5'
                                        }}>
                                            Your accounts are connected and verified. You can now apply for positions at Skyrden Airlines.
                                        </p>
                                        
                                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', width: '100%' }}>
                                            <button onClick={() => window.location.href = '/apply'} style={{ 
                                                padding: '12px 24px', 
                                                background: '#0284c7', 
                                                color: 'white', 
                                                border: 'none', 
                                                borderRadius: '6px', 
                                                cursor: 'pointer',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                flex: '1',
                                                maxWidth: '200px',
                                                fontFamily: '"Source Sans Pro", sans-serif',
                                                transition: 'all 0.2s ease'
                                            }}>
                                                Submit Application
                                            </button>
                                            
                                            <button onClick={() => window.location.href = '/my-applications'} style={{ 
                                                padding: '12px 24px', 
                                                background: 'transparent', 
                                                color: 'white', 
                                                border: '1px solid rgba(255,255,255,0.3)', 
                                                borderRadius: '6px', 
                                                cursor: 'pointer',
                                                fontSize: '16px',
                                                flex: '1',
                                                maxWidth: '200px',
                                                fontFamily: '"Source Sans Pro", sans-serif',
                                                transition: 'all 0.2s ease'
                                            }}>
                                                View My Applications
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div style={{ 
                                        padding: '15px', 
                                        background: 'rgba(0,0,0,0.2)', 
                                        borderRadius: '8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        width: '100%',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div style={{ 
                                            fontSize: '0.9rem',
                                            opacity: '0.7',
                                            fontFamily: '"Source Sans Pro", sans-serif',
                                            marginBottom: '5px'
                                        }}>
                                            Connected Accounts
                                        </div>
                                        
                                        <div style={{ 
                                            display: 'flex', 
                                            gap: '20px',
                                            width: '100%',
                                            justifyContent: 'center'
                                        }}>
                                            <div style={{ 
                                                padding: '10px 15px',
                                                background: 'rgba(88, 101, 242, 0.2)',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                flex: '1',
                                                maxWidth: '220px',
                                                justifyContent: 'center'
                                            }}>
                                                <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M15.248 1.158C14.098 0.621 12.8593 0.2282 11.5643 0C11.3743 0.34 11.1552 0.799 11.002 1.164C9.62428 0.948 8.25756 0.948 6.91381 1.164C6.76058 0.799 6.53568 0.34 6.34368 0C5.04563 0.2292 3.80507 0.6232 2.65298 1.163C0.381641 4.524 -0.234359 7.807 0.0736407 11.044C1.66064 12.2293 3.18674 12.9399 4.686 13.413C5.05397 12.902 5.38273 12.3571 5.66799 11.786C5.13025 11.573 4.61751 11.315 4.13577 11.011C4.26799 10.912 4.39799 10.809 4.52299 10.702C7.53339 12.126 10.8404 12.126 13.813 10.702C13.939 10.809 14.069 10.912 14.2 11.011C13.717 11.316 13.203 11.574 12.664 11.787C12.9496 12.3578 13.2783 12.9026 13.646 13.413C15.1473 12.9399 16.6753 12.2293 18.262 11.044C18.6253 7.283 17.6633 4.031 15.248 1.158ZM6.13133 9.046C5.22697 9.046 4.48133 8.201 4.48133 7.17C4.48133 6.139 5.20997 5.294 6.13133 5.294C7.05269 5.294 7.79833 6.139 7.78133 7.17C7.78133 8.201 7.05269 9.046 6.13133 9.046ZM12.2043 9.046C11.2999 9.046 10.5543 8.201 10.5543 7.17C10.5543 6.139 11.2829 5.294 12.2043 5.294C13.1257 5.294 13.8713 6.139 13.8543 7.17C13.8543 8.201 13.1257 9.046 12.2043 9.046Z" fill="#5865F2"/>
                                                </svg>
                                                <span style={{ fontFamily: '"Source Sans Pro", sans-serif', fontSize: '14px' }}>
                                                    {user.discord_username}
                                                </span>
                                            </div>
                                            
                                            <div style={{ 
                                                padding: '10px 15px',
                                                background: 'rgba(0, 162, 255, 0.2)',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                flex: '1',
                                                maxWidth: '220px',
                                                justifyContent: 'center'
                                            }}>
                                                <span style={{ 
                                                    background: '#00A2FF',
                                                    borderRadius: '4px',
                                                    width: '18px',
                                                    height: '18px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    fontSize: '10px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    R
                                                </span>
                                                <span style={{ fontFamily: '"Source Sans Pro", sans-serif', fontSize: '14px' }}>
                                                    {user.roblox_username}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ 
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    padding: '30px',
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: '10px',
                                    width: '100%',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <h2 style={{ 
                                        fontSize: '1.8rem', 
                                        marginBottom: '10px',
                                        fontFamily: '"Source Sans Pro", sans-serif',
                                        fontWeight: '700'
                                    }}>
                                        Connect Your Roblox Account
                                    </h2>
                                    
                                    <p style={{ 
                                        fontSize: '1.1rem', 
                                        marginBottom: '25px',
                                        opacity: '0.8',
                                        fontFamily: '"Source Sans Pro", sans-serif',
                                        lineHeight: '1.5'
                                    }}>
                                        To apply for positions at Skyrden Airlines, you need to connect your Roblox account. This helps us verify your identity and review your in-game experience.
                                    </p>
                                    
                                    <button onClick={startRobloxLogin} style={{ 
                                        padding: '12px 30px', 
                                        background: '#00A2FF', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '6px', 
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontFamily: '"Source Sans Pro", sans-serif',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <span style={{ 
                                            background: 'white',
                                            borderRadius: '4px',
                                            width: '20px',
                                            height: '20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#00A2FF',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }}>
                                            R
                                        </span>
                                        Connect Roblox Account
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <button onClick={startDiscordLogin} style={{ 
                                padding: '15px 30px', 
                                background: '#5865F2', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '8px', 
                                cursor: 'pointer',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontFamily: '"Source Sans Pro", sans-serif',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 15px rgba(88, 101, 242, 0.4)'
                            }}>
                                <svg width="22" height="16" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M15.248 1.158C14.098 0.621 12.8593 0.2282 11.5643 0C11.3743 0.34 11.1552 0.799 11.002 1.164C9.62428 0.948 8.25756 0.948 6.91381 1.164C6.76058 0.799 6.53568 0.34 6.34368 0C5.04563 0.2292 3.80507 0.6232 2.65298 1.163C0.381641 4.524 -0.234359 7.807 0.0736407 11.044C1.66064 12.2293 3.18674 12.9399 4.686 13.413C5.05397 12.902 5.38273 12.3571 5.66799 11.786C5.13025 11.573 4.61751 11.315 4.13577 11.011C4.26799 10.912 4.39799 10.809 4.52299 10.702C7.53339 12.126 10.8404 12.126 13.813 10.702C13.939 10.809 14.069 10.912 14.2 11.011C13.717 11.316 13.203 11.574 12.664 11.787C12.9496 12.3578 13.2783 12.9026 13.646 13.413C15.1473 12.9399 16.6753 12.2293 18.262 11.044C18.6253 7.283 17.6633 4.031 15.248 1.158ZM6.13133 9.046C5.22697 9.046 4.48133 8.201 4.48133 7.17C4.48133 6.139 5.20997 5.294 6.13133 5.294C7.05269 5.294 7.79833 6.139 7.78133 7.17C7.78133 8.201 7.05269 9.046 6.13133 9.046ZM12.2043 9.046C11.2999 9.046 10.5543 8.201 10.5543 7.17C10.5543 6.139 11.2829 5.294 12.2043 5.294C13.1257 5.294 13.8713 6.139 13.8543 7.17C13.8543 8.201 13.1257 9.046 12.2043 9.046Z" fill="white"/>
                                </svg>
                                Get Started with Discord
                            </button>
                            
                            {/* Developer bypass login option */}
                            <div style={{ 
                                marginTop: '40px', 
                                opacity: '0.7', 
                                fontSize: '14px',
                                cursor: 'pointer'
                            }}>
                                <details>
                                    <summary style={{ 
                                        fontFamily: '"Source Sans Pro", sans-serif', 
                                        opacity: '0.6'
                                    }}>
                                        Developer Options
                                    </summary>
                                    <div style={{ marginTop: '15px' }}>
                                        {!bypassMode ? (
                                            <button 
                                                onClick={() => setBypassMode(true)}
                                                style={{ 
                                                    padding: '8px 16px', 
                                                    background: '#333', 
                                                    color: 'white', 
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Enable Bypass Login
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                <input 
                                                    type="text" 
                                                    id="bypassUsername" 
                                                    placeholder="Enter username" 
                                                    style={{ 
                                                        padding: '8px', 
                                                        borderRadius: '4px', 
                                                        border: 'none',
                                                        fontSize: '12px'
                                                    }} 
                                                />
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button 
                                                        onClick={() => {
                                                            const username = document.getElementById('bypassUsername').value || 'TestUser';
                                                            bypassLogin(username);
                                                            setBypassMode(false);
                                                        }}
                                                        style={{ 
                                                            padding: '8px 16px', 
                                                            background: '#333', 
                                                            color: 'white', 
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Login as Test User
                                                    </button>
                                                    <button 
                                                        onClick={() => setBypassMode(false)}
                                                        style={{ 
                                                            padding: '8px 16px', 
                                                            background: 'transparent', 
                                                            color: 'white', 
                                                            border: '1px solid #333',
                                                            borderRadius: '4px',
                                                            fontSize: '12px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Footer */}
                <footer style={{ 
                    background: '#001122', 
                    padding: '20px', 
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.5)',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    fontSize: '14px',
                    fontFamily: '"Source Sans Pro", sans-serif'
                }}>
                    &copy; 2023 Skyrden Airlines. All rights reserved.
                </footer>
            </>
        );
    };

    // Main rendering logic
    console.log('Rendering App with loading:', loading, 'user:', user);
    
    return (
        <div className="App">
            {loading ? (
                // Loading screen
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    background: '#002244',
                    color: 'white'
                }}>
                    <img src={logoIcon} alt="Skyrden Airlines" style={{ width: '100px', marginBottom: '15px' }} />
                    <h1>Skyrden Airlines</h1>
                    <p>Loading authentication status...</p>
                </div>
            ) : (
                // Main app content - Force re-render when user changes with key
                <Router>
                    <Routes>
                        <Route path="/" element={<LandingPage key={user?.discord_id || 'guest'} />} />
                        <Route path="/admin" element={user?.is_admin ? <AdminDashboard /> : <Navigate to="/?error=not_admin" />} />
                        <Route path="/apply" element={user?.roblox_username ? <ApplicationPortal /> : <Navigate to="/" />} />
                        <Route path="/my-applications" element={user?.roblox_username ? <MyApplications /> : <Navigate to="/" />} />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Router>
            )}
            
            {/* Message toast */}
            {message && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#4CAF50',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                    zIndex: 1000
                }}>
                    {message}
                </div>
            )}
        </div>
    );
}

export default App;