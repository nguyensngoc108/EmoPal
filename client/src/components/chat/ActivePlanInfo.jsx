import React from 'react';
import { CalendarIcon, VideoCameraIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

const ActivePlanInfo = ({ plan }) => {
  if (!plan) return null;
  
  // Check if this is a session rather than a plan
  const isSession = plan.session_type && plan.start_time && plan.end_time;
  
  // Return early if this isn't a plan or session
  if (!isSession && !plan.plan_type) return null;
  
  // For sessions, use a different display format
  if (isSession) {
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString([], { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };
    
    return (
      <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-indigo-800">
            {plan.session_type === 'video' ? 'Video Session' : 'Text Session'}
          </h3>
          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
            {plan.status}
          </span>
        </div>
        
        <div className="flex items-center text-xs text-indigo-700 mb-2">
          <CalendarIcon className="h-4 w-4 mr-1" />
          <span>{formatDate(plan.start_time)} - {formatDate(plan.end_time).split(',')[1]}</span>
        </div>
      </div>
    );
  }
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  };
  
  const daysRemaining = () => {
    if (!plan.end_date) return 0;
    const endDate = new Date(plan.end_date);
    const today = new Date();
    const diffTime = endDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  const getPlanTypeLabel = () => {
    switch(plan.plan_type) {
      case 'text_only':
        return 'Text Only';
      case 'standard':
        return 'Standard';
      case 'premium':
        return 'Premium';
      default:
        return plan.plan_type || 'Unknown';
    }
  };
  
  return (
    <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-indigo-800">
          {getPlanTypeLabel()} Plan
        </h3>
        <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
          {daysRemaining()} days remaining
        </span>
      </div>
      
      <div className="flex items-center text-xs text-indigo-700 mb-2">
        <CalendarIcon className="h-4 w-4 mr-1" />
        <span>Valid until {formatDate(plan.end_date)}</span>
      </div>
      
      <div className="flex items-center justify-between mt-2 text-sm">
        <div className="flex items-center">
          <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1 text-indigo-600" />
          <span>Unlimited messaging</span>
        </div>
        
        <div className="flex items-center">
          <VideoCameraIcon className="h-4 w-4 mr-1 text-indigo-600" />
          <span>
            {plan.video_sessions_used} / {plan.video_sessions_allowed} video sessions
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActivePlanInfo;