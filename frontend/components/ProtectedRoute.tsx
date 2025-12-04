import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import { Icons } from './Icons';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    if (!apiClient.token) {
      setShowLoginPrompt(true);
    }
  }, []);

  if (showLoginPrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-[#1a0b2e] to-gray-900 flex items-center justify-center p-4">
        <div className="bg-[#1a0b2e] border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center">
              <Icons.Lock className="text-purple-400" size={32} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl text-white">로그인이 필요합니다</h2>
              <p className="text-gray-400 text-sm">
                이 페이지에 접근하려면 먼저 로그인해주세요.
              </p>
            </div>

            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  // App.tsx에서 수신하는 전역 이벤트로 로그인 모달을 연다
                  window.dispatchEvent(new Event('codeme-open-login'));
                }}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                로그인 페이지로 이동
              </button>
              
              <p className="text-xs text-gray-500">
                계정이 없으신가요? 홈페이지에서 회원가입할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
