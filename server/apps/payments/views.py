import json
import os
import stripe
import logging
from django.http import HttpResponse, JsonResponse
from bson import ObjectId
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime
import uuid
import io
from django.http import FileResponse
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from database import db


from apps.utils.auth import get_user_from_request
from apps.therapy_sessions.models import TherapySession
from apps.users.models import User
from apps.therapists.models import Therapist
from .services import PaymentService
from .models import Payment

logger = logging.getLogger(__name__)

def convert_object_ids(obj):
    """Convert MongoDB ObjectId objects to strings for JSON serialization"""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {k: convert_object_ids(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_object_ids(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

@csrf_exempt
@require_http_methods(["POST"])
def create_payment(request, session_id):
    """Create a payment checkout session for a therapy session"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get therapy session
        session = TherapySession.find_by_id(session_id)
        if not session:
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
            
        # Verify this is the client
        if str(session.get("user_id")) != user_id:
            return JsonResponse({
                "success": False,
                "message": "Only the client can make payment"
            }, status=403)
            
        # Verify session is in ACCEPTED state
        # if session.get("status") != "accepted":
        #     return JsonResponse({
        #         "success": False,
        #         "message": "Session must be in ACCEPTED state for payment"
        #     }, status=400)
            
        # Get therapist info for display
        therapist_user = User.find_by_id(session.get("therapist_id"))
        therapist_name = therapist_user.get("username", "Therapist") if therapist_user else "Therapist"
        
        # IMPORTANT: Always calculate session_duration_hours for display purposes
        session_duration_hours = (session.get("end_time") - session.get("start_time")).total_seconds() / 3600
        
        # Use the price from the session directly if available
        session_price = session.get("price")
        if not session_price:
            # Only recalculate if price isn't available in the session
            therapist_profile = Therapist.find_by_user_id(session.get("therapist_id"))
            hourly_rate = therapist_profile.get("hourly_rate", 75) if therapist_profile else 75
            # session_duration_hours already calculated above
            session_price = hourly_rate * session_duration_hours
        
        # Log the price for debugging
        logger.info(f"Creating payment for session {session_id} with price {session_price} for {session_duration_hours} hours")
        
        # Get frontend URL from environment or use default
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

        # Create Stripe checkout session
        stripe.api_key = os.environ.get('STRIPE_API_KEY')

        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'Therapy Session with {therapist_name}',
                        'description': f'{session_duration_hours}-hour {session.get("session_type")} session',
                    },
                    'unit_amount': int(session_price * 100),  # Stripe uses cents
                },
                'quantity': 1,
            }],
            metadata={
                'therapy_session_id': session_id,
                'user_id': user_id,
                'therapist_id': str(session.get("therapist_id")),
                'amount': str(session_price),
                'session_type': session.get("session_type"),
            },
            mode='payment',
            success_url=f'{frontend_url}/payment/success?session_id={session_id}',
            cancel_url=f'{frontend_url}/payment/canceled?session_id={session_id}',
        )
        
        return JsonResponse({
            "success": True,
            "payment_session": {
                "id": checkout_session.id,
                "url": checkout_session.url,
            }
        })
        
    except Exception as e:
        logger.error(f"Payment creation error: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

def notify_session_confirmed(therapy_session_id, user_data, therapist_data):
    """Send notifications to both users when a session is confirmed after payment"""
    try:
        # Get session details
        session = TherapySession.find_by_id(therapy_session_id)
        if not session:
            logger.warning(f"Cannot send notification: Session {therapy_session_id} not found")
            return
            
        session_date = session.get("start_time").strftime("%A, %B %d at %I:%M %p")
        session_type = session.get("session_type", "therapy")
        
        # Prepare notification data for client
        client_notification = {
            "user_id": str(user_data.get("_id")),
            "title": "Session Confirmed",
            "message": f"Your {session_type} session with {therapist_data.get('name', 'your therapist')} is confirmed for {session_date}",
            "type": "session_confirmation",
            "reference_id": therapy_session_id,
            "created_at": datetime.utcnow()
        }
        
        # Prepare notification data for therapist
        therapist_notification = {
            "user_id": str(therapist_data.get("_id")),
            "title": "New Session Booked",
            "message": f"A {session_type} session with {user_data.get('name', 'a client')} is confirmed for {session_date}",
            "type": "session_confirmation",
            "reference_id": therapy_session_id,
            "created_at": datetime.utcnow()
        }
        
        # Save notifications to database
        db.notifications.insert_one(client_notification)
        db.notifications.insert_one(therapist_notification)
        
        logger.info(f"Session confirmation notifications sent for session {therapy_session_id}")
        
    except Exception as e:
        logger.error(f"Error sending session confirmation notifications: {str(e)}")

@csrf_exempt
def stripe_webhook(request):
    """Handle Stripe webhook events with enhanced logging"""
    logger.info(f"[WEBHOOK] Received request to {request.path}")
    logger.info(f"[WEBHOOK] Method: {request.method}")
    
    # Log request details in debug mode
    safe_headers = {k: v for k, v in request.headers.items() 
                  if not k.lower() in ('authorization', 'cookie')}
    logger.info(f"[WEBHOOK] Headers: {safe_headers}")
    
    payload = request.body
    
    # Log event type for all incoming webhooks
    try:
        event_json = json.loads(payload)
        event_type = event_json.get('type')
        logger.info(f"[WEBHOOK] Processing event type: {event_type}")
    except Exception as e:
        logger.error(f"[WEBHOOK] Error parsing payload: {str(e)}")
    
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    try:
        if not sig_header or not webhook_secret:
            logger.warning("Missing webhook signature or secret")
            return JsonResponse({'success': False, 'message': 'Missing webhook signature'}, status=400)
            
        # Verify signature
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        
        # Handle different webhook events
        if event['type'] == 'checkout.session.completed':
            # Payment was successful
            session = event['data']['object']
            metadata = session.get('metadata', {})
            
            # Get therapy session ID from metadata
            therapy_session_id = metadata.get('therapy_session_id')
            user_id = metadata.get('user_id')
            therapist_id = metadata.get('therapist_id')
            amount = metadata.get('amount')
            
            if therapy_session_id and user_id and therapist_id:
                # CHECK FOR EXISTING PAYMENT FIRST - ADD THIS CODE
                existing_payment = db.payments.find_one({
                    "$or": [
                        {"checkout_session_id": session.get('id')},
                        {"payment_intent_id": session.get('payment_intent')}
                    ]
                })

                if existing_payment:
                    logger.info(f"Payment for session {therapy_session_id} already processed - skipping (ID: {existing_payment.get('_id')})")
                    return JsonResponse({
                        'success': True,
                        'message': 'Payment already processed',
                        'payment_id': str(existing_payment.get('_id'))
                    })
                
                # Process the payment in our system
                payment_id = PaymentService.process_successful_payment(
                    payment_intent_id=session.get('payment_intent'),
                    checkout_session_id=session.get('id'),
                    therapy_session_id=therapy_session_id,
                    user_id=user_id,
                    therapist_id=therapist_id,
                    amount=amount
                )
                
                # Update session status to confirmed/paid
                update_result = TherapySession.confirm_payment(therapy_session_id)
                logger.info(f"Session status update result: {update_result}")

                # Add verification
                updated_session = db.therapy_sessions.find_one({"_id": ObjectId(therapy_session_id)})
                logger.info(f"Updated session status: {updated_session.get('status') if updated_session else 'Session not found'}")
                
                logger.info(f"Payment confirmed for session {therapy_session_id}")
                
                # Set up chat for the session
                conversation_id = TherapySession.setup_chat_for_session(
                    therapy_session_id,
                    user_id,
                    therapist_id
                )
                
                # Send notification to both users
                user_data = User.find_by_id(user_id)
                therapist_data = User.find_by_id(therapist_id)
                
                # Send email/push notification (implementation depends on your system)
                notify_session_confirmed(therapy_session_id, user_data, therapist_data)
                
                return JsonResponse({
                    'success': True,
                    'payment_id': payment_id,
                    'conversation_id': str(conversation_id),
                    'message': 'Payment processed and conversation created successfully'
                })
            else:
                logger.warning("Missing required metadata in webhook")
                return JsonResponse({
                    'success': False,
                    'message': 'Missing required metadata'
                }, status=400)
        
        # Handle other webhook events if needed
        return JsonResponse({'success': True, 'message': f'Event {event["type"]} received'})
        
    except ValueError as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=400)
    except stripe.error.SignatureVerificationError:
        return JsonResponse({'success': False, 'message': 'Invalid signature'}, status=400)
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)
    
# payment history
@csrf_exempt
@require_http_methods(["GET"])
def get_payment_history(request):
    """Get payment history for the authenticated user"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get query parameters
        limit = int(request.GET.get('limit', 10))
        skip = int(request.GET.get('skip', 0))
        as_therapist = request.GET.get('as_therapist', 'false').lower() == 'true'
        
        # Check if user is a therapist when requesting therapist payments
        if as_therapist and not current_user.get('is_therapist'):
            return JsonResponse({
                "success": False,
                "message": "Not authorized as therapist"
            }, status=403)
            
        # Fetch payment history from database
        payment_history = PaymentService.get_payment_history(user_id, limit, skip, as_therapist)
        
        # Include pagination information
        total_count = len(Payment.find_by_user(user_id)) if not as_therapist else len(Payment.find_by_therapist(user_id))
        
        return JsonResponse({
            "success": True,
            "payment_history": payment_history,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "skip": skip,
                "has_more": (skip + limit) < total_count
            }
        })
        
    except ValueError as e:
        logger.error(f"Value error: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=400)
    except Exception as e:
        logger.error(f"Error fetching payment history: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@csrf_exempt
@require_http_methods(["GET"])
def get_payment_details(request, payment_id):
    """Get detailed information about a specific payment"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get payment details
        payment = Payment.find_by_id(payment_id)
        if not payment:
            return JsonResponse({
                "success": False,
                "message": "Payment not found"
            }, status=404)
            
        # Verify this user owns the payment or is the therapist
        if str(payment.get("user_id")) != user_id and str(payment.get("therapist_id")) != user_id:
            return JsonResponse({
                "success": False,
                "message": "Not authorized to view this payment"
            }, status=403)
            
        # Get session details
        session = TherapySession.find_by_id(payment.get("session_id"))
        
        # Format response
        response = {
            "payment_id": str(payment.get("_id")),
            "session_id": str(payment.get("session_id")),
            "amount": payment.get("amount"),
            "currency": payment.get("currency", "USD"),
            "status": payment.get("payment_status"),
            "date": payment.get("created_at").strftime("%Y-%m-%d"),
            "time": payment.get("created_at").strftime("%H:%M:%S"),
            "payment_method": payment.get("payment_method", "card"),
            "refunded": payment.get("refunded", False),
            "refund_amount": payment.get("refund_amount", 0),
            "refund_reason": payment.get("refund_reason"),
            "metadata": payment.get("metadata", {}),
        }
        
        # Add session details if available
        if session:
            response["session"] = {
                "start_time": session.get("start_time").isoformat(),
                "end_time": session.get("end_time").isoformat(),
                "status": session.get("status"),
                "session_type": session.get("session_type"),
            }
            
            # Calculate duration
            duration_seconds = (session.get("end_time") - session.get("start_time")).total_seconds()
            response["session"]["duration_minutes"] = int(duration_seconds / 60)
            
        return JsonResponse({
            "success": True,
            "payment": response
        })
        
    except Exception as e:
        logger.error(f"Error fetching payment details: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@csrf_exempt
@require_http_methods(["POST"])
def refund_payment(request, payment_id):
    """Process refund for a payment"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get payment details
        payment = Payment.find_by_id(payment_id)
        if not payment:
            return JsonResponse({
                "success": False,
                "message": "Payment not found"
            }, status=404)
            
        # Only therapists can issue refunds
        if str(payment.get("therapist_id")) != user_id:
            return JsonResponse({
                "success": False,
                "message": "Only therapists can issue refunds"
            }, status=403)
            
        # Check if already refunded
        if payment.get("refunded"):
            return JsonResponse({
                "success": False,
                "message": "Payment has already been refunded"
            }, status=400)
            
        # Parse request body
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}
            
        amount = data.get('amount')  # Optional, will refund full amount if not specified
        reason = data.get('reason', 'requested_by_therapist')
        
        # Process refund
        refund_result = PaymentService.issue_refund(payment_id, amount, reason)
        
        # Update session status if needed
        if data.get('cancel_session'):
            TherapySession.update_status(payment.get("session_id"), "cancelled")
        
        return JsonResponse({
            "success": True,
            "refund": refund_result
        })
        
    except ValueError as e:
        logger.error(f"Value error in refund: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=400)
    except Exception as e:
        logger.error(f"Error processing refund: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        


@csrf_exempt
@require_http_methods(["GET"])
def get_invoice(request, payment_id):
    """Generate and return an invoice for a payment"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get payment details
        payment = Payment.find_by_id(payment_id)
        if not payment:
            return JsonResponse({
                "success": False,
                "message": "Payment not found"
            }, status=404)
            
        # Verify this user owns the payment or is the therapist
        if str(payment.get("user_id")) != user_id and str(payment.get("therapist_id")) != user_id:
            return JsonResponse({
                "success": False,
                "message": "Not authorized to view this invoice"
            }, status=403)
            
        # Get session details
        session = TherapySession.find_by_id(payment.get("session_id"))
        
        # Get user and therapist details
        client = User.find_by_id(payment.get("user_id"))
        therapist_user = User.find_by_id(payment.get("therapist_id"))
        therapist = Therapist.find_by_user_id(payment.get("therapist_id"))
        
        # Check if user wants JSON format
        if request.GET.get('format') == 'json':
            # Return invoice data as JSON
            invoice_data = {
                "invoice_id": payment.get("invoice_id") or f"INV-{str(payment.get('_id'))[-8:]}",
                "date": payment.get("created_at").strftime("%Y-%m-%d"),
                "payment_id": str(payment.get("_id")),
                "session_id": str(payment.get("session_id")),
                "client": {
                    "name": client.get("name", "Client"),
                    "email": client.get("email", ""),
                },
                "therapist": {
                    "name": therapist_user.get("name", therapist.get("display_name", "Therapist")),
                    "credentials": therapist.get("credentials", ""),
                    "email": therapist_user.get("email", ""),
                },
                "details": {
                    "session_type": session.get("session_type", "Therapy Session"),
                    "session_date": session.get("start_time").strftime("%Y-%m-%d") if session else None,
                    "session_time": f"{session.get('start_time').strftime('%H:%M')} - {session.get('end_time').strftime('%H:%M')}" if session else None,
                    "duration_minutes": int((session.get("end_time") - session.get("start_time")).total_seconds() / 60) if session else None,
                },
                "payment": {
                    "amount": payment.get("amount"),
                    "currency": payment.get("currency", "USD").upper(),
                    "status": payment.get("payment_status"),
                    "method": payment.get("payment_method", "card").replace("_", " ").title(),
                    "refunded": payment.get("refunded", False),
                    "refund_amount": payment.get("refund_amount", 0),
                }
            }
            
            return JsonResponse({
                "success": True,
                "invoice": invoice_data
            })
        else:
            # Generate PDF invoice
            buffer = io.BytesIO()
            p = canvas.Canvas(buffer, pagesize=letter)
            width, height = letter
            
            # Invoice header
            p.setFont("Helvetica-Bold", 24)
            p.drawString(1*inch, height - 1*inch, "INVOICE")
            
            # Company info
            p.setFont("Helvetica", 12)
            p.drawString(1*inch, height - 1.5*inch, "AI Face Present Therapy")
            p.drawString(1*inch, height - 1.7*inch, "123 Therapy Lane")
            p.drawString(1*inch, height - 1.9*inch, "Mental Health City, CA 94000")
            
            # Invoice details
            p.setFont("Helvetica-Bold", 12)
            p.drawString(5*inch, height - 1.5*inch, f"Invoice #: INV-{str(payment.get('_id'))[-8:]}")
            p.drawString(5*inch, height - 1.7*inch, f"Date: {payment.get('created_at').strftime('%Y-%m-%d')}")
            p.drawString(5*inch, height - 1.9*inch, f"Payment ID: {str(payment.get('_id'))[:8]}...")
            
            # Client info
            p.setFont("Helvetica-Bold", 14)
            p.drawString(1*inch, height - 2.5*inch, "Client Information")
            p.setFont("Helvetica", 12)
            p.drawString(1*inch, height - 2.8*inch, f"Name: {client.get('name', 'Client')}")
            p.drawString(1*inch, height - 3.0*inch, f"Email: {client.get('email', '')}")
            
            # Therapist info
            p.setFont("Helvetica-Bold", 14)
            p.drawString(1*inch, height - 3.6*inch, "Therapist Information")
            p.setFont("Helvetica", 12)
            p.drawString(1*inch, height - 3.9*inch, f"Name: {therapist_user.get('name', therapist.get('display_name', 'Therapist'))}")
            p.drawString(1*inch, height - 4.1*inch, f"Credentials: {therapist.get('credentials', '')}")
            
            # Session details
            p.setFont("Helvetica-Bold", 14)
            p.drawString(1*inch, height - 4.7*inch, "Session Details")
            p.setFont("Helvetica", 12)
            if session:
                p.drawString(1*inch, height - 5.0*inch, f"Type: {session.get('session_type', 'Therapy Session')}")
                p.drawString(1*inch, height - 5.2*inch, f"Date: {session.get('start_time').strftime('%Y-%m-%d')}")
                p.drawString(1*inch, height - 5.4*inch, f"Time: {session.get('start_time').strftime('%H:%M')} - {session.get('end_time').strftime('%H:%M')}")
                duration = int((session.get("end_time") - session.get("start_time")).total_seconds() / 60)
                p.drawString(1*inch, height - 5.6*inch, f"Duration: {duration} minutes")
            
            # Payment info
            p.setFont("Helvetica-Bold", 14)
            p.drawString(1*inch, height - 6.2*inch, "Payment Information")
            p.setFont("Helvetica", 12)
            p.drawString(1*inch, height - 6.5*inch, f"Amount: {payment.get('currency', 'USD').upper()} {payment.get('amount'):.2f}")
            p.drawString(1*inch, height - 6.7*inch, f"Status: {payment.get('payment_status', 'Unknown').title()}")
            p.drawString(1*inch, height - 6.9*inch, f"Method: {payment.get('payment_method', 'card').replace('_', ' ').title()}")
            
            # Refund info if applicable
            if payment.get("refunded"):
                p.setFont("Helvetica-Bold", 12)
                p.setFillColorRGB(0.8, 0.1, 0.1)  # Red color
                p.drawString(1*inch, height - 7.3*inch, "REFUNDED")
                p.setFillColorRGB(0, 0, 0)  # Back to black
                p.setFont("Helvetica", 12)
                p.drawString(1*inch, height - 7.5*inch, f"Refund Amount: {payment.get('currency', 'USD').upper()} {payment.get('refund_amount', 0):.2f}")
                p.drawString(1*inch, height - 7.7*inch, f"Reason: {payment.get('refund_reason', 'Not specified')}")
            
            # Footer
            p.setFont("Helvetica-Oblique", 10)
            p.drawString(width/2 - 2*inch, 0.75*inch, "Thank you for choosing AI Face Present Therapy")
            
            p.showPage()
            p.save()
            buffer.seek(0)
            
            # Return PDF file
            return FileResponse(
                buffer, 
                as_attachment=True, 
                filename=f"invoice_{payment.get('created_at').strftime('%Y%m%d')}_{payment_id[-6:]}.pdf"
            )
        
    except Exception as e:
        logger.error(f"Error generating invoice: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def check_payment_status(request, session_id):
    """Check if payment has been completed for a session"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
        
        # Get the session
        session = TherapySession.find_by_id(session_id)
        if not session:
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
            
        # Check if user has access to this session
        user_id = str(current_user.get("_id"))
        if user_id != str(session.get("user_id")) and user_id != str(session.get("therapist_id")):
            return JsonResponse({
                "success": False,
                "message": "Unauthorized access to session"
            }, status=403)
            
        # Check payment status
        status = "unpaid"
        if session.get("status") in ["scheduled", "in_progress", "completed"]:
            status = "paid"
        elif session.get("status") == "payment_required":
            # Check if there's a payment record
            payment = db.payments.find_one({
                "session_id": ObjectId(session_id),
                "status": "completed"
            })
            
            if payment:
                status = "paid"
                
                # Update session status if payment is found
                TherapySession.update_by_id(
                    session_id,
                    {"$set": {"status": "scheduled"}}
                )
        
        return JsonResponse({
            "success": True,
            "status": status,
            "session_id": session_id
        })
        
    except Exception as e:
        logger.error(f"Error checking payment status: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_payments_by_session_ids(request):
    """Get payments for multiple session IDs"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get session IDs from query parameter
        session_ids_param = request.GET.get("session_ids", "")
        if not session_ids_param:
            return JsonResponse({
                "success": False,
                "message": "No session IDs provided"
            }, status=400)
            
        # Split and clean session IDs
        session_ids = [s.strip() for s in session_ids_param.split(",") if s.strip()]
        
        # Convert to ObjectId for query
        object_ids = []
        for sid in session_ids:
            try:
                object_ids.append(ObjectId(sid))
            except Exception:
                # Skip invalid IDs
                continue
                
        if not object_ids:
            return JsonResponse({
                "success": False,
                "message": "No valid session IDs provided"
            }, status=400)
        
        # Get therapist_id if user is a therapist
        therapist_id = None
        is_therapist = current_user.get("role") == "therapist"
        if is_therapist:
            # First check if therapist_id is in user document
            if "therapist_id" in current_user:
                therapist_id = str(current_user.get("therapist_id"))
            else:
                # Look up in therapists collection
                from apps.therapists.models import Therapist
                therapist = Therapist.find_by_user_id(user_id)
                if therapist:
                    therapist_id = str(therapist.get("_id"))
        
        # Prepare query to get authorized payments
        query = {"session_id": {"$in": object_ids}}
        if is_therapist and therapist_id:
            query["therapist_id"] = therapist_id
        else:
            query["user_id"] = user_id
        
        # Get payments
        payments = Payment.find_by_query(query)
        
        # Convert to list and handle ObjectIds
        result = []
        for payment in payments:
            payment = convert_object_ids(payment)
            result.append(payment)
        
        return JsonResponse({
            "success": True,
            "payments": result
        })
        
    except Exception as e:
        logger.error(f"Error getting payments by session IDs: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

# Add this new view function

@require_http_methods(["GET"])
def get_payment_by_session_id(request, session_id):
    """Get payment details for a specific session"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Find payment for this session - try both string and ObjectId formats
        payment = None
        try:
            # First try with original format
            payment = db.payments.find_one({"session_id": session_id})
            
            # If not found, try with ObjectId conversion
            if not payment:
                payment = db.payments.find_one({"session_id": ObjectId(session_id)})
                
        except Exception as e:
            logger.error(f"Error finding payment by session ID: {str(e)}")
            
        if not payment:
            return JsonResponse({
                "success": False,
                "message": "Payment not found for this session"
            }, status=404)
            
        # Verify authorization - user must be the client or the therapist
        if str(payment.get("user_id")) != user_id and str(payment.get("therapist_id")) != user_id:
            return JsonResponse({
                "success": False,
                "message": "You are not authorized to view this payment"
            }, status=403)
            
        # Convert ObjectIds to strings for JSON response
        payment = {k: str(v) if isinstance(v, ObjectId) else v for k, v in payment.items()}
        
        return JsonResponse({
            "success": True,
            "payment": payment
        })
        
    except Exception as e:
        logger.error(f"Error getting payment by session ID: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)