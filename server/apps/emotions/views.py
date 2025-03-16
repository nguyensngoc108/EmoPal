import os
import json
import uuid
import tempfile
import logging
from datetime import datetime
from bson import ObjectId

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

import base64
import numpy as np
import cv2
from django.http import HttpResponse
from django.template.loader import render_to_string



# Import utilities
from apps.utils.cloudinary_helper import upload_file_to_cloudinary, delete_from_cloudinary
from apps.utils.emotion_analysis import analyze_image, analyze_video
# from apps.utils.auth import get_user_from_token
from apps.emotions.models import EmotionAnalysis
from apps.utils.auth import get_user_from_request

logger = logging.getLogger(__name__)


@csrf_exempt
def test_live_emotion(request):
    """Test endpoint for live facial emotion recognition using webcam"""
    if request.method == 'GET':
        # Serve a simple HTML page with JavaScript to capture webcam frames
        html_content = render_to_string('test_live_emotion.html')
        return HttpResponse(html_content)
        
    elif request.method == 'POST':
        try:
            # Enable anonymous testing
            user = None
            try:
                user = get_user_from_request(request)
            except:
                pass  # Allow anonymous testing
                
            # Get the base64 image from the request
            data = json.loads(request.body)
            frame_data = data.get('frame')
            session_id = data.get('session_id', '')  # Get session ID for tracking
            
            if not frame_data or not frame_data.startswith('data:image/'):
                return JsonResponse({"error": "Invalid frame data"}, status=400)
                
            # Parse the base64 image
            encoded_data = frame_data.split(',')[1]
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Use the session for continuous tracking across requests
            # Initialize session data if not exists
            if not hasattr(request, '_live_detection_sessions'):
                request._live_detection_sessions = {}
            
            session_data = request._live_detection_sessions.get(session_id, {
                'emotion_history': [],
                'valence_history': [],
                'engagement_history': [],
                'frame_count': 0
            })
            
            # Apply image enhancement similar to your Python script
            frame = _enhance_frame_for_detection(frame)
            
            # Skip visualization for real-time mode
            real_time = data.get('real_time', True)
            return_viz = not real_time
            
            # Analyze the frame with enhanced approach
            analysis_results = analyze_image(frame, return_visualization=return_viz)
            
            # Apply temporal smoothing like in your Python script
            if analysis_results.get("emotions"):
                # Track overall metrics for smoothing
                probabilities = []
                for emotion in ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']:
                    probabilities.append(analysis_results["emotions"].get(emotion, 0))
                
                # Get dominant emotion and use majority voting like your Python script
                top_index = np.argmax(probabilities)
                session_data['emotion_history'].append(top_index)
                
                # Keep history bounded
                if len(session_data['emotion_history']) > 10:
                    session_data['emotion_history'].pop(0)
                
                # Get smoothed emotion via majority vote
                if session_data['emotion_history']:
                    most_common = max(set(session_data['emotion_history']), key=session_data['emotion_history'].count)
                    emotions = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']
                    analysis_results["dominant_emotion"] = emotions[most_common]
                    analysis_results["confidence"] = probabilities[most_common]
                
                # Smooth valence and engagement
                valence = analysis_results.get("valence", 0)
                session_data['valence_history'].append(valence)
                if len(session_data['valence_history']) > 10:
                    session_data['valence_history'].pop(0)
                
                engagement = analysis_results.get("engagement", 0)
                session_data['engagement_history'].append(engagement)
                if len(session_data['engagement_history']) > 10:
                    session_data['engagement_history'].pop(0)
                
                # Use smoothed values
                analysis_results["valence"] = sum(session_data['valence_history']) / len(session_data['valence_history'])
                analysis_results["engagement"] = sum(session_data['engagement_history']) / len(session_data['engagement_history'])
                
                # Increment frame count
                session_data['frame_count'] += 1
            
            # Update session data
            request._live_detection_sessions[session_id] = session_data
            
            # Return the results
            response_data = {
                "emotions": analysis_results.get("emotions", {}),
                "dominant_emotion": analysis_results.get("dominant_emotion", "unknown"),
                "valence": analysis_results.get("valence", 0),
                "engagement": analysis_results.get("engagement", 0),
                "face_count": analysis_results.get("face_count", 0),
                "timestamp": datetime.utcnow().isoformat(),
                "frame_count": session_data['frame_count']
            }
            
            # Only include visualization if requested (skip for real-time mode)
            if return_viz and "visualization" in analysis_results:
                response_data["visualization"] = analysis_results["visualization"]
                
            return JsonResponse(response_data)
            
        except Exception as e:
            logger.error(f"Error in test_live_emotion: {str(e)}")
            return JsonResponse({"error": f"Analysis failed: {str(e)}"}, status=500)
    
    return JsonResponse({"error": "Method not allowed"}, status=405)

