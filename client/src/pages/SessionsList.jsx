import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SessionService from '../services/SessionServices';
import TherapistService from '../services/TherapistServices'; 
import PaymentService from '../services/PaymentServices';
import {
  CalendarIcon, ClockIcon, VideoCameraIcon, ChatBubbleLeftRightIcon,
  ChevronRightIcon, CheckCircleIcon, ArrowPathIcon, ExclamationCircleIcon,
  AdjustmentsHorizontalIcon, CreditCardIcon, UserIcon, DocumentTextIcon,
  ChartBarIcon, StarIcon, FunnelIcon, PencilIcon // Added PencilIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

// Add SessionStatsOverview component to the top of your session list
const SessionsList = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('all'); // 'all', 'week', 'month', 'year'
  const [sortOrder, setSortOrder] = useState('upcoming');
  const [showFilters, setShowFilters] = useState(false);
  const isTherapist = currentUser?.user?.role === 'therapist';

  // Add this new state and effect for session stats
  const [sessionStats, setSessionStats] = useState({
    completedCount: 0,
    upcomingCount: 0,
    totalHours: 0,
    totalSpent: 0,
    averageRating: 0,
    progressMetrics: {
      attendance: 0,
      engagement: 0,
      improvement: 0
    }
  });
  
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get both upcoming and past sessions
        const [upcomingResponse, pastResponse] = await Promise.all([
          SessionService.getUpcomingSessions(),
          SessionService.getPastSessions()
        ]);
        
        // Combine sessions
        const allSessions = [
          ...(upcomingResponse.data.sessions || []),
          ...(pastResponse.data.sessions || [])
        ];
        
        // Fetch payment details if there are sessions
        if (allSessions.length > 0) {
          try {
            const sessionIds = allSessions.map(session => session._id);
            const paymentsResponse = await PaymentService.getPaymentsBySessionIds(sessionIds);
            
            // Map payments to sessions
            const paymentsMap = {};
            if (paymentsResponse.data.payments) {
              paymentsResponse.data.payments.forEach(payment => {
                paymentsMap[payment.session_id] = payment;
              });
            }
            
            // Attach payment details to sessions
            const sessionsWithPayments = allSessions.map(session => ({
              ...session,
              payment: paymentsMap[session._id] || null
            }));
            
            setSessions(sessionsWithPayments);
          } catch (paymentError) {
            console.error("Error fetching payment details:", paymentError);
            // Still set sessions even if payment data fails
            setSessions(allSessions);
          }
        } else {
          setSessions([]);
        }
        
        // We'll calculate stats locally from the session data instead
        // This ensures consistency and avoids potential API issues
        
      } catch (err) {
        console.error("Error loading sessions:", err);
        setError(err.response?.data?.message || "Failed to load sessions");
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessions();
  }, []);

  useEffect(() => {
    // Calculate statistics from the session data
    if (sessions.length > 0) {
      // Better matching with how sessions are grouped in UI
      const stats = {
        completedCount: sessions.filter(s => s.status === 'completed').length,
        upcomingCount: sessions.filter(s => 
          ['scheduled', 'accepted', 'pending_payment'].includes(s.status) && 
          new Date(s.start_time) > new Date()
        ).length + sessions.filter(s => s.status === 'in_progress').length, // Include active sessions
        totalHours: sessions.filter(s => s.status === 'completed')
          .reduce((total, session) => total + (session.duration_hours || 0), 0),
        totalSpent: sessions.filter(s => s.payment_confirmed)
          .reduce((total, session) => total + (session.price || 0), 0),
        averageRating: calculateAverageRating(sessions),
        progressMetrics: calculateProgressMetrics(sessions)
      };
      
      // Log for debugging before setting state
   
      
      setSessionStats(prevStats => {

        const newStats = {...stats};

        return newStats; // Add this return statement!
      });
    }
  }, [sessions]);

  // Calculate average rating from completed sessions
  const calculateAverageRating = (sessionList) => {
    const ratedSessions = sessionList.filter(s => s.rating);
    if (ratedSessions.length === 0) return 0;
    
    const totalRating = ratedSessions.reduce((sum, session) => sum + session.rating, 0);
    return totalRating / ratedSessions.length;
  };
  
  // Calculate progress metrics (simplified representation)
  const calculateProgressMetrics = (sessionList) => {
    // This would be more sophisticated in a real app with real data
    const completedSessions = sessionList.filter(s => s.status === 'completed');
    const total = completedSessions.length;
    
    if (total === 0) {
      return { attendance: 0, engagement: 0, improvement: 0 };
    }
    
    // Example metrics:
    const attendance = completedSessions.filter(s => s.client_joined_at).length / total;
    const engagedSessions = completedSessions.filter(s => 
      s.client_joined_at && s.client_left_at && 
      new Date(s.client_left_at) - new Date(s.client_joined_at) > 0.9 * s.duration_hours * 60 * 60 * 1000
    ).length;
    const engagement = engagedSessions / total;
    
    // This would use actual emotion data in a real implementation
    const improvement = calculateEmotionImprovement(completedSessions);
    
    return {
      attendance: Math.round(attendance * 100),
      engagement: Math.round(engagement * 100),
      improvement: Math.round(improvement * 100)
    };
  };
  
  // Calculate emotion improvement based on session history
  // This is a placeholder function that would use real emotion data
  const calculateEmotionImprovement = (completedSessions) => {
    // In a real app, this would analyze emotion data trends over time
    return completedSessions.length > 0 ? Math.min(75, completedSessions.length * 5) : 0;
  };

  // Filter sessions based on selected criteria
  const filteredSessions = sessions.filter(session => {
    // Filter by status
    if (filterStatus !== 'all' && session.status !== filterStatus) {
      return false;
    }
    
    // Filter by date range
    if (filterDate !== 'all') {
      const sessionDate = new Date(session.start_time);
      const now = new Date();
      
      if (filterDate === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        if (sessionDate < weekAgo) return false;
      } else if (filterDate === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        if (sessionDate < monthAgo) return false;
      } else if (filterDate === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(now.getFullYear() - 1);
        if (sessionDate < yearAgo) return false;
      }
    }
    
    return true;
  });

  // Sort sessions based on selected order
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const dateA = new Date(a.start_time);
    const dateB = new Date(b.start_time);
    
    if (sortOrder === 'upcoming') {
      return dateA - dateB;
    } else if (sortOrder === 'recent') {
      return dateB - dateA;
    } else if (sortOrder === 'price-asc') {
      return a.price - b.price;
    } else if (sortOrder === 'price-desc') {
      return b.price - a.price;
    }
    
    return dateA - dateB; // Default
  });

  // Group sessions by status for easier display
  const groupedSessions = {
    upcoming: sortedSessions.filter(s => 
      ['scheduled', 'accepted', 'pending_payment'].includes(s.status) && 
      new Date(s.start_time) > new Date()
    ),
    active: sortedSessions.filter(s => 
      s.status === 'in_progress'
    ),
    past: sortedSessions.filter(s => 
      ['completed', 'cancelled', 'missed'].includes(s.status) || 
      (s.status !== 'in_progress' && new Date(s.start_time) < new Date())
    )
  };

  const handleJoinSession = (session) => {
    // If session has an active conversation, navigate to messages
    if (session.has_active_conversation && session.conversation_id) {
      navigate(`/messages/${session.conversation_id}`);
    } else {
      // If no conversation exists, don't navigate (could add a notification here)

    }
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  // Format time helper
  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Format currency helper
  const formatCurrency = (amount, currency = 'usd') => {
    if (!amount) return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  // Render session status badge with appropriate color
  const renderStatusBadge = (status) => {
    const statusConfig = {
      scheduled: { color: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
      in_progress: { color: 'bg-green-100 text-green-800', label: 'In Progress' },
      completed: { color: 'bg-gray-100 text-gray-800', label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
      pending_payment: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending Payment' },
      accepted: { color: 'bg-purple-100 text-purple-800', label: 'Accepted' },
      missed: { color: 'bg-red-100 text-red-800', label: 'Missed' }
    };
    
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Check if a session is joinable (within 15 minutes of start time or in progress)
  const isSessionJoinable = (session) => {
    // Always allow joining chat if session has an active conversation
    if (session.has_active_conversation && session.conversation_id) {
      return true;
    }
    
    if (session.status === 'in_progress') return true;
    
    const now = new Date();
    const sessionStart = new Date(session.start_time);
    const timeDiff = (sessionStart - now) / (1000 * 60); // difference in minutes
    
    return (
      session.status === 'scheduled' && 
      session.payment_confirmed &&
      timeDiff <= 15 && 
      timeDiff >= -120 // Can join up to 2 hours after start time
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
        
        <div className="flex space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <FunnelIcon className="w-5 h-5 mr-2" />
            Filter & Sort
          </button>
          
          {isTherapist && (
            <button
              onClick={() => navigate('/sessions/calendar')}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
            >
              <CalendarIcon className="w-5 h-5 mr-2" />
              Calendar View
            </button>
          )}
          
          {!isTherapist && (
            <Link
              to="/therapist-finder"
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
            >
              <UserIcon className="w-5 h-5 mr-2" />
              Find Therapist
            </Link>
          )}
        </div>
      </div>

      {/* Enhanced Filters and sorting options */}
      {showFilters && (
        <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Sessions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="all">All Sessions</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                {!isTherapist && <option value="pending_payment">Pending Payment</option>}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="all">All Time</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="upcoming">Date (Upcoming First)</option>
                <option value="recent">Date (Recent First)</option>
                <option value="price-asc">Price (Low to High)</option>
                <option value="price-desc">Price (High to Low)</option>
              </select>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading and error states */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <ArrowPathIcon className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="ml-2 text-gray-600">Loading sessions...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg mb-6">
          <div className="flex">
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <CalendarIcon className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-base font-medium text-gray-900">No sessions found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isTherapist 
              ? "You don't have any sessions scheduled with clients yet."
              : "You haven't booked any sessions with a therapist yet."}
          </p>
          {!isTherapist && (
            <div className="mt-6">
              <Link 
                to="/therapist-finder"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Find a Therapist
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Add session statistics overview */}
          {!loading && !error && sessions.length > 0 && (
            <div className="mb-8">
              {/* Add key prop to force re-render when stats change + debug log */}
              <SessionStatsOverview 
                key={`stats-${sessionStats.completedCount}-${sessionStats.upcomingCount}`}
                stats={sessionStats} 
                isTherapist={isTherapist}
              />
              {/* Add this debug display during development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 text-xs text-gray-500">
                  Debug: {sessionStats.completedCount} completed, {sessionStats.upcomingCount} upcoming
                </div>
              )}
            </div>
          )}

          {/* Active sessions section */}
          {groupedSessions.active.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
                Active Sessions
              </h2>
              
              <div className="bg-green-50 border border-green-200 rounded-lg overflow-hidden">
                {groupedSessions.active.map(session => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={session._id} 
                    className="p-4 border-b border-green-200 last:border-b-0 flex justify-between items-center transition-all duration-200 ease-in-out hover:bg-green-50"
                  >
                    <div className="flex items-center">
                      <div className="mr-4">
                        <div className="bg-green-100 rounded-full p-3 shadow-inner">
                          {session.session_type === 'video' ? (
                            <VideoCameraIcon className="h-6 w-6 text-green-600" />
                          ) : (
                            <ChatBubbleLeftRightIcon className="h-6 w-6 text-green-600" />
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-gray-900 flex items-center">
                          <span className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                          {isTherapist ? `Session with ${session.client_name || 'Client'}` : `Session with ${session.therapist_name || 'Therapist'}`}
                        </h3>
                        
                        <div className="flex items-center mt-1 text-sm text-gray-500">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          <span>
                            In progress • Started {formatTime(session.start_time)}
                          </span>
                        </div>
                        
                        {/* Display session duration */}
                        <div className="text-xs text-gray-500 mt-1">
                          {session.duration_hours} hour session • {formatCurrency(session.price)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleJoinSession(session)}
                        className="px-4 py-2 text-white rounded-md flex items-center shadow-md bg-indigo-600 hover:bg-indigo-700"
                      >
                        Chat Now
                        <ChevronRightIcon className="ml-2 h-4 w-4" />
                      </button>
                      
                      {isTherapist && (
                        <button
                          onClick={() => navigate(`/sessions/${session._id}?tab=notes`)}
                          className="px-4 py-2 bg-white text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50 flex items-center"
                        >
                          <PencilIcon className="h-4 w-4 mr-2" />
                          Add Note
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming sessions section - Enhanced with more details */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-3">Upcoming Sessions</h2>
            
            {groupedSessions.upcoming.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                <p className="text-gray-500">No upcoming sessions</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-200">
                {groupedSessions.upcoming.map((session, index) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={session._id} 
                    className="p-4 hover:bg-gray-50 transition-all duration-200 ease-in-out rounded-lg mb-3 bg-white border border-gray-200"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start">
                        <div className="bg-gray-100 rounded-lg p-3 mr-4">
                          {session.session_type === 'video' ? (
                            <VideoCameraIcon className="h-6 w-6 text-indigo-600" />
                          ) : (
                            <ChatBubbleLeftRightIcon className="h-6 w-6 text-indigo-600" />
                          )}
                        </div>
                        
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {isTherapist ? `Session with ${session.client_name || 'Client'}` : `Session with ${session.therapist_name || 'Therapist'}`}
                          </h3>
                          
                          <div className="flex items-center mt-1 text-sm text-gray-500">
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            <span>{formatDate(session.start_time)}</span>
                          </div>
                          
                          <div className="flex items-center mt-1 text-sm text-gray-500">
                            <ClockIcon className="h-4 w-4 mr-1" />
                            <span>
                              {formatTime(session.start_time)} - {formatTime(session.end_time)}
                            </span>
                          </div>

                          {/* Session type and duration */}
                          <div className="flex items-center mt-1 text-sm text-gray-500">
                            <DocumentTextIcon className="h-4 w-4 mr-1" />
                            <span>
                              {session.session_type.charAt(0).toUpperCase() + session.session_type.slice(1)} Session • {session.duration_hours} hour{session.duration_hours !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          <div className="mt-2 flex flex-wrap gap-2">
                            {renderStatusBadge(session.status)}
                            
                            {session.payment_confirmed && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                Paid
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(session.price)}
                        </span>
                        
                        <div className="mt-4 flex gap-2">
                          <Link
                            to={`/sessions/${session._id}`}
                            className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1 border border-indigo-600 rounded-md"
                          >
                            Details
                          </Link>
                          
                          {isSessionJoinable(session) && (
                            <button
                              onClick={() => handleJoinSession(session)}
                              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
                            >
                              Chat
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Past sessions section with enhanced session cards */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-3">Past Sessions</h2>
            
            {groupedSessions.past.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                <p className="text-gray-500">No past sessions</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-200">
                {groupedSessions.past.map(session => (
                  <div key={session._id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start">
                        <div className="bg-gray-100 rounded-lg p-3 mr-4">
                          {session.session_type === 'video' ? (
                            <VideoCameraIcon className="h-6 w-6 text-gray-500" />
                          ) : (
                            <ChatBubbleLeftRightIcon className="h-6 w-6 text-gray-500" />
                          )}
                        </div>
                        
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {isTherapist ? `Session with ${session.client_name || 'Client'}` : `Session with ${session.therapist_name || 'Therapist'}`}
                          </h3>
                          
                          <div className="flex items-center mt-1 text-sm text-gray-500">
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            <span>{formatDate(session.start_time)}</span>
                          </div>
                          
                          <div className="flex items-center mt-1 text-sm text-gray-500">
                            <ClockIcon className="h-4 w-4 mr-1" />
                            <span>
                              {formatTime(session.start_time)} - {formatTime(session.end_time)}
                            </span>
                          </div>
                          
                          {/* Display payment status and method if available */}
                          {session.payment && (
                            <div className="flex items-center mt-1 text-sm text-gray-500">
                              <CreditCardIcon className="h-4 w-4 mr-1" />
                              <span>
                                {formatCurrency(session.payment.amount)} • {session.payment.payment_method}
                              </span>
                            </div>
                          )}
                          
                          <div className="mt-2 flex flex-wrap gap-2">
                            {renderStatusBadge(session.status)}
                            
                            {session.payment_confirmed && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                Paid
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <div className="flex items-center">
                          {/* Show stars if there's a rating */}
                          {session.rating && (
                            <div className="flex items-center mr-2">
                              {[...Array(5)].map((_, i) => (
                                <StarIcon 
                                  key={i}
                                  className={`h-4 w-4 ${i < session.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                                />
                              ))}
                            </div>
                          )}
                          <span className="font-medium text-gray-900">
                            {formatCurrency(session.price)}
                          </span>
                        </div>
                        
                        <div className="mt-4 flex gap-2">
                          <Link
                            to={`/sessions/${session._id}`}
                            className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1 border border-indigo-600 rounded-md"
                          >
                            Details
                          </Link>
                          
                          {/* Add feedback button for completed sessions without feedback */}
                          {session.status === 'completed' && !session.has_feedback && !isTherapist && (
                            <Link
                              to={`/sessions/${session._id}?tab=feedback`}
                              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
                            >
                              Give Feedback
                            </Link>
                          )}
                          
                          {/* Add notes button for completed sessions for therapists */}
                          {session.status === 'completed' && isTherapist && (
                            <Link
                              to={`/sessions/${session._id}?tab=notes`}
                              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
                            >
                              {session.notes?.length > 0 ? 'View Notes' : 'Add Notes'}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// New component: SessionStatsOverview
const SessionStatsOverview = ({ stats, isTherapist }) => {
  // Add defensive check - use empty object if stats is undefined
  const safeStats = stats || {};

  
  // Get the session counts with fallbacks
  const completedCount = safeStats.completedCount || 0;
  const upcomingCount = safeStats.upcomingCount || 0;
  const totalCount = completedCount + upcomingCount;
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-100 to-transparent rounded-bl-full -z-10"></div>
      
      <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
        <ChartBarIcon className="h-5 w-5 mr-2 text-indigo-600" />
        Session Overview
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Enhanced stat cards with animations and gradients */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stats-card bg-gradient-to-br from-blue-50 to-white p-4 rounded-lg border border-blue-100"
        >
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-blue-100 shadow-inner">
              <CalendarIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm text-gray-500">Total Sessions</h3>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-semibold"
              >
                {totalCount}
              </motion.p>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {completedCount} completed • {upcomingCount} upcoming
          </div>
        </motion.div>
        
        {/* Similar enhancements for other stat cards */}
      </div>
      
      {/* Enhanced progress bars with animations */}
      {!isTherapist && stats.completedCount > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 pt-6 border-t border-gray-200"
        >
          <h3 className="text-sm font-medium text-gray-700 mb-3">Your Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500">Attendance</span>
                <span className="text-xs font-medium">{stats.progressMetrics.attendance}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.progressMetrics.attendance}%` }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full"
                ></motion.div>
              </div>
            </div>
            
            {/* Similar enhancements for other progress bars */}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Add these improved helper components to end of the file

// Add this right before the component's closing brackets
export default SessionsList;

// Session stats component
const SessionStats = ({ sessions }) => {
  // Calculate statistics
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const upcomingSessions = sessions.filter(s => ['scheduled', 'accepted'].includes(s.status)).length;
  const totalSpent = sessions
    .filter(s => s.payment_confirmed && s.status === 'completed')
    .reduce((sum, session) => sum + (session.price || 0), 0);
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm text-gray-500 font-medium">Completed Sessions</h3>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{completedSessions}</p>
          </div>
          <div className="bg-green-100 p-3 rounded-full">
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm text-gray-500 font-medium">Upcoming Sessions</h3>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{upcomingSessions}</p>
          </div>
          <div className="bg-blue-100 p-3 rounded-full">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm text-gray-500 font-medium">Total Investment</h3>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              ${totalSpent.toFixed(2)}
            </p>
          </div>
          <div className="bg-indigo-100 p-3 rounded-full">
            <CreditCardIcon className="h-6 w-6 text-indigo-600" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Add this right after SessionStats component
const EmptySessionState = ({ isTherapist, onFind }) => {
  return (
    <div className="bg-white shadow-sm rounded-lg p-12 text-center">
      <div className="flex justify-center">
        <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
          <CalendarIcon className="h-8 w-8 text-gray-400" />
        </div>
      </div>
      <h3 className="mt-4 text-lg font-medium text-gray-900">No sessions found</h3>
      <p className="mt-2 text-sm text-gray-500">
        {isTherapist ? (
          "You don't have any sessions scheduled with clients yet. Your availability will be shown to potential clients."
        ) : (
          "You haven't booked any sessions with a therapist yet. Find a therapist to book your first session."
        )}
      </p>
      {!isTherapist && (
        <div className="mt-6">
          <button
            onClick={onFind}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Find a Therapist
          </button>
        </div>
      )}
    </div>
  );
};

// Add this right after EmptySessionState component
const CancelSessionDialog = ({ session, isOpen, onClose, onConfirm, isProcessing }) => {
  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'flex' : 'hidden'} items-center justify-center`}>
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 z-10">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Cancel Session</h3>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to cancel your session scheduled for{" "}
          {session ? new Date(session.start_time).toLocaleDateString() : ""}?
        </p>
        
        {session && new Date(session.start_time) <= new Date(Date.now() + 24 * 60 * 60 * 1000) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <p className="text-sm text-yellow-800">
              <ExclamationCircleIcon className="h-5 w-5 text-yellow-500 inline mr-1" />
              This session is within 24 hours. You may still be charged a cancellation fee.
            </p>
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Keep Session
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                Processing...
              </>
            ) : (
              "Cancel Session"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

