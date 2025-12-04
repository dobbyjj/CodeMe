import React, { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import LandingPage from "./pages/LandingPage";
import ChatPage from "./pages/ChatPage";
import AgentPage from "./pages/AgentPage";
import ShareChatPage from "./pages/ShareChatPage";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import PricingPage from "./pages/PricingPage";
import SettingsPage from "./pages/SettingsPage";
import PublicChatPage from "./pages/PublicChatPage";
import LoginModal from "./components/LoginModal";
import ContactModal from "./components/ContactModal";
import ProtectedRoute from "./components/ProtectedRoute";
import { PageRoute } from "./types";
import { AuthProvider } from "./context/AuthContext";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const App: React.FC = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">(
    "login",
  );
  const [isContactOpen, setIsContactOpen] = useState(false);

  const handleOpenLogin = () => {
    setAuthMode("login");
    setIsLoginOpen(true);
  };

  const handleOpenSignup = () => {
    setAuthMode("signup");
    setIsLoginOpen(true);
  };

  // ProtectedRoute에서 전역 이벤트로 로그인 모달 열기 요청을 받을 수 있게 함
  React.useEffect(() => {
    const openLogin = () => handleOpenLogin();
    window.addEventListener('codeme-open-login', openLogin);
    return () => window.removeEventListener('codeme-open-login', openLogin);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col font-sans text-gray-900">
          <Navbar onLoginClick={handleOpenLogin} />
          <main className="flex-grow">
            <Routes>
              <Route
                path={PageRoute.DASHBOARD}
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path={PageRoute.HOME}
                element={
                  <LandingPage
                    onOpenLogin={handleOpenLogin}
                    onOpenSignup={handleOpenSignup}
                  />
                }
              />
              <Route
                path={PageRoute.AGENT}
                element={
                  <ProtectedRoute>
                    <AgentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path={PageRoute.SHARE_CHAT}
                element={
                  <ProtectedRoute>
                    <ShareChatPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path={PageRoute.UPLOAD}
                element={
                  <ProtectedRoute>
                    <UploadPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path={PageRoute.SETTINGS}
                element={<SettingsPage />}
              />
              <Route
                path="/c/:linkId"
                element={<PublicChatPage />}
              />
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
          <ContactModal
            isOpen={isContactOpen}
            onClose={() => setIsContactOpen(false)}
          />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