def _enhance_frame_for_detection(frame):
    """Enhance frame for better face detection - same as in your Python implementation"""
    # Convert to grayscale for histogram equalization
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Apply histogram equalization to improve contrast
    equ = cv2.equalizeHist(gray)
    
    # Convert back to BGR for colored output
    enhanced = cv2.cvtColor(equ, cv2.COLOR_GRAY2BGR)
    
    # Blend with original for more natural look
    result = cv2.addWeighted(frame, 0.7, enhanced, 0.3, 0)
    
    return result

@csrf_exempt
@require_http_methods(["POST"])
def upload_and_analyze(request):
    """Upload an image or video for emotion analysis"""
    try:
        # Check authentication
        user = get_user_from_request(request)
        if not user:
            return JsonResponse({"error": "Authentication required"}, status=401)
        
        # Check for file in request
        if 'file' not in request.FILES:
            return JsonResponse({"error": "No file provided"}, status=400)
        
        file = request.FILES['file']
        session_id = request.POST.get('session_id')
        
        # Validate file type
        allowed_image_types = ['image/jpeg', 'image/png', 'image/gif']
        allowed_video_types = ['video/mp4', 'video/quicktime', 'video/webm']
        
        if file.content_type in allowed_image_types:
            media_type = 'image'
        elif file.content_type in allowed_video_types:
            media_type = 'video'
        else:
            return JsonResponse({"error": "Unsupported file type"}, status=400)
        
        # Prepare unique filename
        filename = f"{user['_id']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        file_ext = os.path.splitext(file.name)[1]
        temp_path = None
        
        # Create temporary file for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            for chunk in file.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name
        
        try:
            # For images, upload to Cloudinary normally
            if media_type == 'image':
                # Upload to Cloudinary
                cloudinary_response = upload_file_to_cloudinary(
                    temp_path, 
                    folder=f"emotion_analysis/{user['_id']}", 
                    public_id=filename
                )
                
                # Extract media metadata
                media_metadata = {
                    "public_id": cloudinary_response.get("public_id"),
                    "format": cloudinary_response.get("format"),
                    "width": cloudinary_response.get("width"),
                    "height": cloudinary_response.get("height"),
                    "resource_type": cloudinary_response.get("resource_type")
                }
                
                # Run emotion analysis
                analysis_results = analyze_image(temp_path, return_visualization=True)
                media_url = cloudinary_response.get("secure_url")
            
            # For videos, analyze first then upload the annotated version only
            else:  # video
                # Extract metadata first without uploading
                import cv2
                cap = cv2.VideoCapture(temp_path)
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                duration = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS))
                cap.release()
                
                # Store metadata without Cloudinary ID yet
                media_metadata = {
                    "format": os.path.splitext(file.name)[1].lstrip('.'),
                    "width": width,
                    "height": height,
                    "duration": duration,
                    "resource_type": "video"
                }
                
                # Run video analysis - don't set max_duration to keep full video length
                sample_rate = 1.0 if duration < 30 else 0.5 if duration < 120 else 0.2
                analysis_results = analyze_video(temp_path, sample_rate=sample_rate)
                
                # Check if we have an annotated video
                if not analysis_results.get("annotated_video_path"):
                    logger.error("No annotated video was created during analysis")
                    # Fallback to original video if no annotated video
                    cloudinary_response = upload_file_to_cloudinary(
                        temp_path, 
                        folder=f"emotion_analysis/{user['_id']}", 
                        public_id=filename,
                        resource_type="video"
                    )
                    media_url = cloudinary_response.get("secure_url")
                    media_metadata["public_id"] = cloudinary_response.get("public_id")
                else:
                    # Upload the annotated video to Cloudinary as the main media
                    annotated_video_path = analysis_results.get("annotated_video_path")
                    cloudinary_response = upload_file_to_cloudinary(
                        annotated_video_path,
                        folder=f"emotion_analysis/{user['_id']}",
                        public_id=filename,  # Use the main filename (no _annotated suffix)
                        resource_type="video"
                    )
                    
                    # Store the URL as the main media URL
                    media_url = cloudinary_response.get("secure_url")
                    media_metadata["public_id"] = cloudinary_response.get("public_id")
                    
                    # We don't need a separate annotated_video field anymore
                    if "annotated_video_path" in analysis_results:
                        del analysis_results["annotated_video_path"]
                        
                    # Clean up the temporary annotated file
                    if os.path.exists(annotated_video_path):
                        os.unlink(annotated_video_path)
            
            # Create and save analysis document
            analysis = EmotionAnalysis(
                user_id=ObjectId(user['_id']),
                media_url=media_url,  # Now using the annotated video URL for videos
                media_type=media_type,
                session_id=ObjectId(session_id) if session_id else None,
                results=analysis_results,
                media_metadata=media_metadata
            )
            
            # Save visualization images if available
            if 'visualization' in analysis_results:
                analysis.visualizations["analyzed_image"] = analysis_results["visualization"]
            if 'graph' in analysis_results:
                analysis.visualizations["emotion_graph"] = analysis_results["graph"]
            if 'timeline_graph' in analysis_results:
                analysis.visualizations["timeline_graph"] = analysis_results["timeline_graph"]
                
            # Generate therapeutic insights
            generate_therapeutic_insights(analysis)
                
            # Save to database
            analysis_id = analysis.save()
            
            # Return success with results
            return JsonResponse({
                "success": True,
                "analysis_id": str(analysis_id),
                "media_url": media_url,
                "media_type": media_type,
                "results_summary": {
                    "dominant_emotion": analysis_results.get("overall", {}).get("dominant_emotion") or 
                                       analysis_results.get("dominant_emotion"),
                    "valence": analysis_results.get("overall", {}).get("avg_valence") or 
                              analysis_results.get("valence", 0),
                    "engagement": analysis_results.get("overall", {}).get("avg_engagement") or 
                                analysis_results.get("engagement", 0),
                    "face_count": analysis_results.get("face_count", 0)
                }
            })
            
        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        logger.error(f"Error in upload_and_analyze: {str(e)}")
        return JsonResponse({"error": f"Analysis failed: {str(e)}"}, status=500)

