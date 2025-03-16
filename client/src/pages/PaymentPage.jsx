import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PaymentService from '../services/PaymentServices';
import SessionService from '../services/SessionServices';
import TherapistService from '../services/TherapistServices';
import { useAuth } from '../contexts/AuthContext';
import { loadStripe } from '@stripe/stripe-js';

const PaymentPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  useEffect(() => {
    const fetchSessionDetails = async () => {
      try {
        setLoading(true);
        const response = await SessionService.getSessionById(sessionId);
        console.log("Session details:", response.data);
        setSessionDetails(response.data.session);
        
        // If session price is not available, fetch therapist details to get hourly rate
        if (!response.data.session.price) {
          const therapistId = response.data.session.therapist_id;
          const therapistResponse = await TherapistService.getTherapistProfile(therapistId);
          
          // Update session details with therapist hourly rate
          setSessionDetails({
            ...response.data.session,
            hourly_rate: therapistResponse.data.therapist.hourly_rate
          });
        }
      } catch (err) {
        console.error("Error fetching session details:", err);
        setError("Failed to load session details");
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessionDetails();
  }, [sessionId]);
  
  const handlePayment = async () => {
    try {
      setProcessingPayment(true);
      const response = await PaymentService.createPayment(sessionId);
      
      // Check if response has expected format
      if (response.data.success && response.data.payment_session) {
        // Check if we're running in dev/test vs production environment
        if (process.env.NODE_ENV === 'development' && response.data.payment_session.url) {
          // Direct redirect in dev since stripe.redirectToCheckout may have issues
          window.location.href = response.data.payment_session.url;
        } else {
          // Initialize Stripe for production
          const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);
          
          if (!stripe) {
            throw new Error("Failed to initialize Stripe");
          }
          
          // Redirect to Stripe Checkout
          await stripe.redirectToCheckout({
            sessionId: response.data.payment_session.id
          });
        }
      } else {
        throw new Error("Invalid payment session response format");
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError("Failed to process payment. Please try again.");
      setProcessingPayment(false);
    }
  };
  
  if (loading) {
    return <div className="text-center py-12">Loading session details...</div>;
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">{error}</div>
        <button 
          onClick={() => navigate('/sessions')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md"
        >
          View My Sessions
        </button>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Complete Your Booking</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Session Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-gray-600">Therapist</p>
            <p className="font-medium">{sessionDetails.therapist_name}</p>
          </div>
          
          <div>
            <p className="text-gray-600">Session Type</p>
            <p className="font-medium">
              {sessionDetails.session_type === "video" ? "Video Therapy" : "Messaging Only"}
            </p>
          </div>
          
          <div>
            <p className="text-gray-600">Date & Time</p>
            <p className="font-medium">
              {new Date(sessionDetails.start_time).toLocaleDateString()} at {" "}
              {new Date(sessionDetails.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
          </div>
          
          <div>
            <p className="text-gray-600">Duration</p>
            <p className="font-medium">{sessionDetails.duration_hours} hours</p>
          </div>
        </div>
        
        <div className="border-t mt-6 pt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Session Fee</span>
            <span>
              ${sessionDetails.price || 
                (sessionDetails.hourly_rate * 
                  (sessionDetails.duration_hours || 
                    ((new Date(sessionDetails.end_time) - new Date(sessionDetails.start_time)) / 3600000)))}
            </span>
          </div>
          
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span>${sessionDetails.price || (sessionDetails.hourly_rate * sessionDetails.duration_hours)}</span>
          </div>
        </div>
      </div>
      
      <div className="text-center">
        <button
          onClick={handlePayment}
          disabled={processingPayment}
          className={`w-full md:w-auto px-8 py-3 rounded-md text-white font-medium ${
            processingPayment ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {processingPayment ? 'Processing...' : 'Proceed to Payment'}
        </button>
      </div>
    </div>
  );
};

export default PaymentPage;