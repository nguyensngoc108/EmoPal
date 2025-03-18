import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SessionService from '../services/SessionServices';
import PaymentService from '../services/PaymentServices';
import FeedbackService from '../services/FeedbackServices.js';
import EmotionService from '../services/EmotionServices';
import {
  CalendarIcon, ClockIcon, VideoCameraIcon, ChatBubbleLeftRightIcon,
  CreditCardIcon, UserIcon, DocumentTextIcon, ChartBarIcon, StarIcon,
  ArrowLeftIcon, CheckBadgeIcon, ExclamationCircleIcon, ArrowPathIcon,
  PaperAirplaneIcon, PencilIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);


const showSuccessEffect = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
};

const pageVariants = {
  initial: { opacity: 0 },
  in: { opacity: 1 },
  out: { opacity: 0 }
};

const tabVariants = {
  initial: { opacity: 0, y: 10 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -10 }
};

const SessionDetail = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isTherapist = currentUser?.user?.role === 'therapist';
  
  const [session, setSession] = useState(null);
  const [payment, setPayment] = useState(null);
  const [therapistNotes, setTherapistNotes] = useState([]);
  const [userFeedback, setUserFeedback] = useState(null);
  const [emotionData, setEmotionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabActive, setTabActive] = useState('overview');
  
  // Feedback form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  
  // Note form state (for therapists)
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Emotion analysis state
  const [emotionTimeRange, setEmotionTimeRange] = useState('full');

  // Add these new state variables 