@require_http_methods(["GET"])
def get_analysis_details(request, analysis_id):
    """Get detailed analysis results"""
    try:
        # Check authentication
        user = get_user_from_request(request)
        if not user:
            return JsonResponse({"error": "Authentication required"}, status=401)
        
        # Retrieve analysis
        analysis = EmotionAnalysis.find_by_id(analysis_id)
        if not analysis:
            return JsonResponse({"error": "Analysis not found"}, status=404)
        
        # Debug output
        print("Analysis user_id:", analysis.get('user_id'))
        print("Request user _id:", user['_id'])
        print("Analysis user_id (str):", str(analysis.get('user_id')))
        
        # Check ownership - FIXED COMPARISON
        if str(analysis.get('user_id')) != str(user['_id']):
            return JsonResponse({"error": "Access denied"}, status=403)
        
        # Return detailed results
        return JsonResponse({
            "analysis_id": str(analysis['_id']),
            "media_url": analysis['media_url'],
            "media_type": analysis['media_type'],
            "created_at": analysis['created_at'].isoformat(),
            "results": analysis['results'],
            "visualizations": analysis.get('visualizations', {}),
            "therapeutic_context": analysis.get('therapeutic_context', {})
        })
    
    except Exception as e:
        logger.error(f"Error in get_analysis_details: {str(e)}")
        return JsonResponse({"error": f"Failed to retrieve analysis: {str(e)}"}, status=500)

