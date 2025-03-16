import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import NavBar from "./components/layout/NavBar.jsx"; // Updated extension
import Footer from "./components/layout/Footer.jsx"; // Updated extension
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import Dashboard from "./pages/Dashboard";
import UserProfile from "./pages/UserProfile";
import MediaAnalysis from "./pages/MediaAnalysis"; // New component
import MediaDetail from "./pages/MediaDetail"; // New component
import TherapistFinder from "./pages/TherapistFinder";  // Add import
import TherapistProfile from "./pages/TherapistProfile";
import MessageCenter from "./pages/MessageCenter"; // Add this import
import PaymentPage from "./pages/PaymentPage"; // Add this import
import PaymentSuccess from "./pages/PaymentSuccess"; // Add this import
import PaymentCanceled from "./pages/PaymentCanceled"; // Add this import
import PaymentDetails from "./pages/PaymentDetails.jsx";
import PaymentHistory from "./pages/PaymentHistory.jsx";

// Commented imports will be uncommented as you implement these components
// import TherapistList from './pages/TherapistList';
// import TherapistProfile from './pages/TherapistProfile';
// import UserProfile from './pages/UserProfile';
// import SessionsList from './pages/SessionsList';
import VideoSession from './pages/VideoSession';
import "./App.css";

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return children;
};

// Role-based route protection
const RoleRoute = ({ children, allowedRoles }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser?.user?.role)) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

function AppContent() {
  return (
    <Router>
      <div className="app-container">
        <NavBar />
        <main className="main-content">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/media-analysis"
              element={
                <ProtectedRoute>
                  <MediaAnalysis />
                </ProtectedRoute>
              }
            />    
            <Route
              path="/media-analysis/:analysisId"
              element={
                <ProtectedRoute>
                  <MediaDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/therapist-finder"
              element={
                <ProtectedRoute>
                  <TherapistFinder />
                </ProtectedRoute>
              }
            />

            <Route
              path="/therapist-finder/:id"
              element={
                <ProtectedRoute>
                  <TherapistProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/therapists/:id"
              element={
                <ProtectedRoute>
                  <TherapistProfile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessageCenter />
                </ProtectedRoute>
              }
            />

            <Route
              path="/messages/:conversationId"
              element={
                <ProtectedRoute>
                  <MessageCenter />
                </ProtectedRoute>
              }
            />

            <Route
              path="/payment/:sessionId"
              element={
                <ProtectedRoute>
                  <PaymentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment/success"
              element={
                <ProtectedRoute>
                  <PaymentSuccess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment/canceled"
              element={
                <ProtectedRoute>
                  <PaymentCanceled />
                </ProtectedRoute>
              }
            />

            <Route 
              path="/video-session/:sessionId" 
              element={
                <ProtectedRoute>
                  <VideoSession />
                </ProtectedRoute>
              }
            />

            <Route
              path="/payments/history"
              element={
                <ProtectedRoute>
                  <PaymentHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments/details/:paymentId"
              element={
                <ProtectedRoute>
                  <PaymentDetails />
                </ProtectedRoute>
              }
            />

            {/* You'll uncomment these routes as you implement the components */}
            {/* <Route path="/therapists" element={
              <ProtectedRoute>
                <TherapistList />
              </ProtectedRoute>
            } />
            
            <Route path="/therapists/:id" element={
              <ProtectedRoute>
                <TherapistProfile />
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            } />
            
            <Route path="/sessions" element={
              <ProtectedRoute>
                <SessionsList />
              </ProtectedRoute>
            } />
            
            <Route path="/sessions/:id" element={
              <ProtectedRoute>
                <VideoSession />
              </ProtectedRoute>
            } />
            */}
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
