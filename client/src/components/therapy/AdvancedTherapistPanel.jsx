import React, { useState, useEffect, useRef } from 'react';
import { useVideoSession } from '../../contexts/VideoSessionContext';
import {
  ChartBarIcon, 
  ExclamationTriangleIcon, 
  LightBulbIcon,
  ChatBubbleLeftRightIcon,
  ChartLineIcon
} from '@heroicons/react/24/outline';

const AdvancedTherapistPanel = () => {
  const { emotionData } = useVideoSession();
  const [activeTab, setActiveTab] = useState('live');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const previousEmotionRef = useRef(null);
  
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
        setAlertMessage(`Significant emotion shift: ${previousEmotionRef.current} → ${emotionData.dominantEmotion}`);
        setAlertVisible(true);
        
        // Hide after 5 seconds
        setTimeout(() => setAlertVisible(false), 5000);
      }
      
      // Update previous emotion
      previousEmotionRef.current = emotionData.dominantEmotion;
    }
  }, [emotionData.dominantEmotion]);
  
  const isPositiveEmotion = (emotion) => ['happy', 'surprise'].includes(emotion);
  const isNegativeEmotion = (emotion) => ['sad', 'angry', 'fear', 'disgust'].includes(emotion);
  
  const renderLiveTab = () => (
    <div className="live-analysis">
      <div className="emotion-overview">
        <div className="primary-metrics">
          <div className="metric-card dominant-emotion">
            <h3>Dominant Emotion</h3>
            <div className={`emotion-value ${emotionData.dominantEmotion || 'neutral'}`}>
              {emotionData.dominantEmotion || 'Neutral'}
            </div>
          </div>
          
          <div className="metric-card valence">
            <h3>Emotional Valence</h3>
            <div className="valence-meter">
              <div className="meter-label negative">Negative</div>
              <div className="meter-container">
                <div 
                  className="meter-value" 
                  style={{ 
                    left: `${((emotionData.valence + 1) / 2) * 100}%`,
                    backgroundColor: emotionData.valence >= 0 ? '#4CAF50' : '#F44336'
                  }}
                ></div>
              </div>
              <div className="meter-label positive">Positive</div>
            </div>
            <div className="value-display">{(emotionData.valence * 100).toFixed(1)}%</div>
          </div>
          
          <div className="metric-card engagement">
            <h3>Client Engagement</h3>
            <div className="engagement-meter">
              <div className="meter-background"></div>
              <div 
                className="meter-fill" 
                style={{ width: `${emotionData.engagement}%` }}
              ></div>
            </div>
            <div className="value-display">{Math.round(emotionData.engagement)}%</div>
          </div>
        </div>
        
        <div className="emotion-distribution">
          <h3>Emotion Distribution</h3>
          <div className="emotion-bars">
            {Object.entries(emotionData.currentEmotions || {}).map(([emotion, intensity]) => (
              <div className="emotion-bar-container" key={emotion}>
                <div className="emotion-label">{emotion}</div>
                <div className="emotion-bar-wrapper">
                  <div 
                    className="emotion-bar-fill"
                    style={{ 
                      width: `${Math.round(intensity * 100)}%`,
                      backgroundColor: getEmotionColor(emotion)
                    }}
                  ></div>
                </div>
                <div className="emotion-value">{Math.round(intensity * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {alertVisible && (
        <div className="emotion-alert">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <span>{alertMessage}</span>
        </div>
      )}
    </div>
  );
  
  const renderInsightsTab = () => (
    <div className="therapeutic-insights">
      <div className="insights-box current-state">
        <h3>Current Emotional State</h3>
        <p>{emotionData.insights?.current_state || 'Analysis in progress...'}</p>
      </div>
      
      <div className="insights-box suggestions">
        <h3>Therapeutic Suggestions</h3>
        {emotionData.insights?.suggestions && emotionData.insights.suggestions.length > 0 ? (
          <ul>
            {emotionData.insights.suggestions.map((suggestion, idx) => (
              <li key={idx}>
                <LightBulbIcon className="h-4 w-4 mr-2" />
                {suggestion}
              </li>
            ))}
          </ul>
        ) : (
          <p>No therapeutic suggestions available yet</p>
        )}
      </div>
      
      <div className="insights-box observation">
        <h3>Key Observation</h3>
        <p>{emotionData.insights?.observation || 'Collecting data...'}</p>
      </div>
    </div>
  );
  
  const renderTrendsTab = () => (
    <div className="emotion-trends">
      <div className="trend-metrics">
        <div className="trend-metric">
          <h3>Emotional Stability</h3>
          <div className="stability-gauge">
            <div 
              className="gauge-fill"
              style={{ 
                width: `${(emotionData.emotionTrends?.emotional_stability || 0.5) * 100}%`,
                backgroundColor: getStabilityColor(emotionData.emotionTrends?.emotional_stability || 0.5)
              }}
            ></div>
          </div>
          <div className="gauge-value">
            {((emotionData.emotionTrends?.emotional_stability || 0.5) * 100).toFixed(0)}%
          </div>
        </div>
        
        <div className="trend-metric">
          <h3>Mood Progression</h3>
          <div className="mood-indicator">
            {emotionData.emotionTrends?.mood_progression || 'Neutral'}
          </div>
        </div>
        
        <div className="trend-metric">
          <h3>Emotional Shifts</h3>
          <div className="shifts-count">
            {emotionData.emotionTrends?.emotional_shifts || 0}
          </div>
        </div>
      </div>
      
      <div className="emotion-chart-placeholder">
        <p>Emotion trend chart visualization would render here</p>
        <p className="chart-note">Tracking changes over session duration</p>
      </div>
    </div>
  );
  
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
    
    return colors[emotion] || '#9E9E9E';
  };
  
  const getStabilityColor = (stability) => {
    if (stability < 0.3) return '#F44336'; // Red
    if (stability < 0.6) return '#FF9800'; // Orange
    return '#4CAF50'; // Green
  };

  return (
    <div className="advanced-therapist-panel">
      <div className="panel-header">
        <h2>Client Emotion Analysis</h2>
        <div className="panel-tabs">
          <button 
            className={`panel-tab ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            <ChartBarIcon className="h-5 w-5 mr-1" />
            <span>Live Analysis</span>
          </button>
          <button 
            className={`panel-tab ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <LightBulbIcon className="h-5 w-5 mr-1" />
            <span>Therapeutic Insights</span>
          </button>
          <button 
            className={`panel-tab ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveTab('trends')}
          >
            <ChartLineIcon className="h-5 w-5 mr-1" />
            <span>Emotion Trends</span>
          </button>
        </div>
      </div>
      
      <div className="panel-content">
        {activeTab === 'live' && renderLiveTab()}
        {activeTab === 'insights' && renderInsightsTab()}
        {activeTab === 'trends' && renderTrendsTab()}
      </div>
    </div>
  );
};

export default AdvancedTherapistPanel;