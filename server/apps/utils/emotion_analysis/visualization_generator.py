import matplotlib.pyplot as plt
import numpy as np
import base64
from io import BytesIO
import logging
from datetime import datetime, timedelta
import seaborn as sns
from matplotlib.colors import LinearSegmentedColormap

logger = logging.getLogger(__name__)

# Create a custom colormap for emotions (from negative to positive)
EMOTION_COLORS = {
    'angry': '#FF5252',     # Red
    'disgust': '#8C9900',   # Olive green
    'fear': '#AA00FF',      # Purple
    'sad': '#0288D1',       # Blue
    'neutral': '#9E9E9E',   # Gray
    'happy': '#FFCA28',     # Yellow
    'surprise': '#00BFA5'   # Teal
}

def generate_bar_chart(emotion_data, title="Emotion Analysis", width=800, height=500):
    """Generate horizontal bar chart of emotions"""
    try:
        # Create figure and axes
        fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
        
        # Extract and sort data by value
        emotions = emotion_data.get("emotions", {})
        sorted_emotions = sorted(emotions.items(), key=lambda x: x[1], reverse=True)
        labels, values = zip(*sorted_emotions)
        colors = [EMOTION_COLORS.get(emotion, '#9E9E9E') for emotion in labels]
        
        # Create horizontal bar chart
        bars = ax.barh(labels, values, color=colors)
        
        # Add values on bars
        for i, v in enumerate(values):
            ax.text(v + 0.01, i, f'{v:.2f}', va='center')
        
        # Customize chart
        ax.set_title(title)
        ax.set_xlim(0, 1.0)
        
        # Convert plot to image
        buf = BytesIO()
        fig.tight_layout()
        plt.savefig(buf, format='png')
        plt.close(fig)
        buf.seek(0)
        
        # Convert to base64 for embedding in HTML
        graph_img = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{graph_img}"
        
    except Exception as e:
        logger.error(f"Error generating bar chart: {str(e)}")
        return None

def generate_timeline_chart(emotion_timeline, title="Emotion Timeline", width=900, height=500):
    """Generate timeline chart of emotions across time"""
    try:
        # Create figure
        fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
        
        # Plot each emotion
        for emotion, data_points in emotion_timeline.items():
            if not data_points:
                continue
                
            timestamps = [point["timestamp"] for point in data_points]
            values = [point["value"] for point in data_points]
            color = EMOTION_COLORS.get(emotion, '#9E9E9E')
            
            ax.plot(timestamps, values, label=emotion, marker='o', markersize=3, color=color)
        
        # Add labels and legend
        ax.set_xlabel('Time (seconds)')
        ax.set_ylabel('Emotion Probability')
        ax.set_title(title)
        ax.legend(loc='upper right')
        ax.grid(True, alpha=0.3)
        ax.set_ylim(0, 1.0)
        
        # Convert plot to image
        buf = BytesIO()
        fig.tight_layout()
        plt.savefig(buf, format='png')
        plt.close(fig)
        buf.seek(0)
        
        # Convert to base64 for embedding in HTML
        graph_img = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{graph_img}"
        
    except Exception as e:
        logger.error(f"Error generating timeline chart: {str(e)}")
        return None

def generate_valence_arousal_plot(valence, arousal, title="Emotional State", width=600, height=600):
    """Generate a valence-arousal circumplex plot of emotional state"""
    try:
        fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
        
        # Create background quadrant labels
        ax.text(0.7, 0.7, "EXCITED", ha='center', fontsize=12, alpha=0.3)
        ax.text(-0.7, 0.7, "STRESSED", ha='center', fontsize=12, alpha=0.3)
        ax.text(-0.7, -0.7, "DEPRESSED", ha='center', fontsize=12, alpha=0.3)
        ax.text(0.7, -0.7, "CALM", ha='center', fontsize=12, alpha=0.3)
        
        # Set up the plot
        ax.set_xlim(-1.1, 1.1)
        ax.set_ylim(-1.1, 1.1)
        ax.axhline(y=0, color='k', linestyle='-', alpha=0.3)
        ax.axvline(x=0, color='k', linestyle='-', alpha=0.3)
        ax.set_xlabel('Valence (Negative → Positive)')
        ax.set_ylabel('Arousal (Calm → Excited)')
        ax.set_title(title)
        ax.grid(True, alpha=0.2)
        
        # Plot the valence-arousal point with a custom marker
        marker_size = 200
        ax.scatter(valence, arousal, s=marker_size, alpha=0.7, 
                   color=get_emotion_color(valence, arousal),
                   edgecolors='black', linewidth=1)
        
        # Add descriptive text
        emotion_label = get_emotion_label(valence, arousal)
        ax.annotate(f"{emotion_label}\nValence: {valence:.2f}, Arousal: {arousal:.2f}", 
                   (valence, arousal), 
                   xytext=(0, -30), 
                   textcoords="offset points",
                   ha='center',
                   bbox=dict(boxstyle="round,pad=0.5", fc="white", alpha=0.8))
        
        # Convert to image
        buf = BytesIO()
        fig.tight_layout()
        plt.savefig(buf, format='png')
        plt.close(fig)
        buf.seek(0)
        
        # Convert to base64 for embedding in HTML
        graph_img = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{graph_img}"
        
    except Exception as e:
        logger.error(f"Error generating valence-arousal plot: {str(e)}")
        return None

