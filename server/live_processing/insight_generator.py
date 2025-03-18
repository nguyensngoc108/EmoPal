import random
from datetime import datetime

def generate_insights(trend_analysis, emotions, dominant_emotion):
    """
    Generate therapeutic insights based on emotion analysis
    """
    insights = {
        "current_state": generate_current_state(dominant_emotion, emotions, trend_analysis),
        "suggestions": generate_therapeutic_suggestions(dominant_emotion, trend_analysis),
        "observation": generate_observation(trend_analysis, dominant_emotion)
    }
    
    return insights

def generate_current_state(dominant_emotion, emotions, trend_analysis):
    """Generate description of client's current emotional state"""
    
    intensity = emotions.get(dominant_emotion, 0)
    intensity_text = "strongly" if intensity > 0.7 else "moderately" if intensity > 0.4 else "mildly"
    
    valence_trend = trend_analysis.get("valence_trend", "stable")
    stability = trend_analysis.get("emotional_stability", 0.5)
    
    state_templates = {
        "happy": [
            f"Client appears {intensity_text} positive and content.",
            f"Client is expressing happiness with {stability_level(stability)} emotional stability."
        ],
        "sad": [
            f"Client shows {intensity_text} sadness with {trend_direction(valence_trend)} mood trend.",
            f"Client is expressing feelings of sadness at {intensity_level(intensity)} intensity."
        ],
        "angry": [
            f"Client exhibits {intensity_text} anger or frustration.",
            f"Client is displaying anger with {stability_level(stability)} emotional regulation."
        ],
        "fear": [
            f"Client appears {intensity_text} anxious or fearful.",
            f"Client is showing signs of anxiety at {intensity_level(intensity)} intensity."
        ],
        "disgust": [
            f"Client shows {intensity_text} aversion or discomfort.",
            f"Client is expressing disgust with {stability_level(stability)} emotional control."
        ],
        "surprise": [
            f"Client appears {intensity_text} surprised or taken aback.",
            f"Client is showing signs of surprise, possibly indicating new realizations."
        ],
        "neutral": [
            f"Client maintains a neutral expression with {stability_level(stability)} emotional engagement.",
            f"Client appears emotionally reserved or measured in their expression."
        ]
    }
    
    templates = state_templates.get(dominant_emotion, state_templates["neutral"])
    return random.choice(templates)

def generate_therapeutic_suggestions(dominant_emotion, trend_analysis):
    """Generate therapeutic suggestions based on emotional data"""
    
    engagement = trend_analysis.get("engagement_level", "moderate")
    
    suggestion_templates = {
        "happy": [
            "Explore what's contributing to current positive feelings",
            "Identify resources that can sustain this positive state",
            "Examine how these positive emotions can be applied to challenges"
        ],
        "sad": [
            "Explore recent events that may have triggered sadness",
            "Consider behavioral activation techniques to improve mood",
            "Examine thought patterns that may contribute to low mood",
            "Check for potential signs of depression if sadness persists"
        ],
        "angry": [
            "Explore the underlying needs behind the anger expression",
            "Consider introducing anger management techniques",
            "Examine triggers and response patterns for anger",
            "Practice communication strategies for expressing needs"
        ],
        "fear": [
            "Explore specific sources of anxiety or fear",
            "Consider grounding or mindfulness techniques",
            "Examine thought patterns related to perceived threats",
            "Discuss graduated exposure approaches if appropriate"
        ],
        "disgust": [
            "Explore the sources of aversion or discomfort",
            "Consider cognitive reframing for strong reactions",
            "Examine if disgust relates to moral/ethical concerns",
            "Look for potential trauma connections if appropriate"
        ],
        "surprise": [
            "Allow processing time for unexpected information",
            "Explore cognitive integration of surprising material",
            "Check for any underlying emotions accompanying surprise",
            "Use this moment of surprise for perspective-taking"
        ],
        "neutral": [
            "Check for emotional suppression or alexithymia",
            "Explore deeper feelings that may be less accessible",
            "Consider emotional awareness exercises",
            "Examine if medication may be affecting emotional expression"
        ]
    }
    
    # Add engagement-based suggestions
    engagement_suggestions = {
        "low": [
            "Consider more interactive therapeutic techniques",
            "Explore potential barriers to emotional engagement"
        ],
        "moderate": [
            "Continue building therapeutic rapport through reflective listening",
            "Use moderate structure with room for exploration"
        ],
        "high": [
            "Utilize high engagement for deeper therapeutic work",
            "Consider if intensity of engagement needs moderation"
        ]
    }
    
    # Combine suggestions
    base_suggestions = suggestion_templates.get(dominant_emotion, suggestion_templates["neutral"])
    eng_suggestions = engagement_suggestions.get(engagement, engagement_suggestions["moderate"])
    
    # Select a subset of suggestions
    all_suggestions = base_suggestions + eng_suggestions
    return random.sample(all_suggestions, min(3, len(all_suggestions)))

def generate_observation(trend_analysis, dominant_emotion):
    """Generate key observation based on emotional data"""
    
    stability = trend_analysis.get("emotional_stability", 0.5)
    shifts = trend_analysis.get("emotional_shifts", 0)
    
    # Observations based on emotional patterns
    if shifts > 5:
        return "Significant emotional lability suggests heightened sensitivity to session content."
    elif stability < 0.3:
        return "Low emotional stability may indicate difficulty with emotional regulation."
    elif stability > 0.8 and dominant_emotion == "neutral":
        return "High stability with neutral affect may suggest emotional suppression or avoidance."
    
    # Dominant emotion specific observations
    emotion_observations = {
        "happy": "Positive affect appears genuine and connected to content being discussed.",
        "sad": "Sadness seems to emerge specifically when discussing personal relationships.",
        "angry": "Anger manifestation appears controlled but significant.",
        "fear": "Anxiety seems to fluctuate with specific topic transitions.",
        "disgust": "Aversion response appears connected to self-concept discussions.",
        "surprise": "Moments of surprise suggest new insights are being processed.",
        "neutral": "Neutral expression maintained consistently throughout emotional content."
    }
    
    return emotion_observations.get(dominant_emotion, "Client's emotional patterns warrant further exploration.")

def stability_level(stability):
    """Convert stability value to descriptive text"""
    if stability < 0.3:
        return "low"
    elif stability < 0.7:
        return "moderate"
    else:
        return "high"

def intensity_level(intensity):
    """Convert intensity value to descriptive text"""
    if intensity < 0.3:
        return "low"
    elif intensity < 0.7:
        return "moderate"
    else:
        return "high"

def trend_direction(trend):
    """Convert trend value to descriptive text"""
    if trend == "improving":
        return "improving"
    elif trend == "deteriorating":
        return "declining"
    else:
        return "stable"