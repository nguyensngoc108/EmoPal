import numpy as np
from datetime import datetime, timedelta
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

class EmotionTrendAnalyzer:
    """Analyzes emotion data over time to identify trends and patterns"""
    
    def __init__(self):
        self.emotion_labels = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']
    
    def analyze_session_data(self, emotion_data):
        """
        Analyze emotion data from a single therapy session
        
        Args:
            emotion_data: List of emotion readings with timestamps
            
        Returns:
            dict: Analysis results including emotional stability, shifts, etc.
        """
        if not emotion_data or len(emotion_data) < 2:
            logger.warning("Insufficient emotion data for trend analysis")
            return {
                "emotional_stability": 0.5,
                "emotional_shifts": 0,
                "dominant_emotions": [],
                "mood_progression": "neutral",
                "engagement_level": "moderate",
                "valence_trend": "stable"
            }
        
        # Extract emotions, valence and engagement over time
        timestamps = []
        emotions_by_time = defaultdict(list)
        valence_values = []
        engagement_values = []
        
        # Process all data points
        for data_point in emotion_data:
            if "timestamp" not in data_point:
                continue
                
            timestamp = data_point.get("timestamp")
            timestamps.append(timestamp)
            
            # Extract emotions
            emotions = data_point.get("emotions", {})
            for emotion, value in emotions.items():
                emotions_by_time[emotion].append(value)
            
            # Extract valence and engagement
            valence_values.append(data_point.get("valence", 0))
            engagement_values.append(data_point.get("engagement", 0))
        
        # Calculate stability (inverse of standard deviation of valence)
        valence_std = np.std(valence_values) if valence_values else 0
        emotional_stability = max(0, min(1, 1 - (valence_std * 2)))
        
        # Count emotional shifts (significant changes in valence)
        threshold = 0.3  # Significant valence change threshold
        emotional_shifts = 0
        for i in range(1, len(valence_values)):
            if abs(valence_values[i] - valence_values[i-1]) > threshold:
                emotional_shifts += 1
        
        # Identify dominant emotions
        avg_emotions = {}
        for emotion, values in emotions_by_time.items():
            if values:
                avg_emotions[emotion] = sum(values) / len(values)
        
        # Sort emotions by average intensity
        dominant_emotions = sorted(avg_emotions.items(), 
                                  key=lambda x: x[1], 
                                  reverse=True)[:3]
        
        # Determine valence trend
        valence_trend = "stable"
        if len(valence_values) > 5:
            # Use linear regression to find trend slope
            x = np.arange(len(valence_values))
            slope, _ = np.polyfit(x, valence_values, 1)
            
            if slope > 0.01:
                valence_trend = "improving"
            elif slope < -0.01:
                valence_trend = "deteriorating"
        
        # Determine mood progression
        avg_valence = sum(valence_values) / len(valence_values) if valence_values else 0
        mood_progression = "neutral"
        if avg_valence > 0.3:
            mood_progression = "positive"
        elif avg_valence < -0.3:
            mood_progression = "negative"
        
        # Determine engagement level
        avg_engagement = sum(engagement_values) / len(engagement_values) if engagement_values else 0
        engagement_level = "moderate"
        if avg_engagement > 70:
            engagement_level = "high"
        elif avg_engagement < 30:
            engagement_level = "low"
        
        # Return comprehensive analysis
        return {
            "emotional_stability": emotional_stability,
            "emotional_shifts": emotional_shifts,
            "dominant_emotions": dominant_emotions,
            "mood_progression": mood_progression,
            "engagement_level": engagement_level,
            "valence_trend": valence_trend,
            "avg_valence": avg_valence,
            "avg_engagement": avg_engagement
        }
    
    def analyze_long_term_trends(self, historical_data, days=30):
        """
        Analyze long-term emotional trends across multiple sessions
        
        Args:
            historical_data: List of emotion analyses from multiple sessions/days
            days: Number of days to analyze
            
        Returns:
            dict: Long-term trend analysis
        """
        if not historical_data:
            logger.warning("No historical data provided for trend analysis")
            return {
                "emotion_trends": {},
                "stability_trend": "stable",
                "recurring_patterns": [],
                "engagement_trend": "stable"
            }
        
        # Group data by date
        data_by_date = defaultdict(list)
        all_dates = set()
        
        for entry in historical_data:
            if "created_at" not in entry:
                continue
                
            date_str = entry["created_at"].strftime("%Y-%m-%d")
            all_dates.add(date_str)
            data_by_date[date_str].append(entry)
        
        # Get daily averages for each emotion
        emotion_trends = {emotion: [] for emotion in self.emotion_labels}
        valence_by_day = []
        engagement_by_day = []
        dates = sorted(all_dates)
        
        for date in dates:
            day_data = data_by_date.get(date, [])
            if not day_data:
                continue
            
            # Calculate daily emotion averages
            daily_emotions = {emotion: [] for emotion in self.emotion_labels}
            daily_valence = []
            daily_engagement = []
            
            for entry in day_data:
                results = entry.get("results", {})
                emotions = results.get("emotions", {})
                
                for emotion, value in emotions.items():
                    if emotion in daily_emotions:
                        daily_emotions[emotion].append(value)
                
                valence = results.get("valence", 0)
                engagement = results.get("engagement", 0)
                daily_valence.append(valence)
                daily_engagement.append(engagement)
            
            # Store daily averages
            for emotion, values in daily_emotions.items():
                if values:
                    emotion_trends[emotion].append(sum(values) / len(values))
                else:
                    emotion_trends[emotion].append(0)
            
            # Store daily valence and engagement
            valence_by_day.append(sum(daily_valence) / len(daily_valence) if daily_valence else 0)
            engagement_by_day.append(sum(daily_engagement) / len(daily_engagement) if daily_engagement else 0)
        
        # Calculate trends
        stability_trend = "stable"
        engagement_trend = "stable"
        
        if len(valence_by_day) > 5:
            # Calculate valence trend
            x = np.arange(len(valence_by_day))
            valence_slope, _ = np.polyfit(x, valence_by_day, 1)
            
            if valence_slope > 0.02:
                stability_trend = "improving"
            elif valence_slope < -0.02:
                stability_trend = "declining"
                
            # Calculate engagement trend
            if len(engagement_by_day) > 5:
                engagement_slope, _ = np.polyfit(x, engagement_by_day, 1)
                
                if engagement_slope > 0.5:
                    engagement_trend = "increasing"
                elif engagement_slope < -0.5:
                    engagement_trend = "decreasing"
        
        # Find recurring emotional patterns
        recurring_patterns = self._detect_recurring_patterns(emotion_trends, dates)
        
        # Return comprehensive analysis
        return {
            "emotion_trends": {
                "dates": dates,
                "values": emotion_trends
            },
            "valence_trend": {
                "dates": dates,
                "values": valence_by_day,
                "direction": stability_trend
            },
            "engagement_trend": {
                "dates": dates, 
                "values": engagement_by_day,
                "direction": engagement_trend
            },
            "recurring_patterns": recurring_patterns
        }
    
    def _detect_recurring_patterns(self, emotion_trends, dates):
        """Identify recurring emotional patterns"""
        patterns = []
        
        # Look for consistent emotion pairs (emotions that rise and fall together)
        correlations = {}
        for emotion1 in self.emotion_labels:
            values1 = emotion_trends[emotion1]
            if not values1 or all(v == 0 for v in values1):
                continue
                
            for emotion2 in self.emotion_labels:
                if emotion1 == emotion2:
                    continue
                    
                values2 = emotion_trends[emotion2]
                if not values2 or all(v == 0 for v in values2):
                    continue
                
                # Calculate correlation
                if len(values1) == len(values2) and len(values1) > 3:
                    corr = np.corrcoef(values1, values2)[0, 1]
                    
                    if abs(corr) > 0.7:  # Strong correlation
                        key = tuple(sorted([emotion1, emotion2]))
                        correlations[key] = corr
        
        # Add highly correlated emotion pairs to patterns
        for (emotion1, emotion2), corr in correlations.items():
            relationship = "rise and fall together" if corr > 0 else "inversely related"
            patterns.append({
                "type": "emotion_correlation",
                "emotions": [emotion1, emotion2],
                "relationship": relationship,
                "strength": abs(corr)
            })
        
        # Look for cyclical patterns in dominant emotions
        # (This would be more complex in a full implementation)
        
        return patterns[:5]  # Return top patterns
    
    def get_therapeutic_suggestions(self, analysis, user_data=None):
        """Generate therapeutic suggestions based on emotional trend analysis"""
        suggestions = []
        
        # Get key metrics
        dominant_emotions = analysis.get("dominant_emotions", [])
        emotional_stability = analysis.get("emotional_stability", 0.5)
        mood_progression = analysis.get("mood_progression", "neutral")
        engagement_level = analysis.get("engagement_level", "moderate")
        valence_trend = analysis.get("valence_trend", "stable")
        
        # General stability-based suggestions
        if emotional_stability < 0.3:
            suggestions.append({
                "focus": "emotional regulation",
                "description": "Patient shows significant emotional instability. Consider emotional regulation techniques.",
                "techniques": ["mindfulness", "deep breathing", "cognitive restructuring"],
                "priority": "high"
            })
        
        # Dominant emotion-based suggestions
        for emotion, value in dominant_emotions:
            if value > 0.5:  # Strong emotion
                if emotion == "sad":
                    suggestions.append({
                        "focus": "mood improvement",
                        "description": "Patient shows persistent sadness. Consider mood enhancement strategies.",
                        "techniques": ["behavioral activation", "positive psychology exercises", "gratitude practices"],
                        "priority": "high" if value > 0.7 else "medium"
                    })
                elif emotion == "angry":
                    suggestions.append({
                        "focus": "anger management",
                        "description": "Patient shows significant anger. Consider anger management techniques.",
                        "techniques": ["cognitive defusion", "progressive muscle relaxation", "timeout strategies"],
                        "priority": "high" if value > 0.7 else "medium"
                    })
                elif emotion == "fear":
                    suggestions.append({
                        "focus": "anxiety reduction",
                        "description": "Patient shows anxiety/fear. Consider anxiety management approaches.",
                        "techniques": ["graduated exposure", "cognitive restructuring", "relaxation training"],
                        "priority": "high" if value > 0.7 else "medium"
                    })
        
        # Engagement-based suggestions
        if engagement_level == "low":
            suggestions.append({
                "focus": "patient engagement",
                "description": "Patient shows low emotional engagement. Consider more interactive techniques.",
                "techniques": ["motivational interviewing", "values exploration", "experiential exercises"],
                "priority": "medium"
            })
            
        # Trend-based suggestions
        if valence_trend == "deteriorating":
            suggestions.append({
                "focus": "mood stabilization",
                "description": "Patient's emotional state is deteriorating. Implement supportive interventions.",
                "techniques": ["safety planning", "increased session frequency", "coping skills training"],
                "priority": "high"
            })
            
        return suggestions