def get_emotion_color(valence, arousal):
    """Get color based on emotion quadrant"""
    if valence >= 0 and arousal >= 0:      # Happy/Excited
        return '#FFCA28'  # Yellow
    elif valence < 0 and arousal >= 0:     # Angry/Stressed
        return '#FF5252'  # Red
    elif valence < 0 and arousal < 0:      # Sad/Depressed
        return '#0288D1'  # Blue
    else:                                  # Calm/Content
        return '#00BFA5'  # Teal

def get_emotion_label(valence, arousal):
    """Get emotion label based on valence-arousal position"""
    if valence >= 0.5 and arousal >= 0.5:       # High positive valence, high arousal
        return "Excited/Happy"
    elif valence >= 0.3 and abs(arousal) < 0.3:  # Positive valence, neutral arousal
        return "Content"
    elif valence >= 0.3 and arousal <= -0.3:     # Positive valence, low arousal
        return "Relaxed/Calm"
    elif valence <= -0.5 and arousal >= 0.5:     # Very negative valence, high arousal
        return "Angry/Upset"
    elif valence <= -0.3 and abs(arousal) < 0.3: # Negative valence, neutral arousal
        return "Dissatisfied"
    elif valence <= -0.3 and arousal <= -0.3:    # Negative valence, low arousal
        return "Sad/Depressed"
    elif abs(valence) < 0.3 and abs(arousal) < 0.3: # Neutral zone
        return "Neutral"
    elif abs(valence) < 0.3 and arousal >= 0.3:     # Neutral valence, high arousal
        return "Alert/Tense"
    elif abs(valence) < 0.3 and arousal <= -0.3:    # Neutral valence, low arousal
        return "Tired/Bored"
    else:
        return "Mixed"

