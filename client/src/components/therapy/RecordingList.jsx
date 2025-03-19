import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { VideoCameraIcon, ClockIcon, ChartBarIcon, ExclamationCircleIcon, DocumentIcon } from '@heroicons/react/24/outline';
import SessionService from '../../services/SessionServices';

const RecordingList = ({ sessionId }) => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emptyMessage, setEmptyMessage] = useState("No recordings found for this session");

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        setLoading(true);
        const response = await SessionService.getSessionRecordings(sessionId);
        
        if (response.data.success) {
          setRecordings(response.data.recordings || []);
        } else {
          setEmptyMessage(response.data.message || "No recordings available");
          setRecordings([]);
        }
      } catch (err) {
        console.error('Error fetching session recordings:', err);
        setError('Failed to load recordings');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchRecordings();
    }
  }, [sessionId]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getEmotionBadge = (dominantEmotion) => {
    if (!dominantEmotion) return null;
    
    const colors = {
      happy: "bg-green-100 text-green-800",
      sad: "bg-blue-100 text-blue-800",
      angry: "bg-red-100 text-red-800",
      fear: "bg-amber-100 text-amber-800",
      neutral: "bg-gray-100 text-gray-800",
      surprise: "bg-purple-100 text-purple-800",
      disgust: "bg-teal-100 text-teal-800"
    };
    
    return (
      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${colors[dominantEmotion] || 'bg-gray-100 text-gray-800'}`}>
        {dominantEmotion}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="py-6 text-center">
        <div className="w-8 h-8 border-4 border-t-indigo-600 border-gray-200 rounded-full animate-spin mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading recordings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center text-red-600">
        <ExclamationCircleIcon className="h-8 w-8 mx-auto" />
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="py-6 text-center text-gray-500">
        <VideoCameraIcon className="h-8 w-8 mx-auto text-gray-400" />
        <p className="mt-2">{emptyMessage}</p>
        <p className="text-sm mt-2">
          During active sessions, recordings are automatically created when both participants are connected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-4">
        Recordings are automatically analyzed for emotional patterns and archived for your reference.
      </p>
      
      {recordings.map((recording, index) => (
        <Link 
          key={recording._id || index} 
          to={`/recordings/${recording._id}`}
          className="flex flex-col sm:flex-row bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
        >
          <div className="sm:w-40 bg-gray-100 p-4 flex items-center justify-center">
            {recording.thumbnail_url ? (
              <img 
                src={recording.thumbnail_url} 
                alt="Recording thumbnail" 
                className="h-24 w-full sm:w-32 object-cover rounded"
              />
            ) : (
              <div className="w-full h-24 flex items-center justify-center bg-gray-200 rounded">
                <VideoCameraIcon className="h-10 w-10 text-indigo-500" />
              </div>
            )}
          </div>
          
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-gray-900 flex items-center">
                  Session Recording
                  <span className="ml-2 bg-gray-100 text-gray-600 text-xs py-0.5 px-1.5 rounded">
                    #{recordings.length - index}
                  </span>
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDate(recording.created_at)}
                </p>
              </div>
              
              <div className="flex flex-col items-end">
                {recording.analysis_results?.dominant_emotion && getEmotionBadge(recording.analysis_results.dominant_emotion)}
                <div className="text-xs text-gray-500 mt-1">
                  {recording.analysis_results?.avg_valence ? (
                    <span className={recording.analysis_results.avg_valence >= 0 ? "text-green-600" : "text-red-600"}>
                      {recording.analysis_results.avg_valence > 0 ? "+" : ""}
                      {Math.round(recording.analysis_results.avg_valence * 100)}% valence
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            
            <div className="mt-2 flex items-center text-sm text-gray-500 flex-wrap gap-x-4 gap-y-1">
              <div className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-1" />
                <span>{formatDuration(recording.duration)}</span>
              </div>
              
              {recording.analysis_results && (
                <div className="flex items-center">
                  <ChartBarIcon className="h-4 w-4 mr-1" />
                  <span>Analysis available</span>
                </div>
              )}
            </div>
            
            {recording.analysis_results?.therapeutic_insights && (
              <div className="mt-2 text-xs text-gray-500">
                <DocumentIcon className="h-3 w-3 inline mr-1" />
                <span>Includes therapeutic insights</span>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
};

export default RecordingList;