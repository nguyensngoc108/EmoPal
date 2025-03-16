import React from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { XCircleIcon } from '@heroicons/react/24/outline';

const PaymentCanceled = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="max-w-md mx-auto mt-16 text-center p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-center">
        <XCircleIcon className="h-16 w-16 text-red-500" />
      </div>
      
      <h1 className="text-2xl font-bold mt-4 text-gray-800">Payment Canceled</h1>
      
      <p className="mt-4 text-gray-600">
        Your payment was canceled and no charges were made.
      </p>
      
      <div className="mt-8 space-y-4">
        {sessionId && (
          <Link 
            to={`/payment/${sessionId}`}
            className="block w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Try Payment Again
          </Link>
        )}
        
        <Link 
          to="/therapist-finder" 
          className="block w-full py-2 px-4 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50"
        >
          Find Another Therapist
        </Link>
        
        <button
          onClick={() => navigate(-1)}
          className="block w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          Go Back
        </button>
      </div>
    </div>
  );
};

export default PaymentCanceled;