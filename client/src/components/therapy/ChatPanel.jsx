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
  
  const MAX_MESSAGES_DISPLAYED = 100; // Limit the number of messages displayed
  
  // Replace the existing useEffect for auto-scrolling (around line 18)
  useEffect(() => {
    // Only scroll if the container exists and only scroll the chat container, not the whole page
    if (messagesEndRef.current) {
      // Use scrollIntoView with specific options to prevent page scrolling
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }
  }, [messages]);
  
  // Add this refreshMessages function around line 30
  const refreshMessages = useCallback(async () => {
    try {
      if (!sessionId || !conversationId) return;
      
      console.log("Refreshing chat messages from database");
      const messagesResponse = await ChatService.getConversationMessages(conversationId);
      
      if (messagesResponse?.data?.messages) {
        // Sort messages by timestamp
        const sortedMessages = messagesResponse.data.messages.sort((a, b) => {
          const aTime = a.sent_at || a.timestamp;
          const bTime = b.sent_at || b.timestamp;
          return new Date(aTime) - new Date(bTime);
        }).slice(-MAX_MESSAGES_DISPLAYED); // Keep only the most recent messages
        
        setMessages(sortedMessages);
        
        // Modify the refreshMessages function to use more targeted scrolling (around line 36)
        setTimeout(() => {
          if (messagesEndRef.current) {
            // Keep the scroll within the chat container only
            const chatContainer = document.querySelector('.chat-messages');
            if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error refreshing messages:", error);
    }
  }, [sessionId, conversationId]);
  
  // Load existing video conversation and messages
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
          
          // Load messages for this video conversation
          const messagesResponse = await ChatService.getConversationMessages(
            videoConversation._id
          );
          
          if (messagesResponse.data.messages) {
            // Sort messages by sent_at or timestamp
            const sortedMessages = messagesResponse.data.messages.sort((a, b) => {
              const aTime = a.sent_at || a.timestamp;
              const bTime = b.sent_at || b.timestamp;
              return new Date(aTime) - new Date(bTime);
            }).slice(-MAX_MESSAGES_DISPLAYED); // Keep only the most recent messages
            
            setMessages(sortedMessages);
          }
        }
      } catch (error) {
        console.error("Error loading video chat messages:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadVideoMessages();
    
    // Listen for new messages from WebSocket - with better logging
    const handleNewMessage = (event) => {
      const newMessage = event.detail;
      console.log("Video chat message received:", newMessage);
      
      // Make sure we don't add duplicate messages
      setMessages(prev => {
        // Check if we already have this message
        if (prev.some(msg => 
            // Check by ID or by content+sender combination
            msg.id === newMessage.id || 
            (msg.content === newMessage.content && 
             msg.sender_id === newMessage.sender_id &&
             Math.abs(new Date(msg.sent_at) - new Date(newMessage.sent_at)) < 5000)
        )) {
          console.log("Duplicate message detected, not adding");
          return prev;
        }
        
        // New message, add it and limit the list size
        const updatedMessages = [...prev, newMessage].slice(-MAX_MESSAGES_DISPLAYED);
        
        // Scroll after render
        setTimeout(() => {
          const chatContainer = document.querySelector('.chat-messages');
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
        }, 100);
        
        return updatedMessages;
      });
    };
    
    // Use more specific event names to avoid conflicts
    const eventName = `video-chat-message-${sessionId}`;
    console.log(`Setting up chat message listener for: ${eventName}`);
    
    window.addEventListener(eventName, handleNewMessage);
    
    // ALSO listen to the general event for backward compatibility
    window.addEventListener('video-chat-message', handleNewMessage);
    
    return () => {
      window.removeEventListener(eventName, handleNewMessage);
      window.removeEventListener('video-chat-message', handleNewMessage);
    };
  }, [sessionId]); // Add sessionId as dependency
  
  // Add this useEffect to periodically refresh messages (around line 90)
  useEffect(() => {
    // Refresh immediately
    refreshMessages();
    
    // Also set up a 10-second refresh interval as backup
    const refreshInterval = setInterval(refreshMessages, 10000);
    
    return () => clearInterval(refreshInterval);
  }, [refreshMessages]);
  
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
    
    setMessages(prev => [...prev, tempMessage]);
    setMessage('');
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
      
      <div className="chat-actions">
        <button 
          onClick={refreshMessages}
          className="refresh-button"
          title="Refresh Messages"
        >
          ↻
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;