@require_http_methods(["GET"])
def get_user_analyses(request):
    """Get list of user's analyses"""
    try:
        # Check authentication
        user = get_user_from_request(request)
        if not user:
            return JsonResponse({"error": "Authentication required"}, status=401)
        
        # Get pagination parameters
        limit = min(int(request.GET.get('limit', 10)), 50)  # Cap at 50
        skip = max(int(request.GET.get('skip', 0)), 0)
        
        # Get analyses
        analyses = EmotionAnalysis.find_by_user(user['_id'], limit=limit, skip=skip)
        
        # Format for response
        results = []
        for analysis in analyses:
            results.append({
                "analysis_id": str(analysis['_id']),
                "media_url": analysis['media_url'],
                "media_type": analysis['media_type'],
                "created_at": analysis['created_at'].isoformat(),
                "dominant_emotion": analysis.get('results', {}).get('overall', {}).get('dominant_emotion') or 
                                    analysis.get('results', {}).get('dominant_emotion', 'unknown'),
                "thumbnail": analysis.get('visualizations', {}).get('analyzed_image')
            })
        
        return JsonResponse({
            "analyses": results,
            "count": len(results),
            "skip": skip,
            "limit": limit
        })
    
    except Exception as e:
        logger.error(f"Error in get_user_analyses: {str(e)}")
        return JsonResponse({"error": f"Failed to retrieve analyses: {str(e)}"}, status=500)

def generate_therapeutic_insights(analysis):
    """Generate therapeutic insights based on emotion analysis"""
    try:
        results = analysis.results
        
        # Initialize therapeutic context
        analysis.therapeutic_context = {
            "suggested_approach": "",
            "warning_flags": [],
            "therapy_notes": ""
        }
        
        # Get dominant emotion
        dominant_emotion = results.get("overall", {}).get("dominant_emotion") or results.get("dominant_emotion")
        valence = results.get("overall", {}).get("avg_valence") or results.get("valence", 0)
        engagement = results.get("overall", {}).get("avg_engagement") or results.get("engagement", 0)
        
        # Generate simple therapeutic suggestions based on emotion
        if dominant_emotion == "sad":
            analysis.therapeutic_context["suggested_approach"] = "Consider cognitive behavioral therapy approaches to address negative thought patterns."
            analysis.therapeutic_context["therapy_notes"] = "Patient displays signs of sadness. Focus on mood improvement strategies and identifying triggers."
            
            # Add warning if valence is very negative
            if valence < -0.5:
                analysis.therapeutic_context["warning_flags"].append("Significant negative emotional valence detected")
        
        elif dominant_emotion == "angry":
            analysis.therapeutic_context["suggested_approach"] = "Consider anger management techniques and stress reduction strategies."
            analysis.therapeutic_context["therapy_notes"] = "Patient displays signs of anger. Focus on identifying triggers and developing coping mechanisms."
            
            # Add warning for high intensity anger
            if results.get("emotions", {}).get("angry", 0) > 0.7:
                analysis.therapeutic_context["warning_flags"].append("High intensity anger detected")
        
        elif dominant_emotion == "fear":
            analysis.therapeutic_context["suggested_approach"] = "Consider exposure therapy or anxiety management techniques."
            analysis.therapeutic_context["therapy_notes"] = "Patient displays signs of fear or anxiety. Focus on safety and gradual exposure to triggers."
            
            if results.get("emotions", {}).get("fear", 0) > 0.7:
                analysis.therapeutic_context["warning_flags"].append("High intensity fear response detected")
        
        elif dominant_emotion == "happy":
            analysis.therapeutic_context["suggested_approach"] = "Reinforce positive behaviors and experiences."
            analysis.therapeutic_context["therapy_notes"] = "Patient displays positive affect. Identify what's working well and build on these strengths."
        
        # Check engagement level
        if engagement < 30:
            analysis.therapeutic_context["warning_flags"].append("Low emotional engagement detected")
            analysis.therapeutic_context["therapy_notes"] += " Patient shows low emotional engagement, which may indicate emotional suppression or disconnect."
        
        # Add general notes about emotional presentation
        emotions_str = ", ".join([f"{emotion}: {prob:.1%}" for emotion, prob in 
                                 sorted(results.get("emotions", {}).items(), key=lambda x: x[1], reverse=True)[:3]])
        
        analysis.therapeutic_context["therapy_notes"] += f" Main emotions detected: {emotions_str}."
        
    except Exception as e:
        logger.error(f"Error generating therapeutic insights: {str(e)}")
        # Don't raise exception, just log it
        
        
