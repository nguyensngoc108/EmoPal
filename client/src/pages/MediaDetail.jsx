import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import {
  ArrowLeftIcon,
  ExclamationCircleIcon,
  DocumentArrowDownIcon,
  TrashIcon,
  FaceSmileIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import EmotionService from "../services/EmotionServices";
import "../styles/MediaAnalysis.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tabs,
  TabsHeader,
  TabsBody,
  Tab,
  TabPanel,
} from "@material-tailwind/react";

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

const MediaDetail = () => {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("emotions");

  // Chart references
  const emotionChartRef = useRef(null);
  const timelineChartRef = useRef(null);
  const faceChartRef = useRef(null);

  useEffect(() => {
    const fetchAnalysisDetails = async () => {
      try {
        setLoading(true);
        const response = await EmotionService.getAnalysisDetails(analysisId);
        console.log("Analysis response:", response.data); // Add this line
        setAnalysis(response.data);
      } catch (err) {
        console.error("Error fetching analysis details:", err);
        setError(
          err.response?.data?.error || "Failed to load analysis details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisDetails();
  }, [analysisId]);

  useEffect(() => {
    if (analysis && !loading) {
      initializeCharts();
    }
  }, [analysis, loading, activeTab]);

  const initializeCharts = () => {
    // Clean up existing charts
    if (emotionChartRef.current) {
      emotionChartRef.current.destroy();
    }
    if (faceChartRef.current) {
      faceChartRef.current.destroy();
    }

    // Get the right data source based on media type
    const isVideo = analysis.media_type === "video";
    const emotions =
      analysis.results?.emotions || analysis.results?.overall?.emotions || {};

    // Initialize emotion distribution chart
    if (emotions && document.getElementById("emotionChart")) {
      const labels = Object.keys(emotions);
      const data = Object.values(emotions);
      const backgroundColors = labels.map((emotion) => {
        const color = getEmotionColor(emotion);
        return color.replace(")", ", 0.7)").replace("rgb", "rgba");
      });
      const borderColors = labels.map((emotion) => getEmotionColor(emotion));

      const ctx = document.getElementById("emotionChart").getContext("2d");
      emotionChartRef.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)), // Capitalize
          datasets: [
            {
              label: "Emotion Distribution",
              data: data,
              backgroundColor: backgroundColors,
              borderColor: borderColors,
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (item) => `${Math.round(item.raw * 100)}%`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 1,
              ticks: {
                callback: (value) => `${Math.round(value * 100)}%`,
              },
            },
          },
        },
      });
    }

    // Initialize face data chart if available
    if (
      analysis.results?.faces?.length > 0 &&
      document.getElementById("faceChart")
    ) {
      const faceData = analysis.results.faces[0];
      if (!faceData) return;

      const ctx = document.getElementById("faceChart").getContext("2d");
      faceChartRef.current = new Chart(ctx, {
        type: "radar",
        data: {
          labels: Object.keys(faceData.emotions).map(
            (l) => l.charAt(0).toUpperCase() + l.slice(1)
          ),
          datasets: [
            {
              label: "Face Emotions",
              data: Object.values(faceData.emotions),
              backgroundColor: "rgba(79, 70, 229, 0.2)",
              borderColor: "rgba(79, 70, 229, 1)",
              borderWidth: 2,
              pointBackgroundColor: "rgba(79, 70, 229, 1)",
              pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              min: 0,
              max: 1,
              ticks: {
                stepSize: 0.2,
                callback: (value) => `${Math.round(value * 100)}%`,
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (item) => `${Math.round(item.raw * 100)}%`,
              },
            },
          },
        },
      });
    }

    // For videos, add a timeline chart if there's timeline data
    if (
      analysis.media_type === "video" &&
      analysis.results?.overall?.emotion_timeline &&
      document.getElementById("timelineChart")
    ) {
      const timelineData = analysis.results.overall.emotion_timeline;
      const emotionColors = {
        happy: "rgba(76, 175, 80, 0.7)",
        sad: "rgba(33, 150, 243, 0.7)",
        angry: "rgba(244, 67, 54, 0.7)",
        fear: "rgba(255, 152, 0, 0.7)",
        neutral: "rgba(158, 158, 158, 0.7)",
        surprise: "rgba(156, 39, 176, 0.7)",
        disgust: "rgba(121, 85, 72, 0.7)",
      };

      const datasets = [];
      for (const [emotion, dataPoints] of Object.entries(timelineData)) {
        if (dataPoints.length === 0) continue;

        datasets.push({
          label: emotion.charAt(0).toUpperCase() + emotion.slice(1),
          data: dataPoints.map((point) => ({
            x: point.timestamp,
            y: point.value,
          })),
          borderColor: emotionColors[emotion] || "rgba(100, 100, 100, 0.7)",
          backgroundColor: emotionColors[emotion] || "rgba(100, 100, 100, 0.7)",
          tension: 0.4,
          pointRadius: 2,
          borderWidth: 2,
        });
      }

      const ctx = document.getElementById("timelineChart").getContext("2d");
      timelineChartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          datasets: datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: "linear",
              position: "bottom",
              title: {
                display: true,
                text: "Time (seconds)",
              },
            },
            y: {
              min: 0,
              max: 1,
              title: {
                display: true,
                text: "Intensity",
              },
              ticks: {
                callback: (value) => `${Math.round(value * 100)}%`,
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.dataset.label || "";
                  const value = Math.round(context.parsed.y * 100);
                  const time = context.parsed.x.toFixed(1);
                  return `${label}: ${value}% at ${time}s`;
                },
              },
            },
          },
        },
      });
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this analysis? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      await EmotionService.deleteAnalysis(analysisId);
      navigate("/media-analysis", { replace: true });
    } catch (err) {
      console.error("Error deleting analysis:", err);
      alert("Failed to delete analysis. Please try again.");
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="analysis-loading">
            <div className="analysis-loading-indicator"></div>
            <p className="mt-4 text-gray-500">Loading analysis...</p>
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
              Error Loading Analysis
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              to="/media-analysis"
              className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Media Analysis
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-center py-16">
            <ExclamationCircleIcon className="h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Analysis Not Found
            </h2>
            <p className="text-gray-600 mb-6">
              The requested analysis could not be found
            </p>
            <Link
              to="/media-analysis"
              className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Media Analysis
            </Link>
          </div>
        </div>
      </div>
    );
  }
  // ...existing code...

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div className="flex items-center">
            <Link
              to="/media-analysis"
              className="mr-4 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                {analysis.media_type === "video" ? "Video" : "Image"} Analysis
              </h1>
              <p className="text-gray-600">
                {new Date(analysis.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
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
          <EmotionsTab analysis={analysis} getEmotionColor={getEmotionColor} />
        ) : (
          <DataTab analysis={analysis} />
        )}
      </div>
    </div>
  );
};

