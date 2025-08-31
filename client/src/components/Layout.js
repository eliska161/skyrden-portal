import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/branding.css';
import logo from '../Public/logos/text-blue.png'; // Make sure to add this logo file

const Layout = ({ children }) => {
  return (
    <div className="app-container">
      <header className="header-with-line">
        <div className="header-line"></div>
        <div className="logo-container">
          <img src={logo} alt="Skyrden Logo" className="logo" />
          <span className="logo-text">skyrden portal</span>
        </div>
      </header>
      
      <main className="main-content">
        {children}
      </main>
      
      <footer className="footer">
        <p>© {new Date().getFullYear()} Skyrden. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Layout;