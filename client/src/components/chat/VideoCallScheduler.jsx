import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ChatService from '../../services/ChatService';

const VideoCallScheduler = ({ therapistId, onSchedule, onCancel, remainingSessions = 0 }) => {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Generate dates for the next 14 days
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });
  
  // Load available slots when date changes
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!therapistId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const formattedDate = selectedDate.toISOString().split('T')[0];
        const response = await ChatService.getTherapistAvailability(therapistId, formattedDate);
        
        if (response.data.success) {
          setAvailableSlots(response.data.slots || []);
        } else {
          setError('Failed to load available time slots');
        }
      } catch (err) {
        console.error('Error fetching slots:', err);
        setError('Could not load availability. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAvailableSlots();
  }, [selectedDate, therapistId]);
  
  const handleSchedule = () => {
    if (selectedTime && remainingSessions > 0) {
      onSchedule(selectedTime);
    }
  };
  
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Schedule Video Session</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        {remainingSessions <= 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
            You've used all your video sessions. Please upgrade your plan to schedule more.
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
          <div className="flex overflow-x-auto pb-2 space-x-2">
            {dateOptions.map((date) => (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`px-3 py-2 rounded-md text-sm whitespace-nowrap ${
                  selectedDate.toDateString() === date.toDateString()
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {formatDate(date)}
              </button>
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Time</label>
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-sm py-2">{error}</div>
          ) : availableSlots.length === 0 ? (
            <div className="text-gray-500 text-sm py-2">No available slots for this date</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot.start_time}
                  onClick={() => setSelectedTime(slot.start_time)}
                  className={`py-2 px-3 rounded-md text-sm ${
                    selectedTime === slot.start_time
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {formatTime(slot.start_time)}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 mr-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={!selectedTime || remainingSessions <= 0 || loading}
            className={`px-4 py-2 rounded-md ${
              !selectedTime || remainingSessions <= 0 || loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallScheduler;