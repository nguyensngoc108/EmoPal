import React from 'react';
import { 
  DocumentIcon, 
  PhotoIcon, 
  ClockIcon,
  CheckIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const MessageBubble = ({ message, isOwn }) => {
  // Format timestamp nicely
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error("Error formatting time:", error);
      return '';
    }
  };

  // Handle different message types
  const renderMessageContent = () => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="mt-1">
            <img 
              src={message.content} 
              alt="Image attachment" 
              className="max-w-xs rounded-lg"
            />
          </div>
        );
      case 'file':
        return (
          <a 
            href={message.content}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-2 bg-white rounded-lg border border-gray-200"
          >
            <DocumentIcon className="h-5 w-5 text-gray-500 mr-2" />
            <span>{message.metadata?.filename || 'Attachment'}</span>
          </a>
        );
      case 'system':
        return (
          <div className="p-3 bg-gray-100 rounded-lg text-gray-600 text-sm">
            <p>{message.content}</p>
          </div>
        );
      default:
        return <p>{message.content}</p>;
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[75%] rounded-lg px-4 py-2 ${
          isOwn 
            ? 'bg-indigo-600 text-white rounded-br-none' 
            : 'bg-white border border-gray-200 rounded-bl-none'
        }`}
      >
        {/* System message styles differently */}
        {message.sender_id === 'system' && (
          <div className="p-1 bg-gray-100 rounded-lg text-gray-600 -mx-2">
            {renderMessageContent()}
          </div>
        )}
        
        {/* Normal user message */}
        {message.sender_id !== 'system' && (
          <>
            {renderMessageContent()}
            
            <div className={`text-xs mt-1 flex justify-end items-center ${
              isOwn ? 'text-indigo-200' : 'text-gray-400'
            }`}>
              <span>{formatTime(message.timestamp)}</span>
              
              {/* Read receipt */}
              {isOwn && (
                <span className="ml-1">
                  {message.read ? (
                    <CheckCircleIcon className="h-3 w-3" />
                  ) : (
                    <CheckIcon className="h-3 w-3" />
                  )}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;