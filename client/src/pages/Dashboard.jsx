import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SessionService from '../services/SessionServices';
import '../styles/Dashboard.css';

// Import Landing component
import Landing from './Landing';
// Import Landing CSS to ensure styles are loaded
import '../styles/Landing.css';

// Import icons
import { 
  CalendarIcon, 
  ChartPieIcon,
  VideoCameraIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon as RefreshIcon,
  UserIcon,
  ClockIcon,
  UserGroupIcon,
  PlusCircleIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

// Component imports
import SupportBubble from '../components/chat/SupportBubble';
import ChatService from '../services/ChatService';
import HelpChat from '../components/chat/HelpChat';

// Icon helper component for consistent sizing
const Icon = ({ icon: IconComponent, size = "md", className = "" }) => {
  const sizeClasses = {
    xs: "h-4 w-4",
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12"
  };
  
  return (
    <IconComponent className={`${sizeClasses[size]} ${className}`} />
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isLoggedIn = !!currentUser;
  const isTherapist = currentUser?.role === 'therapist';
  
  // State management
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [loading, setLoading] = useState({
    sessions: true
  });
  const [error, setError] = useState({});
  const [activeTab, setActiveTab] = useState('dashboard');
  const [greeting, setGreeting] = useState('');
  const [stats, setStats] = useState({
    todaySessions: 0,
    weekSessions: 0,  
    monthSessions: 0,
    totalClients: 0
  });
  const isNewUser = currentUser?.isNewUser || false;
  const [showHelpChat, setShowHelpChat] = useState(isNewUser);
  const [helpMessages, setHelpMessages] = useState([]);

  // Set greeting based on time of day
  useEffect(() => {
    if (!isLoggedIn) return; // Only set greeting if logged in
    
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, [isLoggedIn]);

  // Fetch data when logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    
    // Fetch upcoming sessions
    const fetchUpcomingSessions = async () => {
      try {
        setLoading(prev => ({ ...prev, sessions: true }));
        const response = await SessionService.getUpcomingSessions();
        
        if (response.data && response.data.success && Array.isArray(response.data.sessions)) {
          const sessions = response.data.sessions;
          setUpcomingSessions(sessions);
          
          // Calculate stats for therapists
          if (isTherapist) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            
            // Count sessions for today, this week, and this month
            const todaySessions = sessions.filter(s => new Date(s.start_time) >= today).length;
            const weekSessions = sessions.filter(s => new Date(s.start_time) >= weekAgo).length;
            const monthSessions = sessions.filter(s => new Date(s.start_time) >= monthAgo).length;
            
            // Get unique client count
            const uniqueClients = new Set(sessions.map(s => s.user_id)).size;
            
            setStats({
              todaySessions,
              weekSessions,
              monthSessions,
              totalClients: uniqueClients
            });
          }
        } else {
          console.warn('Invalid upcoming sessions data format:', response.data);
          setUpcomingSessions([]);
        }
      } catch (err) {
        console.error('Error fetching upcoming sessions:', err);
        setError(prev => ({ ...prev, sessions: 'Failed to load upcoming sessions' }));
        setUpcomingSessions([]);
      } finally {
        setLoading(prev => ({ ...prev, sessions: false }));
      }
    };

    // Fetch past sessions
    const fetchPastSessions = async () => {
      try {
        setLoading(prev => ({ ...prev, sessions: true }));
        const response = await SessionService.getPastSessions({ limit: 5 });
        
        if (response.data && response.data.success && Array.isArray(response.data.sessions)) {
          setPastSessions(response.data.sessions);
        } else {
          console.warn('Invalid past sessions data format:', response.data);
          setPastSessions([]);
        }
      } catch (err) {
        console.error('Error fetching past sessions:', err);
        setError(prev => ({ ...prev, sessions: 'Failed to load session history' }));
        setPastSessions([]);
      } finally {
        setLoading(prev => ({ ...prev, sessions: false }));
      }
    };

    fetchUpcomingSessions();
    fetchPastSessions();
  }, [isLoggedIn, isTherapist]);

  // Render the landing page version for non-logged in users
  if (!isLoggedIn) {
    return <Landing />; // Use the Landing component directly
  }

  // Continue with the rest of your dashboard code...
  // This is your existing therapist dashboard

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      {/* Dashboard Header - Full width background with centered content */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 text-white py-8 shadow-lg relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,100 L0,100 Z" fill="url(#header-pattern)" />
          </svg>
          <defs>
            <pattern id="header-pattern" patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="rotate(45)">
              <rect width="100%" height="100%" fill="none" />
              <circle cx="20" cy="20" r="2" fill="currentColor" opacity="0.5" />
            </pattern>
          </defs>
        </div>
        
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="mb-6 md:mb-0 animate-fadeIn">
              <h1 className="text-3xl font-bold text-shadow">
                {greeting}, {currentUser?.user.username || 'Therapist'}
              </h1>
              <p className="text-indigo-100 mt-1 opacity-90">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-3 animate-slideInRight">
              {isTherapist && (
                <Link 
                  to="/client-management"
                  className="btn-dashboard-header"
                >
                  <Icon icon={UserGroupIcon} size="sm" className="mr-2" />
                  Client Management
                </Link>
              )}
              {Array.isArray(upcomingSessions) && upcomingSessions.length > 0 && upcomingSessions[0] && upcomingSessions[0]._id ? (
                <Link 
                  to={`/sessions/${upcomingSessions[0]._id}`}
                  className="btn-dashboard-header glow-on-hover"
                >
                  <Icon icon={VideoCameraIcon} size="sm" className="mr-2" />
                  Join Next Session
                </Link>
              ) : (
                <div className="btn-dashboard-header opacity-70 cursor-not-allowed">
                  <Icon icon={VideoCameraIcon} size="sm" className="mr-2" />
                  No Upcoming Sessions
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content - Fixed width with proper centering */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tabs - Simplified for therapist */}
        <div className="dashboard-tabs">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px" aria-label="Tabs">
              {['dashboard', 'sessions', 'clients', 'notes'].map((tab) => (
                <button
                  key={tab}
                  className={`tab-button ${
                    activeTab === tab
                    ? 'tab-button-active'
                    : 'tab-button-inactive'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'dashboard' && <Icon icon={ChartPieIcon} size="sm" className="mr-2 inline-flex" />}
                  {tab === 'sessions' && <Icon icon={CalendarIcon} size="sm" className="mr-2 inline-flex" />}
                  {tab === 'clients' && <Icon icon={UserGroupIcon} size="sm" className="mr-2 inline-flex" />}
                  {tab === 'notes' && <Icon icon={DocumentTextIcon} size="sm" className="mr-2 inline-flex" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content - Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Therapist Quick Stats */}
            <div className="col-span-full grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div className="stat-card">
                <div className="stat-icon bg-indigo-100 text-indigo-600">
                  <Icon icon={CalendarIcon} size="md" />
                </div>
                <div>
                  <p className="stat-title">Today's Sessions</p>
                  <p className="stat-value">{stats.todaySessions}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon bg-blue-100 text-blue-600">
                  <Icon icon={ClockIcon} size="md" />
                </div>
                <div>
                  <p className="stat-title">This Week</p>
                  <p className="stat-value">{stats.weekSessions}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon bg-green-100 text-green-600">
                  <Icon icon={CheckCircleIcon} size="md" />
                </div>
                <div>
                  <p className="stat-title">This Month</p>
                  <p className="stat-value">{stats.monthSessions}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon bg-purple-100 text-purple-600">
                  <Icon icon={UserGroupIcon} size="md" />
                </div>
                <div>
                  <p className="stat-title">Active Clients</p>
                  <p className="stat-value">{stats.totalClients}</p>
                </div>
              </div>
            </div>
            
            {/* Next Session Card */}
            <div className="dashboard-card col-span-full lg:col-span-1">
              <div className="card-header">
                <h2 className="card-title">Next Session</h2>
                <Link to="/sessions" className="card-link">
                  View All
                </Link>
              </div>
              
              <div className="card-body">
                {loading.sessions ? (
                  <div className="loading-spinner">
                    <Icon icon={RefreshIcon} size="lg" className="animate-spin text-indigo-600" />
                  </div>
                ) : error.sessions ? (
                  <div className="error-message">
                    <Icon icon={ExclamationCircleIcon} size="md" className="text-red-500" />
                    <p>{error.sessions}</p>
                    <button 
                      onClick={() => window.location.reload()} 
                      className="text-sm text-indigo-600 hover:text-indigo-800 mt-2">
                      Retry
                    </button>
                  </div>
                ) : !Array.isArray(upcomingSessions) || upcomingSessions.length === 0 || !upcomingSessions[0] ? (
                  <div className="empty-state">
                    <Icon icon={CalendarIcon} size="xl" className="text-gray-400 mb-3" />
                    <p>No upcoming sessions</p>
                    <p className="text-sm text-gray-500 mt-2">Your schedule is clear</p>
                  </div>
                ) : (
                  <div className="next-session">
                    <div className="session-date">
                      <div className="date-badge">
                        <span className="month">
                          {upcomingSessions[0].start_time ? 
                            new Date(upcomingSessions[0].start_time).toLocaleDateString('en-US', { month: 'short' }) : 
                            'N/A'}
                        </span>
                        <span className="day">
                          {upcomingSessions[0].start_time ? 
                            new Date(upcomingSessions[0].start_time).getDate() : 
                            '--'}
                        </span>
                      </div>
                      <div className="date-time">
                        <Icon icon={ClockIcon} size="sm" className="text-indigo-600" />
                        <span>
                          {upcomingSessions[0].start_time ? 
                            new Date(upcomingSessions[0].start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                            '--:--'}
                          {' - '}
                          {upcomingSessions[0].end_time ? 
                            new Date(upcomingSessions[0].end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                            '--:--'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="session-details">
                      <h3>{upcomingSessions[0].session_type || 'Therapy'} Session</h3>
                      <p>with {upcomingSessions[0].client_name || 'Client'}</p>
                      
                      <div className="flex gap-2 mt-4">
                        <Link 
                          to={`/sessions/${upcomingSessions[0]._id}`} 
                          className="btn-primary flex-1"
                        >
                          Join Session
                        </Link>
                        <Link
                          to={`/sessions/${upcomingSessions[0]._id}?tab=notes`}
                          className="btn-outline border-indigo-600 text-indigo-600 flex-1"
                        >
                          Add Notes
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Today's Schedule */}
            <div className="dashboard-card col-span-full lg:col-span-2">
              <div className="card-header">
                <h2 className="card-title">Today's Schedule</h2>
                <Link to="/calendar" className="card-link">
                  Full Calendar
                </Link>
              </div>
              
              <div className="card-body p-0">
                {loading.sessions ? (
                  <div className="loading-spinner py-8">
                    <Icon icon={RefreshIcon} size="lg" className="animate-spin text-indigo-600" />
                  </div>
                ) : error.sessions ? (
                  <div className="error-message py-8">
                    <Icon icon={ExclamationCircleIcon} size="md" className="text-red-500" />
                    <p>{error.sessions}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {upcomingSessions
                      .filter(session => {
                        const sessionDate = new Date(session.start_time);
                        const today = new Date();
                        return sessionDate.toDateString() === today.toDateString();
                      })
                      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                      .map(session => (
                        <div key={session._id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center">
                              <div className="bg-indigo-100 rounded-full p-2 mr-4">
                                <Icon icon={session.session_type === 'video' ? VideoCameraIcon : UserIcon} size="sm" className="text-indigo-600" />
                              </div>
                              <div>
                                <p className="font-medium">{session.client_name || 'Client'}</p>
                                <p className="text-sm text-gray-600">{session.session_type || 'Therapy'} Session</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                {session.start_time ? 
                                  new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                                  '--:--'}
                              </p>
                              <p className="text-sm text-gray-600">{session.duration_hours} hour</p>
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <Link 
                              to={`/sessions/${session._id}`}
                              className="text-sm text-indigo-600 hover:text-indigo-800"
                            >
                              View Details
                            </Link>
                            {session.has_active_conversation && (
                              <Link 
                                to={`/messages/${session.conversation_id}`}
                                className="text-sm text-indigo-600 hover:text-indigo-800"
                              >
                                Chat
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                      
                    {(!Array.isArray(upcomingSessions) || 
                      upcomingSessions.filter(s => {
                        const sessionDate = new Date(s.start_time);
                        const today = new Date();
                        return sessionDate.toDateString() === today.toDateString();
                      }).length === 0) && (
                      <div className="text-center py-8">
                        <Icon icon={CalendarIcon} size="lg" className="text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No sessions scheduled for today</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Recent Sessions */}
            <div className="dashboard-card col-span-full">
              <div className="card-header">
                <h2 className="card-title">Recent Sessions</h2>
                <Link to="/sessions" className="card-link">
                  View All
                </Link>
              </div>
              
              <div className="card-body p-0">
                {loading.sessions ? (
                  <div className="loading-spinner">
                    <Icon icon={RefreshIcon} size="lg" className="animate-spin text-indigo-600" />
                  </div>
                ) : error.sessions ? (
                  <div className="error-message">
                    <Icon icon={ExclamationCircleIcon} size="md" className="text-red-500" />
                    <p>{error.sessions}</p>
                  </div>
                ) : !Array.isArray(pastSessions) || pastSessions.length === 0 ? (
                  <div className="empty-state py-8">
                    <Icon icon={VideoCameraIcon} size="xl" className="text-gray-400 mb-3" />
                    <p>No past sessions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Client
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Feedback
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pastSessions.map(session => (
                          <tr key={session._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">
                                {session.start_time ? new Date(session.start_time).toLocaleDateString() : 'N/A'}
                              </span>
                              <div className="text-xs text-gray-500">
                                {session.start_time ? new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{session.client_name || 'Unknown'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{session.session_type || 'Standard'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {session.status || 'Completed'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {session.rating ? (
                                <div className="flex items-center">
                                  <span className="text-sm font-medium mr-1">{session.rating}</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">No feedback</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-3">
                                <Link to={`/sessions/${session._id}`} className="text-indigo-600 hover:text-indigo-900">
                                  View
                                </Link>
                                <Link to={`/sessions/${session._id}?tab=notes`} className="text-indigo-600 hover:text-indigo-900">
                                  Notes
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            
            {/* Client Management Preview */}
            <div className="dashboard-card col-span-full">
              <div className="card-header">
                <h2 className="card-title">Active Clients</h2>
                <Link to="/client-management" className="card-link">
                  View All Clients
                </Link>
              </div>
              
              <div className="card-body p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Session
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Next Session
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Get unique clients from all sessions and display them */}
                      {Array.from(new Set([...upcomingSessions, ...pastSessions]
                        .map(session => session.user_id)))
                        .slice(0, 5)
                        .map(clientId => {
                          const clientSessions = [...upcomingSessions, ...pastSessions]
                            .filter(s => s.user_id === clientId);
                          const client = clientSessions[0] || {};
                          
                          const lastSession = [...pastSessions]
                            .filter(s => s.user_id === clientId)
                            .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];
                          
                          const nextSession = [...upcomingSessions]
                            .filter(s => s.user_id === clientId)
                            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
                          
                          return (
                            <tr key={clientId} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-indigo-700 font-medium">
                                      {(client.client_name || 'C').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{client.client_name || 'Client'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {lastSession ? (
                                  <div>
                                    <div className="text-sm text-gray-900">
                                      {new Date(lastSession.start_time).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {lastSession.session_type} Session
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">No past sessions</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {nextSession ? (
                                  <div>
                                    <div className="text-sm text-gray-900">
                                      {new Date(nextSession.start_time).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(nextSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">No upcoming sessions</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end space-x-3">
                                  <Link to={`/client/${clientId}`} className="text-indigo-600 hover:text-indigo-900">
                                    Profile
                                  </Link>
                                  <Link to={`/notes/${clientId}`} className="text-indigo-600 hover:text-indigo-900">
                                    Notes
                                  </Link>
                                  {nextSession && (
                                    <Link to={`/sessions/${nextSession._id}`} className="text-indigo-600 hover:text-indigo-900">
                                      Next Session
                                    </Link>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        
                      {/* Show empty state if no clients */}
                      {!Array.from(new Set([...upcomingSessions, ...pastSessions].map(session => session.user_id))).length && (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center">
                            <Icon icon={UserGroupIcon} size="lg" className="text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">No active clients yet</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Sessions Tab Content */}
        {activeTab === 'sessions' && (
          <div className="space-y-8">
            <div className="dashboard-card">
              <div className="card-header border-b">
                <h2 className="text-lg font-bold text-gray-800">Your Schedule</h2>
                <div className="flex gap-4">
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                    This Week
                  </button>
                  <button className="text-sm font-medium text-gray-500 hover:text-gray-700">
                    This Month
                  </button>
                  <button className="text-sm font-medium text-gray-500 hover:text-gray-700">
                    All
                  </button>
                </div>
              </div>
              
              <div className="card-body p-0">
                <div className="divide-y divide-gray-200">
                  {loading.sessions ? (
                    <div className="loading-spinner py-10">
                      <Icon icon={RefreshIcon} size="lg" className="animate-spin text-indigo-600" />
                    </div>
                  ) : error.sessions ? (
                    <div className="error-message py-8">
                      <Icon icon={ExclamationCircleIcon} size="md" className="text-red-500" />
                      <p>{error.sessions}</p>
                    </div>
                  ) : upcomingSessions.length === 0 ? (
                    <div className="text-center py-10">
                      <Icon icon={CalendarIcon} size="xl" className="text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No upcoming sessions scheduled</p>
                      <button
                        onClick={() => navigate('/availability')}
                        className="btn-primary mt-4"
                      >
                        Set Your Availability
                      </button>
                    </div>
                  ) : (
                    upcomingSessions.map(session => {
                      const sessionDate = new Date(session.start_time);
                      const today = new Date();
                      const isToday = sessionDate.toDateString() === today.toDateString();
                      
                      return (
                        <div key={session._id} className={`p-4 ${isToday ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                            <div className="flex items-start sm:items-center mb-3 sm:mb-0">
                              <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center mr-3 
                                ${isToday ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>
                                <span className="font-medium">
                                  {sessionDate.getDate()}
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center">
                                  <p className="font-medium">
                                    {isToday ? 'Today' : sessionDate.toLocaleDateString()}
                                  </p>
                                  {isToday && (
                                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-800">
                                      Today
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">
                                  {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                                  {session.duration_hours} hour {session.session_type} with {session.client_name || 'Client'}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Link
                                to={`/sessions/${session._id}`}
                                className="btn-primary text-sm py-1.5"
                              >
                                <Icon icon={VideoCameraIcon} size="sm" className="mr-1" />
                                Join
                              </Link>
                              <Link
                                to={`/sessions/${session._id}?tab=notes`}
                                className="btn-outline text-sm py-1.5 border-indigo-600 text-indigo-600"
                              >
                                <Icon icon={DocumentTextIcon} size="sm" className="mr-1" />
                                Notes
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            
            {/* Past Sessions */}
            <div className="dashboard-card">
              <div className="card-header border-b">
                <h2 className="text-lg font-bold text-gray-800">Past Sessions</h2>
                <Link to="/sessions?filter=past" className="card-link">
                  View All
                </Link>
              </div>
              
              <div className="card-body p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pastSessions.length > 0 ? pastSessions.map(session => (
                        <tr key={session._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(session.start_time).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{session.client_name || 'Unknown'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{session.session_type || 'Standard'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              {session.status || 'Completed'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link to={`/sessions/${session._id}`} className="text-indigo-600 hover:text-indigo-900 mr-3">
                              View
                            </Link>
                            <Link to={`/sessions/${session._id}?tab=notes`} className="text-indigo-600 hover:text-indigo-900">
                              Notes
                            </Link>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-10 text-center">
                            <Icon icon={CalendarIcon} size="lg" className="text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">No past sessions found</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Clients Tab Content */}
        {activeTab === 'clients' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Client Management</h2>
              
              <div className="flex gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search clients..."
                    className="border border-gray-300 rounded-md py-2 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-64"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon icon={MagnifyingGlassIcon} size="sm" className="text-gray-400" />
                  </div>
                </div>
                
                <select className="border border-gray-300 rounded-md py-2 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                  <option value="all">All Clients</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            
            <div className="dashboard-card">
              <div className="card-body p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Session
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Next Session
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Map through unique clients from both past and upcoming sessions */}
                      {Array.from(new Set([...upcomingSessions, ...pastSessions]
                        .map(session => session.user_id)))
                        .map(clientId => {
                          const clientSessions = [...upcomingSessions, ...pastSessions]
                            .filter(s => s.user_id === clientId);
                          const client = clientSessions[0] || {};
                          
                          const lastSession = [...pastSessions]
                            .filter(s => s.user_id === clientId)
                            .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];
                          
                          const nextSession = [...upcomingSessions]
                            .filter(s => s.user_id === clientId)
                            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
                          
                          // Determine client status
                          const hasUpcoming = Boolean(nextSession);
                          const clientStatus = hasUpcoming ? 'Active' : 'Inactive';
                          
                          return (
                            <tr key={clientId} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-indigo-700 font-medium">
                                      {(client.client_name || 'C').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{client.client_name || 'Client'}</div>
                                    <div className="text-xs text-gray-500">{clientSessions.length} sessions</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  hasUpcoming 
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {clientStatus}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {lastSession ? (
                                  <div>
                                    <div className="text-sm text-gray-900">
                                      {new Date(lastSession.start_time).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {lastSession.session_type} Session
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">No past sessions</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {nextSession ? (
                                  <div>
                                    <div className="text-sm text-gray-900">
                                      {new Date(nextSession.start_time).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {new Date(nextSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">No upcoming sessions</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end items-center space-x-3">
                                  <Link to={`/client/${clientId}`} className="text-indigo-600 hover:text-indigo-900">
                                    Profile
                                  </Link>
                                  <Link to={`/notes/${clientId}`} className="text-indigo-600 hover:text-indigo-900">
                                    Notes
                                  </Link>
                                  <button className="text-indigo-600 hover:text-indigo-900">
                                    <Icon icon={PlusCircleIcon} size="sm" className="mr-1 inline-block" />
                                    Schedule
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      
                      {/* Show empty state if no clients */}
                      {!Array.from(new Set([...upcomingSessions, ...pastSessions].map(session => session.user_id))).length && (
                        <tr>
                          <td colSpan="5" className="px-6 py-10 text-center">
                            <Icon icon={UserGroupIcon} size="lg" className="text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">No clients yet</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Notes Tab Content */}
        {activeTab === 'notes' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Session Notes</h2>
              
              <div className="flex gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search notes..."
                    className="border border-gray-300 rounded-md py-2 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-64"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon icon={MagnifyingGlassIcon} size="sm" className="text-gray-400" />
                  </div>
                </div>
                
                <select className="border border-gray-300 rounded-md py-2 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                  <option value="all">All Notes</option>
                  <option value="preparation">Preparation Notes</option>
                  <option value="in_session">In-Session Notes</option>
                  <option value="post_session">Post-Session Notes</option>
                </select>
              </div>
            </div>
            
            <div className="dashboard-card">
              <div className="card-body p-0">
                {/* This could be populated with actual notes data when available */}
                <div className="divide-y divide-gray-200">
                  {pastSessions.length > 0 ? pastSessions.slice(0, 5).map(session => (
                    <div key={session._id} className="p-4 hover:bg-gray-50">
                      <div className="flex flex-col sm:flex-row justify-between mb-2">
                        <div>
                          <h3 className="text-md font-medium text-gray-900">
                            {session.session_type} Session with {session.client_name || 'Client'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {new Date(session.start_time).toLocaleDateString()} at {
                              new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                          </p>
                        </div>
                        <div className="mt-2 sm:mt-0">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            session.notes?.length > 0 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {session.notes?.length > 0 ? 'Notes Added' : 'No Notes'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-3 text-sm text-gray-600 line-clamp-2">
                        {session.notes?.length > 0 
                          ? (session.notes[0].content || 'No content available') 
                          : 'Click to add session notes'}
                      </div>
                      
                      <div className="mt-3 flex justify-end">
                        <Link 
                          to={`/sessions/${session._id}?tab=notes`} 
                          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
                        >
                          <DocumentTextIcon className="h-4 w-4 mr-1" />
                          {session.notes?.length > 0 ? 'View Notes' : 'Add Notes'}
                        </Link>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10">
                      <Icon icon={DocumentTextIcon} size="lg" className="text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No session notes yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conditionally render help chat for new users */}
      {showHelpChat && (
        <HelpChat 
          messages={helpMessages}
          onSendQuery={(query) => {
            // Make API call to get help response
            ChatService.getHelpResponse(query, { is_new_user: isNewUser })
              .then(res => {
                if (res.data.success) {
                  // Add user query to messages
                  const userMessage = {
                    id: `user-${Date.now()}`,
                    content: query,
                    sender_id: currentUser?.user?.id,
                    timestamp: new Date().toISOString(),
                    message_type: 'text'
                  };
                  
                  // Add response to messages
                  const responseMessage = {
                    id: `system-${Date.now()}`,
                    content: res.data.message,
                    sender_id: 'system',
                    timestamp: new Date().toISOString(),
                    message_type: 'help',
                    metadata: {
                      suggestions: res.data.suggestions || [],
                      actions: res.data.actions || []
                    }
                  };
                  
                  setHelpMessages(prev => [...prev, userMessage, responseMessage]);
                }
              })
              .catch(err => {
                console.error("Error getting help response:", err);
              });
          }}
          onClose={() => setShowHelpChat(false)}
        />
      )}
      
      {/* Always show support bubble for easy access */}
      <SupportBubble onClick={() => setShowHelpChat(true)} />
    </div>
  );
};

export default Dashboard;


