import React, { useState } from 'react';
import { ChartBarIcon, ExclamationCircleIcon, LightBulbIcon } from '@heroicons/react/24/outline';

const TherapistInsightPanel = ({ emotionData }) => {
  const [activeTab, setActiveTab] = useState('emotions');
  
  const renderEmotionChart = () => {
    const emotions = emotionData.currentEmotions || {};
    const dominantEmotion = emotionData.dominantEmotion || 'neutral';
    
    return (
      <div className="emotion-chart">
        <div className="dominant-emotion">
          <div className="text-lg font-medium">Dominant Emotion</div>
          <div className={`emotion-badge ${dominantEmotion}`}>
            {dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1)}
          </div>
        </div>
        
        <div className="emotion-bars">
          {Object.entries(emotions).map(([emotion, value]) => (
            <div key={emotion} className="emotion-bar">
              <span className="emotion-name">{emotion}</span>
              <div className="bar-container">
                <div 
                  className={`bar ${emotion}`} 
                  style={{width: `${Math.round(value * 100)}%`}}
                ></div>
                <span className="bar-value">{Math.round(value * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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
    
    return (
      <div className="insights-container">
        <div className="current-state">
          <h4>Current Emotional State:</h4>
          <p>{insights.current_state || "Analysis in progress..."}</p>
        </div>
        
        {insights.suggestions && insights.suggestions.length > 0 && (
          <div className="suggestions">
            <h4>Therapeutic Suggestions:</h4>
            <ul>
              {insights.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
        
        {insights.observation && (
          <div className="observation">
            <h4>Key Observation:</h4>
            <p>{insights.observation}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="therapist-insight-panel">
      <div className="panel-header">
        <h3>Client Emotion Analysis</h3>
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'emotions' ? 'active' : ''}`}
            onClick={() => setActiveTab('emotions')}
          >
            <ChartBarIcon className="h-4 w-4 mr-1" />
            Emotions
          </button>
          <button
            className={`tab ${activeTab === 'warnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('warnings')}
          >
            <ExclamationCircleIcon className="h-4 w-4 mr-1" />
            Warnings
          </button>
          <button
            className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <LightBulbIcon className="h-4 w-4 mr-1" />
            Insights
          </button>
        </div>
      </div>
      
      <div className="panel-content">
        {activeTab === 'emotions' && renderEmotionChart()}
        {activeTab === 'warnings' && renderWarnings()}
        {activeTab === 'insights' && renderInsights()}
      </div>
      
      <div className="panel-footer">
        <div className="metrics">
          <div className="metric">
            <span className="metric-label">Valence:</span>
            <span className={`metric-value ${emotionData.valence >= 0 ? 'positive' : 'negative'}`}>
              {emotionData.valence ? emotionData.valence.toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Engagement:</span>
            <span className="metric-value">
              {emotionData.engagement ? emotionData.engagement.toFixed(2) : '0.00'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistInsightPanel;