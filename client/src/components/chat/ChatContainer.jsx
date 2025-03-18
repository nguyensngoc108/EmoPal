import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { VideoCameraIcon } from '@heroicons/react/24/outline';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import HelpChat from './HelpChat';
import SupportBubble from './SupportBubble';
import ChatService from '../../services/ChatService';
import SessionService from '../../services/SessionServices';
import PaymentModal from '../common/PaymentModal';
import LoadingSpinner from '../common/LoadingSpinner.jsx';

// Add this function at the top of the file
const logWithTimestamp = (message, data) => {
  const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
  console.log(`[${timestamp}] ${message}`, data);
};

// Add this helper function at the appropriate scope
const sortMessages = (messages) => {
  return [...messages].sort((a, b) => {
    // First compare by timestamp
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    
    // If timestamps are the same (within 1 second), use sequence number
    if (Math.abs(timeA - timeB) < 1000) {
      return (a.sequence || 0) - (b.sequence || 0);
    }
    
    // Otherwise sort by timestamp
    return timeA - timeB;
  });
};

const getWsHost = () => {
  // First check localStorage for override
  const localStorageHost = localStorage.getItem('wsHost');
  if (localStorageHost) {
    console.log(`Using WebSocket host from localStorage: ${localStorageHost}`);
    return localStorageHost;
  }
  
  // Then check environment variable
  const envHost = process.env.REACT_APP_CHAT_HOST;
  if (envHost) {
    console.log(`Using WebSocket host from environment: ${envHost}`);
    return envHost;
  }
  
  // Default fallback
  return 'localhost:8001';
};

