import React, { useRef, useEffect } from 'react';
import { XMarkIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';

const HelpChat = ({ messages, onSendQuery, onClose }) => {
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const query = inputRef.current.value.trim();
    if (query) {
      onSendQuery(query);
      inputRef.current.value = '';
    }
  };
  
  const handleSuggestionClick = (suggestion) => {
    onSendQuery(suggestion);
  };
  
  return (
    <div className="fixed bottom-20 right-6 w-96 h-96 bg-white rounded-lg shadow-xl z-50 flex flex-col">
      <div className="bg-indigo-600 text-white p-3 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center">
          <ChatBubbleBottomCenterTextIcon className="h-5 w-5 mr-2" />
          <h3 className="font-medium">Help & Support</h3>
        </div>
        <button onClick={onClose}>
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="flex justify-center items-center h-full text-gray-400">
            <p>Ask me anything about therapy or our platform!</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="mb-4">
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <p className="text-gray-800">{msg.content}</p>
              
              {/* Render suggestions as clickable buttons */}
              {msg.metadata?.suggestions && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.metadata.suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Render action buttons/links */}
              {msg.metadata?.actions && (
                <div className="mt-4 flex flex-col gap-2">
                  {msg.metadata.actions.map((action, i) => (
                    action.type === 'link' ? (
                      <a
                        key={i}
                        href={action.url}
                        className="px-4 py-2 bg-indigo-600 text-white rounded text-center text-sm"
                      >
                        {action.text}
                      </a>
                    ) : (
                      <button
                        key={i}
                        className="px-4 py-2 bg-indigo-600 text-white rounded text-sm"
                        onClick={() => action.handler && action.handler()}
                      >
                        {action.text}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1 ml-1">
              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="border-t p-3 bg-white rounded-b-lg">
        <div className="flex">
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask a question..."
            className="flex-1 border rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-r-lg hover:bg-indigo-700"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default HelpChat;