// Emotions Tab Component
// Update the EmotionsTab component to better handle video data

const EmotionsTab = ({ analysis, getEmotionColor }) => {
  const dominantEmotion =
    analysis.results?.dominant_emotion ||
    analysis.results?.overall?.dominant_emotion ||
    "neutral";

  // Determine if this is a video analysis
  const isVideo = analysis.media_type === "video";
  const hasTimelineData = analysis.results?.overall?.emotion_timeline;
  const [showProcessed, setShowProcessed] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);

  const getEmotions = (analysis) => {
    return analysis.results?.faces?.[0]?.emotions || 
           analysis.results?.emotions ||
           analysis.results?.overall?.emotions ||
           {};
  };
  
  const generateDynamicInsights = (analysis) => {
    const emotions = getEmotions(analysis);
    const dominantEmotion = analysis.results?.dominant_emotion || 
                            analysis.results?.overall?.dominant_emotion;
    const valence = analysis.results?.overall?.avg_valence || 
                    analysis.results?.valence || 
                    analysis.results?.faces?.[0]?.valence;
    
    let insights = `Analysis detected ${analysis.results.face_count || 0} face(s) in the ${analysis.media_type}.`;
    
    if (dominantEmotion) {
      insights += ` The primary detected emotion is ${dominantEmotion}.`;
    }
    
    // Add emotional breakdown
    const sortedEmotions = Object.entries(emotions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
      
    if (sortedEmotions.length > 0) {
      insights += ` Top emotions include: ${sortedEmotions
        .map(([emotion, value]) => `${emotion} (${Math.round(value * 100)}%)`)
        .join(', ')}.`;
    }
    
    // Add valence interpretation
    if (!isNaN(valence)) {
      if (valence > 0.3) {
        insights += ` The emotional tone is generally positive (${Math.round(valence * 100)}%).`;
      } else if (valence < -0.3) {
        insights += ` The emotional tone is generally negative (${Math.round(valence * 100)}%).`;
      } else {
        insights += ` The emotional tone is relatively neutral.`;
      }
    }
    
    return insights;
  };
  
  const getSuggestedApproach = (analysis) => {
    const dominantEmotion = analysis.results?.dominant_emotion || 
                            analysis.results?.overall?.dominant_emotion;
    
    switch (dominantEmotion) {
      case 'happy':
        return "Build on positive emotions and reinforce effective coping strategies.";
      case 'sad':
        return "Consider approaches that address negative thought patterns and encourage behavioral activation.";
      case 'angry':
        return "Focus on anger management techniques and identifying emotional triggers.";
      case 'fear':
        return "Consider anxiety management techniques and gradual exposure therapy approaches.";
      case 'surprise':
        return "Explore the unexpected elements that triggered this response and their significance.";
      case 'disgust':
        return "Examine the aversive stimuli and cognitive reframing techniques.";
      default:
        return "Consider a balanced approach focusing on emotional awareness and expression.";
    }
  };
  
  const getRichValenceDisplay = (analysis) => {
    const valence = analysis.results?.faces?.[0]?.valence || 
                  analysis.results?.overall?.avg_valence ||
                  analysis.results?.valence;
                  
    if (isNaN(valence)) return "Not available";
    
    const displayValue = Math.round(valence * 100);
    const prefix = valence > 0 ? '+' : '';
    const description = valence > 0.3 ? "Positive" : 
                        valence < -0.3 ? "Negative" : "Neutral";
    
    return `${prefix}${displayValue}% (${description})`;
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Media display - Full width */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Media</h2>
            {!isVideo &&
              (analysis.visualizations?.analyzed_image ||
                analysis.results?.visualization) && (
              <button
                onClick={() => setShowProcessed(!showProcessed)}
                className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
              >
                {showProcessed ? "Show Original" : "Show Processed"}
              </button>
            )}
          </div>
          
          <div className="p-6">
            <div className="media-container">
              {isVideo ? (
                <React.Fragment>
                  <video
                    key={analysis.media_url} // Force reload when URL changes
                    src={analysis.media_url}
                    controls
                    preload="metadata"
                    onLoadStart={() => setVideoLoading(true)}
                    onLoadedData={() => setVideoLoading(false)}
                    className="w-full h-full"
                  />
                  {videoLoading && (
                    <div className="video-loading">
                      <div className="video-loading-spinner"></div>
                    </div>
                  )}
                </React.Fragment>
              ) : showProcessed &&
                (analysis.visualizations?.analyzed_image ||
                  analysis.results?.visualization) ? (
                <img
                  src={
                    analysis.visualizations?.analyzed_image ||
                    analysis.results?.visualization
                  }
                  alt="Analyzed media with emotions"
                  className="max-w-full max-h-full"
                />
              ) : (
                <img
                  src={analysis.media_url}
                  alt="Original media"
                  className="max-w-full max-h-full"
                />
              )}
            </div>
            
            {/* Media info */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-gray-500 mb-1">Type</div>
                <div className="font-medium capitalize">{analysis.media_type}</div>
              </div>
              
              {analysis.media_metadata?.width && (
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-500 mb-1">Dimensions</div>
                  <div className="font-medium">
                    {analysis.media_metadata.width} x {analysis.media_metadata.height}
                  </div>
                </div>
              )}
              
              {analysis.media_metadata?.duration && (
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-500 mb-1">Duration</div>
                  <div className="font-medium">{Math.round(analysis.media_metadata.duration)}s</div>
                </div>
              )}
              
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-gray-500 mb-1">Date</div>
                <div className="font-medium">{new Date(analysis.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Two column layout for the data sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary Section */}
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
                  style={{ backgroundColor: getEmotionColor(dominantEmotion) }}
                ></div>
                <span className="text-lg font-semibold text-gray-800 capitalize">
                  {dominantEmotion || "Not detected"}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-sm text-gray-500 mb-1">Emotion Confidence</div>
              <div className="text-lg font-semibold text-gray-800">
                {analysis.results?.faces && analysis.results.faces[0]?.confidence 
                  ? `${Math.round(analysis.results.faces[0].confidence * 100)}%` 
                  : Math.round((analysis.results?.confidence || 0) * 100) + '%'}
              </div>
            </div>

            <div className="mb-6">
              <div className="text-sm text-gray-500 mb-1">Emotional Valence</div>
              <div className="text-lg font-semibold text-gray-800">
                {getRichValenceDisplay(analysis)}
              </div>
            </div>

            {/* Add helper function to component */}
            {/* 
              function getRichValenceDisplay(analysis) {
                const valence = analysis.results?.faces?.[0]?.valence || 
                              analysis.results?.overall?.avg_valence ||
                              analysis.results?.valence;
                              
                if (isNaN(valence)) return "Not available";
                
                const displayValue = Math.round(valence * 100);
                const prefix = valence > 0 ? '+' : '';
                const description = valence > 0.3 ? "Positive" : 
                                    valence < -0.3 ? "Negative" : "Neutral";
                
                return `${prefix}${displayValue}% (${description})`;
              }
            */}

            <div className="mb-6">
              <div className="text-sm text-gray-500 mb-1">Engagement Level</div>
              <div className="text-lg font-semibold text-gray-800">
                {Math.round(
                  (analysis.results?.faces?.[0]?.engagement ||
                    analysis.results?.overall?.avg_engagement ||
                    analysis.results?.engagement ||
                    0) * 100
                )}%
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 mb-1">Faces Detected</div>
              <div className="text-lg font-semibold text-gray-800">
                {analysis.results?.face_count || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Emotion Distribution - Always show in the main area */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Emotion Distribution
            </h2>
          </div>
          <div className="p-6">
            {Object.entries(
              analysis.results?.faces?.[0]?.emotions || 
              analysis.results?.emotions ||
              analysis.results?.overall?.emotions ||
              {}
            ).length > 0 ? (
              <>
                {Object.entries(
                  analysis.results?.faces?.[0]?.emotions || 
                  analysis.results?.emotions ||
                  analysis.results?.overall?.emotions ||
                  {}
                ).map(([emotion, value]) => (
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

        {/* For videos: Timeline and significant changes */}
        {isVideo && hasTimelineData && (
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                Emotion Timeline
              </h2>
            </div>
            <div className="p-6">
              {analysis.results?.timeline_graph ? (
                <div className="w-full">
                  <img
                    src={analysis.results.timeline_graph}
                    alt="Emotion timeline"
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Emotion timeline visualization not available
                </div>
              )}
            </div>
          </div>
        )}

        {/* Significant changes with improved layout */}
        {isVideo &&
          analysis.results?.emotion_changes &&
          analysis.results.emotion_changes.length > 0 && (
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                Significant Changes
              </h2>
            </div>
            <div className="p-6">
              <div className="max-h-[400px] overflow-y-auto pr-2 emotion-changes-container">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysis.results.emotion_changes.map((change, index) => (
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

        {/* Other sections */}
        {/* Frame-by-frame visualization for videos */}
        {isVideo && analysis.results?.frames && analysis.results.frames.some(frame => frame.faces?.length > 0) && (
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                Key Frames Analysis
              </h2>
              <span className="text-sm text-gray-500">
                {analysis.results.frames.filter(f => f.faces?.length > 0).length} frames with detected faces
              </span>
            </div>
            <div className="p-6">
              {analysis.results?.frame_visualization ? (
                <div className="flex justify-center">
                  <img
                    src={analysis.results.frame_visualization}
                    alt="Frame-by-frame analysis"
                    className="max-w-full"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {analysis.results.frames
                    .filter(frame => frame.faces?.length > 0)
                    .slice(0, 12) // Limit to 12 frames
                    .map((frame, index) => {
                      const dominantEmotion = frame.faces[0]?.dominant_emotion || "neutral";
                      return (
                        <div key={index} className="relative border rounded overflow-hidden">
                          <div className="absolute top-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                            {frame.timestamp.toFixed(1)}s
                          </div>
                          <div className={`absolute top-0 left-0 w-1.5 h-full bg-${getEmotionColor(dominantEmotion).replace('#', '')}`}></div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 flex justify-between">
                            <span className="capitalize">{dominantEmotion}</span>
                            <span>{Math.round(frame.faces[0]?.confidence * 100)}%</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Face Data - Primarily for images, but also for video frames with faces */}
        {analysis.results?.faces && analysis.results.faces.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                Face Analysis
              </h2>
            </div>
            <div className="p-6 h-80">
              <canvas id="faceChart" />
            </div>
          </div>
        )}

        {/* Add Emotion Heatmap */}
        {analysis.results?.emotion_heatmap && (
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                Emotion Intensity
              </h2>
            </div>
            <div className="p-6">
              <div className="flex justify-center">
                <img
                  src={analysis.results.emotion_heatmap}
                  alt="Emotion intensity heatmap"
                  className="max-w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Therapeutic Context */}
        {analysis.therapeutic_context && (
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                Therapeutic Insights
              </h2>
            </div>
            <div className="p-6">
              {/* Generate insights dynamically if not provided */}
              {!analysis.therapeutic_context.therapy_notes || 
               analysis.therapeutic_context.therapy_notes === " Main emotions detected: ." ? (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Generated Insights
                  </h3>
                  <p className="text-gray-600">
                    {generateDynamicInsights(analysis)}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Suggested Approach
                    </h3>
                    <p className="text-gray-600">
                      {analysis.therapeutic_context.suggested_approach ||
                        getSuggestedApproach(analysis)}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-2">
                      Warning Flags
                    </h3>
                    {analysis.therapeutic_context.warning_flags &&
                    analysis.therapeutic_context.warning_flags.length > 0 ? (
                      <ul className="list-disc pl-5 text-gray-600">
                        {analysis.therapeutic_context.warning_flags.map(
                          (flag, index) => (
                            <li key={index}>{flag}</li>
                          )
                        )}
                      </ul>
                    ) : (
                      <p className="text-gray-600">No warning flags detected.</p>
                    )}
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-2">Notes</h3>
                    <p className="text-gray-600">
                      {analysis.therapeutic_context.therapy_notes || "No notes available."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Data Tab Component
// Update the DataTab component

const DataTab = ({ analysis }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">
          Raw Analysis Data
        </h2>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">
          Analysis Metadata
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm font-medium text-gray-500">Analysis ID</p>
            <p className="text-sm text-gray-800">{analysis.analysis_id}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Created At</p>
            <p className="text-sm text-gray-800">
              {new Date(analysis.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Media Type</p>
            <p className="text-sm text-gray-800 capitalize">
              {analysis.media_type}
            </p>
          </div>
          {analysis.media_metadata && (
            <>
              {analysis.media_metadata.width &&
                analysis.media_metadata.height && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Dimensions
                    </p>
                    <p className="text-sm text-gray-800">
                      {analysis.media_metadata.width} x{" "}
                      {analysis.media_metadata.height} px
                    </p>
                  </div>
                )}
              {analysis.media_metadata.duration && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Duration</p>
                  <p className="text-sm text-gray-800">
                    {analysis.media_metadata.duration.toFixed(1)}s
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <h3 className="text-lg font-medium text-gray-800 mb-4">JSON Data</h3>
        <div className="overflow-x-auto">
          <pre className="bg-gray-50 p-4 rounded-lg text-gray-800 text-sm max-h-[70vh] overflow-auto">
            {JSON.stringify(analysis.results, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default MediaDetail;
