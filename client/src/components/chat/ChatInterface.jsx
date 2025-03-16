import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VideoCallScheduler from './VideoCallScheduler';
import ActivePlanInfo from './ActivePlanInfo';
import ChatService from '../../services/ChatService';
import WebSocketManager from '../../utils/WebSocketManager';

const ChatInterface = () => {
  // Get conversationId from URL params instead of planId
  const { conversationId } = useParams();
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [conversationDetails, setConversationDetails] = useState(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const messageEndRef = useRef(null);
  const socket = useRef(null);
  const host = process.env.REACT_APP_CHAT_HOST || 'localhost:8001';
  // Get conversation details and load initial messages
  useEffect(() => {
    const initializeChat = async () => {
      try {
        setLoading(true);
                                                           
        // Check if conversationId is valid before making API calls
        if (!conversationId || conversationId === 'undefined') {
          setError("Invalid conversation ID. Please select a valid conversation.");
          setLoading(false);
          return;
        }
        
        // Get conversation details
        const conversationRes = await ChatService.getConversationDetails(conversationId);
        setConversationDetails(conversationRes.data.conversation);
        
        // Determine if this is a therapy session or plan conversation
        const convoType = conversationRes.data.conversation.conversation_type;
        
        if (convoType === 'therapy_session') {
          // Get session details
          const sessionId = conversationRes.data.conversation.session_id;
          const sessionRes = await ChatService.getSessionDetails(sessionId);
          setSessionDetails(sessionRes.data.session);
          
          // Get therapist details
          const therapistId = sessionRes.data.session.therapist_id;
          const therapistRes = await ChatService.getTherapistDetails(therapistId);
          setTherapist(therapistRes.data.therapist);
        } else if (convoType === 'therapy_plan') {
          // Handle therapy plan conversations if needed in the future
          const planId = conversationRes.data.conversation.plan_id;
          const planRes = await ChatService.getPlanDetails(planId);
          setSessionDetails(planRes.data.plan); 
          setTherapist(planRes.data.therapist);
        }
        
        // Load messages for the conversation
        const messagesRes = await ChatService.getConversationMessages(conversationId);
        setMessages(messagesRes.data.messages);
        
        // Initialize WebSocket connection
        initializeWebSocket(conversationId);
        
      } catch (err) {
        console.error("Error initializing chat:", err);
        setError("Failed to load chat. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    initializeChat();
    
    return () => {
      // Clean up WebSocket connection
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [conversationId]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Initialize WebSocket connection
  const initializeWebSocket = (conversationId) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}/ws/chat/conversation/${conversationId}/${currentUser?.user?.id}/`;
    
    // Create WebSocket manager
    const wsManager = new WebSocketManager(
      wsUrl,
      // onMessage handler
      (data) => {
        if (data.type === 'chat_message') {
          setMessages(prev => [...prev, {
            id: data.message_id,
            content: data.message,
            sender_id: data.sender_id,
            sender_name: data.sender_name || 'Unknown',
            timestamp: data.timestamp,
            read: false
          }]);
        } else if (data.type === 'read_receipt') {
          // Update read status for messages
          setMessages(prev => prev.map(msg => 
            data.message_ids.includes(msg.id) ? {...msg, read: true} : msg
          ));
        }
      },
      // onConnect handler
      () => {
        console.log('WebSocket connection established');
      },
      // onDisconnect handler
      () => {
        console.log('WebSocket connection closed');
      },
      // onError handler
      (error) => {
        console.error('WebSocket error:', error);
        setError("Connection error. Please refresh the page.");
      }
    );
    
    // Connect and store the manager
    wsManager.connect();
    socket.current = wsManager;
  };
  
  // Send a new message
  const sendMessage = (content) => {
    if (!socket.current || !socket.current.isConnected()) {
      setError("Connection lost. Please refresh the page.");
      return;
    }
    
    socket.current.send({
      type: 'chat_message',
      message: content
    });
  };
  
  // Schedule a video session
  const scheduleVideoSession = async (startTime) => {
    try {
      await ChatService.scheduleVideoSession(conversationId, startTime);
      setShowScheduler(false);
      
      // Reload session details to get updated video session count
      const sessionRes = await ChatService.getSessionDetails(conversationId);
      setSessionDetails(sessionRes.data.session);
    } catch (err) {
      console.error("Error scheduling video session:", err);
      setError("Failed to schedule video session. Please try again.");
    }
  };
  
  if (loading) {
    return <div className="flex justify-center p-8">Loading conversation...</div>;
  }
  
  if (error) {
    return <div className="text-red-500 p-8">{error}</div>;
  }
  
  return (
    <div className="flex flex-col h-full border rounded-lg">
      <ChatHeader 
        therapist={therapist} 
        onScheduleCall={() => setShowScheduler(true)}
        videoSessionsLeft={sessionDetails.video_sessions_allowed - sessionDetails.video_sessions_used}
      />
      
      <div className="flex-grow overflow-y-auto p-4 bg-gray-50">
        <ActivePlanInfo plan={sessionDetails} />
        
        <SessionContinuityPrompt 
          sessionDetails={sessionDetails} 
          onBookFollowUp={() => setShowScheduler(true)} 
        />
        
        <MessageList 
          messages={messages} 
          currentUserId={currentUser?.user?.id} 
        />
        
        <div ref={messageEndRef} />
      </div>
      
      <MessageInput onSendMessage={sendMessage} />
      
      {showScheduler && (
        <VideoCallScheduler 
          therapistId={therapist._id}
          onSchedule={scheduleVideoSession}
          onCancel={() => setShowScheduler(false)}
          remainingSessions={sessionDetails.video_sessions_allowed - sessionDetails.video_sessions_used}
        />
      )}
    </div>
  );
};

const SessionContinuityPrompt = ({ sessionDetails, onBookFollowUp }) => {
  // Only show this component if the session is completed or nearing end
  const now = new Date();
  const sessionEnd = new Date(sessionDetails.end_time);
  const showFollowUpPrompt = now > sessionEnd || 
    (sessionEnd - now) < (30 * 60 * 1000); // 30 min before end
  
  if (!showFollowUpPrompt) return null;
  
  return (
    <div className="border rounded-lg p-4 bg-indigo-50 mb-4">
      <h3 className="font-medium text-indigo-900">Continue Your Progress</h3>
      <p className="text-sm text-indigo-700 mt-1">
        Would you like to schedule a follow-up session with your therapist?
      </p>
      <div className="mt-3">
        <button 
          onClick={onBookFollowUp}
          className="px-3 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
          Book Follow-Up Session
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;