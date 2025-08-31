import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import config from './config';

// Import your new pages
import AdminDashboard from './pages/AdminDashboard';
import ApplicationPortal from './pages/ApplicationPortal';
import MyApplications from './pages/MyApplications';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    
    // Logo paths
    const logoIcon = `${process.env.PUBLIC_URL}/logos/icon.png`;
    const logoTextBlue = `${process.env.PUBLIC_URL}/logos/text-blue.png`;
    const logoTextWhite = `${process.env.PUBLIC_URL}/logos/text-white.png`;

    // Add this useEffect to debug user state changes
useEffect(() => {
    console.log('User state changed:', user);
}, [user]);

   useEffect(() => {
    checkAuthStatus();
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Handle Discord auth success
    if (urlParams.get('auth') === 'success') {
        setMessage('Successfully logged in with Discord!');
        setTimeout(() => {
            checkAuthStatus(); // Re-check auth status
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 2000); // Increased delay for better auth sync
        setTimeout(() => setMessage(''), 5000);
    }
    
    // Handle Roblox linking success
    if (urlParams.get('roblox_linked') === 'true') {
        const username = urlParams.get('username');
        setMessage(username ? `Successfully connected Roblox account: ${username}` : 'Roblox account connected successfully!');
        
        setTimeout(() => {
            checkAuthStatus();
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 2000); // Increased delay for consistency
        
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

    const checkAuthStatus = async (retries = 3) => {
    try {
        console.log('Checking auth status... (retries left:', retries, ')');
        
        const response = await fetch(`${config.API_URL}/api/auth/status`, {
            credentials: 'include'
        });
        
        console.log('Auth response status:', response.status, response.ok);
        
        if (!response.ok) {
            if (response.status === 401) {
                // User is not authenticated - this is normal, not an error
                console.log('User not authenticated');
                setUser(null);
                setLoading(false); // Make sure loading is set to false here
                return;
            }
            
            if (retries > 0) {
                console.log('Auth check failed, retrying...');
                setTimeout(() => checkAuthStatus(retries - 1), 1000);
                return;
            }
            
            // If we're out of retries and response is still not OK
            setUser(null);
            setLoading(false); // Make sure loading is set to false here
            return;
        }
        
        const data = await response.json();
        console.log('Auth data received:', data);
        
        if (data.authenticated && data.user) {
            console.log('Setting user:', data.user);
            setUser(data.user);
        } else {
            console.log('No authenticated user found');
            setUser(null);
        }
        
        // IMPORTANT: Always set loading to false after processing auth response
        setLoading(false);
        
    } catch (error) {
        console.error('Auth check failed:', error);
        if (retries > 0) {
            setTimeout(() => checkAuthStatus(retries - 1), 1000);
            return;
        } else {
            // If we're out of retries, make sure to set loading to false
            setUser(null);
            setLoading(false);
        }
    }
};

    // Function to remove Discord discriminator (everything after #)
    const formatDiscordUsername = (username) => {
        if (!username) return '';
        return username.split('#')[0];
    };

    // Landing Page Component
    const LandingPage = () => (
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
                    {/* Icon Logo */}
            
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
                            background: 'white', 
                            color: '#002244', 
                            border: 'none', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontFamily: 'Source Sans Pro, sans-serif',
                            transition: 'all 0.2s ease'
                        }}>
                            Login with Discord
                        </button>
                    )}
                </div>
            </header>

            {/* Message Banner */}
            {message && (
                <div style={{
                    padding: '12px 30px',
                    backgroundColor: message.includes('Error') || message.includes('denied') ? '#dc2626' : '#059669',
                    color: 'white',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontFamily: 'Source Sans Pro, sans-serif'
                }}>
                    {message}
                </div>
            )}
            
            {/* Main Content */}
            <main style={{ padding: '40px 20px', minHeight: '60vh' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        {/* Blue Text Logo for light background */}
                        <img 
                            src={logoTextBlue} 
                            alt="Skyrden Airlines" 
                            style={{
                                height: '60px',
                                width: 'auto',
                                marginBottom: '20px'
                            }}
                        />
                        <h2 style={{ 
                            fontSize: '32px', 
                            color: '#002244',
                            fontWeight: 'bold',
                            fontFamily: 'Outfit, sans-serif',
                            marginBottom: '10px'
                        }}>
                            Welcome to Skyrden Recruitment
                        </h2>
                        <p style={{ 
                            fontSize: '16px', 
                            color: '#353740',
                            fontFamily: 'Source Sans Pro, sans-serif',
                            maxWidth: '600px',
                            margin: '0 auto'
                        }}>
                            Submit your application here to get a chance to be a part of our staff team.
                        </p>
                    </div>
                    
                    {!user ? (
                        <div style={{ 
                            background: 'white', 
                            padding: '50px', 
                            borderRadius: '12px', 
                            maxWidth: '500px', 
                            margin: '0 auto',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                            textAlign: 'center'
                        }}>
                            <h3 style={{ 
                                fontSize: '20px', 
                                color: '#002244',
                                fontWeight: 'bold',
                                fontFamily: 'Source Sans Pro, sans-serif',
                                marginBottom: '20px'
                            }}>
                                GET STARTED
                            </h3>
                            <p style={{ 
                                fontSize: '14px', 
                                color: '#353740',
                                fontFamily: 'Source Sans Pro, sans-serif',
                                marginBottom: '30px'
                            }}>
                                Please login with Discord to continue your application process.
                            </p>
                            <button onClick={startDiscordLogin} style={{ 
                                padding: '15px 40px', 
                                fontSize: '16px', 
                                backgroundColor: '#002244', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '8px', 
                                cursor: 'pointer', 
                                fontWeight: 'bold',
                                fontFamily: 'Source Sans Pro, sans-serif',
                                transition: 'all 0.2s ease'
                            }}>
                                Login with Discord
                            </button>
                        </div>
                    ) : (
                        <div style={{ 
                            background: 'white', 
                            padding: '30px', 
                            borderRadius: '12px',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                            maxWidth: '800px',
                            margin: '0 auto'
                        }}>
                            <h3 style={{ 
                                fontSize: '18px', 
                                color: '#002244',
                                fontWeight: 'bold',
                                fontFamily: 'Source Sans Pro, sans-serif',
                                marginBottom: '25px',
                                textAlign: 'center'
                            }}>
                                AUTHENTICATION STATUS
                            </h3>
                            
                            <div style={{ marginBottom: '25px' }}>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    padding: '15px',
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    marginBottom: '15px'
                                }}>
                                    <div style={{ 
                                        width: '24px', 
                                        height: '24px', 
                                        borderRadius: '50%', 
                                        backgroundColor: '#002244', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        marginRight: '15px',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}>
                                        ✓
                                    </div>
                                    <div>
                                        <div style={{ 
                                            fontWeight: 'bold',
                                            color: '#002244',
                                            fontFamily: 'Source Sans Pro, sans-serif'
                                        }}>
                                            Discord Connected
                                        </div>
                                        <div style={{ 
                                            fontSize: '14px',
                                            color: '#64748b',
                                            fontFamily: 'Source Sans Pro, sans-serif'
                                        }}>
                                            {formatDiscordUsername(user.discord_username)}
                                        </div>
                                    </div>
                                </div>
                                
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    padding: '15px',
                                    background: '#f8fafc',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ 
                                        width: '24px', 
                                        height: '24px', 
                                        borderRadius: '50%', 
                                        backgroundColor: user.roblox_username ? '#002244' : '#9ca3af', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        marginRight: '15px',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}>
                                        {user.roblox_username ? '✓' : '!'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ 
                                            fontWeight: 'bold',
                                            color: user.roblox_username ? '#002244' : '#374151',
                                            fontFamily: 'Source Sans Pro, sans-serif'
                                        }}>
                                            {user.roblox_username ? 'Roblox Connected' : 'Roblox Not Connected'}
                                        </div>
                                        <div style={{ 
                                            fontSize: '14px',
                                            color: '#64748b',
                                            fontFamily: 'Source Sans Pro, sans-serif'
                                        }}>
                                            {user.roblox_username || 'Connect your Roblox account to continue'}
                                        </div>
                                    </div>
                                    {!user.roblox_username && (
                                        <button onClick={startRobloxLogin} style={{ 
                                            padding: '8px 16px', 
                                            background: '#002244', 
                                            color: 'white', 
                                            border: 'none', 
                                            borderRadius: '4px', 
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            fontFamily: 'Source Sans Pro, sans-serif'
                                        }}>
                                            Connect
                                        </button>
                                    )}
                                </div>
                            </div>

                            {user.roblox_username && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '20px' }}>
                                        <button 
                                            onClick={() => window.location.href = '/apply'}
                                            style={{ 
                                                padding: '12px 30px', 
                                                fontSize: '14px', 
                                                backgroundColor: '#065f46', 
                                                color: 'white', 
                                                border: 'none', 
                                                borderRadius: '6px', 
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                fontFamily: 'Source Sans Pro, sans-serif'
                                            }}
                                        >
                                            Apply Now
                                        </button>
                                        <button 
                                            onClick={() => window.location.href = '/my-applications'}
                                            style={{ 
                                                padding: '12px 30px', 
                                                fontSize: '14px', 
                                                backgroundColor: '#002244', 
                                                color: 'white', 
                                                border: 'none', 
                                                borderRadius: '6px', 
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                fontFamily: 'Source Sans Pro, sans-serif'
                                            }}
                                        >
                                            My Applications
                                        </button>
                                    </div>
                                    <p style={{ 
                                        fontSize: '14px', 
                                        color: '#64748b',
                                        fontFamily: 'Source Sans Pro, sans-serif'
                                    }}>
                                        You're fully authenticated and ready to start your application journey.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer style={{ 
                padding: '30px 20px', 
                background: '#002244', 
                textAlign: 'center', 
                color: 'white',
                marginTop: 'auto'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    {/* White Text Logo in footer */}
                    <img 
                        src={logoTextWhite} 
                        alt="Skyrden Airlines" 
                        style={{
                            height: '30px',
                            width: 'auto',
                            marginBottom: '15px',
                            opacity: 0.8
                        }}
                    />
                    <p style={{ 
                        margin: '0 0 10px 0',
                        fontFamily: 'Source Sans Pro, sans-serif',
                        fontSize: '14px'
                    }}>
                        © 2025 Skyrden. All rights reserved.
                    </p>
                    <p style={{ 
                        margin: 0,
                        fontFamily: 'Source Sans Pro, sans-serif',
                        fontSize: '12px',
                        opacity: 0.7
                    }}>
                        Application Portal v2.0 • {user ? 'Authenticated' : 'Not Authenticated'}
                    </p>
                </div>
            </footer>
        </>
    );

    if (loading) return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            background: 'linear-gradient(135deg, #002244 0%, #003366 100%)',
            color: 'white',
            fontFamily: 'Outfit, sans-serif'
        }}>
            <div style={{ textAlign: 'center' }}>
                <img 
                    src={logoTextWhite} 
                    alt="Skyrden Airlines" 
                    style={{
                        height: '50px',
                        width: 'auto',
                        marginBottom: '20px'
                    }}
                />
                <div>Loading authentication status...</div>
            </div>
        </div>
    );

    return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/applications" element={<ApplicationPortal />} />
        <Route path="/my-applications" element={<MyApplications />} />
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;