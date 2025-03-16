class WebSocketManager {
    constructor() {
      this.socket = null;
      this.sessionId = null;
      this.userId = null;
      this.userRole = null; // Add userRole to constructor
      this.pingInterval = null;
      this.callbacks = {
        onMessage: () => {},
        onConnect: () => {},
        onDisconnect: () => {},
        onError: () => {}
      };
    }
  
    connect(sessionId, userId, userRole) {
      this.sessionId = sessionId;
      this.userId = userId;
      this.userRole = userRole; // Store the user role
      
      // Determine the correct WebSocket host
      let host = process.env.REACT_APP_CHAT_HOST || 'localhost:8001';
      
      // If no environment variable is set, use current hostname with port 8000
      if (!host) {
        host = window.location.hostname === 'localhost' ? 'localhost:8001' : window.location.host;
      }
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${host}/ws/video/${sessionId}/${userId}/`;
      
      try {
        console.log(`Attempting to connect to WebSocket at ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
          console.log('WebSocket connection established');
          // Request token for video chat
          this.send({
            type: 'agora_token_request'
          });
          this.callbacks.onConnect();
        };
        
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.callbacks.onMessage(data);
          } catch (error) {
            console.error('Error processing message:', error);
          }
        };
        
        this.socket.onclose = (event) => {
          console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
          this.callbacks.onDisconnect(event);
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.callbacks.onError(error);
        };
        
        // Setup ping to keep connection alive
        this.pingInterval = setInterval(() => {
          this.sendPing();
        }, 30000);
        
        return true;
      } catch (error) {
        console.error('WebSocket connection error:', error);
        this.callbacks.onError(error);
        return false;
      }
    }
    
    disconnect() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }
      
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
    }
    
    send(message) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
        return true;
      }
      return false;
    }
    
    sendPing() {
      this.send({ type: 'ping' });
    }
    
    sendVideoFrame(imageData) {
      return this.send({
        type: 'video_frame',
        frame: imageData
      });
    }
    
    sendChatMessage(message) {
      return this.send({
        type: 'chat_message',
        message: message,
        message_type: 'text'
      });
    }
    
    onMessage(callback) {
      this.callbacks.onMessage = callback;
    }
    
    onConnect(callback) {
      this.callbacks.onConnect = callback;
    }
    
    onDisconnect(callback) {
      this.callbacks.onDisconnect = callback;
    }
    
    onError(callback) {
      this.callbacks.onError = callback;
    }
  }
  
  export default WebSocketManager;