import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Layout.css';
import { 
  ChatBubbleLeftIcon, 
  CalendarIcon,
  UserIcon,
  ChartBarIcon,
  CreditCardIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

const NavBar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Update these state declarations at the beginning of your component:
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  
  // Mock notification data (replace with actual API call)
  const [notifications, setNotifications] = useState({
    messages: [
      { id: 1, title: 'New message from Dr. Smith', time: '10 min ago', read: false },
      { id: 2, title: 'New message from Alex Johnson', time: '1 hour ago', read: false }
    ],
    sessions: [
      { id: 3, title: 'Upcoming session in 30 minutes', time: '30 min', read: false }
    ],
    payments: [
      { id: 4, title: 'Payment processed successfully', time: 'Yesterday', read: true }
    ]
  });
  
  // Calculate unread notifications
  const unreadCount = [
    ...notifications.messages,
    ...notifications.sessions,
    ...notifications.payments
  ].filter(notif => !notif.read).length;
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/') ? 'active' : '';
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleDropdown = (e) => {
    e.stopPropagation(); // Prevent event from bubbling up
    setDropdownOpen(prevState => !prevState);
    if (notificationDropdownOpen) setNotificationDropdownOpen(false);
  };
  
  
  const toggleNotificationDropdown = (e) => {
    e.stopPropagation(); // Prevent event from bubbling up
    setNotificationDropdownOpen(prevState => !prevState);
    if (dropdownOpen) setDropdownOpen(false);
  };
  
  const markAllAsRead = () => {
    const updatedNotifications = {
      messages: notifications.messages.map(msg => ({ ...msg, read: true })),
      sessions: notifications.sessions.map(session => ({ ...session, read: true })),
      payments: notifications.payments.map(payment => ({ ...payment, read: true }))
    };
    setNotifications(updatedNotifications);
  };
  // Add this useEffect after your other useEffect hooks
  useEffect(() => {
    // Close dropdowns when location/route changes
    setDropdownOpen(false);
    setNotificationDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef, notificationRef]);

  // Extract user data from currentUser
  const userData = currentUser?.user || {};

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/">
            <h1>EmoPal</h1>
          </Link>
        </div>
        
        <button className="mobile-menu-button" onClick={toggleMobileMenu}>
          <span className="menu-icon"></span>
        </button>
        
        <nav className={`navbar-menu ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          {currentUser ? (
            // Authenticated user navigation
            <>
              <ul className="nav-links">
                <li className={isActive('/dashboard')}>
                  <Link to="/dashboard">
                    <UserGroupIcon className="h-5 w-5 mr-2 inline-flex" />
                    Dashboard
                  </Link>
                </li>
                
                {/* Common links for all authenticated users */}
                <li className={isActive('/sessions')}>
                  <Link to="/sessions">
                    <CalendarIcon className="h-5 w-5 mr-2 inline-flex" />
                    Sessions
                  </Link>
                </li>

                <li className={isActive('/messages')}>
                  <Link to="/messages" className="flex items-center">
                    <ChatBubbleLeftIcon className="h-5 w-5 mr-2 inline-flex" />
                    <span>Messages</span>
                    {unreadCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </li>

                <li className={isActive('/media-analysis')}>
                  <Link to="/media-analysis">
                    <ChartBarIcon className="h-5 w-5 mr-2 inline-flex" />
                    Media Analysis
                  </Link>
                </li>
                
                {/* Client-specific links */}
                {userData.role === 'client' && (
                  <>
                    <li className={isActive('/therapists')}>
                      <Link to="/therapists">
                        <UserIcon className="h-5 w-5 mr-2 inline-flex" />
                        Find Therapists
                      </Link>
                    </li>
                    <li className={isActive('/emotions')}>
                      <Link to="/emotions">
                        <ChartBarIcon className="h-5 w-5 mr-2 inline-flex" />
                        Emotion Insights
                      </Link>
                    </li>
                  </>
                )}
                
                {/* Therapist-specific links */}
                {userData.role === 'therapist' && (
                  <>
                    <li className={isActive('/clients')}>
                      <Link to="/clients">
                        <UserGroupIcon className="h-5 w-5 mr-2 inline-flex" />
                        My Clients
                      </Link>
                    </li>
                    <li className={isActive('/availability')}>
                      <Link to="/availability">
                        <CalendarIcon className="h-5 w-5 mr-2 inline-flex" />
                        Availability
                      </Link>
                    </li>
                  </>
                )}
              </ul>
              
              {/* User controls section */}
              <div className="user-controls">
                {/* Notifications */}
                <div className="notifications-menu" ref={notificationRef}>
                  <div 
                    className="notifications-icon-container" 
                    onClick={(e) => toggleNotificationDropdown(e)}
                  >
                    <div className="notifications-icon">
                      <i className="icon bell-icon"></i>
                      {unreadCount > 0 && (
                        <span className="notification-badge">{unreadCount}</span>
                      )}
                    </div>
                  </div>
                  
                  {notificationDropdownOpen && (
                    <div className="notifications-dropdown">
                      <div className="dropdown-header">
                        <h3>Notifications</h3>
                        <button className="mark-read-btn" onClick={markAllAsRead}>
                          Mark all as read
                        </button>
                      </div>
                      
                      <div className="notifications-list">
                        {notifications.messages.length > 0 && (
                          <div className="notification-category">
                            <h4>Messages</h4>
                            {notifications.messages.map(msg => (
                              <div key={msg.id} className={`notification-item ${!msg.read ? 'unread' : ''}`}>
                                <div className="notification-icon message-icon"></div>
                                <div className="notification-content">
                                  <p>{msg.title}</p>
                                  <span className="notification-time">{msg.time}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {notifications.sessions.length > 0 && (
                          <div className="notification-category">
                            <h4>Sessions</h4>
                            {notifications.sessions.map(session => (
                              <div key={session.id} className={`notification-item ${!session.read ? 'unread' : ''}`}>
                                <div className="notification-icon session-icon"></div>
                                <div className="notification-content">
                                  <p>{session.title}</p>
                                  <span className="notification-time">{session.time}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {notifications.payments.length > 0 && (
                          <div className="notification-category">
                            <h4>Payments</h4>
                            {notifications.payments.map(payment => (
                              <div key={payment.id} className={`notification-item ${!payment.read ? 'unread' : ''}`}>
                                <div className="notification-icon payment-icon"></div>
                                <div className="notification-content">
                                  <p>{payment.title}</p>
                                  <span className="notification-time">{payment.time}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {unreadCount === 0 && (
                          <div className="no-notifications">
                            <p>You're all caught up!</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="notifications-footer">
                        <Link to="/notifications">View All Notifications</Link>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* User menu with enhanced dropdown */}
                <div className="user-menu" ref={dropdownRef}>
                <div 
                  className="user-avatar-container" 
                  onClick={(e) => toggleDropdown(e)}
                >
                  <div className="user-avatar">
                    {userData.profile_picture ? (
                      <img src={userData.profile_picture} alt={userData.username} />
                    ) : (
                      <div className="avatar-placeholder">
                        {userData.username ? userData.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                  <span className="dropdown-arrow"></span>
                </div>
                  
                  {dropdownOpen && (
                    <div className="user-dropdown-menu">
                      <div className="dropdown-header">
                        <div className="user-info">
                          <span className="username">{userData.username}</span>
                          <span className="role">{userData.role === 'therapist' ? 'Therapist' : 'Client'}</span>
                          <span className="email">{userData.email}</span>
                        </div>
                      </div>
                      
                      <ul className="dropdown-options">
                        <li>
                          <Link to="/profile">
                            <i className="icon profile-icon"></i>
                            My Profile
                          </Link>
                        </li>
                        <li>
                          <Link to="/account/password">
                            <i className="icon password-icon"></i>
                            Change Password
                          </Link>
                        </li>
                        <li>
                          <Link to="/payments/history">
                            <i className="icon billing-icon"></i>
                            Billing & Payments
                          </Link>
                        </li>
                        <li>
                          <Link to="/account/notifications">
                            <i className="icon notification-icon"></i>
                            Notification Settings
                          </Link>
                        </li>
                        {userData.role === 'therapist' && (
                          <li>
                            <Link to="/therapist/earnings">
                              <i className="icon earnings-icon"></i>
                              My Earnings
                            </Link>
                          </li>
                        )}
                        <li className="divider"></li>
                        <li>
                          <Link to="/help">
                            <i className="icon help-icon"></i>
                            Help Center
                          </Link>
                        </li>
                        <li className="logout-option">
                          <button onClick={handleLogout}>
                            <i className="icon logout-icon"></i>
                            Logout
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Non-authenticated user navigation
            <ul className="nav-links">
              <li><Link to="/" className={isActive('/')}>Home</Link></li>
              <li><Link to="/login" className={isActive('/login')}>Login</Link></li>
              <li><Link to="/register" className={isActive('/register')}>Register</Link></li>
              <li><Link to="/about" className={isActive('/about')}>About</Link></li>
            </ul>
          )}
        </nav>
      </div>
    </header>
  );
};

export default NavBar;