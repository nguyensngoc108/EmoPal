import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const PaymentModal = ({ sessionId, paymentUrl, onComplete, onCancel }) => {
  // Handle payment via external URL
  const handleProceedToPayment = () => {
    // Open Stripe payment URL in a new window
    const paymentWindow = window.open(paymentUrl, '_blank');
    
    // Set up a check for when payment is completed
    const checkPayment = async () => {
      try {
        // This would typically check with your backend if payment is complete
        const response = await fetch(`/api/payments/check-status/${sessionId}`);
        const data = await response.json();
        
        if (data.status === 'paid') {
          if (paymentWindow) {
            paymentWindow.close();
          }
          onComplete();
          return;
        }
        
        // Check again in 2 seconds
        setTimeout(checkPayment, 2000);
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    };
    
    // Start checking for payment completion
    setTimeout(checkPayment, 3000);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Complete Payment</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="py-4">
          <p className="mb-4">
            To start the video session, you'll need to complete the payment first.
          </p>
          
          <p className="text-sm text-gray-600 mb-6">
            You will be redirected to our secure payment provider. Once payment is complete,
            your video session will begin automatically.
          </p>
        </div>
        
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleProceedToPayment}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Proceed to Payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;