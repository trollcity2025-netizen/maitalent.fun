import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CoinStorePage from './pages/CoinStorePage';
import GameLobbyPage from './pages/GameLobbyPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import EarnPage from './pages/EarnPage';
import TermsPage from './pages/TermsPage';
import ResponsiblePlayPage from './pages/ResponsiblePlayPage';
import NotFoundPage from './pages/NotFoundPage';
import ProfilePage from './pages/ProfilePage';
import PublicProfilePage from './pages/PublicProfilePage';
import ChatPage from './pages/ChatPage';
import AdminDashboard from './pages/AdminDashboard';
import MaiPayPage from './pages/mai-pay/MaiPayPage';

// Game Pages
import MaiCoinFlip from './games/MaiCoinFlip';
import MaiTreasureHunt from './games/MaiTreasureHunt';
import MaiLuckySpin from './games/MaiLuckySpin';
import MaiCardPick from './games/MaiCardPick';
import MaiLadderClimb from './games/MaiLadderClimb';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Store
import { useAuthStore } from './store/authStore';

function App() {
  useEffect(() => {
    useAuthStore.getState().loadUser();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/coin-store" element={<CoinStorePage />} />
          <Route path="/games" element={<GameLobbyPage />} />
          <Route path="/earn" element={<EarnPage />} />
          <Route path="/transactions" element={<ProtectedRoute><TransactionHistoryPage /></ProtectedRoute>} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/rules" element={<TermsPage />} />
          <Route path="/responsible-play" element={<ResponsiblePlayPage />} />
          <Route path="/no-purchase-necessary" element={<Navigate to="/terms#no-purchase-necessary" replace />} />
          <Route path="/user/:userId" element={<PublicProfilePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/mai-pay" element={<ProtectedRoute><MaiPayPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/games/mai-coin-flip" element={<ProtectedRoute><MaiCoinFlip /></ProtectedRoute>} />
          <Route path="/games/mai-treasure-hunt" element={<ProtectedRoute><MaiTreasureHunt /></ProtectedRoute>} />
          <Route path="/games/mai-lucky-spin" element={<ProtectedRoute><MaiLuckySpin /></ProtectedRoute>} />
          <Route path="/games/mai-card-pick" element={<ProtectedRoute><MaiCardPick /></ProtectedRoute>} />
          <Route path="/games/mai-ladder-climb" element={<ProtectedRoute><MaiLadderClimb /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
