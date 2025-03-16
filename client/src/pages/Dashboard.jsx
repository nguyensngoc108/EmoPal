import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Chart from 'chart.js/auto';
import { useAuth } from '../contexts/AuthContext';
import SessionService from '../services/SessionServices';
import EmotionService from '../services/EmotionServices';
import PaymentService from '../services/PaymentServices';
import '../styles/Dashboard.css';

// Import icons - use proper path for Heroicons v2
import { 
  CalendarIcon, 
  ChartPieIcon, 
  CreditCardIcon, 
  UserGroupIcon, 
  PlusCircleIcon, 
  ArrowRightIcon,
  ClockIcon,
  VideoCameraIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon as RefreshIcon,
  UserIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

// Add this import for the TherapistCard component
import TherapistCard from '../components/therapist-finder/TherapistCard';
import TherapistService from '../services/TherapistServices';
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
  
  // Chart references
  const emotionChartRef = useRef(null);
  const engagementChartRef = useRef(null);
  
  // State management
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [emotionAnalyses, setEmotionAnalyses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState({
    sessions: true,
    analyses: true,
    payments: true
  });
  const [error, setError] = useState({});
  const [activeTab, setActiveTab] = useState('dashboard');
  const [greeting, setGreeting] = useState('');
  const [recommendedTherapists, setRecommendedTherapists] = useState([]);
  const [loadingTherapists, setLoadingTherapists] = useState(false);
  const [therapistsError, setTherapistsError] = useState(null);
  const isNewUser = currentUser?.isNewUser || false;
  const [showHelpChat, setShowHelpChat] = useState(isNewUser);
  const [helpMessages, setHelpMessages] = useState([]);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  // Fetch data when logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    
    // Fetch upcoming sessions
    const fetchUpcomingSessions = async () => {
      try {
        setLoading(prev => ({ ...prev, sessions: true }));
        const response = await SessionService.getUpcomingSessions();
        
        // Ensure we're storing an array
        if (response.data && response.data.success && Array.isArray(response.data.sessions)) {
          setUpcomingSessions(response.data.sessions);
        } else {
          console.warn('Invalid upcoming sessions data format:', response.data);
          setUpcomingSessions([]);  // Reset to empty array
        }
      } catch (err) {
        console.error('Error fetching upcoming sessions:', err);
        setError(prev => ({ ...prev, sessions: 'Failed to load upcoming sessions' }));
        setUpcomingSessions([]);  // Reset to empty array on error
      } finally {
        setLoading(prev => ({ ...prev, sessions: false }));
      }
    };

    // Fetch past sessions
    const fetchPastSessions = async () => {
      try {
        setLoading(prev => ({ ...prev, sessions: true }));
        const response = await SessionService.getPastSessions({ limit: 5 });
        
        // Ensure we're storing an array
        if (response.data && response.data.success && Array.isArray(response.data.sessions)) {
          setPastSessions(response.data.sessions);
        } else {
          console.warn('Invalid past sessions data format:', response.data);
          setPastSessions([]);  // Reset to empty array
        }
      } catch (err) {
        console.error('Error fetching past sessions:', err);
        setError(prev => ({ ...prev, sessions: 'Failed to load session history' }));
        setPastSessions([]);  // Reset to empty array on error
      } finally {
        setLoading(prev => ({ ...prev, sessions: false }));
      }
    };

    // Fetch emotion analyses
    const fetchEmotionAnalyses = async () => {
      if (isTherapist) return;
      try {
        setLoading(prev => ({ ...prev, analyses: true }));
        const response = await EmotionService.getUserAnalyses();
        setEmotionAnalyses(response.data.analyses || []);
        
        // Initialize charts after data is loaded
        if (response.data.analyses && response.data.analyses.length > 0) {
          initializeCharts(response.data.analyses);
        }
      } catch (err) {
        setError(prev => ({ ...prev, analyses: 'Failed to load emotion analyses' }));
        console.error('Error fetching analyses:', err);
      } finally {
        setLoading(prev => ({ ...prev, analyses: false }));
      }
    };

    // Fetch payment history
    const fetchPayments = async () => {
      try {
        setLoading(prev => ({ ...prev, payments: true }));
        const response = await PaymentService.getPaymentHistory();
        
        // FIX: Store just the payment_history array, not the entire response
        setPayments(response.data.payment_history || []);
      } catch (err) {
        setError(prev => ({ ...prev, payments: 'Failed to load payment history' }));
        console.error('Error fetching payments:', err);
      } finally {
        setLoading(prev => ({ ...prev, payments: false }));
      }
    };

    fetchUpcomingSessions();
    fetchPastSessions();
    fetchEmotionAnalyses();
    fetchPayments();
  }, [isLoggedIn, isTherapist]);

  useEffect(() => {
    if (!isLoggedIn || isTherapist) return;
    
    const fetchRecommendedTherapists = async () => {
      try {
        setLoadingTherapists(true);
        setTherapistsError(null);
        const response = await TherapistService.getTherapists({ recommended: true, limit: 3 });
        
        if (response.data && response.data.therapists) {
          setRecommendedTherapists(response.data.therapists);
        } else {
          setRecommendedTherapists([]);
        }
      } catch (err) {
        console.error("Error fetching recommended therapists:", err);
        setTherapistsError("Failed to load recommended therapists");
      } finally {
        setLoadingTherapists(false);
      }
    };
    
    fetchRecommendedTherapists();
  }, [isLoggedIn, isTherapist]);

  // Initialize charts with emotion data
  const initializeCharts = (analyses) => {
    // Destroy existing charts if they exist
    if (emotionChartRef.current) {
      emotionChartRef.current.destroy();
    }
    if (engagementChartRef.current) {
      engagementChartRef.current.destroy();
    }

    // Get the most recent analyses (last 7)
    const recentAnalyses = analyses.slice(-7);

    // Create emotion chart
    if (document.getElementById('emotionChart')) {
      emotionChartRef.current = new Chart(
        document.getElementById('emotionChart'),
        {
          type: 'bar',
          data: {
            labels: recentAnalyses.map(a => new Date(a.created_at).toLocaleDateString()),
            datasets: [
              {
                label: 'Happy',
                data: recentAnalyses.map(a => a.emotions?.happy || 0),
                backgroundColor: 'rgba(34, 197, 94, 0.6)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 2,
                borderRadius: 4,
                barThickness: 12,
              },
              {
                label: 'Sad',
                data: recentAnalyses.map(a => a.emotions?.sad || 0),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                borderRadius: 4,
                barThickness: 12,
              },
              {
                label: 'Neutral',
                data: recentAnalyses.map(a => a.emotions?.neutral || 0),
                backgroundColor: 'rgba(156, 163, 175, 0.6)',
                borderColor: 'rgba(156, 163, 175, 1)',
                borderWidth: 2,
                borderRadius: 4,
                barThickness: 12,
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Emotion Distribution'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                max: 1,
                ticks: {
                  callback: (value) => `${Math.round(value * 100)}%`
                }
              }
            }
          }
        }
      );
    }

    // Create engagement chart
    if (document.getElementById('engagementChart')) {
      engagementChartRef.current = new Chart(
        document.getElementById('engagementChart'),
        {
          type: 'line',
          data: {
            labels: recentAnalyses.map(a => new Date(a.created_at).toLocaleDateString()),
            datasets: [
              {
                label: 'Engagement',
                data: recentAnalyses.map(a => a.engagement * 100),
                backgroundColor: 'rgba(79, 70, 229, 0.2)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: 'rgba(79, 70, 229, 1)'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Session Engagement'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  callback: (value) => `${value}%`
                }
              }
            }
          }
        }
      );
    }
  };

  // Render the landing page version for non-logged in users
  if (!isLoggedIn) {
    return (
      <div className="bg-gradient-to-b from-indigo-50 to-white min-h-screen">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-indigo-800 text-white">
          <div className="absolute inset-0 opacity-20">
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
          
          <div className="container mx-auto px-4 py-24 md:py-32 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Transform Your <span className="text-indigo-300">Therapy</span> Experience
              </h1>
              <p className="text-xl md:text-2xl text-indigo-100 mb-8">
                AI-powered emotion recognition for more effective therapy sessions
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/register" className="btn-primary text-center py-3 px-6 text-lg">
                  Sign Up Now
                </Link>
                <Link to="/login" className="btn-outline border-white text-white hover:bg-white/10 text-center py-3 px-6 text-lg">
                  Login
                </Link>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-indigo-50 to-transparent"></div>
        </div>
        
        {/* Features Section */}
        <div className="container mx-auto px-4 py-16 md:py-24">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            How It Works
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="feature-card">
              <div className="feature-icon bg-indigo-100 text-indigo-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 mx-auto">
                <Icon icon={VideoCameraIcon} size="lg" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-3">Virtual Sessions</h3>
              <p className="text-gray-600 text-center">
                Connect with therapists remotely through secure video sessions from the comfort of your home.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon bg-purple-100 text-purple-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 mx-auto">
                <Icon icon={ChartPieIcon} size="lg" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-3">Emotion Analysis</h3>
              <p className="text-gray-600 text-center">
                AI technology analyzes facial expressions to help therapists better understand your emotional responses.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon bg-green-100 text-green-600 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 mx-auto">
                <Icon icon={UserGroupIcon} size="lg" />
              </div>
              <h3 className="text-xl font-semibold text-center mb-3">Expert Therapists</h3>
              <p className="text-gray-600 text-center">
                Connect with licensed professionals specialized in various therapeutic approaches.
              </p>
            </div>
          </div>
        </div>
        
        {/* Benefits Section */}
        <div className="bg-gray-50 py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="md:w-1/2">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">
                  Benefits of Emotion Recognition in Therapy
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="bg-indigo-500 rounded-full p-2 mr-4 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-1">More Effective Sessions</h3>
                      <p className="text-gray-600">
                        Therapists gain deeper insights into your emotional state, enabling more targeted interventions.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-indigo-500 rounded-full p-2 mr-4 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-1">Track Your Progress</h3>
                      <p className="text-gray-600">
                        Monitor your emotional patterns over time and see your therapeutic journey unfold.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-indigo-500 rounded-full p-2 mr-4 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-800 mb-1">Personalized Approach</h3>
                      <p className="text-gray-600">
                        Receive therapy that adapts to your specific emotional responses and needs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="md:w-1/2">
                <img 
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                  alt="Therapy session" 
                  className="rounded-lg shadow-xl max-w-full"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Therapy Experience?</h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto mb-10">Join thousands of users who have enhanced their mental health journey with EmoPalt.</p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/register" className="inline-flex items-center justify-center px-6 py-3 bg-white text-indigo-700 font-medium rounded-md shadow-sm hover:bg-gray-100 transition-colors duration-200">
                Get Started Now
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center px-6 py-3 bg-transparent border border-white text-white font-medium rounded-md hover:bg-white/10 transition-colors duration-200">
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render the dashboard for logged-in users
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Dashboard Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 text-white py-8 px-4 sm:px-6 lg:px-8 shadow-lg relative overflow-hidden">
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
        
        <div className="container mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="mb-6 md:mb-0">
              <h1 className="text-3xl font-bold">{greeting}, {currentUser?.user.username || 'User'}</h1>
              <p className="text-indigo-100 mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-3">
              <Link 
                to="/therapist-finder" 
                className="btn-dashboard-header"
              >
                <Icon icon={PlusCircleIcon} size="sm" className="mr-2" />
                Find Therapist
              </Link>
              <Link 
                to={Array.isArray(upcomingSessions) && upcomingSessions.length > 0 && upcomingSessions[0] && upcomingSessions[0]._id ? 
                    `/sessions/${upcomingSessions[0]._id}` : 
                    '/sessions'} 
                className={`btn-dashboard-header ${!Array.isArray(upcomingSessions) || upcomingSessions.length === 0 || !upcomingSessions[0] ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={(e) => {
                  if (!Array.isArray(upcomingSessions) || upcomingSessions.length === 0 || !upcomingSessions[0]) {
                    e.preventDefault();
                  }
                }}
              >
                <Icon icon={VideoCameraIcon} size="sm" className="mr-2" />
                {Array.isArray(upcomingSessions) && upcomingSessions.length > 0 && upcomingSessions[0] ? 
                  'Join Next Session' : 
                  'No Upcoming Sessions'}
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto py-8 px-4">
        {/* Dashboard Tabs */}
        <div className="dashboard-tabs">
        <div className="border-b border-gray-200">
            <nav className="flex -mb-px" aria-label="Tabs">
            {['dashboard', 'therapists', 'sessions', 'insights'].map((tab) => (
                <button
                key={tab}
                className={`tab-button ${
                    activeTab === tab
                    ? 'tab-button-active'
                    : 'tab-button-inactive'
                }`}
                onClick={() => setActiveTab(tab)}
                >
                {tab === 'dashboard' && <Icon icon={UserGroupIcon} size="sm" className="mr-2 inline-flex" />}
                {tab === 'therapists' && <Icon icon={UserIcon} size="sm" className="mr-2 inline-flex" />}
                {tab === 'sessions' && <Icon icon={CalendarIcon} size="sm" className="mr-2 inline-flex" />}
                {tab === 'insights' && <Icon icon={ChartPieIcon} size="sm" className="mr-2 inline-flex" />}
                {/* {tab === 'payments' && <Icon icon={CreditCardIcon} size="sm" className="mr-2 inline-flex" />} */}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
            </nav>
        </div>
        </div>
        {/* Main Content - Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <div className="col-span-full grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div className="stat-card">
                <div className="stat-icon bg-indigo-100 text-indigo-600">
                  <Icon icon={CalendarIcon} size="md" />
                </div>
                <div>
                  <p className="stat-title">Upcoming</p>
                  <p className="stat-value">{upcomingSessions.length}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon bg-green-100 text-green-600">
                  <Icon icon={CheckCircleIcon} size="md" />
                </div>
                <div>
                  <p className="stat-title">Completed</p>
                  <p className="stat-value">{pastSessions.length}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon bg-purple-100 text-purple-600">
                  <Icon icon={ChartPieIcon} size="md" />
                </div>
                <div>
                  <p className="stat-title">Analyses</p>
                  <p className="stat-value">{emotionAnalyses.length}</p>
                </div>
              </div>
              
              {/* <div className="stat-card">
                <div className="stat-icon bg-blue-100 text-blue-600">
                  <Icon icon={CreditCardIcon} size="md" />
                </div>
                <div>
                  <p className="stat-title">Total Spend</p>
                  <p className="stat-value">
                    ${Array.isArray(payments) ? 
                      payments
                        .filter(p => p.status === 'completed' || p.status === 'Completed')
                        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                        .toFixed(2) 
                      : '0.00'}
                  </p>
                </div>
              </div> */}
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
                  </div>
                ) : !Array.isArray(upcomingSessions) || upcomingSessions.length === 0 || !upcomingSessions[0] ? (
                  <div className="empty-state">
                    <Icon icon={CalendarIcon} size="xl" className="text-gray-400 mb-3" />
                    <p>No upcoming sessions</p>
                    <Link to="/therapists" className="btn-primary mt-4">
                      Find a Therapist
                    </Link>
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
                      <p>with {upcomingSessions[0].therapist_name || 'Your Therapist'}</p>
                      
                      <Link 
                        to={`/sessions/${upcomingSessions[0]._id}`} 
                        className="btn-primary mt-4"
                      >
                        Join Session
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Emotion Analysis Charts */}
            <div className="dashboard-card col-span-full lg:col-span-2">
              <div className="card-header">
                <h2 className="card-title">Emotional Insights</h2>
                <Link to="/emotions" className="card-link">
                  View All
                </Link>
              </div>
              
              <div className="card-body">
                {loading.analyses ? (
                  <div className="loading-spinner">
                    <Icon icon={RefreshIcon} size="lg" className="animate-spin text-indigo-600" />
                  </div>
                ) : error.analyses ? (
                  <div className="error-message">
                    <Icon icon={ExclamationCircleIcon} size="md" className="text-red-500" />
                    <p>{error.analyses}</p>
                  </div>
                ) : emotionAnalyses.length === 0 ? (
                  <div className="empty-state">
                    <Icon icon={ChartPieIcon} size="xl" className="text-gray-400 mb-3" />
                    <p>No emotion data available yet</p>
                    <p className="text-sm text-gray-500 mt-1">Complete a session to see your emotional insights</p>
                  </div>
                ) : (
                  <div className="charts-container">
                    <div className="charts-grid">
                      <div className="chart-wrapper">
                        <canvas id="emotionChart" height="200"></canvas>
                      </div>
                      <div className="chart-wrapper">
                        <canvas id="engagementChart" height="200"></canvas>
                      </div>
                    </div>
                    <div className="insights-summary mt-4 pt-4 border-t border-gray-100">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Latest Insight</h4>
                      <p className="text-sm text-gray-600">{getLatestInsight(emotionAnalyses)}</p>
                    </div>
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
                            Therapist
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
                              <div className="text-sm text-gray-900">{session.therapist_name || 'Unknown'}</div>
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
                              <Link to={`/sessions/${session._id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                View
                              </Link>
                              {session.has_recording && (
                                <Link to={`/sessions/${session._id}/recording`} className="text-indigo-600 hover:text-indigo-900">
                                  Recording
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Featured Therapists */}
            {!isTherapist && (
              <div className="dashboard-card col-span-full">
                <div className="card-header">
                  <h2 className="card-title">Featured Therapists</h2>
                  <Link to="/therapist-finder" className="card-link">
                    Find More
                  </Link>
                </div>
                
                <div className="card-body">
                  {loadingTherapists ? (
                    <div className="loading-spinner">
                      <Icon icon={RefreshIcon} size="lg" className="animate-spin text-indigo-600" />
                    </div>
                  ) : therapistsError ? (
                    <div className="error-message">
                      <Icon icon={ExclamationCircleIcon} size="md" className="text-red-500" />
                      <p>{therapistsError}</p>
                    </div>
                  ) : recommendedTherapists.length === 0 ? (
                    <div className="empty-state py-8">
                      <Icon icon={UserIcon} size="xl" className="text-gray-400 mb-3" />
                      <p>No recommended therapists yet</p>
                      <Link to="/therapist-finder" className="btn-primary mt-4">
                        Find Therapists
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {recommendedTherapists.map(therapist => (
                        <TherapistCard 
                          key={therapist._id}
                          therapist={therapist}
                          onViewProfile={() => navigate(`/therapists/${therapist._id}`)}
                          onBookSession={(t) => navigate(`/therapists/${t._id}`)}
                        />
                      ))}
                      
                      <div className="text-center mt-4">
                        <Link 
                          to="/therapist-finder" 
                          className="btn-outline border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-6 py-2 rounded-md inline-flex items-center"
                        >
                          <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                          Find Your Ideal Match
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Sessions Tab Content */}
        {activeTab === 'sessions' && (
          <SessionsTabContent 
            upcomingSessions={upcomingSessions} 
            pastSessions={pastSessions}
            isLoading={loading.sessions}
            error={error.sessions}
          />
        )}
        
        {/* Insights Tab Content */}
        {activeTab === 'insights' && (
          <InsightsTabContent 
            emotionAnalyses={emotionAnalyses}
            isLoading={loading.analyses}
            error={error.analyses}
          />
        )}
        
        {/* Payments Tab Content */}
        {/* {activeTab === 'payments' && (
          <PaymentsTabContent 
            payments={payments}
            isLoading={loading.payments}
            error={error.payments}
          />
        )} */}

        {/* Therapists Tab Content */}
        {activeTab === 'therapists' && (
          <TherapistsTabContent />
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

// Helper function to get the latest insight from emotion analyses
const getLatestInsight = (analyses) => {
  if (!analyses || analyses.length === 0) return 'No insights available yet.';
  
  const latestAnalysis = analyses[analyses.length - 1];
  
  if (latestAnalysis.insights && latestAnalysis.insights.length > 0) {
    return latestAnalysis.insights[0];
  } else {
    // Generate a simple insight based on available data
    const dominantEmotion = Object.entries(latestAnalysis.emotions || {})
      .sort((a, b) => b[1] - a[1])[0];
      
    if (dominantEmotion) {
      return `Your dominant emotion was ${dominantEmotion[0]} at ${Math.round(dominantEmotion[1] * 100)}%. ${
        dominantEmotion[0] === 'happy' ? 'Great job maintaining a positive state!' :
        dominantEmotion[0] === 'neutral' ? 'You maintained a balanced emotional state.' :
        'Consider discussing these emotions with your therapist.'
      }`;
    }
    
    return 'Emotion data was recorded but no specific insights are available.';
  }
};

// Placeholder components for tab content
const SessionsTabContent = ({ upcomingSessions, pastSessions, isLoading, error }) => {
  // Add defensive checks
  const upcomingList = Array.isArray(upcomingSessions) ? upcomingSessions : [];
  const pastList = Array.isArray(pastSessions) ? pastSessions : [];
  
  return (
    <div>
      {/* Use upcomingList and pastList instead of the props directly */}
      {/* ... */}
    </div>
  );
};

const InsightsTabContent = ({ emotionAnalyses, isLoading, error }) => {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-800">Emotional Insights</h2>
      
      {/* Implementation of detailed insights view */}
    </div>
  );
};

const PaymentsTabContent = ({ payments, isLoading, error }) => {
  // Add defensive check to ensure payments is an array
  const paymentsList = Array.isArray(payments) ? payments : [];

  return (
    <div className="dashboard-card">
      {/* Use paymentsList instead of payments directly */}
      {/* ... */}
    </div>
  );
};

// Add this with your other tab content components at the bottom of Dashboard.jsx
// import { useNavigate } from 'react-router-dom';

const TherapistsTabContent = () => {
  const navigate = useNavigate();
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    specialization: '',
    gender: '',
    priceRange: [0, 500],
    rating: 0
  });
  
  useEffect(() => {
    const fetchTherapists = async () => {
      try {
        setLoading(true);
        const response = await TherapistService.getTherapists();
        setTherapists(response.data.therapists || []);
      } catch (err) {
        console.error("Error fetching therapists:", err);
        setError("Failed to load therapists");
      } finally {
        setLoading(false);
      }
    };
    
    fetchTherapists();
  }, []);
  
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Find a Therapist</h2>
        
        <Link 
          to="/therapist-finder" 
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Advanced Search
        </Link>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-500 mb-2">{error}</div>
          <button 
            onClick={() => window.location.reload()}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {therapists.map(therapist => (
            <TherapistCard 
              key={therapist._id}
              therapist={therapist}
              onViewProfile={() => navigate(`/therapists/${therapist._id}`)}
              onBookSession={(t) => navigate(`/therapists/${t._id}`)}
            />
          ))}
        </div>
      )}
      
      <div className="text-center py-6">
        <p className="text-gray-600 mb-4">Not finding what you're looking for?</p>
        <Link 
          to="/therapist-finder" 
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Take Our Matching Quiz
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
