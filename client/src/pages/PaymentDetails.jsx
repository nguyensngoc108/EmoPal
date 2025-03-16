import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PaymentService from '../services/PaymentServices';
import { 
  DocumentArrowDownIcon, 
  ArrowPathIcon, 
  ExclamationCircleIcon,
  ArrowLeftIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserIcon,
  VideoCameraIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

const PaymentDetails = () => {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  
  useEffect(() => {
    const fetchPaymentDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await PaymentService.getPaymentDetails(paymentId);
        
        if (response.data.success) {
          setPayment(response.data.payment);
        } else {
          throw new Error(response.data.message || 'Failed to fetch payment details');
        }
      } catch (err) {
        console.error('Error fetching payment details:', err);
        setError('Failed to load payment details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPaymentDetails();
  }, [paymentId]);
  
  const handleRefundRequest = async () => {
    try {
      setIsRefunding(true);
      const response = await PaymentService.requestRefund(paymentId, refundReason);
      if (response.data.success) {
        setPayment({ ...payment, refunded: true, refund_amount: response.data.refund_amount });
        setShowRefundModal(false);
      } else {
        throw new Error(response.data.message || 'Failed to request refund');
      }
    } catch (err) {
      console.error('Error requesting refund:', err);
      // Show error notification
    } finally {
      setIsRefunding(false);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      const success = await PaymentService.downloadInvoice(paymentId);
      if (!success) {
        throw new Error('Failed to download invoice');
      }
    } catch (err) {
      console.error('Error downloading invoice:', err);
      // Show error notification
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <ArrowPathIcon className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="ml-2 text-gray-600">Loading payment details...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
          <Link 
            to="/payments/history"
            className="mt-3 text-sm font-medium text-red-700 hover:text-red-600 flex items-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Payment History
          </Link>
        </div>
      </div>
    );
  }
  
  if (!payment) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <h3 className="mt-2 text-base font-medium text-gray-900">Payment not found</h3>
          <Link 
            to="/payments/history"
            className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center justify-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Payment History
          </Link>
        </div>
      </div>
    );
  }
  
  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center">
        <Link 
          to="/payments/history"
          className="text-indigo-600 hover:text-indigo-800 flex items-center mr-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to History
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">
            Payment #{paymentId.substring(0, 8)}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={handleDownloadInvoice}
              className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-1" />
              Download Invoice
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Amount</p>
                    <p className="text-base font-medium text-gray-900">
                      ${parseFloat(payment.amount).toFixed(2)} {payment.currency?.toUpperCase() || 'USD'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="h-5 w-5 text-gray-400 mr-2 flex items-center justify-center">
                    <span className="block h-3 w-3 rounded-full bg-green-500"></span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <p className="text-base font-medium text-gray-900">
                      {payment.status || 'N/A'}
                      {payment.refunded && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                          Refunded: ${parseFloat(payment.refund_amount || 0).toFixed(2)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Date & Time</p>
                    <p className="text-base text-gray-900">{formatDate(payment.date + ' ' + payment.time)}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="h-5 w-5 text-gray-400 mr-2 flex items-center justify-center">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 10H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Payment Method</p>
                    <p className="text-base text-gray-900">{payment.payment_method || 'Card'}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Session Details</h3>
              
              {payment.session ? (
                <div className="space-y-4">
                  <div className="flex items-start">
                    <VideoCameraIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Session Type</p>
                      <p className="text-base text-gray-900">{payment.session.session_type || 'Therapy Session'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Session Date & Time</p>
                      <p className="text-base text-gray-900">{formatDate(payment.session.start_time)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Duration</p>
                      <p className="text-base text-gray-900">
                        {payment.session.duration_minutes 
                          ? `${Math.floor(payment.session.duration_minutes / 60)} hour${payment.session.duration_minutes >= 120 ? 's' : ''} ${payment.session.duration_minutes % 60 > 0 ? `${payment.session.duration_minutes % 60} minutes` : ''}`
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="h-5 w-5 text-gray-400 mr-2 flex items-center justify-center">
                      <span 
                        className={`block h-3 w-3 rounded-full ${
                          payment.session.status === 'completed' ? 'bg-green-500' : 
                          payment.session.status === 'scheduled' ? 'bg-blue-500' : 
                          payment.session.status === 'cancelled' ? 'bg-red-500' : 
                          'bg-yellow-500'
                        }`}>
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Session Status</p>
                      <p className="text-base text-gray-900">{payment.session.status || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Link 
                      to={`/sessions/${payment.session_id}`}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      View Session
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">No session information available</div>
              )}
            </div>
          </div>
          
          {/* Continue from the existing code... */}
{payment.refunded && (
  <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-100">
    <h3 className="text-lg font-medium text-purple-900 mb-2">Refund Information</h3>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-sm text-purple-700">Refund Amount:</span>
        <span className="text-sm font-medium text-purple-900">
          ${parseFloat(payment.refund_amount || 0).toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-purple-700">Refund Date:</span>
        <span className="text-sm font-medium text-purple-900">
          {payment.deleted_at ? formatDate(payment.deleted_at) : 'N/A'}
        </span>
      </div>
      <div className="mt-2">
        <span className="text-sm text-purple-700">Reason:</span>
        <p className="text-sm font-medium text-purple-900 mt-1">{payment.refund_reason || 'No reason provided'}</p>
      </div>
    </div>
  </div>
)}

{/* Transaction Details */}
<div className="mt-6">
  <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Details</h3>
  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">Payment ID:</span>
      <span className="text-sm font-medium text-gray-900">{payment._id}</span>
    </div>
    {payment.payment_intent_id && (
      <div className="flex justify-between">
        <span className="text-sm text-gray-500">Payment Intent:</span>
        <span className="text-sm font-medium text-gray-900">{payment.payment_intent_id}</span>
      </div>
    )}
    {payment.checkout_session_id && (
      <div className="flex justify-between">
        <span className="text-sm text-gray-500">Checkout Session:</span>
        <span className="text-sm font-medium text-gray-900">{payment.checkout_session_id}</span>
      </div>
    )}
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">Created At:</span>
      <span className="text-sm font-medium text-gray-900">{formatDate(payment.created_at)}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">Updated At:</span>
      <span className="text-sm font-medium text-gray-900">{formatDate(payment.updated_at)}</span>
    </div>
  </div>
</div>

{/* Actions */}
<div className="mt-8 flex justify-end space-x-4">
  <button
    onClick={handleDownloadInvoice}
    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
  >
    <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
    Download Invoice
  </button>
  
  {payment.payment_status === 'completed' && !payment.refunded && (
    <button
      onClick={() => setShowRefundModal(true)}
      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
    >
      Request Refund
    </button>
  )}
</div>

{/* Refund Modal */}
{showRefundModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Request Refund</h3>
      <p className="text-sm text-gray-500 mb-4">
        Are you sure you want to request a refund for this payment? This action cannot be undone.
      </p>
      
      <div className="mb-4">
        <label htmlFor="refundReason" className="block text-sm font-medium text-gray-700 mb-1">
          Reason for Refund
        </label>
        <textarea
          id="refundReason"
          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          rows="3"
          value={refundReason}
          onChange={(e) => setRefundReason(e.target.value)}
          placeholder="Please provide a reason for the refund request..."
        ></textarea>
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => setShowRefundModal(false)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleRefundRequest}
          disabled={isRefunding}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
        >
          {isRefunding ? 'Processing...' : 'Confirm Refund'}
        </button>
      </div>
    </div>
  </div>
)}
          </div>
        </div>
      </div>
  );
};

export default PaymentDetails;