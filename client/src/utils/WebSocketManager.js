import ChatService from '../services/ChatService';

class WebSocketManager {
  constructor(url, options = {}) {
    this.url = url;
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.pingInterval = options.pingInterval || 30000;
    this.pingIntervalId = null;
    this.callbacks = {
      onMessage: options.onMessage || (() => {}),
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onError: options.onError || ((error) => console.error("WebSocket error:", error))
    };
  }
  
  // Add token automatically when connecting via api.js
  connect(token = null) {
    try {
      // If token is passed, use it; otherwise check localStorage
      const authToken = token || localStorage.getItem('auth_token');
      
      // Append token to URL if available
      const url = authToken ? 
        `${this.url}${this.url.includes('?') ? '&' : '?'}token=${authToken}` : 
        this.url;
      
      this.socket = new WebSocket(url);
      
      this.socket.onopen = () => {
        console.log(`WebSocket connected to ${this.url}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this._startPingInterval();
        this.callbacks.onConnect();
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'chat_message') {
            // Ensure content is a string
            const content = typeof data.message === 'object' 
              ? JSON.stringify(data.message) 
              : data.message;
            
            // Use the sanitized content
            const message = {
              id: data.message_id,
              content: content,
              sender_id: data.sender_id,
              timestamp: data.timestamp,
              message_type: data.message_type || 'text',
              metadata: data.metadata || {},
              read: false
            };
            
            this.callbacks.onMessage(message);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      this.socket.onerror = (event) => {
        console.error('WebSocket error:', event);
        this.callbacks.onError(event);
      };
      
      this.socket.onclose = (event) => {
        console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
        this.isConnected = false;
        this._clearPingInterval();
        this.callbacks.onDisconnect(event);
        
        // Attempt to reconnect if the close wasn't intentional
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connect(), this.reconnectInterval);
          this.reconnectAttempts++;
        }
      };
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      this.callbacks.onError(error);
    }
  }
  
  disconnect() {
    if (this.socket) {
      this._clearPingInterval();
      this.socket.close(1000, 'Client disconnected');
      this.socket = null;
      this.isConnected = false;
    }
  }
  
  send(data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket is not connected');
      return false;
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.socket.send(message);
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }
  
  _startPingInterval() {
    this._clearPingInterval();
    this.pingIntervalId = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      }
    }, this.pingInterval);
  }
  
  _clearPingInterval() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }
  
  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
  
  // Add token to WebSocket URL for authentication
  static getWebSocketUrl(path, token = null) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use localhost:8001 instead of window.location.host
    const host = process.env.REACT_APP_CHAT_HOST || 'localhost:8001';
    
    // Add token as query parameter if provided
    const tokenParam = token ? `?token=${token}` : '';
    
    return `${protocol}//${host}${path}${tokenParam}`;
  }
  
  // Replace this method with a properly implemented one
  async initializeWebSocketConnection(conversationId, currentUserId) {
    // Clean up any existing connection
    this.disconnect();
    
    // Get conversation details to determine the correct URL
    try {
          const response = await ChatService.getConversationDetails(conversationId);
          const conversation = response.data.conversation;
          const otherUserId = conversation.participants.find(id => id !== currentUserId);

          let wsPath;
          if (conversation.conversation_type === 'therapy_session' && conversation.session_id) {
              wsPath = `/ws/chat/session/${conversation.session_id}/${currentUserId}/${otherUserId}/`;
          } else {
              wsPath = `/ws/chat/${currentUserId}/${otherUserId}/`;
          }

          // Get URL with authentication token
          const wsUrl = WebSocketManager.getWebSocketUrl(wsPath);
          console.log("Connecting to WebSocket:", wsUrl);

          // Create new instance with the correct URL
          this.url = wsUrl;

          // Connect to the WebSocket
          this.connect();
          return true;
      } catch (error) {
          console.error("Error getting conversation details for WebSocket:", error);
          return false;
      }
  }
}

export default WebSocketManager;