import os
import stripe
import logging
from datetime import datetime
from bson import ObjectId

from .models import Payment
from apps.therapy_sessions.models import TherapySession

logger = logging.getLogger(__name__)

# Initialize Stripe with your secret key
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', os.environ.get('STRIPE_API_KEY'))

class PaymentService:
    """Service for handling Stripe payment processing"""
    
    @staticmethod
    def create_checkout_session(session_data):
        """
        Create a Stripe checkout session for therapy payment
        
        Args:
            session_data (dict): Contains therapy_session_id, therapist_name, 
                                session_type, amount, etc.
        
        Returns:
            dict: Stripe checkout session details
        """
        try:
            # Convert price to cents for Stripe
            amount_in_cents = int(float(session_data.get('amount', 0)) * 100)
            
            # Frontend URL for redirects
            frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
            
            # Create checkout session with Stripe
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': session_data.get('currency', 'usd'),
                        'product_data': {
                            'name': f"Therapy Session with {session_data.get('therapist_name', 'Therapist')}",
                            'description': f"{session_data.get('session_type', 'Video')} therapy session",
                        },
                        'unit_amount': amount_in_cents,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f"{frontend_url}/sessions/{session_data.get('therapy_session_id')}/success",
                cancel_url=f"{frontend_url}/sessions/{session_data.get('therapy_session_id')}/cancel",
                metadata={
                    'therapy_session_id': session_data.get('therapy_session_id'),
                    'user_id': session_data.get('user_id'),
                    'therapist_id': session_data.get('therapist_id'),
                    'amount': session_data.get('amount')
                }
            )
            
            # Create a pending payment record in our database
            payment = Payment(
                user_id=ObjectId(session_data.get('user_id')),
                session_id=ObjectId(session_data.get('therapy_session_id')),
                therapist_id=ObjectId(session_data.get('therapist_id')),
                amount=float(session_data.get('amount')),
                currency=session_data.get('currency', 'usd'),
                payment_status='pending',
                metadata={
                    'checkout_session_id': checkout_session.id,
                    'session_type': session_data.get('session_type')
                }
            )
            
            payment_id = payment.save()
            
            return {
                'id': checkout_session.id,
                'url': checkout_session.url,
                'status': 'created',
                'payment_id': str(payment_id)
            }
            
        except Exception as e:
            logger.error(f"Error creating checkout session: {str(e)}")
            raise
        
    @staticmethod
    def process_successful_payment(payment_intent_id, checkout_session_id, therapy_session_id, user_id, therapist_id, amount):
        """Process a successful payment from Stripe webhook"""
        try:
            # Create payment record - Remove metadata parameter
            payment = Payment(
                user_id=user_id,
                therapist_id=therapist_id,
                session_id=therapy_session_id,
                amount=float(amount),
                payment_intent_id=payment_intent_id,
                checkout_session_id=checkout_session_id,
                payment_status="completed"
                # Remove metadata parameter here
            )
            
            # Save the payment
            payment_id = payment.save()
            logger.info(f"Payment record created: {payment_id}")
            
            return str(payment_id)
        except Exception as e:
            logger.error(f"Error processing payment: {str(e)}")
            raise
    
    @staticmethod
    def get_payment_history(user_id, limit=10, skip=0, as_therapist=False):
        """
        Get payment history for a user
        
        Args:
            user_id (str): User ID
            limit (int): Number of records to return
            skip (int): Number of records to skip
            as_therapist (bool): If True, get payments where user is therapist
            
        Returns:
            list: List of payment records with session details
        """
        try:
            from bson import ObjectId
            
            # No need to convert user_id to ObjectId here - the find_by_* methods
            # will handle both string and ObjectId formats
            
            # Fetch payments from our database
            payments = list(Payment.find_by_user(user_id, limit, skip) if not as_therapist else 
                       Payment.find_by_therapist(user_id, limit, skip))
            
            # Enhance payment records with session details
            enhanced_payments = []
            for payment in payments:
                try:
                    # Get session details - Convert session_id to ObjectId if it's a string
                    session_id = payment["session_id"]
                    if isinstance(session_id, str):
                        session_id = ObjectId(session_id)
                    
                    session = TherapySession.find_by_id(session_id)
                    if session:
                        # Include formatted date and time
                        formatted_date = session["start_time"].strftime("%Y-%m-%d")
                        formatted_time = session["start_time"].strftime("%H:%M") + " - " + session["end_time"].strftime("%H:%M")
                        
                        # Include session duration
                        duration_seconds = (session["end_time"] - session["start_time"]).total_seconds()
                        duration_minutes = int(duration_seconds / 60)
                        
                        # Get participant names
                        client = session.get("client_name", "Client")
                        therapist = session.get("therapist_name", "Therapist")
                        
                        enhanced_payment = {
                            "payment_id": str(payment["_id"]),
                            "session_id": str(payment["session_id"]),
                            "amount": payment["amount"],
                            "currency": payment.get("currency", "USD"),
                            "status": payment["payment_status"],
                            "date": payment["created_at"].strftime("%Y-%m-%d"),
                            "time": payment["created_at"].strftime("%H:%M:%S"),
                            "session_date": formatted_date,
                            "session_time": formatted_time,
                            "session_duration": duration_minutes,
                            "session_type": session.get("session_type", ""),
                            "client": client,
                            "therapist": therapist,
                            "refunded": payment.get("refunded", False),
                            "refund_amount": payment.get("refund_amount", 0),
                            "invoice_id": payment.get("invoice_id")
                        }
                        enhanced_payments.append(enhanced_payment)
                except Exception as session_error:
                    logger.error(f"Error fetching session details: {str(session_error)}")
                    # Include basic payment info even if session details fail
                    enhanced_payments.append({
                        "payment_id": str(payment["_id"]),
                        "amount": payment["amount"],
                        "currency": payment.get("currency", "USD"),
                        "status": payment["payment_status"],
                        "date": payment["created_at"].strftime("%Y-%m-%d"),
                        "time": payment["created_at"].strftime("%H:%M:%S")
                    })
            
            return enhanced_payments
            
        except Exception as e:
            logger.error(f"Error fetching payment history: {str(e)}")
            raise
    
    @staticmethod
    def issue_refund(payment_id, amount=None, reason=None):
        """
        Issue a refund for a payment
        
        Args:
            payment_id (str): Payment ID
            amount (float): Amount to refund (optional, defaults to full amount)
            reason (str): Reason for refund
            
        Returns:
            dict: Refund details
        """
        try:
            # Get payment details
            payment = Payment.find_by_id(payment_id)
            if not payment:
                raise ValueError("Payment not found")
                
            if payment.get("refunded"):
                raise ValueError("Payment has already been refunded")
                
            payment_intent_id = payment.get("payment_intent_id")
            if not payment_intent_id:
                raise ValueError("No payment intent ID found")
                
            # Determine refund amount
            refund_amount = amount if amount is not None else payment.get("amount")
            refund_amount_cents = int(float(refund_amount) * 100)
            
            # Create refund in Stripe
            refund = stripe.Refund.create(
                payment_intent=payment_intent_id,
                amount=refund_amount_cents,
                reason="requested_by_customer"
            )
            
            # Record refund in our database
            Payment.record_refund(payment_id, refund_amount, reason)
            
            return {
                "success": True,
                "refund_id": refund.id,
                "amount": refund_amount,
                "status": refund.status
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error issuing refund: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error issuing refund: {str(e)}")
            raise