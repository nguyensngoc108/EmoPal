import React, { useState, useEffect, useRef } from 'react';
import { ChartBarIcon, ExclamationCircleIcon, LightBulbIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ClockIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

const TherapistInsightPanel = ({ emotionData, sessionId }) => {
  const [activeTab, setActiveTab] = useState('emotions');
  const [alertMessage, setAlertMessage] = useState(null);
  const previousEmotionRef = useRef(null);
  const alertTimeoutRef = useRef(null);
  
  // Track significant emotion changes
  useEffect(() => {
    if (!emotionData.dominantEmotion || !previousEmotionRef.current) {
      previousEmotionRef.current = emotionData.dominantEmotion;
      return;
    }
    
    // If emotion changed significantly
    if (previousEmotionRef.current !== emotionData.dominantEmotion) {
      // Check if it's a significant shift (e.g., positive to negative)
      const isSignificantShift = 
        (isPositiveEmotion(previousEmotionRef.current) && isNegativeEmotion(emotionData.dominantEmotion)) || 
        (isNegativeEmotion(previousEmotionRef.current) && isPositiveEmotion(emotionData.dominantEmotion));
      
      if (isSignificantShift) {
        // Show alert
        const message = `Significant shift: ${previousEmotionRef.current} → ${emotionData.dominantEmotion}`;
        setAlertMessage(message);
        
        // Add to warnings list
        // This would be handled by your existing warnings system
        
        // Auto-hide alert after 5 seconds
        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
        alertTimeoutRef.current = setTimeout(() => setAlertMessage(null), 5000);
      }
      
      // Update previous emotion
      previousEmotionRef.current = emotionData.dominantEmotion;
    }
    
    return () => {
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, [emotionData.dominantEmotion]);
  
  const isPositiveEmotion = (emotion) => ['happy', 'surprise'].includes(emotion);
  const isNegativeEmotion = (emotion) => ['sad', 'angry', 'fear', 'disgust'].includes(emotion);
  
  const renderEmotionChart = () => {
    const emotions = emotionData.currentEmotions || {};
    const dominantEmotion = emotionData.dominantEmotion || 'neutral';
    
    // Calculate emotional intensity for dominant emotion
    const intensity = emotions[dominantEmotion] || 0;
    let intensityLevel = "Low";
    if (intensity > 0.7) intensityLevel = "High";
    else if (intensity > 0.4) intensityLevel = "Moderate";
    
    // Get emotional valence description
    const valence = emotionData.valence || 0;
    let valenceDescription = "Neutral";
    if (valence > 0.3) valenceDescription = "Positive";
    if (valence < -0.3) valenceDescription = "Negative";
    
    // Get emotional history trend function
    const getEmotionTrend = (emotion) => {
      const history = emotionData.emotionHistory || [];
      if (history.length < 5) return null;
      
      const recent = history.slice(-5).map(h => h.emotions?.[emotion] || 0);
      const oldest = recent[0];
      const newest = recent[recent.length - 1];
      
      if (newest > oldest + 0.15) return "increasing";
      if (newest < oldest - 0.15) return "decreasing";
      return "stable";
    };
    
    return (
      <div className="emotion-chart">
        {alertMessage && (
          <div className="emotion-alert">
            <ExclamationCircleIcon className="h-4 w-4 text-amber-500" />
            <span>{alertMessage}</span>
          </div>
        )}
        
        <div className="dominant-emotion-container">
          <div className="text-lg font-medium">Primary Emotion</div>
          <div className={`emotion-badge ${dominantEmotion}`}>
            {dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1)}
          </div>
          
          <div className="emotion-metrics">
            <span className="intensity-level">{intensityLevel} Intensity</span>
            <span className="valence-level">{valenceDescription} Valence</span>
          </div>
        </div>
        
        <div className="emotion-bars">
          {Object.entries(emotions)
            .sort(([, valueA], [, valueB]) => valueB - valueA)
            .map(([emotion, value]) => {
            const trend = getEmotionTrend(emotion);
            
            return (
              <div key={emotion} className="emotion-bar">
                <div className="emotion-name-container">
                  <span className="emotion-name">{capitalize(emotion)}</span>
                  {trend === "increasing" && (
                    <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                  )}
                  {trend === "decreasing" && (
                    <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                  )}
                </div>
                
                <div className="bar-container">
                  <div 
                    className={`bar ${emotion}`} 
                    style={{width: `${Math.round(value * 100)}%`}}
                  ></div>
                  <span className="bar-value">{Math.round(value * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Session timeline visualization would be great here */}
        {emotionData.emotionHistory && emotionData.emotionHistory.length > 0 && (
          <div className="session-timeline">
            <div className="timeline-header">
              <ClockIcon className="h-4 w-4 text-gray-600" />
              <span>Session Timeline</span>
            </div>
            <div className="timeline-visualization">
              {/* Simple visualization of emotion changes */}
              <div className="timeline-track">
                {emotionData.emotionHistory.slice(-10).map((point, index) => (
                  <div 
                    key={index} 
                    className="timeline-point"
                    style={{
                      backgroundColor: getEmotionColor(point.dominantEmotion || 'neutral'),
                      opacity: 0.5 + (index / 20) // More recent = more opaque
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Emotional stability meter */}
        {emotionData.emotionTrends && (
          <div className="emotional-stability">
            <div className="stability-label">Emotional Stability</div>
            <div className="stability-bar">
              <div 
                className="stability-value"
                style={{
                  width: `${Math.round((emotionData.emotionTrends.emotional_stability || 0.5) * 100)}%`,
                  backgroundColor: getStabilityColor(emotionData.emotionTrends.emotional_stability)
                }}
              />
            </div>
            <div className="stability-percentage">
              {Math.round((emotionData.emotionTrends.emotional_stability || 0.5) * 100)}%
            </div>
          </div>
        )}
      </div>
    );
  };

  // Add helper functions
  const getStabilityColor = (stability) => {
    if (stability >= 0.7) return '#4CAF50'; // Green
    if (stability >= 0.4) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  };
  
  const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };
  
  const getEmotionColor = (emotion) => {
    const colors = {
      happy: '#4CAF50',
      sad: '#2196F3',
      angry: '#F44336',
      fear: '#FF9800',
      neutral: '#9E9E9E',
      surprise: '#9C27B0',
      disgust: '#795548'
    };
    
    return colors[emotion?.toLowerCase()] || '#9E9E9E';
  };

  const renderWarnings = () => {
    const warnings = emotionData.warnings || [];
    
    if (warnings.length === 0) {
      return (
        <div className="empty-state">
          <p>No active warnings. Client's emotional state appears stable.</p>
        </div>
      );
    }
    
    return (
      <div className="warnings-list">
        {warnings.map(warning => (
          <div key={warning.id} className="warning-item">
            <ExclamationCircleIcon className="h-5 w-5 text-amber-500 mr-2" />
            <div>
              <p className="warning-message">{warning.message}</p>
              <p className="warning-time">
                {new Date(warning.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  const renderInsights = () => {
    const insights = emotionData.insights || {};
    const trends = emotionData.emotionTrends || {};
    
    return (
      <div className="insights-container">
        <div className="current-state">
          <h4>Current Emotional State:</h4>
          <p>{insights.current_state || "Analysis in progress..."}</p>
        </div>
        
        {trends.mood_progression && (
          <div className="mood-progression">
            <h4>Mood Progression:</h4>
            <p className={`mood-${trends.mood_progression}`}>
              {trends.mood_progression === 'positive' ? '📈 Improving' : 
               trends.mood_progression === 'negative' ? '📉 Declining' : 
               '📊 Stable'}
            </p>
          </div>
        )}
        
        {insights.suggestions && insights.suggestions.length > 0 && (
          <div className="suggestions">
            <h4>Therapeutic Recommendations:</h4>
            <ul className="suggestion-list">
              {insights.suggestions.map((suggestion, index) => (
                <li key={index} className="suggestion-item">
                  <div className="suggestion-bullet">→</div>
                  <div className="suggestion-text">{suggestion}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {insights.observation && (
          <div className="observation">
            <h4>Key Observation:</h4>
            <p className="observation-text">
              <span className="observation-marker">!</span>
              {insights.observation}
            </p>
          </div>
        )}
        
        {/* Intervention tips based on dominant emotion */}
        <div className="intervention-tips">
          <h4>Quick Intervention Tips:</h4>
          {getInterventionTips()}
        </div>
      </div>
    );
  };

  // Helper function for intervention tips
  const getInterventionTips = () => {
    const dominantEmotion = emotionData.dominantEmotion || 'neutral';
    
    const tips = {
      happy: [
        "Reinforce positive experiences and identify sources of joy",
        "Explore what's working well in client's life right now",
        "Encourage mindful savoring of positive emotions",
        "Leverage positive affect to address challenging topics"
      ],
      sad: [
        "Validate emotional experience without rushing to fix it",
        "Explore recent triggers with gentle inquiry",
        "Consider behavioral activation techniques",
        "Check for signs of depression if sadness is persistent"
      ],
      angry: [
        "Allow safe expression while maintaining boundaries",
        "Explore underlying needs behind the anger",
        "Suggest brief breathing exercise if intensity is high",
        "Identify patterns in anger triggers"
      ],
      fear: [
        "Use grounding techniques if anxiety is elevating",
        "Normalize fear response while building coping skills",
        "Consider gradual exposure framework for specific fears",
        "Assess for physical manifestations of anxiety"
      ],
      neutral: [
        "Explore emotional awareness and access to feelings",
        "Check for emotional suppression or avoidance",
        "Use open-ended questions about underlying feelings",
        "Consider if medication or other factors may be flattening affect"
      ],
      disgust: [
        "Explore moral/ethical concerns if present",
        "Identify specific triggers with non-judgmental stance",
        "Consider cognitive reframing for strong disgust reactions",
        "Look for connections to past experiences or trauma"
      ],
      surprise: [
        "Allow processing time for unexpected information",
        "Explore cognitive integration of surprising material",
        "Check for any accompanying emotions (fear, joy, etc.)",
        "Use moment of surprise as opportunity for new perspective"
      ]
    };
    
    return (
      <ul className="tips-list">
        {(tips[dominantEmotion] || tips.neutral).map((tip, index) => (
          <li key={index} className="tip-item">{tip}</li>
        ))}
      </ul>
    );
  };

  return (
    <div className="therapist-insight-panel">
      <div className="panel-header">
        <h3>Session Analysis</h3>
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'emotions' ? 'active' : ''}`}
            onClick={() => setActiveTab('emotions')}
          >
            <ChartBarIcon className="h-4 w-4 mr-1" />
            Emotions
          </button>
          <button
            className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <LightBulbIcon className="h-4 w-4 mr-1" />
            Insights
          </button>
          <button
            className={`tab ${activeTab === 'warnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('warnings')}
          >
            <ExclamationCircleIcon className="h-4 w-4 mr-1" />
            Alerts
          </button>
          <button
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
            Chat
          </button>
        </div>
      </div>
      
      <div className="panel-content">
        {activeTab === 'emotions' && renderEmotionChart()}
        {activeTab === 'warnings' && renderWarnings()}
        {activeTab === 'insights' && renderInsights()}
        {activeTab === 'chat' && <ChatPanelWrapper sessionId={sessionId} />}
      </div>
      
      {/* Only show metrics at bottom if on emotions tab */}
      {activeTab === 'emotions' && (
        <div className="panel-footer">
          <div className="metrics">
            <div className="metric">
              <span className="metric-label">Valence:</span>
              <span className={`metric-value ${emotionData.valence >= 0 ? 'positive' : 'negative'}`}>
                {emotionData.valence ? (emotionData.valence * 100).toFixed(0) : '0'}%
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Engagement:</span>
              <span className="metric-value">
                {emotionData.engagement ? (emotionData.engagement).toFixed(0) : '0'}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple wrapper component to integrate ChatPanel
const ChatPanelWrapper = ({ sessionId }) => {
  // Import here to avoid circular dependencies
  const ChatPanel = React.lazy(() => import('./ChatPanel'));
  
  return (
    <React.Suspense fallback={<div>Loading chat...</div>}>
      <ChatPanel sessionId={sessionId} />
    </React.Suspense>
  );
};

export default TherapistInsightPanel;