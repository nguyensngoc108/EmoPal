import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVideoSession } from '../../contexts/VideoSessionContext';
import { useAuth } from '../../contexts/AuthContext';
import ChatService from '../../services/ChatService';

const ChatPanel = ({ sessionId }) => {
  const { currentUser } = useAuth();
  const { sendChatMessage } = useVideoSession();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const lastRefreshTimeRef = useRef(Date.now());
  const pendingRefreshRef = useRef(null);
  const messageHashRef = useRef('');
  
  const MAX_MESSAGES_DISPLAYED = 100;

  // Improved scroll behavior function to avoid page scroll
  const scrollToBottom = useCallback(() => {
    if (!messagesEndRef.current) return;
    
    // Get a reference to the chat container
    const chatContainer = messagesEndRef.current.closest('.chat-messages');
    if (!chatContainer) return;
    
    // Only scroll if we're already near the bottom (don't interrupt manual scrolling)
    const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
    
    if (isNearBottom) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, []);
  
  // Debounced message refresh function
  const refreshMessages = useCallback(async (force = false) => {
    // Prevent rapid successive refreshes
    const now = Date.now();
    if (!force && now - lastRefreshTimeRef.current < 2000) {
      // If refresh requested too soon, schedule a delayed refresh
      if (pendingRefreshRef.current) {
        clearTimeout(pendingRefreshRef.current);
      }
      pendingRefreshRef.current = setTimeout(() => refreshMessages(true), 2000);
      return;
    }
    
    try {
      if (!sessionId || !conversationId) return;
      
      console.log("Refreshing chat messages from database");
      lastRefreshTimeRef.current = now;
      
      const messagesResponse = await ChatService.getConversationMessages(conversationId);
      
      if (messagesResponse?.data?.messages) {
        // Sort messages by timestamp
        const sortedMessages = messagesResponse.data.messages.sort((a, b) => {
          const aTime = a.sent_at || a.timestamp;
          const bTime = b.sent_at || b.timestamp;
          return new Date(aTime) - new Date(bTime);
        }).slice(-MAX_MESSAGES_DISPLAYED);
        
        // Generate message hash to detect changes
        const newHash = JSON.stringify(sortedMessages.map(m => m.id));
        
        // Only update if messages have changed
        if (newHash !== messageHashRef.current) {
          messageHashRef.current = newHash;
          setMessages(sortedMessages);
          
          // Schedule scroll after render
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch (error) {
      console.error("Error refreshing messages:", error);
    }
  }, [sessionId, conversationId, scrollToBottom]);
  
  // Load initial messages
  useEffect(() => {
    if (!sessionId) return;
    
    const loadVideoMessages = async () => {
      try {
        setLoading(true);
        
        // Find video session conversation for this session
        const response = await ChatService.getConversationsByQuery({
          session_id: sessionId,
          conversation_type: 'video_session'
        });
        
        if (response.data.conversations && response.data.conversations.length > 0) {
          const videoConversation = response.data.conversations[0];
          setConversationId(videoConversation._id);
          
          // Load messages for this conversation only once on init
          await refreshMessages(true);
        }
      } catch (error) {
        console.error("Error loading video chat messages:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadVideoMessages();
  }, [sessionId, refreshMessages]);
  
  // Set up event listeners for new messages - more targeted approach
  useEffect(() => {
    if (!sessionId) return;
    
    // Handle new messages arriving via WebSocket
    const handleNewMessage = (event) => {
      const newMessage = event.detail;
      console.log("Video chat message received:", newMessage);
      
      setMessages(prev => {
        // Check if we already have this message by ID
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev; // No change needed
        }
        
        // Check for duplicate message content (just sent)
        if (prev.some(msg => 
            msg.sender_id === newMessage.sender_id &&
            msg.content === newMessage.content &&
            Math.abs(new Date(msg.sent_at || msg.timestamp) - new Date(newMessage.sent_at || newMessage.timestamp)) < 5000
        )) {
          return prev; // Likely duplicate, don't add
        }
        
        // Add new message and schedule scroll
        setTimeout(scrollToBottom, 50);
        
        // New message, add it and limit the list size
        return [...prev, newMessage].slice(-MAX_MESSAGES_DISPLAYED);
      });
    };
    
    // Use session-specific event only for better performance
    const eventName = `video-chat-message-${sessionId}`;
    console.log(`Setting up chat message listener for: ${eventName}`);
    
    window.addEventListener(eventName, handleNewMessage);
    
    return () => {
      window.removeEventListener(eventName, handleNewMessage);
    };
  }, [sessionId, scrollToBottom]);
  
  // Periodic refresh with reduced frequency
  useEffect(() => {
    // No need to refresh immediately here - we already do it in initial load
    
    // Set up a 15-second refresh interval (less frequent)
    const refreshInterval = setInterval(() => refreshMessages(), 15000);
    
    return () => {
      clearInterval(refreshInterval);
      if (pendingRefreshRef.current) {
        clearTimeout(pendingRefreshRef.current);
      }
    };
  }, [refreshMessages]);
  
  // Optimized message sending
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() === '') return;
    
    // Send message through WebSocket
    sendChatMessage(message);
    
    // Add message locally for immediate UI update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.user.id,
      content: message,
      sent_at: new Date().toISOString(),
      message_type: 'text'
    };
    
    // Add new message to UI
    setMessages(prev => [...prev, tempMessage]);
    
    // Clear the input field
    setMessage('');
    
    // Scroll to the new message
    setTimeout(scrollToBottom, 50);
  };
  
  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>Session Chat</h3>
      </div>
      
      <div className="chat-messages">
        {loading ? (
          <div className="empty-chat">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="empty-chat">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              className={`message ${msg.sender_id === currentUser.user.id ? 'sent' : 'received'}`}
            >
              <div className="message-content">{msg.content}</div>
              <div className="message-time">
                {new Date(msg.sent_at || msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit', 
                  minute: '2-digit'
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="message-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit" disabled={!message.trim() || loading}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;