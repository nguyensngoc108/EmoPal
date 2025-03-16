import React from 'react';
import { format } from 'date-fns';

// Add this helper function at the top of your component
const getConversationId = (conversation) => {
  if (!conversation) return null;
  return conversation._id || conversation.id; 
};

const ConversationList = ({ 
  conversations = [], 
  activeConversation,
  onSelectConversation
}) => {
  // console.log("ConversationList rendering:", conversations);
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Messages</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No conversations yet</p>
          </div>
        ) : (
          conversations.map(conversation => {
            const isActive = activeConversation && 
                            (activeConversation._id === conversation._id);
            const lastMessage = conversation.last_message;
            
            return (
              <div 
                key={conversation._id}
                className={`p-4 border-b cursor-pointer ${
                  isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="flex items-start">
                  {/* Add recipient avatar */}
                  {conversation.recipient_picture ? (
                    <img 
                      src={conversation.recipient_picture} 
                      alt={conversation.recipient_name || 'User'}
                      className="h-10 w-10 rounded-full mr-3 object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-indigo-800 font-medium">
                        {(conversation.recipient_name || '?')[0]}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-medium">
                        {conversation.recipient_name || 'Unknown User'}
                      </h3>
                      {lastMessage && (
                        <span className="text-xs text-gray-500">
                          {lastMessage.sent_at ? 
                            format(new Date(lastMessage.sent_at), 'h:mm a') : ''}
                        </span>
                      )}
                    </div>
                    
                    {/* Message content preview */}
                    {lastMessage ? (
                      <p className="text-sm text-gray-600 truncate">
                        {lastMessage.content || ''}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No messages yet</p>
                    )}
                    
                    {/* Status and badge row */}
                    <div className="flex justify-between mt-1">
                      {/* Online status indicator */}
                      <div className="flex items-center text-xs text-gray-500">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                          conversation.recipient_status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                        }`}></span>
                        <span>{conversation.recipient_status === 'online' ? 'Online' : 'Offline'}</span>
                      </div>
                      
                      {/* Unread badge */}
                      {conversation.unread_count > 0 && (
                        <span className="bg-blue-500 text-white text-xs rounded-full 
                          h-5 w-5 flex items-center justify-center">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;