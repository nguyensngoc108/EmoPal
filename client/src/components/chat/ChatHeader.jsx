import React, { useState, useEffect } from 'react';
import { 
  VideoCameraIcon, 
  PhoneIcon, 
  QuestionMarkCircleIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';
import TherapistService from '../../services/TherapistServices';
import { useAuth } from '../../contexts/AuthContext';

const ChatHeader = ({ 
  recipient, 
  recipientStatus = 'offline',
  conversationType,
  connectionStatus,
  onHelpClick,
  onVideoCall,
  isVideoEnabled
}) => {
  // console.log("ChatHeader rendering with recipient:", recipient);
  // console.log("ChatHeader rendering with recipientStatus:", recipient);
  // Check if recipient is defined before accessing properties
  const displayName = recipient ? 
    `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || recipient.username || 'Unknown User'
    : 'Loading...';
  
  return (
    <div className="bg-white border-b border-gray-200 p-3 flex justify-between items-center">
      <div className="flex items-center">
        {/* Avatar/Profile Picture - Handle null recipient */}
        {recipient && recipient.profile_picture ? (
          <img 
            src={recipient.profile_picture} 
            alt={displayName}
            className="h-8 w-8 rounded-full mr-3 object-cover border border-gray-200"
          />
        ) : (
          <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-indigo-800 font-medium text-sm">
              {recipient?.first_name?.[0] || recipient?.last_name?.[0] || '?'}
            </span>
          </div>
        )}
        
        <div>
          {/* User name */}
          <div className="font-medium">
            {conversationType === 'help' ? 'AI Assistant' : displayName}
          </div>
          
          {/* Online status indicator */}
          <div className="flex items-center text-xs text-gray-500">
            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
              recipientStatus === 'online' ? 'bg-green-500' : 'bg-gray-400'
            }`}></span>
            <span>{recipientStatus === 'online' ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>
      
      {/* Right side buttons */}
      <div className="flex space-x-2">
        {isVideoEnabled && (
          <button 
            onClick={onVideoCall}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full"
          >
            <VideoCameraIcon className="h-5 w-5" />
          </button>
        )}
        
        <button 
          onClick={onHelpClick}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full"
        >
          <QuestionMarkCircleIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

const TherapistAvailabilityIndicator = ({ therapistId }) => {
  const [availability, setAvailability] = useState('offline');
  
  useEffect(() => {
    // Subscribe to therapist availability updates
    const subscribe = async () => {
      const onlineStatus = await TherapistService.getOnlineStatus(therapistId);
      setAvailability(onlineStatus.status);
      
      // Start websocket subscription for real-time updates
      // ...
    };
    
    subscribe();
  }, [therapistId]);
  
  const getStatusIndicator = () => {
    switch(availability) {
      case 'online':
        return (
          <div className="flex items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2 animate-pulse"></div>
            <span className="text-xs text-gray-500">Online now</span>
          </div>
        );
      case 'away':
        return (
          <div className="flex items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500 mr-2"></div>
            <span className="text-xs text-gray-500">Away</span>
          </div>
        );
      default:
        // Get therapist's typical response time
        return (
          <div className="flex items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-gray-300 mr-2"></div>
            <span className="text-xs text-gray-500">Typically replies within 24 hours</span>
          </div>
        );
    }
  };
  
  return getStatusIndicator();
};

export default ChatHeader;