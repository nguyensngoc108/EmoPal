import React from 'react';
import { Link } from 'react-router-dom';
import './Layout.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>EmoPal</h3>
          <p>Advanced emotion analysis for therapy sessions</p>
          <p className="copyright">© {currentYear} EmoPal. All rights reserved.</p>
        </div>
        
        <div className="footer-section">
          <h4>Company</h4>
          <ul>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li><Link to="/terms">Terms of Service</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4>Resources</h4>
          <ul>
            <li><Link to="/blog">Blog</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
            <li><Link to="/support">Support</Link></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4>Connect With Us</h4>
          <div className="social-links">
            <a href="https://twitter.com/aifacepresent" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href="https://linkedin.com/company/aifacepresent" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://facebook.com/aifacepresent" target="_blank" rel="noopener noreferrer">Facebook</a>
          </div>
          <div className="contact-info">
            <p>Email: info@aifacepresent.com</p>
            <p>Phone: (123) 456-7890</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;