const ChatContainer = ({ 
  conversationType = 'therapist', // 'therapist', 'system', 'help'
  recipientId = null,
  sessionId = null,
  conversationId = null,
  showHelpByDefault = false
}) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(showHelpByDefault);
  const [recipient, setRecipient] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isSessionActive, setIsSessionActive] = useState(true);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [showVideoCallBanner, setShowVideoCallBanner] = useState(false);
  const [isVideoSessionActive, setIsVideoSessionActive] = useState(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingSessionData, setPendingSessionData] = useState(null);
  const userRole = currentUser?.user?.role;
  const processedMessagesRef = useRef(new Set());
  const processedMessages = processedMessagesRef.current;
  const [recipientStatus, setRecipientStatus] = useState('offline');
  const [messageQueue, setMessageQueue] = useState([]);

  // Add after the userRole line and before WebSocket refs
  const messageContainerRef = useRef(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  // WebSocket refs
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const hasInitializedRef = useRef(false);
  // console.log('currentUser:', currentUser);

  // Add this function to scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
      setShowScrollToBottom(false);
      setIsAtBottom(true);
    }
  }, []);

  // Move refreshMessages before initializeWebSocket and sendMessage

  // First define this function around line 80-90, before initializeWebSocket
  const refreshMessages = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      console.log("Refreshing messages from database for conversation:", conversationId);
      const messagesResponse = await ChatService.getConversationMessages(conversationId, 1, PAGE_SIZE);
      
      if (messagesResponse?.data?.messages) {
        const standardizedMessages = messagesResponse.data.messages.map(msg => ({
          id: msg.id || msg._id,
          content: msg.content,
          sender_id: msg.sender_id,
          timestamp: msg.timestamp || msg.sent_at,
          message_type: msg.message_type || 'text',
          metadata: msg.metadata || {},
          read: Boolean(msg.read),
          sequence: msg.sequence || 0
        }));
        
        // Add new message IDs to processed set
        standardizedMessages.forEach(msg => {
          processedMessages.add(msg.id);
        });
        
        // Update messages but preserve pending messages
        setMessages(prev => {
          // Keep pending messages that aren't in the standardized set
          const pendingMessages = prev.filter(
            msg => msg.pending && !standardizedMessages.some(sm => sm.id === msg.id)
          );
          
          return sortMessages([...standardizedMessages, ...pendingMessages]);
        });
        
        setPage(1);
        setHasMoreMessages(messagesResponse.data.messages.length >= PAGE_SIZE);
      }
    } catch (error) {
      console.error("Error refreshing messages:", error);
    }
  }, [conversationId, PAGE_SIZE, processedMessages]);

  // Initialize WebSocket connection
  const initializeWebSocket = useCallback((otherUserId, sessionIdParam = null) => {
    // Add additional validation to prevent premature connection attempts
    if (!currentUser?.user?.id) {
      console.log("WebSocket initialization delayed: Missing current user ID");
      return;
    }
    
    if (!otherUserId) {
      console.log("WebSocket initialization delayed: Missing recipient ID");
      return;
    }
    
    // Additional validation for session-based chats
    if (conversationType === 'therapist' && sessionIdParam === null && sessionId) {
      console.log("Using sessionId from props for WebSocket initialization");
      sessionIdParam = sessionId;
    }

    // If session ID is required but not available yet, don't initialize
    if (conversationType === 'therapist' && !sessionIdParam) {
      console.log("WebSocket initialization delayed: Waiting for session details");
      return;
    }

    // Rest of your existing initialization code...
    
    // Close existing connection if there is one
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      console.log("Closing existing WebSocket connection");
      socketRef.current.onclose = null; // Remove onclose handler to prevent reconnect loop
      socketRef.current.close(1000, "Reinitializing");
    }
    
    // Clear any existing timers
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    // Only proceed if we have the required IDs
    if (!currentUser?.user?.id) {
      console.error("Missing current user ID for WebSocket connection");
      return;
    }
    
    if (!otherUserId) {
      console.error("Missing recipient ID for WebSocket connection");
      return;
    }
    
    setConnectionStatus('connecting');
    
    const host = getWsHost();
    // IMPORTANT: Always use WSS for localhost.run (lhr.life) domains
    const protocol = host.includes('.lhr.life') || host.includes('.serveo.net') ? 'wss:' : 
                 (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    let path;
    
    // Create appropriate WebSocket path - Fix parameter order and formatting
    if (sessionIdParam) {
      // Make sure all parameters are properly defined and in the right order
      path = `/ws/chat/session/${sessionIdParam}/${currentUser?.user?.id || ''}/${otherUserId || ''}/`;
    } else {
      path = `/ws/chat/${currentUser?.user?.id || ''}/${otherUserId || ''}/`;
    }
    
    // Add user_id as query parameter as backup auth
    const wsUrl = `${protocol}//${host}${path}?user_id=${currentUser?.user?.id || ''}`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    // Add extra debugging for protocol decision
    console.log("WebSocket connection details:", {
      protocol,
      host,
      isLocalhostRun: host.includes('.lhr.life'),
      isServeo: host.includes('.serveo.net'),
      windowProtocol: window.location.protocol
    });
    
    try {
      // Create new WebSocket instance
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      // Set up event handlers
      socket.onopen = () => {
        console.log("WebSocket connection established");
        setConnectionStatus('connected');
        
        // Set up ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
        
        // Process any queued messages
        if (messageQueue.length > 0) {
          console.log(`Sending ${messageQueue.length} queued messages`);
          messageQueue.forEach(msg => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify(msg));
            }
          });
          setMessageQueue([]);
        }
        
        // Refresh messages to ensure we have the latest
        refreshMessages();
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logWithTimestamp("WebSocket message received:", data);
          
          // Handle different message types
          if (data.type === 'chat_message') {
            const currentUserId = currentUser?.user?.id;
            const isOwnMessage = data.sender_id === currentUserId;
            
            // Use contentHash if available for better deduplication
            const messageId = data.message_id || `temp-${Date.now()}`;
            const contentHash = data.contentHash;
            
            // Skip processing if:
            // 1. We've processed this exact message ID before, OR
            // 2. We have the content hash in our processed set (meaning we sent this message)
            if (processedMessages.has(messageId) || (contentHash && processedMessages.has(contentHash))) {
              console.log("Skipping duplicate message via hash check");
              return;
            }
            
            // Rest of the handler remains the same...
            console.log(`Message ownership: sender=${data.sender_id}, user=${currentUserId}, isOwn=${isOwnMessage}`);
            
            // Create a consistent message ID for deduplication
            // const messageId = data.message_id || `temp-${Date.now()}`;
            
            // Improved deduplication logic
            // For own messages that were already added as pending, we should deduplicate based on content
            const alreadyHasPendingWithSameContent = isOwnMessage && messages.some(msg => 
              msg.pending && 
              msg.content === data.message && 
              msg.sender_id === currentUserId
            );
            
            // Skip if we've already processed this exact message ID
            // OR if it's our own message and we already have a pending one with identical content
            if (processedMessages.has(messageId) || alreadyHasPendingWithSameContent) {
              console.log("Skipping duplicate message:", messageId);
              return;
            }
            

            processedMessages.add(messageId);
            if (contentHash) {
              processedMessages.add(contentHash);
            }
            
            if (isOwnMessage) {
              // Handle own messages - update pending messages or add new ones
              setMessages(prevMessages => {
                // Find any pending messages with matching content
                const pendingMessage = prevMessages.find(msg => 
                  msg.pending && 
                  msg.content === data.message &&
                  msg.sender_id === currentUserId
                );
                
                if (pendingMessage) {
                  console.log("Found pending message to replace with server message:", messageId);
                  
                  // Replace the pending message with confirmed message
                  return prevMessages.map(msg => 
                    (msg.id === pendingMessage.id) 
                      ? { 
                          id: messageId,
                          content: data.message,
                          sender_id: data.sender_id,
                          timestamp: data.timestamp,
                          message_type: data.message_type || 'text',
                          metadata: data.metadata || {},
                          pending: false
                        } 
                      : msg
                  );
                } else {
                  // Only add if we don't already have a matching message
                  // This additional check helps prevent duplication
                  const hasMatchingMessage = prevMessages.some(msg => 
                    !msg.pending && 
                    msg.content === data.message &&
                    msg.sender_id === currentUserId &&
                    Math.abs(new Date(msg.timestamp) - new Date(data.timestamp)) < 5000 // within 5 seconds
                  );
                  
                  if (hasMatchingMessage) {
                    console.log("Found matching non-pending message, skipping");
                    return prevMessages;
                  }
                  
                  console.log("No pending message found, adding new message");
                  const newMessage = {
                    id: messageId,
                    content: data.message,
                    sender_id: data.sender_id,
                    timestamp: data.timestamp,
                    message_type: data.message_type || 'text',
                    metadata: data.metadata || {}
                  };
                  
                  return sortMessages([...prevMessages, newMessage]);
                }
              });
            } else {
              // Message from other user
              console.log("Adding message from other user:", messageId);
              
              setMessages(prevMessages => {
                if (!prevMessages.some(msg => msg.id === messageId)) {
                  const newMessage = {
                    id: messageId,
                    content: data.message,
                    sender_id: data.sender_id,
                    timestamp: data.timestamp || new Date().toISOString(),
                    message_type: data.message_type || 'text',
                    metadata: data.metadata || {}
                  };
                  
                  setTimeout(scrollToBottom, 50);
                  return sortMessages([...prevMessages, newMessage]);
                }
                return prevMessages;
              });
            }
          } else if (data.type === 'user_status') {
            setRecipientStatus(data.status);
          } else if (data.type === 'message_history') {
              // Only process message history if we don't already have messages
            if (data.messages && Array.isArray(data.messages) && messages.length === 0) {
              console.log("Processing message history:", data.messages.length);
              
              const formattedMessages = data.messages.map(msg => ({
                id: msg._id || msg.id,
                content: msg.content,
                sender_id: msg.sender_id,
                timestamp: msg.timestamp || msg.sent_at,
                message_type: msg.message_type || 'text',
                metadata: msg.metadata || {}
              }));
              
              // Add to processed set
              formattedMessages.forEach(msg => processedMessages.add(msg.id));
              
              // Sort by timestamp
              setMessages(sortMessages(formattedMessages));
              setTimeout(scrollToBottom, 100);
            }
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} ${event.reason || 'No reason'}`);
        setConnectionStatus('disconnected');
        
        // Clear the ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Only try to reconnect if this wasn't an intentional close and component is still mounted
        if (event.code !== 1000) {
          console.log("Scheduling WebSocket reconnection in 5 seconds");
          
          // Clear any existing reconnect timer
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          
          // Set new reconnect timer
          reconnectTimerRef.current = setTimeout(() => {
            console.log("Attempting to reconnect WebSocket now");
            
            // Make sure we have the necessary IDs before reconnecting
            if (currentUser?.user?.id && otherUserId) {
              console.log("Reconnecting with IDs:", currentUser.user.id, otherUserId);
              initializeWebSocket(otherUserId, sessionIdParam);
            } else {
              console.error("Missing user IDs for reconnection:", {
                currentUserId: currentUser?.user?.id, 
                otherUserId
              });
            }
          }, 5000);
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        
        // Log more details about the current state
        console.log("WebSocket state during error:", {
          currentUserID: currentUser?.user?.id,
          otherUserID: otherUserId,
          readyState: socketRef.current ? socketRef.current.readyState : 'No socket',
          url: socketRef.current ? socketRef.current.url : 'No URL'
        });
        
        setConnectionStatus('error');
        
        // Don't close here - let the browser handle it
        // The onclose handler will handle reconnection
      };
    } catch (error) {
      console.error("Error initializing WebSocket:", error);
      setConnectionStatus('error');
    }
  }, [currentUser, conversationType, sessionId, messageQueue, processedMessages, refreshMessages]);

  // Send message function
  const sendMessage = useCallback((content, attachments = null) => {
    const timestamp = new Date().toISOString();
    const localMessageId = `local-${new Date(timestamp).getTime()}`;
    
    // IMPORTANT: Always use the user ID, not therapist_id
    const userID = currentUser?.user?.id;
    
    // Create a content hash to help with deduplication
    const contentHash = `${content}-${timestamp.substring(0, 19)}`;
    
    // Track this in our reference to avoid duplicates
    processedMessages.add(contentHash);
    
    // Always show the message in UI immediately
    const newMessage = {
      id: localMessageId,
      content,
      sender_id: userID,
      timestamp: timestamp,
      message_type: 'text',
      metadata: attachments ? {
        filename: attachments.filename,
        file_size: attachments.size,
        mime_type: attachments.type
      } : {},
      pending: true,
      contentHash // Add this to help with deduplication
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
    
    // Create message data - add the contentHash here too
    const messageData = {
      type: 'chat_message',
      message: content,
      message_type: 'text',
      timestamp: timestamp,
      sender_id: userID,
      contentHash // Add this to help track the message
    };
    
    // Check if WebSocket is connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // Send message directly
      try {
        socketRef.current.send(JSON.stringify(messageData));
        console.log("Message sent successfully:", content.substring(0, 30) + (content.length > 30 ? '...' : ''));
        
        // Update UI to show message sent
        setTimeout(() => {
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.id === localMessageId ? { ...msg, pending: false } : msg
            )
          );
          
          // Refresh messages after a short delay to get the server-generated ID
          setTimeout(() => {
            refreshMessages();
          }, 500);
        }, 300);
      } catch (error) {
        console.error("Error sending message:", error);
        
        // Add to queue on error
        setMessageQueue(prev => [...prev, messageData]);
      }
    } else {
      console.log("WebSocket not connected, queueing message");
      
      // Add to message queue for later sending
      setMessageQueue(prev => [...prev, messageData]);
      
      // Try to reconnect if socket is closed
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        // Attempt to reinitialize if we have recipient info
        if (recipient && recipient.id) {
          initializeWebSocket(recipient.id, sessionDetails?.session_id);
        }
      }
    }
    
    // Add this at the end:
    setTimeout(scrollToBottom, 100);
    
    return true;
  }, [currentUser, initializeWebSocket, recipient, sessionDetails, scrollToBottom, refreshMessages]);
  
  // Load conversation details and initialize chat
  const initializeChat = useCallback(async () => {
    try {
      if (!conversationId || !currentUser?.user?.id) {
        console.log("Cannot initialize chat: missing conversation ID or user ID");
        return;
      }
      
      setLoading(true);
      console.log(`Initializing chat for conversation ${conversationId}`);
      const conversationRes = await ChatService.getConversationDetails(conversationId);
      
      if (!conversationRes?.data?.success) {
        console.error("Failed to load conversation:", conversationRes?.data?.message);
        setConnectionStatus('error');
        setLoading(false);
        return;
      }
      
      const conversation = conversationRes.data.conversation;
      console.log("Conversation details loaded:", conversation);
      
      // Set recipient info
      if (conversationRes.data.other_user) {
        setRecipient(conversationRes.data.other_user);
        setRecipientStatus(conversationRes.data.other_user.status || 'offline');
        
        // Initialize WebSocket connection AFTER we have all data
        const recipientId = conversationRes.data.other_user.id || conversationRes.data.other_user._id;
        if (recipientId) {
          console.log("Initializing WebSocket with recipient ID and session ID:", 
                     recipientId, conversation.session_id || null);
          initializeWebSocket(recipientId, conversation.session_id || null);
        }
      }
      
      // Load initial messages with pagination (first page)
      console.log(`Fetching messages for conversation: ${conversationId}`);
      const messagesResponse = await ChatService.getConversationMessages(conversationId, 1, PAGE_SIZE);
      if (messagesResponse?.data?.messages) {
        console.log(`Found ${messagesResponse.data.messages.length} messages`);
        
        const standardizedMessages = messagesResponse.data.messages.map(msg => ({
          id: msg.id || msg._id,
          content: msg.content,
          sender_id: msg.sender_id,
          timestamp: msg.timestamp || msg.sent_at,
          message_type: msg.message_type || 'text',
          metadata: msg.metadata || {},
          read: Boolean(msg.read),
          sequence: msg.sequence || 0
        }));
        
        // Sort messages by timestamp and sequence
        const sortedMessages = sortMessages(standardizedMessages);
        
        setMessages(sortedMessages);
        setPage(1);
        
        // Check if there might be more messages
        setHasMoreMessages(messagesResponse.data.messages.length >= PAGE_SIZE);
        
        // Add all message IDs to processed set to avoid duplicates
        standardizedMessages.forEach(msg => {
          processedMessages.add(msg.id);
        });
        
        // Scroll to bottom after messages load
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error("Error initializing chat:", error);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  }, [conversationId, currentUser, initializeWebSocket, processedMessages, scrollToBottom]);
  
  // Initialize chat once
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    
    console.log("Initializing chat for the first time");
    initializeChat();
    
    // Cleanup function
    return () => {
      console.log("Component unmounting, cleaning up");
      
      // Close WebSocket
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounting");
      }
      
      // Clear timers
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [initializeChat]);

  useEffect(() => {
    // Reset initialization flag when conversation ID changes
    if (conversationId) {
      console.log(`Conversation ID changed to: ${conversationId}`);
      hasInitializedRef.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    if (hasInitializedRef.current || !conversationId) return;
    hasInitializedRef.current = true;
    
    console.log("Initializing chat for conversation:", conversationId);
    initializeChat();
    
    // Cleanup function when unmounting or when conversationId changes
    return () => {
      console.log("Cleaning up WebSocket and timers for:", conversationId);
      
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounting or conversation changed");
      }
      
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [conversationId, initializeChat]);

  // Improve the cleanup logic when component unmounts

  // Replace or update the useEffect for cleanup
  useEffect(() => {
    const isMountedRef = { current: true };
    
    // Return cleanup function
    return () => {
      console.log("Component unmounting, cleaning up WebSocket");
      isMountedRef.current = false;
      
      // Close WebSocket
      if (socketRef.current) {
        socketRef.current.onclose = null; // Remove our handler to avoid reconnection attempts
        socketRef.current.close(1000, "Component unmounting");
        socketRef.current = null;
      }
      
      // Clear timers
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, []);
  
  // Handle session status
  useEffect(() => {
    // Reset session-related states when conversation ID changes
    setSessionDetails(null);
    setShowVideoCallBanner(false);
    setIsVideoSessionActive(false);
    
    const getSessionStatus = async () => {
      try {
        const convId = conversationId || sessionId || recipientId;
        
        if (!convId || convId === 'undefined') {
          console.error("Invalid conversation ID");
          setLoading(false);
          return;
        }
        
        setLoading(true);
        const conversationResponse = await ChatService.getConversation(convId);
        const conversation = conversationResponse.data.conversation;
        
        if (conversation.session_id) {
          const sessionResponse = await SessionService.getSessionById(conversation.session_id);
          const sessionData = sessionResponse.data.session;
          console.log("Session details loaded:", sessionData);
          setSessionDetails(sessionData);
          
          setIsSessionActive(
            // sessionData.status !== "completed" && 
            sessionData.status !== "cancelled" && 
            sessionData.status !== "missed"
          );
          
          // Only show video UI elements if this specific session is video type
          if (sessionData.session_type === "video" && 
              sessionData.payment_confirmed === true &&
              (sessionData.status === "scheduled" || sessionData.status === "in_progress" || sessionData.status === "completed")) {
            setShowVideoCallBanner(true);
          } else {
            // Explicitly hide video UI for non-video sessions
            setShowVideoCallBanner(false);
          }
        } else {
          setIsSessionActive(true);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error getting session status:", err);
        setLoading(false);
      }
    };
    
    getSessionStatus();
  }, [sessionId, conversationId, recipientId]);
  
  // Helper function to send welcome template 
  const sendWelcomeTemplate = useCallback(() => {
    if (!sessionDetails) return;
    
    const conversationHasMessages = messages.length > 0;
    const welcomeTemplates = {
      'video': 'Welcome! I look forward to our video session on {date}. Feel free to share what you hope to address so I can prepare.',
      'text': 'Thank you for booking a text therapy session. Please share your main concerns so we can make the most of our conversation.',
    };
    
    const template = welcomeTemplates[sessionDetails.session_type] || welcomeTemplates.video;
    const formattedDate = new Date(sessionDetails.start_time).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    
    const message = template.replace('{date}', formattedDate);
    
    if (userRole === 'therapist' && !conversationHasMessages) {
      sendMessage(message);
    }
  }, [sessionDetails, messages.length, userRole, sendMessage]);
  
  // Send welcome message when session details load
  useEffect(() => {
    let welcomeTimer = null;
    
    if (sessionDetails && userRole === 'therapist' && messages.length === 0 && !loading) {
      welcomeTimer = setTimeout(sendWelcomeTemplate, 1000);
    }
    
    return () => {
      if (welcomeTimer) clearTimeout(welcomeTimer);
    };
  }, [sessionDetails, messages.length, loading, userRole, sendWelcomeTemplate]);
  
  // Send help request
  const sendHelpRequest = (query) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    socketRef.current.send(JSON.stringify({
      type: 'help_request',
      query: query
    }));
    
    return true;
  };
  
  // Video call functions
  const initiateVideoCall = async () => {
    try {
      setIsInitiatingCall(true);
      
      if (sessionDetails && sessionDetails._id && sessionDetails.session_type === "video") {
        navigate(`/video-session/${sessionDetails._id}`);
        return;
      }
      
      const data = {};
      
      if (sessionId) {
        data.session_id = sessionId;
      } else if (conversationId) {
        data.conversation_id = conversationId;
      } else if (recipientId) {
        data.recipient_id = recipientId;
      }
      
      const response = await SessionService.initiateVideoCall(data);
      
      if (response.data.success) {
        if (response.data.requires_payment) {
          setPendingSessionData({
            sessionId: response.data.session_id,
            paymentUrl: response.data.payment_url,
            paymentSessionId: response.data.payment_session_id
          });
          setShowPaymentModal(true);
        } else {
          navigate(`/video-session/${response.data.session_id}`);
        }
      }
    } catch (err) {
      console.error("Error initiating video call:", err);
    } finally {
      setIsInitiatingCall(false);
    }
  };
  
  // Handle payment completion
  const handlePaymentComplete = () => {
    setShowPaymentModal(false);
    if (pendingSessionData && pendingSessionData.sessionId) {
      navigate(`/video-session/${pendingSessionData.sessionId}`);
    }
  };
  
  // Join ongoing video session
  const joinVideoSession = () => {
    if (sessionDetails && sessionDetails._id) {
      navigate(`/video-session/${sessionDetails._id}`);
    }
  };

  // Add this useEffect for scroll management
  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 20;
      setIsAtBottom(atBottom);
      setShowScrollToBottom(!atBottom);
      
      // Load older messages when scrolling to top
      if (scrollTop < 50 && hasMoreMessages && !isLoadingMore) {
        loadMoreMessages();
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMoreMessages]);

  // Add this function to load older messages
  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || isLoadingMore || !hasMoreMessages) return;
    
    try {
      setIsLoadingMore(true);
      const nextPage = page + 1;
      
      // Save current scroll position
      const container = messageContainerRef.current;
      const oldScrollHeight = container.scrollHeight;
      
      // Load older messages with pagination
      const messagesResponse = await ChatService.getConversationMessages(
        conversationId, 
        nextPage, 
        PAGE_SIZE
      );
      
      if (messagesResponse?.data?.messages?.length > 0) {
        const oldMessages = messagesResponse.data.messages.map(msg => ({
          id: msg.id || msg._id,
          content: msg.content,
          sender_id: msg.sender_id,
          timestamp: msg.timestamp || msg.sent_at,
          message_type: msg.message_type || 'text',
          metadata: msg.metadata || {},
          read: Boolean(msg.read)
        }));
        
        // Add to processed set to avoid duplicates
        oldMessages.forEach(msg => {
          processedMessages.add(msg.id);
        });
        
        // Prepend old messages to current messages
        setMessages(prevMessages => [...oldMessages, ...prevMessages]);
        setPage(nextPage);
        
        // If we got fewer messages than requested, there are no more
        if (oldMessages.length < PAGE_SIZE) {
          setHasMoreMessages(false);
        }
        
        // Restore scroll position after new messages are rendered
        setTimeout(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - oldScrollHeight;
          }
        }, 50);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, page, isLoadingMore, hasMoreMessages]);

  // Update the effect that handles new messages to auto-scroll only if at bottom
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-lg border border-gray-200 bg-white shadow overflow-hidden">
      <ChatHeader 
        recipient={recipient} 
        recipientStatus={recipientStatus}
        conversationType={conversationType}
        connectionStatus={connectionStatus}
        onHelpClick={() => setShowHelp(true)}
        onVideoCall={initiateVideoCall}
        isVideoEnabled={sessionDetails?.session_type === "video" && sessionDetails?.payment_confirmed === true}
      />
      
      {/* Connection Status Indicator */}
      {connectionStatus !== 'connected' && (
        <div className={`px-4 py-2 text-sm font-medium text-center ${
          connectionStatus === 'connecting' 
            ? 'bg-blue-50 text-blue-600' 
            : connectionStatus === 'error'
              ? 'bg-red-50 text-red-600'
              : 'bg-yellow-50 text-yellow-600'
        }`}>
          {connectionStatus === 'connecting' 
            ? 'Connecting to chat...' 
            : connectionStatus === 'error'
              ? 'Connection error. Messages will be sent when reconnected.'
              : 'Offline. Messages will be sent when reconnected.'}
        </div>
      )}
      
      {/* Video Call Banner */}
      {showVideoCallBanner && (
        <div className="bg-indigo-50 border-b border-indigo-100 p-3 flex justify-between items-center">
          <div className="flex items-center">
            <VideoCameraIcon className="h-5 w-5 text-indigo-600 mr-2" />
            <span className="text-sm font-medium text-indigo-700">
              {isVideoSessionActive ? 
                'Video session in progress' : 
                'Video session available for this conversation'}
            </span>
          </div>
          <button
            onClick={joinVideoSession}
            disabled={isInitiatingCall}
            className={`px-4 py-1 ${
              isInitiatingCall ? 
                'bg-gray-400 cursor-not-allowed' : 
                'bg-indigo-600 hover:bg-indigo-700'
            } text-white text-sm rounded-md`}
          >
            {isInitiatingCall ? 'Loading...' : isVideoSessionActive ? 'Join Session' : 'Start Video Call'}
          </button>
        </div>
      )}
      
      <div 
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto bg-gray-50 p-4 relative"
      >
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
          </div>
        )}
        
        {showHelp && (
          <HelpChat
            onClose={() => setShowHelp(false)}
            onSendQuery={sendHelpRequest}
            messages={messages.filter(msg => msg.sender_id === 'system' && msg.message_type === 'help')}
          />
        )}
        
        <MessageList 
          messages={messages.filter(msg => !showHelp || msg.sender_id !== 'system')} 
          currentUserId={currentUser?.user?.id}
          conversationType={conversationType}
          currentUser={currentUser}  // Add this prop
        />
        
        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <button 
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      
      {!isSessionActive && (
        <div className="bg-yellow-50 border-t border-yellow-200 p-3">
          <p className="text-sm text-yellow-700">
            This session has ended. You can view the message history but cannot send new messages.
          </p>
        </div>
      )}

      <MessageInput 
        onSendMessage={sendMessage} 
        conversationType={conversationType}
        disabled={!isSessionActive || (showHelp && conversationType === 'help')}
      />
      
      {/* Support bubble that shows in all chats except help chat */}
      {conversationType !== 'help' && !showHelp && (
        <SupportBubble onClick={() => setShowHelp(true)} />
      )}
      
      {/* Payment Modal */}
      {showPaymentModal && pendingSessionData && (
        <PaymentModal
          sessionId={pendingSessionData.sessionId}
          paymentUrl={pendingSessionData.paymentUrl}
          onComplete={handlePaymentComplete}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
};

export default ChatContainer;