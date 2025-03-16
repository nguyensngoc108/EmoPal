import api from './api';

const PaymentService = {
  // Create payment checkout for a session
  createPayment: (sessionId) => {
    return api.post(`payments/checkout/${sessionId}/`);
  },
  
  // Get all payments for the current user
  getPaymentHistory: (options = {}) => {
    const { limit = 10, skip = 0, asTherapist = false } = options;
    return api.get(`/payments/history/`, {
      params: { 
        limit, 
        skip, 
        as_therapist: asTherapist 
      }
    });
  },
  
  // Get details for a specific payment
  getPaymentDetails: (paymentId) => {
    return api.get(`/payments/details/${paymentId}/`);
  },
  
  // Request a refund for a payment
  requestRefund: (paymentId, data = {}) => {
    return api.post(`/payments/refund/${paymentId}/`, data);
  },
  
  // Generate an invoice (PDF or JSON)
  getInvoice: (paymentId, format = 'pdf') => {
    return api.get(`/payments/invoice/${paymentId}/`, {
      params: { format },
      responseType: format === 'pdf' ? 'blob' : 'json'
    });
  },
  
  // Check payment status for a session
  checkPaymentStatus: (sessionId) => {
    return api.get(`/payments/status/${sessionId}/`);
  },
  
  // Download invoice as PDF
  downloadInvoice: async (paymentId) => {
    try {
      const response = await api.get(`/payments/invoice/${paymentId}/`, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${paymentId}.pdf`);
      
      // Append to html page
      document.body.appendChild(link);
      
      // Force download
      link.click();
      
      // Clean up
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error("Error downloading invoice:", error);
      return false;
    }
  }
};

export default PaymentService;