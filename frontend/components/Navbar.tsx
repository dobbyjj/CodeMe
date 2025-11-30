
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from './Icons';
import { PageRoute } from '../types';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onLoginClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLoginClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ path, label }: { path: string, label: string }) => (
    <Link
      to={path}
      className={`text-sm font-medium transition-colors duration-200 ${
        isActive(path) 
          ? 'text-brand-primary bg-purple-100 px-3 py-1.5 rounded-md' 
          : 'text-gray-600 hover:text-brand-primary'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-brand-primary">{'<'}</span>
              <span className="text-xl font-bold text-slate-800">Code:Me_</span>
              <span className="text-xs text-brand-secondary font-medium mt-1">AI Agent Platform</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <NavItem path={PageRoute.AGENT} label="에이전트" />
            <NavItem path={PageRoute.SHARE_CHAT} label="공유 챗봇" />
            <NavItem path={PageRoute.DASHBOARD} label="대시보드" />
            <NavItem path={PageRoute.UPLOAD} label="업로드" />
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            <Link to={PageRoute.PRICING}>
              <button className="hidden md:block px-4 py-2 text-sm font-medium text-brand-primary border border-brand-primary rounded-lg hover:bg-purple-50 transition-colors">
                업그레이드
              </button>
            </Link>
            
            {user ? (
               <div className="flex items-center gap-4">
                  <div className="hidden md:flex flex-col items-end">
                      <span className="text-sm font-semibold text-gray-800">{user.name}</span>
                      <span className="text-xs text-gray-500">{user.email}</span>
                  </div>
                  <Link 
                    to={PageRoute.SETTINGS} 
                    className="p-2 text-gray-500 hover:text-brand-primary hover:bg-purple-50 rounded-lg transition-colors"
                    title="설정"
                  >
                    <Icons.Settings size={20} className="w-5 h-5" />
                  </Link>
                  <button 
                    onClick={logout}
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="로그아웃"
                  >
                    <Icons.LogOut size={20} className="w-5 h-5" /> 
                  </button>
               </div>
            ) : (
                <button 
                onClick={onLoginClick}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                로그인
                </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
