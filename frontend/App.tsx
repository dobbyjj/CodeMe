
import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import ChatPage from './pages/ChatPage';
import AgentPage from './pages/AgentPage';
import ShareChatPage from './pages/ShareChatPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import PricingPage from './pages/PricingPage';
import SettingsPage from './pages/SettingsPage';
import PublicChatPage from './pages/PublicChatPage';
import LoginModal from './components/LoginModal';
import ContactModal from './components/ContactModal';
import { PageRoute } from './types';
import { AuthProvider } from './context/AuthContext';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const App: React.FC = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isContactOpen, setIsContactOpen] = useState(false);

  const handleOpenLogin = () => {
    setAuthMode('login');
    setIsLoginOpen(true);
  };

  const handleOpenSignup = () => {
    setAuthMode('signup');
    setIsLoginOpen(true);
  };

  return (
    <AuthProvider>
      <HashRouter>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col font-sans text-gray-900">
            <Navbar onLoginClick={handleOpenLogin} />
            <main className="flex-grow">
              <Routes>
                <Route 
                  path={PageRoute.HOME} 
                  element={<LandingPage onOpenLogin={handleOpenLogin} onOpenSignup={handleOpenSignup} />} 
                />
                <Route path={PageRoute.AGENT} element={<AgentPage />} />
                <Route path={PageRoute.SHARE_CHAT} element={<ShareChatPage />} />
                <Route path={PageRoute.DASHBOARD} element={<DashboardPage />} />
                <Route path={PageRoute.UPLOAD} element={<UploadPage />} />
                <Route path={PageRoute.SETTINGS} element={<SettingsPage />} />
                <Route path="/c/:linkId" element={<PublicChatPage />} />
                <Route 
                  path={PageRoute.PRICING} 
                  element={
                    <PricingPage 
                      onOpenLogin={handleOpenLogin} 
                      onOpenSignup={handleOpenSignup}
                      onOpenContact={() => setIsContactOpen(true)} 
                    />
                  } 
                />
              </Routes>
            </main>
            <Footer />
            <LoginModal 
              isOpen={isLoginOpen} 
              onClose={() => setIsLoginOpen(false)} 
              initialMode={authMode}
            />
            <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
        </div>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
