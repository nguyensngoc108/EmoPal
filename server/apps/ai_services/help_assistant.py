import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class HelpAssistant:
    """Service for generating help responses in the chat system"""
    
    def __init__(self):
        self.welcome_flow = {
            "new_user": [
                "Welcome to AI Face Present! I'm your therapy assistant.",
                "I can help you find the right therapist, explain how our platform works, or assist with technical issues."
            ],
            "returning_user": [
                "Welcome back! How can I help you today?"
            ]
        }
        
        # Common help topics and their responses
        self.help_topics = {
            "find_therapist": {
                "message": "I can help you find the perfect therapist for your needs.",
                "suggestions": [
                    "Take our matching questionnaire for personalized recommendations",
                    "Browse therapists by specialty",
                    "View our highest-rated therapists"
                ],
                "actions": [
                    {"type": "link", "text": "Start matching quiz", "url": "/therapist-finder/quiz"},
                    {"type": "link", "text": "Browse all therapists", "url": "/therapist-finder"}
                ]
            },
            "how_sessions_work": {
                "message": "Therapy on our platform is flexible and convenient.",
                "suggestions": [
                    "Video sessions are 50 minutes with face-to-face interaction",
                    "Messaging plans let you chat with your therapist for days or weeks",
                    "You can combine both approaches based on your needs"
                ]
            },
            "payment": {
                "message": "We offer several payment options and plans.",
                "suggestions": [
                    "Pay per session starting at $60",
                    "Weekly messaging plans from $40/week",
                    "Monthly subscriptions with both messaging and video"
                ],
                "actions": [
                    {"type": "link", "text": "View pricing", "url": "/pricing"}
                ]
            }
            # Add more topics as needed
        }
    
    def get_response(self, query, context=None):
        """Generate a response based on user query and context"""
        if not context:
            context = {}
            
        # Handle empty queries for first-time visitors
        if not query:
            user_type = "new_user" if context.get("is_new_user", True) else "returning_user"
            return {
                "message": self.welcome_flow[user_type][0],
                "suggestions": [
                    "Find a therapist",
                    "How therapy works here",
                    "Payment options"
                ]
            }
            
        # Simple keyword matching for demo purposes
        # In production, use a real NLP service or AI model
        query_lower = query.lower()
        
        if "therapist" in query_lower or "find" in query_lower:
            return self.help_topics["find_therapist"]
            
        elif "session" in query_lower or "video" in query_lower or "work" in query_lower:
            return self.help_topics["how_sessions_work"]
            
        elif "pay" in query_lower or "cost" in query_lower or "price" in query_lower:
            return self.help_topics["payment"]
            
        # Default response
        return {
            "message": "I'm not sure I understand. Could you try rephrasing your question?",
            "suggestions": [
                "Find a therapist",
                "How therapy works",
                "Payment information",
                "Technical support"
            ]
        }