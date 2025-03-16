/**
 * ChatSocketManager
 * Handles WebSocket connections for chat functionality
 */

class ChatSocketManager {
    constructor() {
      this.socket = null;
      this.userId = null;
      this.otherUserId = null;
      this.conversationId = null;
      this.sessionId = null;
      this.connectionAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 5000; // Start with 5 seconds
      this.pingInterval = null;
      this._listenersInitialized = false;
      
      // Callbacks
      this.callbacks = {
        onMessage: () => {},
        onConnect: () => {},
        onDisconnect: () => {},
        onError: () => {}
      };
    }
  
    // Update these critical methods to fix connection issues

    /**
     * Connect to WebSocket for chat
     */
    connect(conversationId, userId, otherUserId, sessionId = null) {
      // Store these for reconnection if needed
      this.conversationId = conversationId;
      this.userId = userId;
      this.otherUserId = otherUserId;
      this.sessionId = sessionId;
      
      // Close any existing socket
      if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
        console.log("Closing existing WebSocket before connecting new one");
        this.socket.close();
      }
      
      // Create WebSocket URL based on parameters
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.REACT_APP_CHAT_HOST || 'localhost:8001';
      let path;
      
      // Set proper path based on session or direct chat
      if (sessionId) {
        path = `/ws/chat/session/${sessionId}/${userId}/${otherUserId}/`;
      } else {
        path = `/ws/chat/${userId}/${otherUserId}/`;
      }
      
      const wsUrl = `${protocol}//${host}${path}`;
      console.log(`[ChatSocketManager] Connecting to ${wsUrl}`);
      
