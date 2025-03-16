import logging
from datetime import datetime
import json
from .trend_analyzer import EmotionTrendAnalyzer

logger = logging.getLogger(__name__)

class SessionSummaryGenerator:
    """Generates comprehensive summaries of therapy sessions based on emotion data"""
    
    def __init__(self):
        self.trend_analyzer = EmotionTrendAnalyzer()
        
    def generate_summary(self, session_data, session_metadata=None):
        """
        Generate a comprehensive session summary
        
        Args:
            session_data: Emotion analysis data from the session
            session_metadata: Additional session information (duration, therapist notes, etc.)
            
        Returns:
            dict: Session summary with insights and recommendations
        """
        # Process all emotion data from the session
        emotion_data = []
        
        # Extract emotion data based on input format
        if isinstance(session_data, list):
            emotion_data = session_data
        elif isinstance(session_data, dict):
            if "frames" in session_data:
                # Extract emotion data from video frames
                for frame in session_data.get("frames", []):
                    if frame.get("faces"):
                        face = frame["faces"][0]  # Use first face
                        data_point = {
                            "timestamp": frame.get("timestamp", 0),
                            "emotions": face.get("emotions", {}),
                            "valence": face.get("valence", 0),
                            "engagement": face.get("engagement", 0)
                        }
                        emotion_data.append(data_point)
            elif "emotion_timeline" in session_data:
                # Process session with existing timeline data
                timeline = session_data.get("emotion_timeline", {})
                timestamps = sorted(timeline.get("timestamps", []))
                
                for timestamp in timestamps:
                    data_point = {
                        "timestamp": timestamp,
                        "emotions": {
                            emotion: values[timestamps.index(timestamp)]
                            for emotion, values in timeline.get("emotions", {}).items()
                            if timestamps.index(timestamp) < len(values)
                        },
                        "valence": timeline.get("valence", [])[timestamps.index(timestamp)]
                        if timeline.get("valence") and timestamps.index(timestamp) < len(timeline.get("valence", []))
                        else 0,
                        "engagement": timeline.get("engagement", [])[timestamps.index(timestamp)]
                        if timeline.get("engagement") and timestamps.index(timestamp) < len(timeline.get("engagement", []))
                        else 0
                    }
                    emotion_data.append(data_point)
        
        # Empty result if no data
        if not emotion_data:
            logger.warning("No emotion data available for summary generation")
            return {
                "status": "insufficient_data",
                "message": "Not enough emotion data to generate a meaningful summary"
            }
            
        # Get metadata
        session_duration = session_metadata.get("duration", 0) if session_metadata else 0
        therapist_notes = session_metadata.get("notes", "") if session_metadata else ""
        session_date = session_metadata.get("date", datetime.utcnow()) if session_metadata else datetime.utcnow()
        
        # Get trend analysis
        trend_analysis = self.trend_analyzer.analyze_session_data(emotion_data)
        
        # Get therapeutic suggestions
        therapeutic_suggestions = self.trend_analyzer.get_therapeutic_suggestions(trend_analysis)
        
        # Generate summary text
        summary_text = self._generate_summary_text(trend_analysis, session_duration, therapist_notes)
        
        # Generate session metrics for visualization
        session_metrics = self._generate_session_metrics(emotion_data, trend_analysis)
        
        # Compile complete summary
        summary = {
            "date": session_date.isoformat(),
            "duration_minutes": session_duration / 60 if session_duration else 0,
            "summary_text": summary_text,
            "emotional_analysis": trend_analysis,
            "therapeutic_suggestions": therapeutic_suggestions,
            "session_metrics": session_metrics,
            "status": "success"
        }
        
        return summary
    
    def _generate_summary_text(self, trend_analysis, duration_seconds, therapist_notes=""):
        """Generate a human-readable summary of the session"""
        dominant_emotions = trend_analysis.get("dominant_emotions", [])
        dominant_emotion_names = [emotion for emotion, value in dominant_emotions[:2]] if dominant_emotions else ["neutral"]
        
        stability = trend_analysis.get("emotional_stability", 0.5)
        stability_text = "very unstable" if stability < 0.2 else \
                        "somewhat unstable" if stability < 0.4 else \
                        "moderately stable" if stability < 0.6 else \
                        "stable" if stability < 0.8 else "very stable"
                        
        valence_trend = trend_analysis.get("valence_trend", "stable")
        mood = trend_analysis.get("mood_progression", "neutral")
        engagement = trend_analysis.get("engagement_level", "moderate")
        
        # Format duration
        minutes, seconds = divmod(int(duration_seconds), 60)
        duration_text = f"{minutes} minutes" if minutes > 0 else f"{seconds} seconds"
        
        # Generate summary paragraphs
        paragraphs = []
        
        # Overall summary
        overall = f"In this {duration_text} session, the patient displayed predominantly {' and '.join(dominant_emotion_names)} emotions. "
        overall += f"The patient's emotional state appeared {stability_text} and their overall mood was {mood}. "
        
        if valence_trend != "stable":
            overall += f"Their emotional state was {valence_trend} as the session progressed. "
            
        overall += f"Patient showed {engagement} levels of emotional engagement throughout the session."
        paragraphs.append(overall)
        
        # Emotional patterns
        shifts = trend_analysis.get("emotional_shifts", 0)
        if shifts > 3:
            paragraphs.append(f"The patient experienced {shifts} significant emotional shifts during the session, "
                             f"suggesting emotional lability or reactivity to session content.")
        elif shifts == 0:
            paragraphs.append("The patient maintained consistent emotional expressions throughout the session.")
        
        # Add therapist notes if available
        if therapist_notes:
            paragraphs.append(f"Therapist notes: {therapist_notes}")
        
        # Join paragraphs
        return "\n\n".join(paragraphs)
    
    def _generate_session_metrics(self, emotion_data, trend_analysis):
        """Generate session metrics for visualization and further analysis"""
        # Get timestamps and sort data points
        data_points = sorted(emotion_data, key=lambda x: x.get("timestamp", 0))
        
        if not data_points:
            return {}
            
        # Extract emotions across time
        timestamps = [point.get("timestamp", 0) for point in data_points]
        
        emotion_values = {}
        for emotion in ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']:
            emotion_values[emotion] = []
            
        valence_values = []
        engagement_values = []
        
        # Process all data points
        for point in data_points:
            emotions = point.get("emotions", {})
            for emotion in emotion_values.keys():
                emotion_values[emotion].append(emotions.get(emotion, 0))
                
            valence_values.append(point.get("valence", 0))
            engagement_values.append(point.get("engagement", 0))
        
        # Calculate emotion averages
        emotion_averages = {}
        for emotion, values in emotion_values.items():
            if values:
                emotion_averages[emotion] = {
                    "average": sum(values) / len(values),
                    "current": values[-1] if values else 0,
                    "min": min(values),
                    "max": max(values)
                }
        
        # Generate metrics for visualization
        return {
            "duration": max(timestamps) if timestamps else 0,
            "emotions": emotion_averages,
            "valence_timeline": {
                "timestamps": timestamps,
                "values": valence_values
            },
            "engagement_timeline": {
                "timestamps": timestamps,
                "values": engagement_values
            },
            "emotional_stability": trend_analysis.get("emotional_stability", 0.5),
            "emotional_shifts": trend_analysis.get("emotional_shifts", 0)
        }