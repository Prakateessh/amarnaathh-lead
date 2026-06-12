import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import ManualEntry from './pages/ManualEntry';
import Database from './pages/Database';
import IndiaMart from './pages/IndiaMart';
import TradeIndia from './pages/TradeIndia'; 
import DetailedAnalytics from './pages/DetailedAnalytics';
import LeadManager from './pages/LeadManager';
import Checklist from './pages/Checklist';

// 🛑 THE GATEKEEPER
// Checks if the browser has the login key. If not, kicks them to Login.
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isLoggedIn') === 'true';
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* UNPROTECTED ROUTE - The Front Door */}
        <Route path="/" element={<Login />} />

        {/* PROTECTED ROUTES - Secured by the Gatekeeper */}
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/manual" element={<ProtectedRoute><ManualEntry /></ProtectedRoute>} />
        <Route path="/database" element={<ProtectedRoute><Database /></ProtectedRoute>} />
        <Route path="/leadmanager" element={<ProtectedRoute><LeadManager /></ProtectedRoute>} />
        <Route path="/indiamart" element={<ProtectedRoute><IndiaMart /></ProtectedRoute>} />
        <Route path="/tradeindia" element={<ProtectedRoute><TradeIndia /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><DetailedAnalytics /></ProtectedRoute>} />
        <Route path="/checklist" element={<ProtectedRoute><Checklist /></ProtectedRoute>} />

        {/* Catch-all route: Send unknown URLs back to login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