      // Create WebSocket with connection tracking
      try {
        console.log("[ChatSocketManager] Creating new WebSocket instance");
        this.socket = new WebSocket(wsUrl);
        this.connectionAttempts++;
        
        // Debug connection state
        console.log("[ChatSocketManager] Initial socket state:", this._getReadyStateAsText());
        
        // Set up event handlers with better logging
        this.socket.onopen = (event) => {
          console.log("[ChatSocketManager] WebSocket connection established", event);
          this.connectionAttempts = 0; // Reset counter on successful connection
          this.reconnectDelay = 5000; // Reset delay
          this._setupPingInterval();
          
          // Debug connection state after open
          console.log("[ChatSocketManager] Socket state after open:", this._getReadyStateAsText());
          
          this.callbacks.onConnect();
        };
        
        this.socket.onmessage = this._handleMessage.bind(this);
        this.socket.onclose = this._handleClose.bind(this);
        this.socket.onerror = this._handleError.bind(this);
        
        return true;
      } catch (error) {
        console.error("[ChatSocketManager] Failed to create WebSocket:", error);
        this._scheduleReconnect();
        return false;
      }
    }
    
    /**
     * Disconnects WebSocket and cleans up
     */
    disconnect() {
      this._clearPingInterval();
      
      if (this.socket) {
        console.log("[ChatSocketManager] Disconnecting WebSocket");
        
        // Remove event listeners to avoid memory leaks
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        
        this.socket.close(1000, "Intentional disconnection");
        this.socket = null;
      }
    }
    
    /**
     * Check if socket is connected
     */
    isConnected() {
      const connected = this.socket && this.socket.readyState === WebSocket.OPEN;
      
      // Debug connection state when checked
      console.log(`[ChatSocketManager] Connection check: ${connected ? 'connected' : 'not connected'} (${this._getReadyStateAsText()})`);
      
      return connected;
    }
    
    /**
     * Send message via WebSocket with queueing
     */
    send(data) {
      // Debug connection state before sending
      console.log(`[ChatSocketManager] Socket state before sending: ${this._getReadyStateAsText()}`);
      
      if (!this.isConnected()) {
        console.log("[ChatSocketManager] Socket not connected, queuing message for later");
        
        // Store message for later sending
        if (!this._messageQueue) this._messageQueue = [];
        this._messageQueue.push(data);
        
        // Try to reconnect if socket is closed
        if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
          console.log("[ChatSocketManager] Socket closed, attempting reconnection");
          if (this.userId && this.otherUserId) {
            this.connect(this.conversationId, this.userId, this.otherUserId, this.sessionId);
          }
        }
        
        // Return true to indicate message was queued
        return true;
      }
      
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        console.log("[ChatSocketManager] Sending message:", message.substring(0, 50) + "...");
        this.socket.send(message);
        return true;
      } catch (error) {
        console.error("[ChatSocketManager] Error sending message:", error);
        return false;
      }
    }
    
    /**
     * Send chat message
     */
    sendChatMessage(content, attachments = null) {
      const messageData = {
        type: 'chat_message',
        message: content,
        message_type: 'text'
      };
      
      if (attachments) {
        messageData.attachment_url = attachments.url;
        messageData.metadata = {
          filename: attachments.filename,
          file_size: attachments.size,
          mime_type: attachments.type
        };
      }
      
      return this.send(messageData);
    }
    
    /**
     * Send ping to keep connection alive
     */
    _sendPing() {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }
    
    /**
     * Set up ping interval
     */
    _setupPingInterval() {
      this._clearPingInterval();
      this.pingInterval = setInterval(() => {
        this._sendPing();
      }, 30000); // Send ping every 30 seconds
    }
    
    /**
     * Clear ping interval
     */
    _clearPingInterval() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    }
    
    /**
     * Handle WebSocket open event
     */
    _handleOpen() {
      console.log("[ChatSocketManager] WebSocket connection established");
      this.connectionAttempts = 0; // Reset counter on successful connection
      this.reconnectDelay = 5000; // Reset delay
      this._setupPingInterval();
      
      // Send any queued messages
      this._processMessageQueue();
      
      this.callbacks.onConnect();
    }
    
    /**
     * Handle WebSocket message event
     */
    _handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onMessage(data);
        
        // Special handling for pong message
        if (data.type === 'pong') {
          console.log("[ChatSocketManager] Received pong from server");
        }
      } catch (error) {
        console.error("[ChatSocketManager] Error processing message:", error);
      }
    }
    
    /**
     * Handle WebSocket close event
     */
    _handleClose(event) {
      this._clearPingInterval();
      console.log(`[ChatSocketManager] WebSocket closed: ${event.code} ${event.reason || 'No reason provided'}`);
      
      // Only reconnect for unexpected closures, not intentional ones
      if (event.code !== 1000 && event.code !== 1001) {
        this._scheduleReconnect();
      }
      
      this.callbacks.onDisconnect(event);
    }
    
    /**
     * Handle WebSocket error event
     */
    _handleError(event) {
      console.error("[ChatSocketManager] WebSocket error:", event);
      this.callbacks.onError(event);
    }
    
    /**
     * Schedule reconnection with exponential backoff
     */
    _scheduleReconnect() {
      if (this.connectionAttempts >= this.maxReconnectAttempts) {
        console.log("[ChatSocketManager] Maximum reconnection attempts reached");
        return;
      }
      
      const delay = Math.min(30000, this.reconnectDelay * Math.pow(1.5, this.connectionAttempts - 1));
      console.log(`[ChatSocketManager] Scheduling reconnect in ${delay/1000} seconds`);
      
      setTimeout(() => {
        if (this.userId && this.otherUserId) {
          console.log("[ChatSocketManager] Attempting to reconnect...");
          this.connect(this.conversationId, this.userId, this.otherUserId, this.sessionId);
        }
      }, delay);
      
      this.reconnectDelay = delay;
    }
    
    // Register callbacks
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

    /**
     * Get readable WebSocket state
     */
    _getReadyStateAsText() {
      if (!this.socket) return "No socket";
      
      switch (this.socket.readyState) {
        case WebSocket.CONNECTING: return "CONNECTING";
        case WebSocket.OPEN: return "OPEN";
        case WebSocket.CLOSING: return "CLOSING";
        case WebSocket.CLOSED: return "CLOSED";
        default: return `Unknown (${this.socket.readyState})`;
      }
    }

    /**
     * Process queued messages
     */
    _processMessageQueue() {
      if (this._messageQueue && this._messageQueue.length > 0) {
        console.log(`[ChatSocketManager] Processing ${this._messageQueue.length} queued messages`);
        
        while (this._messageQueue.length > 0) {
          const message = this._messageQueue.shift();
          try {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            console.log("[ChatSocketManager] Sending queued message:", messageStr.substring(0, 50) + "...");
            this.socket.send(messageStr);
          } catch (error) {
            console.error("[ChatSocketManager] Error sending queued message:", error);
          }
        }
      }
    }
  }
  
  export default ChatSocketManager;