import React, { useMemo, useCallback, useEffect } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { 
  DocumentIcon, 
  PhotoIcon, 
  CalendarIcon, 
  ClipboardDocumentCheckIcon, 
  ClipboardDocumentIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';
import MessageBubble from './MessageBubble';

// Add a utility function at the top level of your file:
const getFormattedTime = (timestamp) => {
  if (!timestamp) return "";
  
  try {
    // Handle different timestamp formats
    let date;
    if (typeof timestamp === 'string') {
      // ISO string with timezone
      if (timestamp.includes('T') && timestamp.includes('Z')) {
        date = new Date(timestamp);
      }
      // ISO string without timezone
      else if (timestamp.includes('T')) {
        date = new Date(timestamp);
      }
      // Unix timestamp as string
      else if (/^\d+$/.test(timestamp)) {
        date = new Date(parseInt(timestamp, 10));
      }
      // Other string formats
      else {
        date = new Date(timestamp);
      }
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      date = new Date();
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn("Invalid timestamp:", timestamp);
      return "";
    }
    
    // Format time
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch (error) {
    console.error("Error formatting time:", error);
    return "";
  }
};

// Add this helper function at the top of your component
const formatTimeIfValid = (timestamp, formatString) => {
  if (!timestamp) return "";
  
  try {
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "";
    }
    
    return format(date, formatString);
  } catch (error) {
    console.error("Date formatting error:", error);
    return "";
  }
};

// Add this helper function at the top of the file
const isSameId = (id1, id2) => {
  if (!id1 || !id2) return false;
  
  // Convert to string and normalize format
  const normalize = (id) => String(id).trim().toLowerCase();
  return normalize(id1) === normalize(id2);
};

// Message types renderer with specialized displays for therapy content
const MessageList = ({ messages, currentUserId, conversationType }) => {
  // Simplified helper - direct ID comparison only
  const isFromCurrentUser = useCallback((message) => {
    return message.sender_id === currentUserId;
  }, [currentUserId]);
  
  // Debug any messages that still appear on the wrong side
  useEffect(() => {
    if (messages.length > 0) {

      messages.forEach(msg => {
      
      });
    }
  }, [messages, currentUserId]);
  
  // Group messages by date
  const messagesByDate = useMemo(() => {
    const groups = [];
    let currentGroup = null;
    
    // Ensure messages is an array and is sorted
    const messagesToGroup = Array.isArray(messages) ? [...messages] : [];
    
    messagesToGroup.forEach(message => {
      // Skip messages without content or timestamp
      if (!message || !message.timestamp) return;
      
      try {
        const messageDate = new Date(message.timestamp);
        if (!messageDate || isNaN(messageDate.getTime())) return;
        
        // Format date for grouping - use ISO date string for consistency
        const dateStr = messageDate.toISOString().split('T')[0];
        
        if (!currentGroup || currentGroup.date !== dateStr) {
          currentGroup = { 
            date: dateStr, 
            displayDate: formatMessageDate(messageDate),
            messages: [] 
          };
          groups.push(currentGroup);
        }
        
        currentGroup.messages.push(message);
      } catch (err) {
        console.error("Error processing message for grouping:", err);
      }
    });
    
    return groups;
  }, [messages]);
  
  // Process message groups into sender groups
  const processMessageGroup = useCallback((messages) => {
    const result = [];
    let currentSenderGroup = null;
    
    messages.forEach((message, index) => {
      // Determine if message is from the current user
      const isCurrentUserMessage = isFromCurrentUser(message);
      
      // Start a new group when sender changes or more than 5 mins apart
      const needsNewGroup = !currentSenderGroup || 
        currentSenderGroup.isOwn !== isCurrentUserMessage ||
        timeDifferenceExceeds(message.timestamp, messages[index-1]?.timestamp, 5);
        
      if (needsNewGroup) {
        currentSenderGroup = {
          senderId: message.sender_id,
          isOwn: isCurrentUserMessage,
          messages: [message]
        };
        result.push(currentSenderGroup);
      } else {
        currentSenderGroup.messages.push(message);
      }
    });
    
    return result;
  }, [isFromCurrentUser]);
  
  return (
    <div className="space-y-4">
      {messagesByDate.map((group, i) => (
        <div key={group.date} className="message-date-group">
          <div className="flex justify-center my-4">
            <div className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
              {group.displayDate}
            </div>
          </div>
          
          {processMessageGroup(group.messages).map((senderGroup, j) => (
            <div 
              key={`${i}-${j}`} 
              className={`${senderGroup.isOwn ? 'items-end' : 'items-start'} flex flex-col space-y-1 mb-2`}
            >
              {senderGroup.messages.map((message, k) => (
                <MessageBubble
                  key={message.id || message._id}
                  message={message}
                  isOwn={message.sender_id === currentUserId}
                  showAvatar={k === 0} // Only show avatar for first message in group
                  showTime={k === senderGroup.messages.length - 1} // Only show time for last message
                  // other props...
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// Helper functions
function sortMessages(messages) {
  return messages.sort((a, b) => {
    // Sort by timestamp first
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    
    if (timeA !== timeB) return timeA - timeB;
    
    // If timestamps are equal, sort by sequence if available
    return (a.sequence || 0) - (b.sequence || 0);
  });
}

function formatMessageDate(date) {
  // Format as YYYY-MM-DD in UTC
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getDisplayDate(date) {
  if (isToday(date)) {
    return 'Today';
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMMM d, yyyy');
  }
}

function timeDifferenceExceeds(timestamp1, timestamp2, minutes) {
  if (!timestamp1 || !timestamp2) return true;
  
  const time1 = new Date(timestamp1).getTime();
  const time2 = new Date(timestamp2).getTime();
  const diffMinutes = Math.abs(time1 - time2) / (60 * 1000);
  
  return diffMinutes > minutes;
}

export default MessageList;