def generate_session_summary_chart(session_data, width=1000, height=600):
    """Generate comprehensive session summary visualization"""
    try:
        # Create figure with 2x2 subplots
        fig, axs = plt.subplots(2, 2, figsize=(width/100, height/100), dpi=100)
        
        # 1. Emotion Distribution (top left)
        emotions = session_data.get('emotions', {})
        emotions_sorted = sorted(emotions.items(), key=lambda x: x[1]['average'], reverse=True)
        labels = [e[0] for e in emotions_sorted]
        values = [e[1]['average'] for e in emotions_sorted]
        colors = [EMOTION_COLORS.get(emotion, '#9E9E9E') for emotion in labels]
        
        axs[0, 0].barh(labels, values, color=colors)
        axs[0, 0].set_title('Dominant Emotions')
        axs[0, 0].set_xlim(0, 1.0)
        
        # 2. Valence Timeline (top right)
        if 'valence_timeline' in session_data:
            times = session_data['valence_timeline']['times']
            values = session_data['valence_timeline']['values']
            
            axs[0, 1].plot(times, values, color='blue', marker='o', markersize=2)
            axs[0, 1].set_title('Emotional Valence Timeline')
            axs[0, 1].set_ylim(-1.0, 1.0)
            axs[0, 1].axhline(y=0, color='k', linestyle='--', alpha=0.3)
            axs[0, 1].set_ylabel('Negative ← → Positive')
            axs[0, 1].grid(True, alpha=0.3)
        
        # 3. Engagement Timeline (bottom left)
        if 'engagement_timeline' in session_data:
            times = session_data['engagement_timeline']['times']
            values = session_data['engagement_timeline']['values']
            
            axs[1, 0].plot(times, values, color='green', marker='o', markersize=2)
            axs[1, 0].set_title('Engagement Level')
            axs[1, 0].set_ylim(0, 100)
            axs[1, 0].set_ylabel('Engagement %')
            axs[1, 0].grid(True, alpha=0.3)
        
        # 4. Emotional Stability (bottom right)
        if 'emotional_shifts' in session_data:
            shifts = session_data['emotional_shifts']
            stability = session_data.get('emotional_stability', 0.5)
            
            # Create a gauge chart for emotional stability
            stability_colors = [(0.8, 0.1, 0.1), (0.95, 0.85, 0.1), (0.1, 0.8, 0.1)]
            stability_cmap = LinearSegmentedColormap.from_list("stability", stability_colors)
            
            axs[1, 1].set_aspect('equal')
            axs[1, 1].set_title('Emotional Stability')
            
            # Create a gauge (half circle)
            theta = np.linspace(0, np.pi, 100)
            r = 0.8
            x = r * np.cos(theta)
            y = r * np.sin(theta)
            
            # Draw gauge background
            axs[1, 1].plot(x, y, color='black', linewidth=2)
            
            # Add colored arcs for different stability regions
            arc_resolution = 30
            for i in range(3):
                start_angle = i * np.pi/3
                end_angle = (i+1) * np.pi/3
                arc_theta = np.linspace(start_angle, end_angle, arc_resolution)
                arc_x = r * np.cos(arc_theta)
                arc_y = r * np.sin(arc_theta)
                axs[1, 1].plot(arc_x, arc_y, color=stability_cmap(i/2), linewidth=8, alpha=0.7)
            
            # Add needle showing current stability
            needle_angle = (1 - stability) * np.pi
            needle_x = [0, r * 0.9 * np.cos(needle_angle)]
            needle_y = [0, r * 0.9 * np.sin(needle_angle)]
            axs[1, 1].plot(needle_x, needle_y, color='black', linewidth=3)
            
            # Add labels
            axs[1, 1].text(-r*0.7, r*0.2, "Unstable", ha='center', fontsize=10)
            axs[1, 1].text(0, r*0.5, "Moderate", ha='center', fontsize=10)
            axs[1, 1].text(r*0.7, r*0.2, "Stable", ha='center', fontsize=10)
            
            # Add stability percentage
            axs[1, 1].text(0, -r*0.3, f"Stability: {stability*100:.1f}%", ha='center', fontsize=12)
            
            # Add count of emotional shifts
            axs[1, 1].text(0, -r*0.5, f"Emotional shifts: {shifts}", ha='center', fontsize=10)
            
            # Remove axes
            axs[1, 1].set_xlim(-1, 1)
            axs[1, 1].set_ylim(-0.2, 1)
            axs[1, 1].axis('off')
        
        # Main title
        duration = session_data.get('duration', 0)
        minutes, seconds = divmod(int(duration), 60)
        fig.suptitle(f"Therapy Session Emotional Summary ({minutes}m {seconds}s)", fontsize=16)
        
        # Adjust layout
        fig.tight_layout()
        plt.subplots_adjust(top=0.9)
        
        # Convert to image
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close(fig)
        buf.seek(0)
        
        # Convert to base64 for embedding in HTML
        graph_img = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{graph_img}"
        
    except Exception as e:
        logger.error(f"Error generating session summary chart: {str(e)}")
        return None

def generate_trend_chart(trend_data, width=1000, height=500):
    """Generate chart showing emotional trends over time (days/weeks)"""
    try:
        # Create figure
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(width/100, height/100), dpi=100, 
                                       gridspec_kw={'height_ratios': [3, 2]})
        
        # Extract data
        dates = trend_data.get('dates', [])
        if not dates:
            raise ValueError("No trend data available")
            
        # 1. Plot emotion trends
        emotions = trend_data.get('emotions', {})
        for emotion, values in emotions.items():
            if len(values) > 0:
                color = EMOTION_COLORS.get(emotion, '#9E9E9E')
                ax1.plot(dates, values, label=emotion, marker='o', 
                        markersize=4, linewidth=2, alpha=0.7, color=color)
        
        # Customize emotion plot
        ax1.set_title('Emotional Trends Over Time')
        ax1.set_ylabel('Emotion Intensity')
        ax1.grid(True, alpha=0.3)
        ax1.legend(loc='upper right')
        
        # 2. Plot valence trend
        valence = trend_data.get('valence', [])
        engagement = trend_data.get('engagement', [])
        
        if valence:
            # Create a color gradient based on valence
            valence_colors = []
            for v in valence:
                if v > 0.2:
                    valence_colors.append('#4CAF50')  # Green for positive
                elif v < -0.2:
                    valence_colors.append('#F44336')  # Red for negative
                else:
                    valence_colors.append('#9E9E9E')  # Grey for neutral
                    
            ax2.bar(dates, valence, color=valence_colors, alpha=0.6, label='Valence')
            ax2.axhline(y=0, color='k', linestyle='--', alpha=0.3)
            ax2.set_ylabel('Emotional Valence')
        
        # Customize valence plot
        ax2.set_xlabel('Date')
        ax2.grid(True, alpha=0.3)
        
        # Format x-axis dates
        fig.autofmt_xdate()
        
        # Layout
        fig.tight_layout()
        
        # Convert to image
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close(fig)
        buf.seek(0)
        
        # Convert to base64 for embedding in HTML
        graph_img = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{graph_img}"
        
    except Exception as e:
        logger.error(f"Error generating trend chart: {str(e)}")
        return None

