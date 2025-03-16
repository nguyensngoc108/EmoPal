import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PaymentService from '../services/PaymentServices';
import { useAuth } from '../contexts/AuthContext';
import { 
  DocumentArrowDownIcon, 
  EyeIcon,
  ChevronLeftIcon, 
  ChevronRightIcon,
  ArrowPathIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

const PaymentHistory = () => {
  const { currentUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ 
    total: 0, 
    limit: 10, 
    skip: 0,
    hasMore: false
  });
  const [view, setView] = useState('client'); // 'client' or 'therapist'
  const isTherapist = currentUser?.user?.role === 'therapist';
  
  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const asTherapist = view === 'therapist';
      const response = await PaymentService.getPaymentHistory({
        limit: pagination.limit,
        skip: pagination.skip,
        asTherapist
      });
      
      if (response.data.success) {
        setPayments(response.data.payment_history);
        setPagination({
          ...pagination,
          total: response.data.pagination.total,
          hasMore: response.data.pagination.has_more
        });
      } else {
        throw new Error(response.data.message || 'Failed to fetch payment history');
      }
    } catch (err) {
      console.error('Error fetching payment history:', err);
      setError('Failed to load payment history. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch payment history when component mounts or pagination changes
  useEffect(() => {
    if (currentUser) {
      fetchPaymentHistory();
    }
  }, [pagination.skip, pagination.limit, view, currentUser]);
  
  const handleDownloadInvoice = async (paymentId) => {
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
  
  const handleViewChange = (newView) => {
    if (newView !== view) {
      setView(newView);
      setPagination({ ...pagination, skip: 0 }); // Reset pagination
    }
  };
  
  const nextPage = () => {
    if (pagination.hasMore) {
      setPagination({ ...pagination, skip: pagination.skip + pagination.limit });
    }
  };
  
  const prevPage = () => {
    if (pagination.skip > 0) {
      setPagination({ 
        ...pagination, 
        skip: Math.max(0, pagination.skip - pagination.limit)
      });
    }
  };
  
  const formatDate = (dateString) => {
    // Handle null, undefined or invalid date strings
    if (!dateString) {
      return 'N/A';
    }
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };
  
  const renderStatusBadge = (status) => {
    let colorClass = 'bg-gray-100 text-gray-800'; // Default
    
    switch(status?.toLowerCase()) {
      case 'completed':
        colorClass = 'bg-green-100 text-green-800';
        break;
      case 'pending':
        colorClass = 'bg-yellow-100 text-yellow-800';
        break;
      case 'failed':
        colorClass = 'bg-red-100 text-red-800';
        break;
      case 'refunded':
        colorClass = 'bg-purple-100 text-purple-800';
        break;
      default:
        break;
    }
    
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}`}>
        {status || 'Unknown'}
      </span>
    );
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
        
        {isTherapist && (
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => handleViewChange('client')}
              className={`${
                view === 'client'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } py-2 px-4 text-sm font-medium rounded-l-md border border-gray-300`}
            >
              As Client
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('therapist')}
              className={`${
                view === 'therapist'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } py-2 px-4 text-sm font-medium rounded-r-md border border-gray-300 border-l-0`}
            >
              As Therapist
            </button>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <ArrowPathIcon className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="ml-2 text-gray-600">Loading payment history...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
          <button 
            onClick={fetchPaymentHistory}
            className="mt-3 text-sm font-medium text-red-700 hover:text-red-600"
          >
            Try Again
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <h3 className="mt-2 text-base font-medium text-gray-900">No payments found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {view === 'client' 
              ? "You haven't made any payments yet." 
              : "You haven't received any payments yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    {view === 'therapist' && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    )}
                    {view === 'client' && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Therapist</th>
                    )}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment, index) => (
                    <tr key={payment._id || `payment-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(payment.created_at)}</div>
                        <div className="text-xs text-gray-500">
                          {payment.created_at && !isNaN(new Date(payment.created_at).getTime()) 
                            ? new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </div>
                      </td>
                      {view === 'therapist' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{payment.client_name || 'Client'}</div>
                          <div className="text-xs text-gray-500">{payment.client_email || ''}</div>
                        </td>
                      )}
                      {view === 'client' && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{payment.therapist_name || 'Therapist'}</div>
                          <div className="text-xs text-gray-500">{payment.therapist_email || ''}</div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${parseFloat(payment.amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">{payment.currency?.toUpperCase() || 'USD'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderStatusBadge(payment.payment_status)}
                        {payment.refunded && (
                          <div className="text-xs text-purple-600 mt-1">
                            Refunded: ${parseFloat(payment.refund_amount || 0).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.session_id ? (
                          <Link 
                            to={`/sessions/${payment.session_id}`} 
                            className="text-sm text-indigo-600 hover:text-indigo-900"
                          >
                            View Session
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <Link
                            to={`/payments/details/${payment._id}`}
                            className="text-gray-600 hover:text-gray-900"
                            title="View details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </Link>
                          <button
                            onClick={() => handleDownloadInvoice(payment._id)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Download invoice"
                          >
                            <DocumentArrowDownIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{Math.min(pagination.total, pagination.skip + 1)}</span> to{" "}
              <span className="font-medium">
                {Math.min(pagination.total, pagination.skip + payments.length)}
              </span>{" "}
              of <span className="font-medium">{pagination.total}</span> payments
            </div>
            <div className="flex space-x-2">
              <button
                onClick={prevPage}
                disabled={pagination.skip === 0}
                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                  pagination.skip === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Previous
              </button>
              <button
                onClick={nextPage}
                disabled={!pagination.hasMore}
                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                  !pagination.hasMore
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Next
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PaymentHistory;