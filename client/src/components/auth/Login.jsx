import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const Login = () => {
  const [activeTab, setActiveTab] = useState('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [appearAnimation, setAppearAnimation] = useState(false);
  const { login, error: authError } = useAuth();
  const navigate = useNavigate();
  const particlesContainerRef = useRef(null);

  // Add animation when component mounts
  useEffect(() => {
    setAppearAnimation(true);
    
    // Create particles animation
    if (particlesContainerRef.current) {
      createParticles();
    }
    
    return () => {
      // Cleanup particles if needed
    };
  }, []);
  
  // Function to create particles
  const createParticles = () => {
    const container = particlesContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Create 15 particles
    for (let i = 0; i < 15; i++) {
      createParticle(container, containerRect);
    }
    
    // Create new particles periodically
    const interval = setInterval(() => {
      createParticle(container, containerRect);
    }, 800);
    
    return () => clearInterval(interval);
  };
  
  const createParticle = (container, containerRect) => {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    
    // Random size between 10px and 30px
    const size = Math.random() * 20 + 10;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    
    // Random position at bottom of container
    const xPos = Math.random() * containerRect.width;
    particle.style.left = `${xPos}px`;
    particle.style.bottom = '0';
    
    // Random animation duration
    const duration = Math.random() * 3 + 3; // 3-6 seconds
    particle.style.animationDuration = `${duration}s`;
    
    // Random delay
    const delay = Math.random() * 2;
    particle.style.animationDelay = `${delay}s`;
    
    container.appendChild(particle);
    
    // Remove particle after animation completes
    setTimeout(() => {
      if (container.contains(particle)) {
        container.removeChild(particle);
      }
    }, (duration + delay) * 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setError('');
  };

  return (
    <div className="auth-container">
      <div className="particles-container" ref={particlesContainerRef}></div>
      
      <div className={`auth-card ${appearAnimation ? 'appeared' : ''}`}>
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${activeTab === 'client' ? 'active' : ''}`}
            onClick={() => handleTabChange('client')}
          >
            Client Login
          </button>
          <button 
            className={`auth-tab ${activeTab === 'therapist' ? 'active' : ''}`}
            onClick={() => handleTabChange('therapist')}
          >
            Therapist Login
          </button>
        </div>

        <div className="auth-content">
          <h2>{activeTab === 'client' ? 'Welcome Back' : 'Provider Login'}</h2>
          <p className="auth-subtitle">
            {activeTab === 'client' 
              ? 'Sign in to continue your therapy journey' 
              : 'Access your therapist dashboard'}
          </p>

          {(error || authError) && (
            <div className="auth-error">
              {error || authError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder=" "
              />
              <label htmlFor="email">Email Address</label>
            </div>

            <div className="form-group">
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder=" "
              />
              <label htmlFor="password">Password</label>
            </div>

            <button 
              type="submit" 
              className="auth-button" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <div className="auth-links">
              <Link to="/forgot-password">Forgot Password?</Link>
            </div>
            
            <p className="auth-register">
              Don't have an account? {' '}
              {activeTab === 'client' ? (
                <Link to="/register">Sign Up</Link>
              ) : (
                <Link to="/therapist/register">Register as Therapist</Link>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;