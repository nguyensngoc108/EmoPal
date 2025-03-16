import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const Login = () => {
  const [activeTab, setActiveTab] = useState('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error: authError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // The backend API distinguishes between client/therapist by the role in the JWT
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${activeTab === 'client' ? 'active' : ''}`}
            onClick={() => setActiveTab('client')}
          >
            Client Login
          </button>
          <button 
            className={`auth-tab ${activeTab === 'therapist' ? 'active' : ''}`}
            onClick={() => setActiveTab('therapist')}
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
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>

            <button 
              type="submit" 
              className="auth-button" 
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
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