@require_http_methods(["GET"])
def get_emotion_trends(request):
    """Get emotion trends over time for a user"""
    try:
        # Check authentication
        user = get_user_from_request(request)
        if not user:
            return JsonResponse({"error": "Authentication required"}, status=401)
        
        # Get time range (default to last 30 days)
        days = int(request.GET.get('days', 30))
        
        # Get trends from model
        trends = EmotionAnalysis.get_emotion_trends(user['_id'], days=days)
        
        # Generate visualization
        from apps.utils.emotion_analysis.visualization_generator import generate_trend_chart
        chart_image = generate_trend_chart(trends)
        
        return JsonResponse({
            "trends": trends,
            "visualization": chart_image,
            "timespan": f"{days} days"
        })
        
    except Exception as e:
        logger.error(f"Error in get_emotion_trends: {str(e)}")
        return JsonResponse({"error": f"Failed to retrieve trends: {str(e)}"}, status=500)

@require_http_methods(["GET"])
def get_visualization(request, analysis_id, viz_type):
    """Get specific visualization for an analysis"""
    try:
        # Check authentication
        user = get_user_from_request(request)
        if not user:
            return JsonResponse({"error": "Authentication required"}, status=401)
        
        # Retrieve analysis
        analysis = EmotionAnalysis.find_by_id(analysis_id)
        if not analysis:
            return JsonResponse({"error": "Analysis not found"}, status=404)
        
        # Check ownership
        if str(analysis.get('user_id')) != user['_id']:
            return JsonResponse({"error": "Access denied"}, status=403)
        
        # Generate requested visualization
        from apps.utils.emotion_analysis.visualization_generator import generate_visualization
        
        visualization = generate_visualization(analysis, viz_type)
        if not visualization:
            return JsonResponse({"error": f"Visualization type '{viz_type}' not supported"}, status=400)
        
        return JsonResponse({
            "visualization": visualization,
            "analysis_id": analysis_id,
            "viz_type": viz_type
        })
        
    except Exception as e:
        logger.error(f"Error in get_visualization: {str(e)}")
        return JsonResponse({"error": f"Failed to generate visualization: {str(e)}"}, status=500)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_analysis(request, analysis_id):
    """Delete an analysis and associated media"""
    try:
        # Check authentication
        user = get_user_from_request(request)
        if not user:
            return JsonResponse({"error": "Authentication required"}, status=401)
        
        # Retrieve analysis to get media info
        analysis = EmotionAnalysis.find_by_id(analysis_id)
        if not analysis:
            return JsonResponse({"error": "Analysis not found"}, status=404)
        
        # Check ownership
        if str(analysis.get('user_id')) != user['_id']:
            return JsonResponse({"error": "Access denied"}, status=403)
        
        # Delete from Cloudinary if media exists
        if analysis.get('media_metadata') and analysis['media_metadata'].get('public_id'):
            delete_from_cloudinary(
                analysis['media_metadata']['public_id'],
                resource_type=analysis['media_metadata'].get('resource_type', 'image')
            )
        
        # Delete from database
        result = EmotionAnalysis.delete_analysis(analysis_id, user['_id'])
        
        return JsonResponse({
            "success": True,
            "message": "Analysis and associated media deleted"
        })
        
    except Exception as e:
        logger.error(f"Error in delete_analysis: {str(e)}")
        return JsonResponse({"error": f"Failed to delete analysis: {str(e)}"}, status=500)
    
    
