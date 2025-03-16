import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  
  const sessionId = searchParams.get('session_id');
  
  useEffect(() => {
    // Redirect to sessions after countdown
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      navigate('/sessions');
    }
  }, [countdown, navigate]);
  
  return (
    <div className="max-w-md mx-auto mt-16 text-center p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-center">
        <CheckCircleIcon className="h-16 w-16 text-green-500" />
      </div>
      
      <h1 className="text-2xl font-bold mt-4 text-gray-800">Payment Successful!</h1>
      
      <p className="mt-4 text-gray-600">
        Your therapy session has been booked and confirmed. You can now message your therapist before the session.
      </p>
      
      <div className="mt-8 space-y-4">
        <Link 
          to={`/sessions/${sessionId}`}
          className="block w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          View Session Details
        </Link>
        
        <Link 
          to="/messages" 
          className="block w-full py-2 px-4 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50"
        >
          Go to Messages
        </Link>
      </div>
      
      <p className="mt-6 text-sm text-gray-500">
        Redirecting to your sessions in {countdown} seconds...
      </p>
    </div>
  );
};

export default PaymentSuccess;