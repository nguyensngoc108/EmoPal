from datetime import datetime
import sys
import os

# Import MongoDB connection
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from database import db

# Collection
payments_collection = db["payments"]

class Payment:
    """Model for storing payment records"""
    
    def __init__(self, user_id, therapist_id, session_id, amount, 
                 payment_intent_id=None, checkout_session_id=None, 
                 payment_status="pending", payment_method="card",
                 currency="usd", refunded=False, refund_amount=None,
                 refund_reason=None, metadata=None):  # Add metadata parameter
        """
        Create a new payment record
        
        Args:
            user_id (str): ID of the user making payment
            session_id (str): ID of the therapy session 
            therapist_id (str): ID of the therapist
            amount (float): Payment amount
            currency (str): Currency code
            payment_method (str): Payment method (card, bank, etc.)
            payment_intent_id (str): Stripe payment intent ID
            payment_status (str): Status of payment
            invoice_id (str): Invoice ID if applicable
        """
        self.user_id = user_id
        self.session_id = session_id
        self.therapist_id = therapist_id
        self.amount = amount
        self.currency = currency
        self.payment_method = payment_method
        self.payment_intent_id = payment_intent_id
        self.payment_status = payment_status
        self.checkout_session_id = checkout_session_id
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.refunded = refunded
        self.refund_amount = refund_amount
        self.refund_reason = refund_reason
        self.metadata = metadata or {}  # Default to empty dict if None
        
    def save(self):
        """Save payment to database"""
        payment_data = self.__dict__
        result = payments_collection.insert_one(payment_data)
        return result.inserted_id
    
    @staticmethod
    def find_by_id(payment_id):
        """Find payment by ID"""
        from bson import ObjectId
        if isinstance(payment_id, str):
            payment_id = ObjectId(payment_id)
        return payments_collection.find_one({"_id": payment_id})
    
    @staticmethod
    def find_by_session(session_id):
        """Find payment by therapy session ID"""
        from bson import ObjectId
        if isinstance(session_id, str):
            session_id = ObjectId(session_id)
        return payments_collection.find_one({"session_id": session_id})
    
    @staticmethod
    def find_by_user(user_id, limit=10, skip=0):
        """Find payments by user ID"""
        from bson import ObjectId
        
        # Create a query that works with either string or ObjectId
        if isinstance(user_id, ObjectId):
            user_id_str = str(user_id)
            query = {"$or": [
                {"user_id": user_id_str},  # String format
                {"user_id": user_id}       # ObjectId format
            ]}
        else:
            # user_id is already a string
            query = {"user_id": user_id}
        
        return list(payments_collection.find(query)
                    .sort("created_at", -1)
                    .skip(skip)
                    .limit(limit))
    
    @staticmethod
    def find_by_therapist(therapist_id, limit=10, skip=0):
        """Find payments by therapist ID"""
        from bson import ObjectId
        
        # Create a query that works with either string or ObjectId
        if isinstance(therapist_id, ObjectId):
            therapist_id_str = str(therapist_id)
            query = {"$or": [
                {"therapist_id": therapist_id_str},  # String format
                {"therapist_id": therapist_id}       # ObjectId format
            ]}
        else:
            # therapist_id is already a string
            query = {"therapist_id": therapist_id}
        
        return list(payments_collection.find(query)
                    .sort("created_at", -1)
                    .skip(skip)
                    .limit(limit))
    
    @staticmethod
    def update_status(payment_id, status):
        """Update payment status"""
        from bson import ObjectId
        if isinstance(payment_id, str):
            payment_id = ObjectId(payment_id)
        payments_collection.update_one(
            {"_id": payment_id},
            {"$set": {"payment_status": status, "updated_at": datetime.utcnow()}}
        )
        return True
    
    @staticmethod
    def record_refund(payment_id, amount, reason=None):
        """Record a refund"""
        from bson import ObjectId
        if isinstance(payment_id, str):
            payment_id = ObjectId(payment_id)
        payments_collection.update_one(
            {"_id": payment_id},
            {"$set": {
                "refunded": True,
                "refund_amount": amount,
                "refund_reason": reason,
                "updated_at": datetime.utcnow()
            }}
        )
        return True