const [noteType, setNoteType] = useState(() => {
  // Set default note type based on session status
  if (session?.status === 'completed') return 'post_session';
  if (session?.status === 'in_progress') return 'in_session';
  return 'preparation';
});



  useEffect(() => {
    const fetchSessionDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch session details
        const sessionResponse = await SessionService.getSessionById(sessionId);
        
        if (!sessionResponse.data.success) {
          throw new Error(sessionResponse.data.message || 'Failed to load session');
        }
        
        const sessionData = sessionResponse.data.session;
        console.log('Session Data:', sessionData);
        setSession(sessionData);

        // Only fetch payment details if the user is NOT a therapist
        if (sessionData.payment_confirmed && !isTherapist) {
          try {
            const paymentResponse = await PaymentService.getPaymentBySessionId(sessionId);
            if (paymentResponse.data.success) {
              setPayment(paymentResponse.data.payment);
            }
          } catch (paymentError) {
            console.error("Error fetching payment details:", paymentError);
            // Don't break the whole page if payment info fails
          }
        }
        
        const notesResponse = await SessionService.getSessionNotes(sessionId);
        if (notesResponse.data.success) {
          setTherapistNotes(notesResponse.data.notes || []);
        }
        
        // Fetch user feedback
        if (sessionData.status === 'completed') {
          const feedbackResponse = await FeedbackService.getSessionFeedback(sessionId);
          if (feedbackResponse.data.success) {
            setUserFeedback(feedbackResponse.data.feedback);
          }
        }
        
        // Fetch emotion data if completed
        if (sessionData.status === 'completed' && sessionData.session_type === 'video') {
          const emotionResponse = await EmotionService.getSessionEmotionData(sessionId);
          if (emotionResponse.data.success) {
            setEmotionData(emotionResponse.data.emotion_data);
          }
        }
        
      } catch (err) {
        console.error('Error fetching session details:', err);
        setError(err.message || 'Failed to load session details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessionDetails();
  }, [sessionId, isTherapist]);

  // Add this at the top of your component to handle tab query parameter
useEffect(() => {
  // Check if there's a tab parameter in the URL
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam && ['overview', 'notes', 'emotions', 'feedback'].includes(tabParam)) {
    setTabActive(tabParam);
  }
}, []);

  // Handle submitting feedback
  const handleSubmitFeedback = async () => {
    if (feedbackRating === 0) return;
    
    try {
      setSubmittingFeedback(true);
      const response = await FeedbackService.submitFeedback(sessionId, {
        rating: feedbackRating,
        comment: feedbackComment
      });
      
      if (response.data.success) {
        setUserFeedback({
          rating: feedbackRating,
          comment: feedbackComment,
          created_at: new Date().toISOString()
        });
        setShowFeedbackForm(false);
        showSuccessEffect();
      } else {
        throw new Error(response.data.message || 'Failed to submit feedback');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Handle submitting therapist note
  const handleSubmitNote = async () => {
    if (!noteContent.trim()) return;
    
    try {
      setSubmittingNote(true);
      const response = await SessionService.addSessionNote(sessionId, {
        content: noteContent,
        type: noteType // Add note type
      });
      
      if (response.data.success) {
        const newNote = {
          _id: response.data.note_id,
          content: noteContent,
          type: noteType,
          created_at: new Date().toISOString(),
          author: currentUser.user.username
        };
        
        setTherapistNotes(prev => [...prev, newNote]);
        setShowNoteForm(false);
        setNoteContent('');
        showSuccessEffect();
      } else {
        throw new Error(response.data.message || 'Failed to add note');
      }
    } catch (err) {
      console.error('Error submitting note:', err);
      alert('Failed to add note. Please try again.');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Format date and time
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount, currency = 'usd') => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  // Render status badge with appropriate color
  const renderStatusBadge = (status) => {
    const statusConfig = {
      scheduled: { color: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
      in_progress: { color: 'bg-green-100 text-green-800', label: 'In Progress' },
      completed: { color: 'bg-gray-100 text-gray-800', label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
      missed: { color: 'bg-red-100 text-red-800', label: 'Missed' },
    };
    
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Check if session is joinable
  const isSessionJoinable = () => {
    if (!session) return false;
    if (session.status === 'in_progress') return true;
    
    const now = new Date();
    const sessionStart = new Date(session.start_time);
    const timeDiff = (sessionStart - now) / (1000 * 60); // difference in minutes
    
    return (
      session.status === 'scheduled' && 
      timeDiff <= 15 && 
      timeDiff >= -120 // Can join up to 2 hours after start time
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4 flex justify-center">
        <div className="flex flex-col items-center">
          <ArrowPathIcon className="h-12 w-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-gray-600">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="bg-red-50 p-4 rounded-lg mb-6">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-6 w-6 text-red-500 mr-3" />
            <p className="text-red-700">{error || 'Session not found'}</p>
          </div>
        </div>
        <div className="mt-6">
          <Link 
            to="/sessions" 
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-1" />
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
      className="container mx-auto py-8 px-4"
    >
      {/* Back button */}
      <div className="mb-6">
        <Link 
          to="/sessions" 
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Sessions
        </Link>
      </div>

      {/* Enhanced session header */}
      <motion.div 
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6 overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-50 to-transparent rounded-bl-full -z-0"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 mr-3">
                {session.session_type.charAt(0).toUpperCase() + session.session_type.slice(1)} Session
              </h1>
              {renderStatusBadge(session.status)}
            </div>
            <p className="text-gray-600 mt-1">
              {isTherapist 
                ? `With ${session.client_name || 'Client'}`
                : `With ${session.therapist_name || 'Therapist'}`}
            </p>
          </div>

          {isSessionJoinable() && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/video-session/${session._id}`)}
              className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-md shadow-md flex items-center transition-all"
            >
              <VideoCameraIcon className="h-5 w-5 mr-2" />
              Join Session
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Enhanced tabs navigation with indicator animation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex -mb-px relative">
          {/* Add an animated indicator */}
          <motion.div 
            className="absolute bottom-0 h-0.5 bg-indigo-500"
            initial={false}
            animate={{ 
              left: tabActive === 'overview' ? '2%' : 
                   tabActive === 'notes' ? '15%' : 
                   tabActive === 'emotions' ? '35%' : '55%',
              width: tabActive === 'overview' ? '75px' : 
                    tabActive === 'notes' ? '110px' : 
                    tabActive === 'emotions' ? '130px' : '100px'
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
          
          <button
            onClick={() => setTabActive('overview')}
            className={`mr-8 py-4 px-1 font-medium text-sm transition-colors ${
              tabActive === 'overview'
                ? 'text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          
          {/* Notes tab - available for all session statuses */}
          <button
            onClick={() => setTabActive('notes')}
            className={`mr-8 py-4 px-1 font-medium text-sm transition-colors ${
              tabActive === 'notes'
                ? 'text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {isTherapist ? 'Session Notes' : 'Therapist Guidance'}
          </button>
          
          {/* Feedback tab - only for completed sessions */}
          {session.status === 'completed' && (
            <>
              {session.session_type === 'video' && (
                <button
                  onClick={() => setTabActive('emotions')}
                  className={`mr-8 py-4 px-1 font-medium text-sm transition-colors ${
                    tabActive === 'emotions'
                      ? 'text-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Emotional Analysis
                </button>
              )}
              
              <button
                onClick={() => setTabActive('feedback')}
                className={`mr-8 py-4 px-1 font-medium text-sm transition-colors ${
                  tabActive === 'feedback'
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {isTherapist ? 'Client Feedback' : 'Your Feedback'}
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Tab content with animations */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {tabActive === 'overview' && (
          <motion.div 
            variants={tabVariants}
            initial="initial"
            animate="in"
            exit="out"
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Session Information Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-indigo-600" />
                Session Information
              </h2>

              <div className="space-y-3">
                <div className="flex items-start">
                  <CalendarIcon className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Date</p>
                    <p className="text-sm text-gray-600">{formatDate(session.start_time)}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <ClockIcon className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Time</p>
                    <p className="text-sm text-gray-600">
                      {formatTime(session.start_time)} - {formatTime(session.end_time)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-gray-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Duration</p>
                    <p className="text-sm text-gray-600">{session.duration_hours} hour{session.duration_hours !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  {session.session_type === 'video' ? (
                    <VideoCameraIcon className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                  ) : (
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">Session Type</p>
                    <p className="text-sm text-gray-600">
                      {session.session_type.charAt(0).toUpperCase() + session.session_type.slice(1)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-gray-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Status</p>
                    <div className="mt-1">
                      {renderStatusBadge(session.status)}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Payment Information Card - Only show for clients, not therapists */}
            {!isTherapist && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CreditCardIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Payment Information
                </h2>
                
                {payment ? (
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <CreditCardIcon className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Amount</p>
                        <p className="text-sm text-gray-600">{formatCurrency(session.price)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-gray-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Payment Method</p>
                        <p className="text-sm text-gray-600">{payment.payment_method || 'Credit Card'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <CalendarIcon className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Payment Date</p>
                        <p className="text-sm text-gray-600">{formatDate(payment.created_at)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <CheckBadgeIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Status</p>
                        <p className="text-sm text-green-600">Confirmed</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  session.payment_confirmed ? (
                    <div className="text-center py-6">
                      <CreditCardIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Loading payment details...</p>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CreditCardIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No payment information available</p>
                    </div>
                  )
                )}
              </motion.div>
            )}

            {/* Person Information Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <UserIcon className="h-5 w-5 mr-2 text-indigo-600" />
                {isTherapist ? 'Client Information' : 'Therapist Information'}
              </h2>

              <div className="space-y-3">
                <div className="flex items-start">
                  <UserIcon className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Name</p>
                    <p className="text-sm text-gray-600">
                      {isTherapist ? session.client_name : session.therapist_name}
                    </p>
                  </div>
                </div>
                
                {session.has_active_conversation && (
                  <div className="mt-4">
                    <button
                      onClick={() => navigate(`/messages/${session.conversation_id}`)}
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                      Go to Chat
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        
        {/* Notes/Guidance Tab with enhanced styling */}
        {tabActive === 'notes' && (
          <motion.div 
            variants={tabVariants}
            initial="initial"
            animate="in"
            exit="out"
            className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <DocumentTextIcon className="h-5 w-5 mr-2 text-indigo-600" />
                {isTherapist ? 'Session Notes' : 'Therapist Guidance'}
              </h2>
              
              {/* Allow therapists to add notes for any session status */}
              {isTherapist && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowNoteForm(true)}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md shadow-sm hover:shadow-md flex items-center transition-all"
                >
                  <PencilIcon className="h-5 w-5 mr-2" />
                  {therapistNotes.length > 0 ? 'Add Note' : 'Add First Note'}
                </motion.button>
              )}
            </div>
            
            {/* Display notes with different context based on session status */}
            {therapistNotes.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {isTherapist 
                    ? session.status === 'completed' 
                      ? 'No session notes added yet. Add your first note to help track client progress.'
                      : session.status === 'in_progress' 
                        ? 'Add notes during the session to record important observations.'
                        : 'Add preparation notes or things to discuss in the upcoming session.'
                    : "Your therapist hasn't added any notes for this session yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {therapistNotes.map((note, index) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={note._id} 
                    className={`rounded-lg p-5 shadow-sm border ${
                      // Different styling based on note type
                      note.type === 'preparation' ? 'bg-blue-50 border-blue-100' :
                      note.type === 'in_session' ? 'bg-green-50 border-green-100' :
                      'bg-indigo-50 border-indigo-100'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-medium text-gray-900 flex items-center">
                        {note.type === 'preparation' ? (
                          <svg className="w-4 h-4 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path>
                          </svg>
                        ) : note.type === 'in_session' ? (
                          <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 mr-1 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                          </svg>
                        )}
                        {note.type === 'preparation' ? 'Preparation Note' : 
                         note.type === 'in_session' ? 'In-Session Note' : 
                         `Session Note ${therapistNotes.length - index}`}
                      </h3>
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                        {formatDate(note.created_at)} at {formatTime(note.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </motion.div>
                ))}
              </div>
            )}
            
            {/* Enhanced note form modal with note type selection */}
            {isTherapist && showNoteForm && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-lg p-6 max-w-xl w-full mx-4 shadow-xl"
                >
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <PencilIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Add Session Note
                  </h3>
                  
                  {/* Note type selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Note Type</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="noteType"
                          value="preparation"
                          checked={noteType === 'preparation'}
                          onChange={() => setNoteType('preparation')}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Preparation</span>
                      </label>
                      
                      {session.status === 'in_progress' && (
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="noteType"
                            value="in_session"
                            checked={noteType === 'in_session'}
                            onChange={() => setNoteType('in_session')}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                          />
                          <span className="ml-2 text-sm text-gray-700">In-Session</span>
                        </label>
                      )}
                      
                      {session.status === 'completed' && (
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="noteType"
                            value="post_session"
                            checked={noteType === 'post_session'}
                            onChange={() => setNoteType('post_session')}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                          />
                          <span className="ml-2 text-sm text-gray-700">Post-Session</span>
                        </label>
                      )}
                    </div>
                  </div>
                  
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-3 h-48 mb-5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder={noteType === 'preparation' 
                      ? "Enter preparation notes, topics to discuss, or goals for the session..."
                      : noteType === 'in_session'
                      ? "Enter real-time observations, client statements, or interventions used..."
                      : "Enter your post-session notes, observations, or guidance for the client..."
                    }
                  ></textarea>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowNoteForm(false);
                        setNoteContent('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitNote}
                      disabled={!noteContent.trim() || submittingNote}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {submittingNote ? 'Submitting...' : 'Submit Note'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
        
        {/* Emotions Tab */}
        {tabActive === 'emotions' && (
          <motion.div 
            variants={tabVariants}
            initial="initial"
            animate="in"
            exit="out"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Emotional Analysis
              </h2>
              
              <div>
                <select 
                  className="border border-gray-300 rounded-md py-1 px-2 text-sm"
                  value={emotionTimeRange || 'full'}
                  onChange={e => setEmotionTimeRange(e.target.value)}
                >
                  <option value="full">Full Session</option>
                  <option value="first-15">First 15 Minutes</option>
                  <option value="middle">Middle Section</option>
                  <option value="last-15">Last 15 Minutes</option>
                </select>
              </div>
            </div>
            
            {!emotionData ? (
              <div className="text-center py-12">
                <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  Emotion data is not available for this session
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Emotion Overview Section */}
                <div className="emotion-overview">
                  <h3 className="text-md font-medium text-gray-800 mb-4">
                    Emotion Distribution
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Emotion distribution chart */}
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-600 mb-3">
                        Primary Emotions
                      </h4>
                      <div className="h-64">
                        <EmotionPieChart data={emotionData} />
                      </div>
                    </div>
                    
                    {/* Emotion metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border border-gray-200 rounded-lg bg-blue-50">
                        <h4 className="text-sm font-medium text-gray-600 mb-1">
                          Average Valence
                        </h4>
                        <p className="text-2xl font-semibold">
                          {emotionData.average_valence ? 
                            `${(emotionData.average_valence * 100).toFixed(0)}%` : 
                            'N/A'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {getValenceDescription(emotionData.average_valence)}
                        </p>
                      </div>
                      
                      <div className="p-4 border border-gray-200 rounded-lg bg-purple-50">
                        <h4 className="text-sm font-medium text-gray-600 mb-1">
                          Average Engagement
                        </h4>
                        <p className="text-2xl font-semibold">
                          {emotionData.average_engagement ? 
                            `${(emotionData.average_engagement).toFixed(0)}%` : 
                            'N/A'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {getEngagementDescription(emotionData.average_engagement)}
                        </p>
                      </div>
                      
                      <div className="p-4 border border-gray-200 rounded-lg bg-green-50">
                        <h4 className="text-sm font-medium text-gray-600 mb-1">
                          Peak Positive Emotion
                        </h4>
                        <p className="text-xl font-semibold">
                          {getPeakEmotion(emotionData, 'positive')}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Most intense positive emotion
                        </p>
                      </div>
                      
                      <div className="p-4 border border-gray-200 rounded-lg bg-red-50">
                        <h4 className="text-sm font-medium text-gray-600 mb-1">
                          Peak Negative Emotion
                        </h4>
                        <p className="text-xl font-semibold">
                          {getPeakEmotion(emotionData, 'negative')}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Most intense negative emotion
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Emotion Timeline Section */}
                <div className="emotion-timeline">
                  <h3 className="text-md font-medium text-gray-800 mb-4">
                    Emotion Timeline
                  </h3>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="h-80">
                      <EmotionTimelineChart data={emotionData} />
                    </div>
                  </div>
                </div>
                
                {/* Key Moments Section */}
                <div className="emotion-key-moments">
                  <h3 className="text-md font-medium text-gray-800 mb-4">
                    Key Emotional Moments
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {emotionData.key_moments?.map((moment, index) => (
                      <div 
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center">
                            <div className={`rounded-full p-1.5 ${getEmotionColorClass(moment.emotion)}`}>
                              <span className="block h-2 w-2 rounded-full bg-white"></span>
                            </div>
                            <h4 className="text-sm font-medium text-gray-700 ml-2">
                              {formatEmotionName(moment.emotion)}
                            </h4>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatMinuteSecond(moment.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          {moment.description || `Significant ${formatEmotionName(moment.emotion).toLowerCase()} response detected.`}
                        </p>
                      </div>
                    ))}
                    
                    {(!emotionData.key_moments || emotionData.key_moments.length === 0) && (
                      <div className="col-span-2 p-6 border border-gray-200 rounded-lg bg-gray-50 text-center">
                        <p className="text-gray-500">No significant emotional moments detected.</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Comparative Analysis Section - for recurring clients */}
                {emotionData.historical_comparison && (
                  <div className="emotion-comparison">
                    <h3 className="text-md font-medium text-gray-800 mb-4">
                      Progress Comparison
                    </h3>
                    
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="h-64">
                        <EmotionProgressChart data={emotionData.historical_comparison} />
                      </div>
                      
                      <div className="mt-4 text-sm text-gray-600">
                        <p>
                          {getProgressSummary(emotionData.historical_comparison)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Therapist-only insights section */}
                {isTherapist && (
                  <div className="therapist-insights">
                    <h3 className="text-md font-medium text-gray-800 mb-4">
                      Therapeutic Insights
                    </h3>
                    
                    <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700">
                            Key Observations
                          </h4>
                          <p className="text-sm text-gray-600">
                            {emotionData.insights?.observations || 
                             "Client showed varied emotional responses during the session. Consider exploring triggers for emotional shifts."}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700">
                            Suggested Focus Areas
                          </h4>
                          <ul className="list-disc pl-5 text-sm text-gray-600">
                            {emotionData.insights?.suggestions?.map((suggestion, i) => (
                              <li key={i}>{suggestion}</li>
                            )) || (
                              <>
                                <li>Explore emotional regulation techniques</li>
                                <li>Discuss potential triggers for negative emotions</li>
                                <li>Build on positive emotional responses</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
        
        {/* Feedback Tab */}
        {tabActive === 'feedback' && (
          <motion.div 
            variants={tabVariants}
            initial="initial"
            animate="in"
            exit="out"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {isTherapist ? 'Client Feedback' : 'Your Feedback'}
              </h2>
              
              {!isTherapist && !userFeedback && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowFeedbackForm(true)}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md shadow-sm hover:shadow-md flex items-center transition-all"
                >
                  <StarIcon className="h-5 w-5 mr-2" />
                  Leave Feedback
                </motion.button>
              )}
            </div>
            
            {userFeedback ? (
              <div className="space-y-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <StarIconSolid 
                      key={i}
                      className={`h-6 w-6 ${i < userFeedback.rating ? 'text-yellow-400' : 'text-gray-300'}`} 
                    />
                  ))}
                </div>
                <p className="text-gray-700">{userFeedback.comment}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(userFeedback.created_at)} at {formatTime(userFeedback.created_at)}
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <StarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {isTherapist 
                    ? 'No feedback from the client yet.'
                    : 'You have not left feedback for this session yet.'}
                </p>
              </div>
            )}
            
            {/* Feedback form */}
            {!isTherapist && showFeedbackForm && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-lg p-6 max-w-xl w-full mx-4 shadow-xl"
                >
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <StarIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Leave Feedback
                  </h3>
                  
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setFeedbackRating(i + 1)}
                        className={`h-8 w-8 ${i < feedbackRating ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        <StarIconSolid className="h-full w-full" />
                      </button>
                    ))}
                  </div>
                  
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-3 h-32 mb-5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="Enter your feedback..."
                  ></textarea>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowFeedbackForm(false);
                        setFeedbackRating(0);
                        setFeedbackComment('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleSubmitFeedback();
                        showSuccessEffect();
                      }}
                      disabled={feedbackRating === 0 || submittingFeedback}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-md hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Emotion pie chart component
const EmotionPieChart = ({ data }) => {
  const chartData = {
    labels: Object.keys(data.emotion_distribution || {}).map(formatEmotionName),
    datasets: [
      {
        data: Object.values(data.emotion_distribution || {}),
        backgroundColor: [
          '#36c75e', // happy - green
          '#3498db', // sad - blue 
          '#e74c3c', // angry - red
          '#f39c12', // fear - orange
          '#95a5a6', // neutral - gray
          '#9b59b6', // surprise - purple
          '#795548'  // disgust - brown
        ],
        borderWidth: 1
      }
    ]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label}: ${(value * 100).toFixed(0)}%`;
          }
        }
      }
    }
  };
  
  return <Pie data={chartData} options={options} />;
};

// Emotion timeline chart component
const EmotionTimelineChart = ({ data }) => {
  const timepoints = data.timeline?.map(point => formatMinuteSecond(point.timestamp)) || [];
  
  const datasets = [
    {
      label: 'Valence',
      data: data.timeline?.map(point => point.valence * 100) || [],
      borderColor: 'rgb(53, 162, 235)',
      backgroundColor: 'rgba(53, 162, 235, 0.5)',
      yAxisID: 'y'
    },
    {
      label: 'Engagement',
      data: data.timeline?.map(point => point.engagement) || [],
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
      yAxisID: 'y1'
    }
  ];
  
  const chartData = {
    labels: timepoints,
    datasets: datasets
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    stacked: false,
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Valence %'
        },
        min: -100,
        max: 100
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Engagement %'
        },
        min: 0,
        max: 100,
        grid: {
          drawOnChartArea: false,
        },
      },
    }
  };
  
  return <Line data={chartData} options={options} />;
};

// Emotion progress chart component
const EmotionProgressChart = ({ data }) => {
  const chartData = {
    labels: ['Positive Emotions', 'Negative Emotions', 'Engagement', 'Emotional Range'],
    datasets: [
      {
        label: 'Previous Sessions (avg)',
        data: [
          data.previous.positive_emotions * 100,
          data.previous.negative_emotions * 100,
          data.previous.engagement,
          data.previous.emotional_range * 100
        ],
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'Current Session',
        data: [
          data.current.positive_emotions * 100,
          data.current.negative_emotions * 100,
          data.current.engagement,
          data.current.emotional_range * 100
        ],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: 'Value %'
        }
      }
    }
  };
  
  return <Bar data={chartData} options={options} />;
};

// Helper functions for emotion analysis display
const formatEmotionName = (emotion) => {
  if (!emotion) return 'Unknown';
  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
};

const formatMinuteSecond = (timestamp) => {
  if (!timestamp) return '00:00';
  
  const minutes = Math.floor(timestamp / 60);
  const seconds = Math.floor(timestamp % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const getEmotionColorClass = (emotion) => {
  const colorMap = {
    happy: 'bg-green-500',
    sad: 'bg-blue-500',
    angry: 'bg-red-500',
    fear: 'bg-orange-500',
    neutral: 'bg-gray-500',
    surprise: 'bg-purple-500',
    disgust: 'bg-brown-500'
  };
  
  return colorMap[emotion?.toLowerCase()] || 'bg-gray-500';
};

const getValenceDescription = (valence) => {
  if (valence === null || valence === undefined) return 'No data available';
  
  if (valence > 0.5) return 'Strongly positive emotional state';
  if (valence > 0.2) return 'Moderately positive emotional state';
  if (valence > -0.2) return 'Neutral emotional state';
  if (valence > -0.5) return 'Moderately negative emotional state';
  return 'Strongly negative emotional state';
};

const getEngagementDescription = (engagement) => {
  if (engagement === null || engagement === undefined) return 'No data available';
  
  if (engagement > 80) return 'Very high engagement';
  if (engagement > 60) return 'High engagement';
  if (engagement > 40) return 'Moderate engagement';
  if (engagement > 20) return 'Low engagement';
  return 'Very low engagement';
};

const getPeakEmotion = (data, type) => {
  if (!data.peak_emotions) return 'N/A';
  
  const emotionMap = {
    positive: ['happy', 'surprise'],
    negative: ['sad', 'angry', 'fear', 'disgust']
  };
  
  let highest = { emotion: 'none', intensity: 0 };
  
  Object.entries(data.peak_emotions).forEach(([emotion, intensity]) => {
    if (emotionMap[type].includes(emotion) && intensity > highest.intensity) {
      highest = { emotion, intensity };
    }
  });
  
  return highest.emotion !== 'none' 
    ? `${formatEmotionName(highest.emotion)} (${(highest.intensity * 100).toFixed(0)}%)` 
    : 'N/A';
};

const getProgressSummary = (comparison) => {
  if (!comparison) return 'No comparative data available.';
  
  const positiveChange = comparison.current.positive_emotions - comparison.previous.positive_emotions;
  const engagementChange = comparison.current.engagement - comparison.previous.engagement;
  
  let message = '';
  
  if (positiveChange > 0.1) {
    message += `Positive emotions have increased by ${(positiveChange * 100).toFixed(0)}% compared to previous sessions. `;
  } else if (positiveChange < -0.1) {
    message += `Positive emotions have decreased by ${Math.abs(positiveChange * 100).toFixed(0)}% compared to previous sessions. `;
  } else {
    message += 'Positive emotion levels are consistent with previous sessions. ';
  }
  
  if (engagementChange > 10) {
    message += `Client engagement has improved significantly (+${engagementChange.toFixed(0)}%).`;
  } else if (engagementChange < -10) {
    message += `Client engagement has decreased (${engagementChange.toFixed(0)}%).`;
  } else {
    message += 'Engagement levels remain stable.';
  }
  
  return message;
};

export default SessionDetail;
