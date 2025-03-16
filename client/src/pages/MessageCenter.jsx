import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationList from '../components/chat/ConversationList';
import ChatInterface from '../components/chat/ChatInterface'; 
import ChatContainer from '../components/chat/ChatContainer';
import OnboardingChat from '../components/chat/OnboardingChat.jsx';
import HelpChat from '../components/chat/HelpChat';
import ChatService from '../services/ChatService';
import WebSocketManager from '../utils/WebSocketManager';

const MessageCenter = () => {
  const { currentUser } = useAuth();
  const { conversationId } = useParams();
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [helpMessages, setHelpMessages] = useState([]);
  const navigate = useNavigate();
  
  useEffect(() => {
    const initializeMessageCenter = async () => {
      try {
        setIsLoading(true);
        
        // Load all conversations
        const response = await ChatService.getConversations();
        setConversations(response.data.conversations);
        
        // Check if new user (less than 24h since registration)
        const userTimestamp = new Date(currentUser.created_at).getTime();
        const nowTimestamp = new Date().getTime();
        const dayInMs = 24 * 60 * 60 * 1000;
        setIsNewUser((nowTimestamp - userTimestamp) < dayInMs);
        
        // Show onboarding chat for new users with no conversations
        if (response.data.conversations.length === 0 && isNewUser) {
          setShowHelp(true);
        }
        
      } catch (err) {
        console.error('Error loading message center:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeMessageCenter();
  }, [currentUser]);

  const setupHelpWebSocket = () => {
    const wsPath = `/ws/help/${currentUser?.user?.id}/`;
    const wsUrl = WebSocketManager.getWebSocketUrl(wsPath);
    
    const wsManager = new WebSocketManager(wsUrl, {
      onMessage: (data) => {
        if (data.type === 'chat_message') {
          setHelpMessages(prev => [...prev, {
            id: data.message_id,
            content: data.message,
            sender_id: data.sender_id,
            timestamp: data.timestamp,
            message_type: data.message_type,
            metadata: data.metadata || {},
            read: false
          }]);
        }
      },
      onConnect: () => {
        console.log('Help WebSocket connected');
      },
      onDisconnect: () => {
        console.log('Help WebSocket disconnected');
      }
    });
    
    wsManager.connect();
    return wsManager;
  };

  useEffect(() => {
    if (showHelp) {
      const wsManager = setupHelpWebSocket();
      
      return () => {
        if (wsManager) {
          wsManager.disconnect();
        }
      };
    }
  }, [showHelp, currentUser?.user?.id]);

  const handleSelectConversation = (conversation) => {
    const id = conversation._id || conversation.id;
    console.log("Selected conversation:", id);
    navigate(`/messages/${id}`);
  };
  
  return (
    <div className="flex h-full">
      <div className="w-1/3 border-r">
        <ConversationList 
          activeConversation={{ _id: conversationId }}
          conversations={conversations}
          onSelectConversation={handleSelectConversation}
        />
      </div>
      <div className="w-2/3">
        {conversationId ? (
          <ChatContainer conversationId={conversationId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageCenter;