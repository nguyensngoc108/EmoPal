import React, { useState } from 'react';

const EmotionDisplay = ({ emotionData }) => {
  const [activeTab, setActiveTab] = useState('realtime'); // 'realtime', 'trends', 'insights'
  
  const { 
    currentEmotions, 
    dominantEmotion, 
    valence, 
    engagement, 
    emotionTrends, 
    warnings 
  } = emotionData;

  const renderRealtimeTab = () => (
    <div className="realtime-tab">
      <div className="emotion-summary">
        <div className="emotion-stat">
          <div className="emotion-stat-value">{dominantEmotion || '-'}</div>
          <div className="emotion-stat-label">Dominant</div>
        </div>
        <div className="emotion-stat">
          <div className="emotion-stat-value">{Math.round(valence * 100)}%</div>
          <div className="emotion-stat-label">Valence</div>
        </div>
        <div className="emotion-stat">
          <div className="emotion-stat-value">{Math.round(engagement * 100)}%</div>
          <div className="emotion-stat-label">Engagement</div>
        </div>
      </div>
      
      <div className="emotion-metrics">
        {Object.entries(currentEmotions).map(([emotion, value]) => (
          <div className="emotion-metric" key={emotion}>
            <div className="emotion-label">{emotion}</div>
            <div className="emotion-value">
              <div 
                className="emotion-value-bar"
                style={{ 
                  width: `${value * 100}%`,
                  background: getEmotionColor(emotion)
                }}
              />
            </div>
            <div className="emotion-value-text">{(value * 100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTrendsTab = () => (
    <div className="trends-tab">
      {emotionTrends ? (
        <>
          <div className="emotion-summary">
            <div className="emotion-stat">
              <div className="emotion-stat-value">
                {emotionTrends.emotional_stability ? 
                  `${Math.round(emotionTrends.emotional_stability * 100)}%` : 
                  '-'}
              </div>
              <div className="emotion-stat-label">Stability</div>
            </div>
            <div className="emotion-stat">
              <div className="emotion-stat-value">{emotionTrends.mood_progression || '-'}</div>
              <div className="emotion-stat-label">Mood</div>
            </div>
            <div className="emotion-stat">
              <div className="emotion-stat-value">{emotionTrends.emotional_shifts || 0}</div>
              <div className="emotion-stat-label">Shifts</div>
            </div>
          </div>
          
          <div className="chart-placeholder">
            {/* This would be a Chart.js implementation in a real app */}
            <div style={{textAlign: 'center', padding: '40px 0', color: '#666'}}>
              Emotion trends chart would render here
            </div>
          </div>
        </>
      ) : (
        <div className="no-data">No trend data available yet</div>
      )}
    </div>
  );

  const renderInsightsTab = () => (
    <div className="insights-tab">
      <div className="insight-section">
        <h4>Current State</h4>
        <p>
          {emotionTrends?.current_state || 
            `The client appears to be ${dominantEmotion || 'neutral'} with 
             ${valence > 0.5 ? 'positive' : 'negative'} valence.`}
        </p>
      </div>
      
      <div className="insight-section">
        <h4>Therapeutic Suggestions</h4>
        {emotionTrends?.suggestions && emotionTrends.suggestions.length > 0 ? (
          <ul>
            {emotionTrends.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        ) : (
          <p>No suggestions available yet</p>
        )}
      </div>
    </div>
  );
  
  // Helper function to get color for each emotion
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

  return (
    <div className="emotion-container">
      <div className="emotion-header">
        <h3>Emotion Analysis</h3>
      </div>
      
      {warnings.length > 0 && (
        <div className="emotion-warnings">
          {warnings.slice(-1)[0].message}
        </div>
      )}
      
      <div className="tab-container">
        <div 
          className={`tab ${activeTab === 'realtime' ? 'active' : ''}`}
          onClick={() => setActiveTab('realtime')}
        >
          Real-time
        </div>
        <div 
          className={`tab ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          Trends
        </div>
        <div 
          className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          Insights
        </div>
      </div>
      
      <div className="emotion-content">
        {activeTab === 'realtime' && renderRealtimeTab()}
        {activeTab === 'trends' && renderTrendsTab()}
        {activeTab === 'insights' && renderInsightsTab()}
      </div>
    </div>
  );
};

export default EmotionDisplay;