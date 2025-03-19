import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  UserIcon, 
  AcademicCapIcon, 
  LanguageIcon, 
  CurrencyDollarIcon, 
  StarIcon,
  ClockIcon,
  CalendarIcon,
  CheckCircleIcon,
  VideoCameraIcon, 
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import TherapistService from '../services/TherapistServices';
import SessionService from '../services/SessionServices';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from '../components/common/Toast';

const TherapistProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(null);
  const { currentUser } = useAuth();
  const [sessionType, setSessionType] = useState('video');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');
  const [sessionDuration, setSessionDuration] = useState(2);
  const [customTimeMode, setCustomTimeMode] = useState(false);
  const [customStartTime, setCustomStartTime] = useState('');
  const [customDuration, setCustomDuration] = useState(2);
  
  // Fetch therapist data
  useEffect(() => {
    const fetchTherapist = async () => {
      try {
        setLoading(true);
        const response = await TherapistService.getTherapistProfile(id);
        setTherapist(response.data.therapist);
 
        
        // Also fetch reviews
        const reviewsResponse = await TherapistService.getTherapistFeedback(id);
        setReviews(reviewsResponse.data.feedback || []);
        
        // Get availability for current week
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);
        
        const availabilityResponse = await TherapistService.getTherapistAvailability(id, {
          start_date: now.toISOString().split('T')[0],
          end_date: nextWeek.toISOString().split('T')[0]
        });
        // console.log(availabilityResponse.data.availability);
        
        setAvailableTimes(availabilityResponse.data.availability || []);
      } catch (err) {
        console.error("Error fetching therapist details:", err);
        setError("Failed to load therapist profile");
      } finally {
        setLoading(false);
      }
    };
    
    fetchTherapist();
  }, [id]);
  
  // Inside the useEffect or create a new function to fetch availability
  const fetchAvailabilityForDate = async (date) => {
    try {
      // Use the selected date
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1); // Just get this single day
      
      const availabilityResponse = await TherapistService.getTherapistAvailability(id, {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      });
      
      setAvailableTimes(availabilityResponse.data.availability || []);
    } catch (err) {
      console.error("Error fetching availability:", err);
    }
  };

  // Also call this when component mounts
  useEffect(() => {
    fetchAvailabilityForDate(selectedDate);
  }, [id, selectedDate]); // Add selectedDate as dependency
  
  // Fix the handleBookSession function
  const handleBookSession = async () => {
    if (!selectedTime) return;
    
    try {
      // Create a proper date combination of selected date + selected time
      const selectedTimeObj = new Date(selectedTime);
      const startTime = new Date(selectedDate);
      
      // Transfer only the time portion from selectedTimeObj to startDate
      startTime.setHours(
        selectedTimeObj.getHours(),
        selectedTimeObj.getMinutes(),
        0, 0
      );
      
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + sessionDuration);
      

      
      // Create session data with properly combined date/time
      const sessionData = {
        therapist_id: id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        session_type: sessionType,
        duration_hours: sessionDuration
      };
      
      // Book the session directly
      const response = await SessionService.bookSession(sessionData);
      
      // Show success toast
      setToastMessage('Session booked successfully! Proceeding to payment...');
      setToastType('success');
      setShowToast(true);
      
      // Redirect to payment page
      setTimeout(() => {
        navigate(`/payment/${response.data.session_id}`);
      }, 1500);
    } catch (err) {
      console.error("Error booking session:", err);
      setToastMessage('Failed to book session. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleCustomBookSession = async () => {
    if (!customStartTime) return;
    
    try {
      const startTime = new Date(customStartTime);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + customDuration);
      
      const sessionData = {
        therapist_id: id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        session_type: sessionType,
        duration_hours: customDuration,
        is_custom_request: true,
        notes: "Custom time requested by client"
      };

      
      const response = await SessionService.bookSession(sessionData);
      
      // Show success toast
      setToastMessage('Custom time request sent to therapist!');
      setToastType('success');
      setShowToast(true);
      
      // Navigate after a brief delay to show the toast
      setTimeout(() => {
        navigate(`/sessions/${response.data.session_id}`);
      }, 1500);
    } catch (err) {
      console.error("Error requesting custom session:", err);
      setError("Failed to request custom session. Please try again.");
      setToastMessage('Failed to request custom session. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (error || !therapist) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600">Error</h2>
        <p className="mt-2 text-gray-600">{error || "Failed to load therapist profile"}</p>
        <button 
          onClick={() => navigate(-1)}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-md"
        >
          Go Back
        </button>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 min-h-screen py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 text-gray-600 flex items-center hover:text-indigo-600 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to search
        </button>
        
        {/* Therapist profile header */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 h-36 relative">
            {therapist.is_verified && (
              <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm font-medium">Verified Professional</span>
              </div>
            )}
          </div>
          
          <div className="px-6 py-8 relative">
            <div className="absolute -top-16 left-6 border-4 border-white rounded-full overflow-hidden">
              <img 
                src={therapist.profile_picture || 'https://via.placeholder.com/150'} 
                alt={therapist.name}
                className="w-32 h-32 object-cover"
              />
            </div>
            
            <div className="ml-40">
              <div className="flex flex-wrap items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{therapist.name}</h1>
                  <p className="text-gray-600 mt-1">{therapist.title || 'Licensed Therapist'}</p>
                </div>
                <div className="flex items-center bg-yellow-50 px-3 py-1 rounded-md">
                  <StarIcon className="h-5 w-5 text-yellow-400 mr-2" />
                  <span className="font-medium text-gray-800">{therapist.rating ? parseFloat(therapist.rating).toFixed(1) : 'N/A'}</span>
                  {therapist.rating_count && (
                    <span className="ml-1 text-gray-500">({therapist.rating_count} ratings)</span>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-4">
                <div className="flex items-center text-gray-600">
                  <UserIcon className="h-5 w-5 mr-2 text-gray-400" />
                  <span>{therapist.gender || 'Gender not specified'}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <AcademicCapIcon className="h-5 w-5 mr-2 text-gray-400" />
                  <span>{therapist.years_experience} years experience</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <LanguageIcon className="h-5 w-5 mr-2 text-gray-400" />
                  <span>{(therapist.languages || ['English']).join(', ')}</span>
                </div>
                <div className="flex items-center text-indigo-600 font-medium">
                  <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                  <span>${therapist.hourly_rate}/hr</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* About section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">About</h2>
              <p className="text-gray-700 whitespace-pre-line">{therapist.bio || 'No bio available.'}</p>
            </div>
            
            {/* Specializations */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Specializations</h2>
              <div className="flex flex-wrap gap-2">
                {(therapist.specialization || []).map((spec, index) => (
                  <span 
                    key={index} 
                    className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm"
                  >
                    {spec}
                  </span>
                ))}
                {therapist.specialization?.length === 0 && (
                  <p className="text-gray-500">No specializations listed</p>
                )}
              </div>
            </div>
            
            {/* Education & Credentials */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Education & Credentials</h2>
              <ul className="space-y-4">
                {(therapist.education || []).map((edu, index) => (
                  <li key={index} className="border-l-2 border-indigo-500 pl-4">
                    <h3 className="font-medium text-gray-800">{edu.degree || 'Degree'}</h3>
                    <p className="text-gray-600">{edu.institution || 'Institution'}</p>
                    <p className="text-gray-500 text-sm">{edu.year || ''}</p>
                  </li>
                ))}
                {therapist.education?.length === 0 && (
                  <p className="text-gray-500">No education details available</p>
                )}
              </ul>
              
              {therapist.license_number && (
                <div className="mt-6">
                  <h3 className="font-medium text-gray-800">License</h3>
                  <p className="text-gray-600">{therapist.license_number}</p>
                </div>
              )}
            </div>
            
            {/* Reviews */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Reviews</h2>
                <span className="text-gray-500">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
              </div>
              
              {reviews.length === 0 ? (
                <p className="text-gray-500">No reviews yet</p>
              ) : (
                <div className="space-y-6">
                  {reviews.map(review => (
                    <div key={review._id} className="border-b pb-6 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center">
                          <div className="bg-indigo-100 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                            {review.user_name ? review.user_name.charAt(0).toUpperCase() : 'A'}
                          </div>
                          <span className="font-medium text-gray-800">
                            {review.user_name || 'Anonymous User'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <StarIcon className="h-5 w-5 text-yellow-400 mr-1" />
                          <span>{review.rating}</span>
                        </div>
                      </div>
                      <p className="text-gray-700">{review.comment}</p>
                      <p className="text-gray-500 text-sm mt-1">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Sidebar - Booking */}
          <div className="space-y-6">
            {/* Booking widget */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Book a Session</h2>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Select Date</label>
                <div className="border rounded-md p-2">
                  <CalendarIcon className="h-5 w-5 text-gray-500 mx-auto mb-2" />
                  <input 
                    type="date"
                    className="w-full border-none focus:ring-0 text-center"
                    value={selectedDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      setSelectedDate(newDate);
                      setSelectedTime(null); // Reset selected time when date changes
                      fetchAvailabilityForDate(newDate);
                    }}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 mb-2">Available Time Slots</label>
                {availableTimes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {availableTimes.map((slot, index) => (
                      <button
                        key={`${slot.availability_id || ''}-${index}`}
                        className={`border rounded-md p-2 flex items-center justify-center ${
                          selectedTime === slot.start_time 
                            ? 'border-indigo-600 bg-indigo-50' 
                            : 'border-gray-300 hover:border-indigo-300'
                        }`}
                        onClick={() => {
                          setSelectedTime(slot.start_time);
                          setSessionDuration(slot.default_duration || 2);
                        }}
                      >
                        <ClockIcon className="h-4 w-4 mr-2 text-gray-500" />
                        <div>
                          <span>
                            {new Date(slot.start_time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {' - '}
                            {new Date(slot.end_time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className="text-xs block text-indigo-600 mt-1">
                            {slot.default_duration || 2}-hour session
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No available times for selected date</p>
                )}
              </div>
              
              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-indigo-600 text-sm hover:text-indigo-800"
                  onClick={() => setCustomTimeMode(!customTimeMode)}
                >
                  {customTimeMode ? 'Use standard slots' : 'Request custom time'}
                </button>
              </div>

              {customTimeMode && (
                <div className="mt-4 p-4 border border-gray-200 rounded-md">
                  <h3 className="font-medium text-gray-800 mb-3">Custom Time Request</h3>
                  
                  <div className="mb-3">
                    <label className="block text-sm text-gray-600 mb-1">Preferred Date & Time</label>
                    <input
                      type="datetime-local"
                      className="w-full border-gray-300 rounded-md"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-sm text-gray-600 mb-1">Session Length</label>
                    <select
                      className="w-full border-gray-300 rounded-md"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(parseInt(e.target.value))}
                    >
                      {[2, 3].map(hours => (
                        <option key={hours} value={hours}>
                          {hours} hours
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={handleCustomBookSession}
                    disabled={!customStartTime}
                    className={`w-full py-2 rounded-md text-white text-center font-medium ${
                      customStartTime 
                        ? 'bg-indigo-600 hover:bg-indigo-700' 
                        : 'bg-indigo-300 cursor-not-allowed'
                    }`}
                  >
                    Request Custom Time
                  </button>
                  
                  <p className="text-xs text-gray-500 mt-2">
                    Custom time requests require therapist approval before confirmation.
                  </p>
                </div>
              )}
              
              <button
                onClick={handleBookSession}
                disabled={!selectedTime}
                className={`w-full py-3 rounded-md text-white text-center font-medium ${
                  selectedTime 
                    ? 'bg-indigo-600 hover:bg-indigo-700' 
                    : 'bg-indigo-300 cursor-not-allowed'
                }`}
              >
                Book Session
              </button>
            </div>
            
            {/* Session types - UPDATED TO ONLY 2 OPTIONS */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Session Format</h2>
              
              <div className="space-y-3">
                <div 
                  onClick={() => setSessionType('video')}
                  className={`cursor-pointer border rounded-md p-4 flex items-center ${
                    sessionType === 'video' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <VideoCameraIcon className="h-6 w-6 text-indigo-600 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-800">Video Therapy</h3>
                    <p className="text-sm text-gray-600">Complete therapy experience with video and messaging included</p>
                  </div>
                </div>
                
                <div 
                  onClick={() => setSessionType('text')}
                  className={`cursor-pointer border rounded-md p-4 flex items-center ${
                    sessionType === 'text' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <ChatBubbleLeftRightIcon className="h-6 w-6 text-indigo-600 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-800">Messaging Only</h3>
                    <p className="text-sm text-gray-600">Written communication through secure text-based platform</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 border border-yellow-200 bg-yellow-50 rounded-md">
                <h3 className="font-medium text-gray-800 flex items-center">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-yellow-500" />
                  Session Information
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Sessions are 2-3 hours in length. Your therapist will guide the conversation and provide personalized support tailored to your needs.
                </p>
              </div>
            </div>
            
            {/* Session price estimation - SAME PRICE REGARDLESS OF SESSION TYPE */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Pricing</h2>
              <div className="flex justify-between items-center border-b pb-4">
                <span className="text-gray-600">Session fee</span>
                <span className="font-medium">${therapist.hourly_rate}/hr</span>
              </div>
              <div className="flex justify-between items-center border-b pb-4 pt-4">
                <span className="text-gray-600">Duration</span>
                <span className="font-medium">
                  {customTimeMode ? customDuration : sessionDuration} hours
                </span>
              </div>
              <div className="flex justify-between items-center pt-4">
                <span className="font-medium">Total</span>
                <span className="font-bold text-lg">
                  ${therapist.hourly_rate * (customTimeMode ? customDuration : sessionDuration)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                *Your insurance may cover a portion of this cost. Contact your provider for details.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};

export default TherapistProfile;