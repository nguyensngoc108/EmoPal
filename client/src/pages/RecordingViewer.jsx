import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeftIcon, 
  ChartBarIcon, 
  DocumentTextIcon,
  CloudArrowDownIcon,
  ExclamationCircleIcon,
  FaceSmileIcon
} from '@heroicons/react/24/outline';
import SessionService from '../services/SessionServices';
import { useAuth } from '../contexts/AuthContext';
import Chart from 'chart.js/auto';
// import '../styles/MediaDetail.css';
import '../styles/RecordingViewer.css'; // Create this CSS file

const RecordingViewer = () => {
  const { recordingId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [recording, setRecording] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("emotions");
  
  // Chart references
  const emotionChartRef = useRef(null);
  const timelineChartRef = useRef(null);
  const valenceChartRef = useRef(null);
  
  useEffect(() => {
    const fetchRecordingDetails = async () => {
      try {
        setLoading(true);
        const response = await SessionService.getRecordingDetails(recordingId);
        
        if (!response.data.success) {
          throw new Error(response.data.message || "Failed to load recording details");
        }

        
        setRecording(response.data.recording);
        
        // Also fetch the associated session
        if (response.data.recording && response.data.recording.session_id) {
          const sessionResponse = await SessionService.getSessionById(response.data.recording.session_id);
          if (sessionResponse.data.success) {
            setSession(sessionResponse.data.session);
          }
        }
        
        setError("");
      } catch (err) {
        console.error('Error fetching recording details:', err);
        setError(err.message || "Failed to load recording");
      } finally {
        setLoading(false);
      }
    };

    fetchRecordingDetails();
  }, [recordingId]);
  
  // Initialize charts when recording data is loaded
  useEffect(() => {
    if (recording && !loading && activeTab === "emotions") {
      initializeCharts();
    }
  }, [recording, loading, activeTab]);
  
  const initializeCharts = () => {
    // Clean up existing charts
    if (emotionChartRef.current) {
      emotionChartRef.current.destroy();
    }
    if (timelineChartRef.current) {
      timelineChartRef.current.destroy();
    }
    if (valenceChartRef.current) {
      valenceChartRef.current.destroy();
    }
    
    // Get emotion analysis data
    const analysisResults = recording.analysis_results || {};
    
    // Initialize emotion distribution chart
    if (analysisResults.emotions && document.getElementById("emotionChart")) {
      const ctx = document.getElementById("emotionChart").getContext("2d");
      const emotions = analysisResults.emotions;
      
      emotionChartRef.current = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: Object.keys(emotions).map(e => e.charAt(0).toUpperCase() + e.slice(1)),
          datasets: [{
            data: Object.values(emotions).map(v => Math.round(v * 100)),
            backgroundColor: [
              '#4CAF50', '#2196F3', '#F44336', '#FF9800', '#9E9E9E', '#9C27B0', '#795548'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right'
            },
            title: {
              display: true,
              text: 'Emotion Distribution'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.label}: ${context.raw}%`;
                }
              }
            }
          }
        }
      });
    }
    
    // Initialize timeline chart for emotion changes over time
    if (analysisResults.emotion_timeline && document.getElementById("timelineChart")) {
      const ctx = document.getElementById("timelineChart").getContext("2d");
      const timeline = analysisResults.emotion_timeline;
      const emotions = Object.keys(timeline);
      
      // Prepare datasets from timeline data
      const timestamps = Object.keys(timeline[emotions[0]]).map(t => parseFloat(t));
      
      const datasets = emotions.map((emotion, index) => {
        const colorPalette = ['#4CAF50', '#2196F3', '#F44336', '#FF9800', '#9E9E9E', '#9C27B0', '#795548'];
        
        return {
          label: emotion.charAt(0).toUpperCase() + emotion.slice(1),
          data: timestamps.map(t => timeline[emotion][t] * 100),
          borderColor: colorPalette[index % colorPalette.length],
          backgroundColor: colorPalette[index % colorPalette.length] + '20',
          fill: false,
          tension: 0.4,
          borderWidth: 2
        };
      });
      
      timelineChartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timestamps.map(t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`),
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              title: {
                display: true,
                text: 'Intensity (%)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Time (mm:ss)'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Emotion Changes Over Time'
            },
            legend: {
              position: 'top'
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          }
        }
      });
    }
    
    // Initialize valence chart
    if (analysisResults.valence_timeline && document.getElementById("valenceChart")) {
      const ctx = document.getElementById("valenceChart").getContext("2d");
      const valenceData = analysisResults.valence_timeline;
      const timestamps = Object.keys(valenceData).map(t => parseFloat(t));
      
      valenceChartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timestamps.map(t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`),
          datasets: [{
            label: 'Valence',
            data: timestamps.map(t => valenceData[t]),
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            fill: true,
            tension: 0.4,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              min: -1,
              max: 1,
              title: {
                display: true,
                text: 'Valence (-1 to +1)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Time (mm:ss)'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Emotional Valence Over Time'
            }
          }
        }
      });
    }
  };
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };
  
  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const getEmotionColor = (emotion) => {
    const colors = {
      happy: "#4CAF50",
      sad: "#2196F3",
      angry: "#F44336",
      fear: "#FF9800",
      neutral: "#9E9E9E",
      surprise: "#9C27B0",
      disgust: "#795548",
    };
    return colors[emotion] || "#9E9E9E";
  };
  
  const getOverallSentiment = () => {
    if (!recording || !recording.analysis_results) return "Neutral";
    
    const valence = recording.analysis_results.valence ?? 
                    recording.analysis_results.overall?.avg_valence ?? 0;
    
    if (valence >= 0.5) return "Very Positive";
    if (valence >= 0.2) return "Positive";
    if (valence >= -0.2) return "Neutral";
    if (valence >= -0.5) return "Negative";
    return "Very Negative";
  };
  
  
  const getSentimentClass = () => {
    if (!recording || !recording.analysis_results) return "neutral";
    
    const valence = recording.analysis_results.valence ?? 
                    recording.analysis_results.overall?.avg_valence ?? 0;
    
    if (valence >= 0.5) return "very-positive";
    if (valence >= 0.2) return "positive";
    if (valence >= -0.2) return "neutral";
    if (valence >= -0.5) return "negative";
    return "very-negative";
  };
  
  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500">Loading recording...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-center py-16">
            <ExclamationCircleIcon className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Error Loading Recording
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              to="/sessions"
              className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Sessions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-center py-16">
            <ExclamationCircleIcon className="h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Recording Not Found
            </h2>
            <p className="text-gray-600 mb-6">
              The requested recording could not be found
            </p>
            <Link
              to="/sessions"
              className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Sessions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div className="flex items-center">
            <Link
              to={`/sessions/${recording.session_id}`}
              className="mr-4 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                Session Recording
              </h1>
              <p className="text-gray-600">
                {formatDate(recording.created_at)}
              </p>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 flex gap-2">
            {session && (
              <Link 
                to={`/sessions/${session._id}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Session Details
              </Link>
            )}
            {recording.media_url && (
              <a 
                href={recording.media_url} 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-indigo-600 bg-white text-indigo-600 rounded-md shadow-sm text-sm font-medium hover:bg-indigo-50"
              >
                <CloudArrowDownIcon className="h-4 w-4 mr-2" />
                Download Recording
              </a>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("emotions")}
              className={`flex-1 py-4 px-6 text-center font-medium text-sm md:text-base transition-colors ${
                activeTab === "emotions"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <FaceSmileIcon className="h-5 w-5 inline mr-2" />
              Emotion Analysis
            </button>
            <button
              onClick={() => setActiveTab("data")}
              className={`flex-1 py-4 px-6 text-center font-medium text-sm md:text-base transition-colors ${
                activeTab === "data"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <ChartBarIcon className="h-5 w-5 inline mr-2" />
              Raw Data
            </button>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === "emotions" ? (
          <div className="grid grid-cols-1 gap-6">
            {/* Video and Summary Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Video Player */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">Recording</h2>
                </div>
                <div className="p-6">
                  <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
                    {recording.media_url ? (
                      <video 
                        src={recording.media_url} 
                        controls 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <p className="text-gray-500">Video not available</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-500 mb-1">Duration</div>
                      <div className="font-medium">{formatDuration(recording.duration)}</div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-500 mb-1">Date</div>
                      <div className="font-medium">{new Date(recording.created_at).toLocaleDateString()}</div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-500 mb-1">Client</div>
                      <div className="font-medium">{session?.client_name || 'Unknown'}</div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-500 mb-1">Sentiment</div>
                      <div className={`font-medium sentiment-${getSentimentClass()}`}>
                        {getOverallSentiment()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Emotion Summary */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Analysis Summary
                  </h2>
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    <div className="text-sm text-gray-500 mb-1">Dominant Emotion</div>
                    <div className="flex items-center">
                      <div
                        className="w-4 h-4 rounded-full mr-2"
                        style={{ backgroundColor: getEmotionColor(recording.analysis_results?.dominant_emotion) }}
                      ></div>
                      <span className="text-lg font-semibold text-gray-800 capitalize">
                        {recording.analysis_results?.dominant_emotion || 
                         recording.analysis_results?.overall?.dominant_emotion || 
                         "Not detected"}
                      </span>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="text-sm text-gray-500 mb-1">Emotional Valence</div>
                    <div className="text-lg font-semibold text-gray-800">
                      {(recording.analysis_results?.valence !== undefined || recording.analysis_results?.overall?.avg_valence !== undefined)
                        ? `${((recording.analysis_results?.valence ?? recording.analysis_results?.overall?.avg_valence) * 100).toFixed(1)}%` 
                        : 'N/A'}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="h-2 rounded-full" 
                        style={{
                          width: `${(((recording.analysis_results?.valence ?? recording.analysis_results?.overall?.avg_valence) || 0) + 1) / 2 * 100}%`,
                          backgroundColor: (recording.analysis_results?.valence ?? recording.analysis_results?.overall?.avg_valence) >= 0 ? '#4CAF50' : '#F44336'
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Negative</span>
                      <span>Neutral</span>
                      <span>Positive</span>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="text-sm text-gray-500 mb-1">Engagement Level</div>
                    <div className="text-lg font-semibold text-gray-800">
                      {(recording.analysis_results?.engagement !== undefined || recording.analysis_results?.overall?.avg_engagement !== undefined)
                        ? `${Math.round((recording.analysis_results?.engagement ?? recording.analysis_results?.overall?.avg_engagement) * 100)}%` 
                        : 'N/A'}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="h-2 rounded-full bg-blue-500" 
                        style={{
                          width: `${Math.round(((recording.analysis_results?.engagement ?? recording.analysis_results?.overall?.avg_engagement) || 0) * 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500 mb-1">Faces Detected</div>
                    <div className="text-lg font-semibold text-gray-800">
                      {recording.analysis_results?.face_count || 1}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Emotion Distribution */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  Emotion Distribution
                </h2>
              </div>
              <div className="p-6">
                {recording.analysis_results?.emotions ? (
                  <>
                    {Object.entries(recording.analysis_results.emotions).map(([emotion, value]) => (
                      <div key={emotion} className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {emotion}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {Math.round(value * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="h-2.5 rounded-full"
                            style={{
                              width: `${Math.round(value * 100)}%`,
                              backgroundColor: getEmotionColor(emotion),
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                    <div className="h-60 mt-6">
                      <canvas id="emotionChart" />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No emotion distribution data available
                  </div>
                )}
              </div>
            </div>
            
            {/* Emotion Timeline */}
            {recording.analysis_results?.emotion_timeline && (
              <EmotionTimelineView recording={recording} />
            )}
            
            {/* Valence Timeline */}
            {recording.analysis_results?.valence_timeline && (
              <div className="bg-white rounded-xl shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Emotional Valence Over Time
                  </h2>
                </div>
                <div className="p-6">
                  <div className="h-80">
                    <canvas id="valenceChart" />
                  </div>
                </div>
              </div>
            )}
            
            {/* Therapeutic Insights */}
            {recording.analysis_results?.therapeutic_insights && (
              <TherapeuticInsights recording={recording} session={session} />
            )}
            
            {/* Significant Changes */}
            {recording.analysis_results?.emotion_changes && recording.analysis_results.emotion_changes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Significant Emotional Changes
                  </h2>
                </div>
                <div className="p-6">
                  <div className="max-h-[400px] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {recording.analysis_results.emotion_changes.map((change, index) => (
                        <div
                          key={index}
                          className={`border-l-4 pl-3 py-2 pr-3 rounded bg-gray-50 flex justify-between ${
                            change.change === 'increased' 
                              ? 'border-green-500' 
                              : 'border-red-500'
                          }`}
                        >
                          <div className="flex items-center">
                            <div
                              className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                              style={{ backgroundColor: getEmotionColor(change.emotion) }}
                            ></div>
                            <div>
                              <div className="capitalize font-medium text-sm">
                                {change.emotion}
                                <span className={`text-xs ml-1.5 px-1.5 py-0.5 rounded ${
                                  change.change === 'increased'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {change.change === 'increased' ? '↑' : '↓'} {Math.abs(Math.round((change.to - change.from) * 100))}%
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {Math.round(change.from * 100)}% → {Math.round(change.to * 100)}%
                              </div>
                            </div>
                          </div>
                          <div className="text-xs bg-gray-200 rounded px-2 py-1 flex items-center h-fit">
                            {change.timestamp.toFixed(1)}s
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <DataTab recording={recording} />
        )}
      </div>
    </div>
  );
};

const DataTab = ({ recording }) => {
  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">
          Raw Analysis Data
        </h2>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">
          Recording Metadata
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm font-medium text-gray-500">Recording ID</p>
            <p className="text-sm text-gray-800">{recording._id}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Created At</p>
            <p className="text-sm text-gray-800">
              {new Date(recording.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Session ID</p>
            <p className="text-sm text-gray-800 capitalize">
              {recording.session_id}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Duration</p>
            <p className="text-sm text-gray-800">
              {formatDuration(recording.duration)}
            </p>
          </div>
        </div>

        {/* Analysis methods used */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-700 mb-2">Analysis Methods</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>Facial Emotion Recognition using Convolutional Neural Networks</li>
              <li>Frame-by-frame emotional intensity tracking</li> 
              <li>Valence-arousal dimensional analysis</li>
              <li>Temporal emotion pattern detection</li>
              <li>State change identification algorithm</li>
            </ul>
          </div>
        </div>

        <h3 className="text-lg font-medium text-gray-800 mb-4">JSON Data</h3>
        <div className="overflow-x-auto">
          <pre className="bg-gray-50 p-4 rounded-lg text-gray-800 text-sm max-h-[70vh] overflow-auto">
            {JSON.stringify(recording.analysis_results, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

// Add Therapeutic Insights and Notes components for the recording viewer


const TherapeuticInsights = ({ recording, session }) => {
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotes, setSavedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  
  useEffect(() => {
    const fetchSessionNotes = async () => {
      if (!recording.session_id) return;
      
      try {
        setLoadingNotes(true);
        const response = await SessionService.getSessionNotes(recording.session_id);
        if (response.data.success) {
          // Filter notes related to this recording
          const relevantNotes = response.data.notes.filter(
            note => note.recording_id === recording._id || 
                    note.note_type === 'recording_note'
          );
          setSavedNotes(relevantNotes);
        }
      } catch (err) {
        console.error("Error fetching session notes:", err);
      } finally {
        setLoadingNotes(false);
      }
    };
    
    fetchSessionNotes();
  }, [recording]);
  
  const handleAddNote = async () => {
    if (!notes.trim()) return;
    
    try {
      setIsSaving(true);
      await SessionService.addSessionNote(recording.session_id, {
        content: notes,
        note_type: 'recording_note',
        recording_id: recording._id,
        timestamp: new Date().toISOString()
      });
      
      // Add the new note to the list
      setSavedNotes([
        ...savedNotes,
        {
          _id: `temp-${Date.now()}`,
          content: notes,
          note_type: 'recording_note',
          recording_id: recording._id,
          timestamp: new Date().toISOString(),
          author_name: 'You (just now)'
        }
      ]);
      
      // Clear the input
      setNotes("");
      
      // Show success toast if you have a notification system
      // toastService.success("Note added successfully");
      
    } catch (error) {
      console.error("Error adding note:", error);
      // toastService.error("Failed to add note");
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">
          Therapeutic Insights
        </h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">
              Emotional Patterns
            </h3>
            <p className="text-gray-600 mb-4">
              {recording.analysis_results?.therapeutic_insights?.patterns || 
               "The client shows varied emotional responses throughout the session. Pay attention to emotional shifts during different discussion topics."}
            </p>
            
            <h3 className="font-semibold text-gray-800 mb-3 mt-6">
              Key Observations
            </h3>
            <ul className="list-disc pl-5 text-gray-600 space-y-2">
              {recording.analysis_results?.therapeutic_insights?.observations?.map((observation, index) => (
                <li key={index}>{observation}</li>
              )) || (
                <>
                  <li>Notable {recording.analysis_results?.dominant_emotion || "neutral"} expressions during the session</li>
                  <li>Client's emotional valence tends toward {recording.analysis_results?.avg_valence > 0 ? "positive" : "negative"} affect</li>
                  <li>Overall engagement level was {Math.round((recording.analysis_results?.avg_engagement || 0.5) * 100)}%</li>
                </>
              )}
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">
              Suggested Approaches
            </h3>
            <ul className="list-disc pl-5 text-gray-600 space-y-2 mb-6">
              {recording.analysis_results?.therapeutic_insights?.suggestions?.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              )) || (
                <>
                  <li>Explore topics that elicited positive emotional responses</li>
                  <li>Address potential triggers that led to negative emotional shifts</li>
                  <li>Consider using reflection techniques to build on emotional awareness</li>
                  <li>Validate client's emotional experiences while offering coping strategies</li>
                </>
              )}
            </ul>
            
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-800 mb-3">Add Notes Based on Recording</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={4}
                placeholder="Add your therapeutic observations based on this recording..."
              />
              <button
                onClick={handleAddNote}
                disabled={!notes.trim() || isSaving}
                className="mt-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Add to Session Notes'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Previous Notes Section */}
        {savedNotes.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-800 mb-4">Previous Notes</h3>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {savedNotes.map(note => (
                <div key={note._id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <p className="text-gray-600 whitespace-pre-wrap">{note.content}</p>
                    <span className="text-xs text-gray-400 ml-4">
                      {new Date(note.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {note.author_name || "Therapist"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {loadingNotes && (
          <div className="text-center py-6">
            <div className="inline-block animate-spin h-5 w-5 border-2 border-gray-300 border-t-indigo-600 rounded-full"></div>
            <p className="mt-2 text-sm text-gray-500">Loading notes...</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Add an Emotion Timeline component for clearer visualization
const EmotionTimelineView = ({ recording }) => {
  const [highlightedTime, setHighlightedTime] = useState(null);
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const timeline = recording.analysis_results?.emotion_timeline;
  
  if (!timeline) {
    return (
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Emotion Timeline
          </h2>
        </div>
        <div className="p-6 text-center text-gray-500">
          No timeline data available for this recording
        </div>
      </div>
    );
  }

  // Get all timestamps from the first emotion (they all share the same timestamps)
  const firstEmotion = Object.keys(timeline)[0];
  const timestamps = Object.keys(timeline[firstEmotion]).map(t => parseFloat(t));
  
  // Get list of all emotions
  const emotions = Object.keys(timeline);
  
  // Helper to get color for emotion
  const getEmotionColor = (emotion) => {
    const colors = {
      happy: "#4CAF50",
      sad: "#2196F3",
      angry: "#F44336",
      fear: "#FF9800",
      neutral: "#9E9E9E",
      surprise: "#9C27B0",
      disgust: "#795548",
    };
    return colors[emotion] || "#9E9E9E";
  };
  
  // Helper to format time in mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleTimelineClick = (time) => {
    setHighlightedTime(time);
    
    // If you have video control capabilities, you could seek to this time
    // videoRef.current.currentTime = time;
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">
          Emotion Timeline
        </h2>
      </div>
      
      <div className="p-6">
        {/* Top filters for emotions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {emotions.map(emotion => (
            <button
              key={emotion}
              onClick={() => setSelectedEmotion(selectedEmotion === emotion ? null : emotion)}
              className={`px-3 py-1 rounded-full text-sm flex items-center ${
                selectedEmotion === emotion 
                  ? 'ring-2 ring-offset-2' 
                  : selectedEmotion 
                    ? 'opacity-50' 
                    : ''
              }`}
              style={{ 
                backgroundColor: `${getEmotionColor(emotion)}20`, 
                borderColor: getEmotionColor(emotion),
                color: getEmotionColor(emotion) 
              }}
            >
              <div 
                className="w-3 h-3 rounded-full mr-1"
                style={{ backgroundColor: getEmotionColor(emotion) }}
              ></div>
              {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
            </button>
          ))}
        </div>
        
        {/* Timeline - can be enhanced with a more sophisticated timeline */}
        <div className="h-80">
          <canvas id="timelineChart" />
        </div>
        
        {/* Timeline markers */}
        <div className="mt-4 relative h-16 bg-gray-100 rounded-lg">
          <div className="absolute inset-0 flex">
            {timestamps.map((time, index) => {
              // Only show a subset of timestamps for clarity
              if (index % Math.max(1, Math.floor(timestamps.length / 20)) !== 0) return null;
              
              // Calculate emotion values at this timestamp
              const emotionValues = {};
              emotions.forEach(emotion => {
                emotionValues[emotion] = timeline[emotion][time];
              });
              
              // Find dominant emotion at this time
              const dominantEmotion = emotions.reduce((a, b) => 
                emotionValues[a] > emotionValues[b] ? a : b
              );
              
              return (
                <button
                  key={time}
                  className={`absolute top-0 bottom-0 px-1 hover:bg-gray-200 cursor-pointer flex flex-col items-center justify-center ${
                    highlightedTime === time ? 'bg-gray-200 ring-2 ring-indigo-500' : ''
                  }`}
                  style={{ 
                    left: `${(time / recording.duration) * 100}%`,
                    width: '24px',
                    marginLeft: '-12px'
                  }}
                  onClick={() => handleTimelineClick(time)}
                >
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getEmotionColor(dominantEmotion) }}
                  ></div>
                  <div className="text-[10px] text-gray-600 mt-1">{formatTime(time)}</div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Selected timestamp detail */}
        {highlightedTime !== null && (
          <div className="mt-4 p-4 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Time: {formatTime(highlightedTime)}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {emotions.map(emotion => (
                <div key={emotion} className="flex items-center">
                  <div 
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: getEmotionColor(emotion) }}
                  ></div>
                  <span className="text-xs font-medium capitalize">{emotion}:</span>
                  <span className="text-xs ml-1">
                    {Math.round(timeline[emotion][highlightedTime] * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Add CSS for the RecordingViewer
// Make sure to create this file

export default RecordingViewer;

