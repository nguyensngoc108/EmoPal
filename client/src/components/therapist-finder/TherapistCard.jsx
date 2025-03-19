import React from 'react';
import { CheckCircleIcon, StarIcon, VideoCameraIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';

const TherapistCard = ({ therapist, onViewProfile, onBookSession }) => {
  // Format rating to show one decimal place
  const formattedRating = therapist.rating ? parseFloat(therapist.rating).toFixed(1) : '0.0';
  
  // Format price
  const formattedPrice = therapist.hourly_rate ? `$${therapist.hourly_rate}` : 'Price unavailable';
  
  // Show only first 3 specializations with a "+X more" if there are more
  const specializations = therapist.specialization || [];
  const displaySpecializations = specializations.slice(0, 3);
  const hasMoreSpecializations = specializations.length > 3;
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex flex-col md:flex-row">
        {/* Therapist photo and basic details */}
        <div className="w-full md:w-1/3 p-6 flex flex-col items-center md:border-r border-gray-200">
          <div className="relative">
            <img
              src={therapist.profile_picture || 'https://via.placeholder.com/150'}
              alt={therapist.name || "Therapist"}
              className="w-32 h-32 object-cover rounded-full border-2 border-indigo-100"
            />
            {therapist.is_verified && (
              <CheckCircleIcon className="absolute bottom-0 right-0 h-6 w-6 text-green-500 bg-white rounded-full" />
            )}
          </div>
          
          <h3 className="mt-4 text-xl font-medium text-gray-900">{therapist.name || 'Unknown'}</h3>
          
          <div className="mt-1 flex items-center">
            <StarIcon className="h-5 w-5 text-yellow-400" />
            <span className="ml-1 text-gray-700">{formattedRating}</span>
            {therapist.rating_count && (
              <span className="ml-1 text-gray-500">({therapist.rating_count})</span>
            )}
          </div>
          
          <p className="mt-2 text-sm text-gray-500">
            {therapist.years_experience 
              ? `${therapist.years_experience} years experience` 
              : 'Experience not specified'}
          </p>
          
          <p className="mt-1 font-medium text-indigo-600">{formattedPrice}/hr</p>
        </div>
        
        {/* Therapist details and actions */}
        <div className="w-full md:w-2/3 p-6">
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">SPECIALIZES IN</h4>
            <div className="flex flex-wrap gap-2">
              {displaySpecializations.map((specialization, index) => (
                <span 
                  key={index}
                  className="bg-indigo-100 text-indigo-800 text-xs px-3 py-1 rounded-full"
                >
                  {specialization}
                </span>
              ))}
              {hasMoreSpecializations && (
                <span className="bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full">
                  +{specializations.length - 3} more
                </span>
              )}
            </div>
          </div>
          
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">ABOUT</h4>
            <p className="text-gray-700 text-sm line-clamp-3">
              {therapist.bio || 'No bio provided.'}
            </p>
          </div>
          
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-500 mb-2">SESSION FORMATS</h4>
            <div className="flex gap-3">
              {(therapist.session_formats || []).includes('video') && (
                <div className="flex items-center text-sm text-gray-700">
                  <VideoCameraIcon className="h-4 w-4 mr-1" />
                  <span>Video</span>
                </div>
              )}
              {(therapist.session_formats || []).includes('messaging') && (
                <div className="flex items-center text-sm text-gray-700">
                  <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                  <span>Messaging</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={onViewProfile}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              View Profile
            </button>
            <button 
              onClick={onViewProfile}
              className="flex-1 px-4 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors text-sm font-medium"
            >
              Book a Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistCard;