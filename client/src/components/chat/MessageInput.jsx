import React, { useState, useRef } from 'react';
import { 
  PaperAirplaneIcon, 
  PaperClipIcon,
  PhotoIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  MicrophoneIcon,
  CalendarIcon,
  FaceSmileIcon
} from '@heroicons/react/24/outline';
import EmojiPicker from './EmojiPicker'; // You'll need to implement or import this

const MessageInput = ({ onSendMessage, onSendAttachment, onRequestAssessment }) => {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setIsUploading(true);
      await onSendAttachment(file);
    } catch (err) {
      console.error('Error uploading file:', err);
      // Show error toast
    } finally {
      setIsUploading(false);
      // Reset file input
      fileInputRef.current.value = '';
    }
  };
  
  const handleEmojiSelect = (emoji) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="border-t bg-white p-4">
      {/* Tools bar */}
      {showTools && (
        <div className="flex justify-between items-center mb-3 px-2">
          <div className="flex space-x-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-500 hover:text-indigo-600"
              title="Upload file"
            >
              <DocumentTextIcon className="h-5 w-5" />
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-500 hover:text-indigo-600"
              title="Upload image"
            >
              <PhotoIcon className="h-5 w-5" />
            </button>
            
            <button 
              onClick={() => onRequestAssessment()}
              className="text-gray-500 hover:text-indigo-600"
              title="Request assessment"
            >
              <CalendarIcon className="h-5 w-5" />
            </button>
          </div>
          
          <button 
            onClick={() => setShowTools(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Message input */}
      <div className="flex items-end">
        <button 
          onClick={() => setShowTools(true)}
          className="text-gray-500 hover:text-indigo-600 mr-2"
        >
          <PaperClipIcon className="h-5 w-5" />
        </button>
        
        <div className="flex-grow relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="w-full border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 resize-none py-2 px-3"
            rows={message.split('\n').length > 3 ? 4 : 1}
          />
          
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-2 bottom-2 text-gray-500 hover:text-gray-700"
          >
            <FaceSmileIcon className="h-5 w-5" />
          </button>
          
          {showEmojiPicker && (
            <div className="absolute bottom-12 right-0">
              <EmojiPicker onSelect={handleEmojiSelect} />
            </div>
          )}
        </div>
        
        <button
          onClick={handleSend}
          disabled={!message.trim() || isUploading}
          className={`ml-2 p-2 rounded-full ${
            message.trim() && !isUploading
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isUploading ? (
            <ArrowPathIcon className="h-5 w-5 animate-spin" />
          ) : (
            <PaperAirplaneIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt"
      />
    </div>
  );
};

export default MessageInput;