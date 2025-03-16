import api from "./api"; // Assuming api.js is in the same directory

class ChatService {
  // Conversation management
  getConversations() {
    return api.get("/messages/conversations/");
  }

  getConversation(conversationId) {
    return api.get(`/messages/conversations/${conversationId}/`);
  }

  getConversationsByQuery(query) {
    return api.get("/messages/conversations/video/query/", { params: query });
  }

  getConversationDetails(conversationId) {
    return api.get(`/messages/conversations/${conversationId}/`);
  }

  // Update this method
  async getConversationMessages(conversationId, page = 1, pageSize = 50) {
    try {
      console.log(
        `[API] Fetching messages for conversation: ${conversationId}, page: ${page}, size: ${pageSize}`
      );
      const response = await api.get(
        `/messages/conversations/${conversationId}/messages/?page=${page}&page_size=${pageSize}`
      );

      if (response.data && response.data.messages) {
        console.log(`[API] Found ${response.data.messages.length} messages`);
      }

      return response;
    } catch (error) {
      console.error("[API] Error fetching conversation messages:", error);
      throw error;
    }
  }

  // Messages
  getMessages(conversationId, limit = 50, skip = 0) {
    return api.get(`/messages/conversations/${conversationId}/messages/`, {
      params: { limit, skip },
    });
  }

  markMessagesRead(conversationId, messageIds) {
    return api.post(`/messages/read/${messageIds.join(",")}`, {
      conversation_id: conversationId,
    });
  }

  // Session chat
  getSessionChat(sessionId) {
    return api.get(`/messages/sessions/${sessionId}/messages/`);
  }

  getSessionDetails(sessionId) {
    return api.get(`/sessions/${sessionId}/`);
  }

  // Plans and sessions
  getPlanDetails(planId) {
    return api.get(`/sessions/plans/${planId}/`);
  }

  scheduleVideoSession(planId, startTime) {
    return api.post(`/sessions/plans/${planId}/schedule-session/`, {
      start_time: startTime,
    });
  }

  // Therapist availability
  getTherapistAvailability(therapistId, date) {
    return api.get(`/therapists/${therapistId}/availability/`, {
      params: { date },
    });
  }

  getTherapistDetails(therapistId) {
    return api.get(`/therapists/${therapistId}/`);
  }

  // Help and support
  getHelpResponse(query, context = {}) {
    return api.post("/ai_services/help/", {
      query,
      context,
    });
  }

  // For direct server communication without WebSockets
  sendMessage(conversationId, content, attachments = null) {
    const data = {
      content,
      conversation_id: conversationId,
    };

    if (attachments) {
      data.attachment_url = attachments.url;
      data.metadata = {
        filename: attachments.filename,
        file_size: attachments.size,
        mime_type: attachments.type,
      };
    }

    return api.post(`/messages/send/`, data);
  }

  deleteMessage(messageId) {
    return api.delete(`/messages/delete/${messageId}/`);
  }

  getUnreadCount() {
    return api.get("/messages/unread/");
  }

  // Add this new method to your ChatService class
  getUserDetails(userId) {
    return api.get(`/users/${userId}/`);
  }
}

const chatServiceInstance = new ChatService();
export default chatServiceInstance;