# Main function that other modules can call
def generate_visualization(analysis, viz_type):
    """Generate appropriate visualization based on the requested type"""
    try:
        if viz_type == 'emotions':
            emotions = analysis.get('results', {}).get('emotions', {})
            return generate_bar_chart({'emotions': emotions}, "Emotion Analysis")
            
        elif viz_type == 'timeline':
            timeline = analysis.get('results', {}).get('overall', {}).get('emotion_timeline', {})
            return generate_timeline_chart(timeline, "Emotion Timeline")
            
        elif viz_type == 'valence_arousal':
            valence = analysis.get('results', {}).get('valence', 0)
            # Calculate arousal from engagement (scaled from 0-100 to -1 to 1)
            engagement = analysis.get('results', {}).get('engagement', 50)
            arousal = (engagement / 50) - 1
            return generate_valence_arousal_plot(valence, arousal)
            
        elif viz_type == 'session_summary':
            # For session summary, we need to prepare the data
            session_data = prepare_session_summary_data(analysis)
            return generate_session_summary_chart(session_data)
            
        elif viz_type == 'trends':
            # This would be called with trend data from EmotionAnalysis.get_emotion_trends
            return generate_trend_chart(analysis)
            
        else:
            logger.warning(f"Unsupported visualization type: {viz_type}")
            return None
            
    except Exception as e:
        logger.error(f"Error generating visualization: {str(e)}")
        return None

def prepare_session_summary_data(analysis):
    """Prepare data for session summary visualization"""
    # This would extract relevant data from a session's emotion analyses
    session_data = {
        'emotions': {},
        'valence_timeline': {'times': [], 'values': []},
        'engagement_timeline': {'times': [], 'values': []},
        'emotional_shifts': 0,
        'emotional_stability': 0.5,  # Default value
        'duration': 0
    }
    
    # Extract data from analysis results
    results = analysis.get('results', {})
    
    # Get session metrics if available
    metrics = results.get('session_metrics', {})
    if metrics:
        session_data['emotions'] = metrics.get('emotions', {})
        session_data['emotional_stability'] = metrics.get('emotional_stability', 0.5)
        session_data['duration'] = metrics.get('duration', 0)
    else:
        # Fall back to overall emotion data
        emotions = results.get('overall', {}).get('emotions', {})
        if not emotions:
            emotions = results.get('emotions', {})
        
        session_data['emotions'] = {
            emotion: {'current': value, 'average': value}
            for emotion, value in emotions.items()
        }
    
    # Extract timeline data if available
    frames = results.get('frames', [])
    if frames:
        # For video analysis, extract data from frames
        times = []
        valence_values = []
        engagement_values = []
        
        for frame in frames:
            if 'timestamp' in frame and frame.get('faces', []):
                times.append(frame['timestamp'])
                face = frame['faces'][0]  # Use first face
                valence_values.append(face.get('valence', 0))
                engagement_values.append(face.get('engagement', 0) / 100)  # Convert to 0-1
                
        session_data['valence_timeline'] = {'times': times, 'values': valence_values}
        session_data['engagement_timeline'] = {'times': times, 'values': engagement_values}
        
        # Calculate emotional shifts (detect significant changes in valence)
        if len(valence_values) >= 2:
            shifts = 0
            prev_val = valence_values[0]
            for val in valence_values[1:]:
                if abs(val - prev_val) > 0.3:  # Significant shift threshold
                    shifts += 1
                prev_val = val
            
            session_data['emotional_shifts'] = shifts
    
    return session_data