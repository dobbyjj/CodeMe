import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icons } from '../components/Icons';
import type { ChatLog } from '../services/chatService';
import { ChatMessage } from '../types';
import { HeyMeLogo } from '../components/HeyMeLogo';
import { CodeMeLogo } from '../components/CodeMeLogo';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/chatService';
import { apiClient } from '../services/api';
import { dbService } from '../services/dbService';
import { Cloud, CloudOff } from 'lucide-react';

type Message = ChatMessage;

// Separate component to prevent re-rendering issues
interface SatisfactionSurveyProps {
    onDismiss: () => void;
    onSubmit: () => void;
}

const SatisfactionSurvey: React.FC<SatisfactionSurveyProps> = ({ onDismiss, onSubmit }) => {
      const [rating, setRating] = useState<number | null>(null);
      const [submitted, setSubmitted] = useState(false);
      
      const handleSubmitSurvey = () => {
          if (!rating) return;
          setSubmitted(true);
          // Allow animation to play before notifying parent
          setTimeout(() => onSubmit(), 2000);
      };

      if (submitted) {
          return (
              <div className="mx-auto my-6 max-w-sm p-4 bg-green-50 border border-green-200 rounded-xl text-center animate-in zoom-in duration-300">
                  <div className="flex justify-center mb-2">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                          <Icons.Check size={20} />
                      </div>
                  </div>
                  <h4 className="font-bold text-green-800">소중한 의견 감사합니다!</h4>
                  <p className="text-xs text-green-600">더 나은 서비스로 보답하겠습니다.</p>
              </div>
          );
      }

      return (
          <div className="mx-auto my-6 max-w-sm bg-white border border-gray-200 shadow-lg rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
             <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 flex justify-between items-center text-white">
                 <div className="flex items-center gap-2">
                     <Icons.Zap size={16} />
                     <span className="font-bold text-sm">이번 대화는 어떠셨나요?</span>
                 </div>
                 <button onClick={onDismiss} className="text-white/70 hover:text-white">
                     <Icons.Close size={16} />
                 </button>
             </div>
             <div className="p-5">
                 <p className="text-sm text-gray-600 text-center mb-4">별점을 선택하여 피드백을 남겨주세요</p>
                 <div className="flex justify-center gap-2 mb-6">
                     {[1, 2, 3, 4, 5].map((r) => (
                         <button 
                            key={r}
                            onClick={() => setRating(r)}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold transition-all ${
                                rating === r 
                                ? 'bg-purple-600 text-white shadow-lg scale-110' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                         >
                             {r}
                         </button>
                     ))}
                 </div>
                 
                 {rating && (rating < 4) && (
                     <div className="mb-4 animate-in fade-in duration-200">
                         <p className="text-xs text-gray-500 mb-2 font-semibold">어떤 점이 아쉬우셨나요?</p>
                         <div className="flex flex-wrap gap-2">
                             {['이해 못함', '답변 불만족', '느린 응답', '기타'].map((reason) => (
                                 <button key={reason} className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 hover:border-purple-300 hover:text-purple-600">
                                     {reason}
                                 </button>
                             ))}
                         </div>
                     </div>
                 )}

                 <button 
                    onClick={handleSubmitSurvey}
                    disabled={!rating}
                    className="w-full py-2.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                     제출하기
                 </button>
             </div>
          </div>
      );
};

const ChatPage: React.FC = () => {
  // --- State Management ---
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'model',
      text: '안녕하세요! 👋\n저는 Hey Me입니다. 당신의 개인 AI 에이전트입니다. 무엇을 도와드릴까요?',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      sessionId: Date.now().toString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Session State
  const [sessionId] = useState<string>('');

  // Search & Filter State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Survey State
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 초기 로드 추적
  const [cleanedDummy, setCleanedDummy] = useState(false); // 데모 메시지 제거 여부
  const { user } = useAuth();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Load from LocalStorage on Mount
  useEffect(() => {
    setIsConnected(false);
    const loadLogs = async () => {
      if (!user || !apiClient.token) {
        setMessages([
          {
            id: 'init',
            role: 'model',
            text: '안녕하세요! 👋\n저는 Hey Me입니다. 당신의 개인 AI 에이전트입니다. 무엇을 도와드릴까요?',
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date().toISOString(),
            sessionId: Date.now().toString(),
          },
        ]);
        setTimeout(() => setIsInitialLoad(false), 100); // 초기 로드 완료
        return;
      }
      try {
        const logs: ChatLog[] = await chatService.listLogs();
        if (logs.length === 0) {
          // 더미 데이터로 대화 기록 생성
          const dummyMessages: Message[] = [
            {
              id: 'dummy-1',
              role: 'model',
              text: '안녕하세요! 👋\n저는 Hey Me입니다. 당신의 개인 AI 에이전트입니다. 무엇을 도와드릴까요?',
              timestamp: '09:30',
              createdAt: new Date(Date.now() - 3600000).toISOString(),
              sessionId: 'demo-session',
            },
            {
              id: 'dummy-2',
              role: 'user',
              text: 'Code:Me 플랫폼에 대해 설명해줄 수 있어?',
              timestamp: '09:31',
              createdAt: new Date(Date.now() - 3500000).toISOString(),
              sessionId: 'demo-session',
            },
            {
              id: 'dummy-3',
              role: 'model',
              text: '물론이죠! Code:Me는 AI 기반 자동화 플랫폼으로, Hey Me라는 개인 AI 챗봇 서비스를 제공합니다.\n\n주요 기능:\n• 문서 업로드를 통한 AI 학습\n• 24시간 자동 응답 챗봇\n• RAG 기술을 활용한 정확한 답변\n• 공유 가능한 챗봇 링크 생성\n\n당신의 정보를 학습시키면 AI가 당신을 대신해 응답합니다!',
              timestamp: '09:31',
              createdAt: new Date(Date.now() - 3400000).toISOString(),
              sessionId: 'demo-session',
            },
            {
              id: 'dummy-4',
              role: 'user',
              text: '어떤 종류의 파일을 업로드할 수 있어?',
              timestamp: '09:33',
              createdAt: new Date(Date.now() - 3200000).toISOString(),
              sessionId: 'demo-session',
            },
            {
              id: 'dummy-5',
              role: 'model',
              text: '다양한 텍스트 기반 파일 형식을 지원합니다:\n\n📄 PDF - 보고서, 논문, 매뉴얼\n📝 TXT - 일반 텍스트 파일\n📋 MD - 마크다운 문서\n📊 DOCX - Word 문서\n\n업로드한 파일은 자동으로 인덱싱되어 AI가 내용을 학습하고, 질문에 대한 답변에 활용합니다. 파일은 업로드 페이지에서 관리할 수 있습니다!',
              timestamp: '09:33',
              createdAt: new Date(Date.now() - 3100000).toISOString(),
              sessionId: 'demo-session',
            },
            {
              id: 'dummy-6',
              role: 'user',
              text: 'RAG 기술이 뭐야?',
              timestamp: '09:35',
              createdAt: new Date(Date.now() - 2900000).toISOString(),
              sessionId: 'demo-session',
            },
            {
              id: 'dummy-7',
              role: 'model',
              text: 'RAG는 "Retrieval-Augmented Generation"의 약자로, 검색 증강 생성이라고 합니다.\n\n🔍 작동 원리:\n1. 사용자 질문 분석\n2. 업로드된 문서에서 관련 정보 검색\n3. 검색된 정보를 바탕으로 정확한 답변 생성\n\n✨ 장점:\n• 환각(Hallucination) 현상 감소\n• 실제 문서 기반 정확한 답변\n• 출처 추적 가능\n\nHey Me는 이 기술로 당신의 문서를 학습해서 정확하게 답변합니다!',
              timestamp: '09:35',
              createdAt: new Date(Date.now() - 2800000).toISOString(),
              sessionId: 'demo-session',
            },
          ];
          setMessages(dummyMessages);
          setTimeout(() => setIsInitialLoad(false), 100); // 초기 로드 완료
          return;
        }
        const restored: Message[] = [];
        logs.forEach(log => {
          const ts = log.created_at
            ? new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            : '';
          restored.push({
            id: `${log.id}-q`,
            role: 'user',
            text: log.question,
            timestamp: ts,
            createdAt: log.created_at || new Date().toISOString(),
            sessionId: '',
          });
          restored.push({
            id: `${log.id}-a`,
            role: 'model',
            text: log.answer,
            timestamp: ts,
            createdAt: log.created_at || new Date().toISOString(),
            sessionId: '',
          });
        });
        setMessages(restored);
        setTimeout(() => setIsInitialLoad(false), 100); // 초기 로드 완료
      } catch (e) {
        // API 오류 시에도 더미 데이터 표시
        const dummyMessages: Message[] = [
          {
            id: 'dummy-1',
            role: 'model',
            text: '안녕하세요! 👋\n저는 Hey Me입니다. 당신의 개인 AI 에이전트입니다. 무엇을 도와드릴까요?',
            timestamp: '09:30',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            sessionId: 'demo-session',
          },
          {
            id: 'dummy-2',
            role: 'user',
            text: 'Code:Me 플랫폼에 대해 설명해줄 수 있어?',
            timestamp: '09:31',
            createdAt: new Date(Date.now() - 3500000).toISOString(),
            sessionId: 'demo-session',
          },
          {
            id: 'dummy-3',
            role: 'model',
            text: '물론이죠! Code:Me는 AI 기반 자동화 플랫폼으로, Hey Me라는 개인 AI 챗봇 서비스를 제공합니다.\n\n주요 기능:\n• 문서 업로드를 통한 AI 학습\n• 24시간 자동 응답 챗봇\n• RAG 기술을 활용한 정확한 답변\n• 공유 가능한 챗봇 링크 생성\n\n당신의 정보를 학습시키면 AI가 당신을 대신해 응답합니다!',
            timestamp: '09:31',
            createdAt: new Date(Date.now() - 3400000).toISOString(),
            sessionId: 'demo-session',
          },
          {
            id: 'dummy-4',
            role: 'user',
            text: '어떤 종류의 파일을 업로드할 수 있어?',
            timestamp: '09:33',
            createdAt: new Date(Date.now() - 3200000).toISOString(),
            sessionId: 'demo-session',
          },
          {
            id: 'dummy-5',
            role: 'model',
            text: '다양한 텍스트 기반 파일 형식을 지원합니다:\n\n📄 PDF - 보고서, 논문, 매뉴얼\n📝 TXT - 일반 텍스트 파일\n📋 MD - 마크다운 문서\n📊 DOCX - Word 문서\n\n업로드한 파일은 자동으로 인덱싱되어 AI가 내용을 학습하고, 질문에 대한 답변에 활용합니다. 파일은 업로드 페이지에서 관리할 수 있습니다!',
            timestamp: '09:33',
            createdAt: new Date(Date.now() - 3100000).toISOString(),
            sessionId: 'demo-session',
          },
          {
            id: 'dummy-6',
            role: 'user',
            text: 'RAG 기술이 뭐야?',
            timestamp: '09:35',
            createdAt: new Date(Date.now() - 2900000).toISOString(),
            sessionId: 'demo-session',
          },
          {
            id: 'dummy-7',
            role: 'model',
            text: 'RAG는 "Retrieval-Augmented Generation"의 약자로, 검색 증강 생성이라고 합니다.\n\n🔍 작동 원리:\n1. 사용자 질문 분석\n2. 업로드된 문서에서 관련 정보 검색\n3. 검색된 정보를 바탕으로 정확한 답변 생성\n\n✨ 장점:\n• 환각(Hallucination) 현상 감소\n• 실제 문서 기반 정확한 답변\n• 출처 추적 가능\n\nHey Me는 이 기술로 당신의 문서를 학습해서 정확하게 답변합니다!',
            timestamp: '09:35',
            createdAt: new Date(Date.now() - 2800000).toISOString(),
            sessionId: 'demo-session',
          },
        ];
        setMessages(dummyMessages);
        setTimeout(() => setIsInitialLoad(false), 100); // 초기 로드 완료
      }
    };
    loadLogs();
  }, [user]);

  // Intermittent Survey Trigger
  useEffect(() => {
      // Logic: Trigger survey if the total count of messages implies a decent conversation length (e.g. 9, 17, 25...).
      if (messages.length > 2 && (messages.length - 1) % 8 === 0 && !showSurvey && !surveySubmitted) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.role === 'model') {
              setShowSurvey(true);
          }
      }
  }, [messages, showSurvey, surveySubmitted]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (!searchTerm && !startDate && !endDate) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // 초기 로드가 완료된 후에만 자동 스크롤
    if (!isInitialLoad) {
      scrollToBottom();
    }
  }, [messages, isTyping, showSurvey, isInitialLoad]);

  // Demo 세션 메시지가 남아 있으면 환영 메시지 하나만 남기고 정리
  useEffect(() => {
    if (cleanedDummy) return;
    const hasDemo = messages.some(m => m.sessionId === 'demo-session');
    if (hasDemo) {
      setMessages([
        {
          id: 'init',
          role: 'model',
          text: '안녕하세요! 👋\n저는 Hey Me입니다. 당신의 개인 AI 에이전트입니다. 무엇을 도와드릴까요?',
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          createdAt: new Date().toISOString(),
          sessionId: Date.now().toString(),
        },
      ]);
      setCleanedDummy(true);
    }
  }, [messages, cleanedDummy]);

  // --- Handlers ---

  const handleSend = async () => {
    if (isTyping || !input.trim()) return;

    // Dismiss survey if user continues chatting
    if (showSurvey) setShowSurvey(false);

    const now = new Date();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: now.toISOString(),
      sessionId: sessionId // Attach Session ID
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    
    // Prepare history for API (Limit context to last 20 messages to save tokens)
    const history = messages.slice(-20).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    try {
        // 백엔드 RAG 챗봇 호출 (내 문서 기반)
        if (!apiClient.token) {
            throw new Error('JWT 토큰이 없습니다. 로그인 후 다시 시도하세요.');
        }

        const ragReply = await chatService.chatWithRag({
            question: userMsg.text,
            top_k: 5,
        });

        const replyText = ragReply.answer || "죄송합니다. 응답을 생성하지 못했습니다.";
        const replyNow = new Date();
        const botMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: replyText || "죄송합니다. 응답을 생성하지 못했습니다.",
            timestamp: replyNow.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            createdAt: replyNow.toISOString(),
            sessionId: sessionId
        };
        setMessages(prev => [...prev, botMsg]);
        
        // --- NEW: Save Q&A Pair to DB (One entry per turn) ---
        await dbService.saveQAPair({
            question: userMsg.text,
            answer: botMsg.text,
            sessionId: sessionId,
            isFailed: false
        });

    } catch (e: any) {
        console.error(e);
        setIsTyping(false);
        const errorMsg: Message = {
            id: Date.now().toString(),
            role: 'model',
            text: "⚠️ 오류가 발생했습니다. 네트워크 연결을 확인하거나 나중에 다시 시도해주세요.",
            timestamp: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            createdAt: now.toISOString(),
            sessionId: sessionId
        };
        setMessages(prev => [...prev, errorMsg]);

        // Save Failed Q&A Pair
        await dbService.saveQAPair({
            question: userMsg.text,
            answer: "Error response",
            sessionId: sessionId,
            isFailed: true
        });

    } finally {
        setIsTyping(false);
    }
  };

  const clearHistory = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!window.confirm("모든 대화 내용을 삭제하시겠습니까?")) return;
      // 서버 로그 삭제
      try {
        await chatService.clearLogs();
      } catch (err) {
        console.error(err);
      }
      setMessages([{
        id: Date.now().toString(),
        role: 'model',
        text: '대화 기록이 초기화되었습니다. 새로운 대화를 시작해보세요!',
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        sessionId: '',
      }]);
      setSurveySubmitted(false);
      setShowSurvey(false);
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent double submission during Korean IME composition
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Filtering Logic ---
  
  const toggleSearch = () => {
    if (isSearchOpen) setSearchTerm('');
    setIsSearchOpen(!isSearchOpen);
    if (isFilterOpen) setIsFilterOpen(false);
  };

  const toggleFilter = () => {
    setIsFilterOpen(!isFilterOpen);
    if (isSearchOpen) setIsSearchOpen(false);
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const regex = new RegExp(`(${highlight})`, 'gi');
    return text.split(regex).map((part, i) => 
        regex.test(part) ? <span key={i} className="bg-yellow-500/50 text-white font-bold px-0.5 rounded-sm">{part}</span> : part
    );
  };

  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      const matchesSearch = msg.text.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesDate = true;
      if (startDate || endDate) {
        const msgDate = new Date(msg.createdAt);
        msgDate.setHours(0, 0, 0, 0);
        if (startDate && msgDate < new Date(startDate)) matchesDate = false;
        if (endDate && msgDate > new Date(endDate)) matchesDate = false;
      }
      return matchesSearch && matchesDate;
    });
  }, [messages, searchTerm, startDate, endDate]);


  // --- Render ---

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col h-[600px] border border-gray-200 relative">
        
        {/* Chat Header */}
        <div className="bg-[#1a0b2e] flex flex-col shrink-0 transition-all duration-300">
           <div className="p-6 pb-4 flex items-center justify-between h-20">
                {isSearchOpen ? (
                   <div className="w-full flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-200">
                      <div className="flex-1 relative">
                          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input 
                            autoFocus
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="대화 내용 검색..."
                            className="w-full bg-white/10 text-white placeholder-gray-400 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-400 border border-white/10"
                          />
                      </div>
                      <button 
                        onClick={toggleSearch}
                        className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                          <Icons.Close size={20} />
                      </button>
                   </div>
                ) : (
                   <>
                        <div className="flex items-center gap-4">
                            <HeyMeLogo size="xs" showCursor={true} showIcon={true} theme="dark" />
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-purple-300">👋 나를 부르면 대답하는 AI</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={clearHistory}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                                title="대화 초기화"
                            >
                                <Icons.Trash size={20} />
                            </button>
                            <div className="w-px h-6 bg-white/10 mx-1"></div>
                            <button 
                                onClick={toggleFilter}
                                className={`p-2 rounded-full transition-colors ${isFilterOpen ? 'text-white bg-purple-600' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                <Icons.Filter size={20} />
                            </button>
                            <button 
                                onClick={toggleSearch}
                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <Icons.Search size={20} />
                            </button>
                        </div>
                   </>
                )}
           </div>

           {/* Filter Bar */}
           {(isFilterOpen || startDate || endDate) && !isSearchOpen && (
               <div className={`px-6 pb-4 flex items-center gap-3 animate-in slide-in-from-top-2 duration-200 ${!isFilterOpen ? 'hidden' : ''}`}>
                    <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-lg border border-white/5 flex-1">
                        <Icons.Calendar size={14} className="text-purple-300 ml-2" />
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-white text-sm focus:outline-none p-1 [&::-webkit-calendar-picker-indicator]:invert"
                        />
                        <span className="text-gray-400">-</span>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-white text-sm focus:outline-none p-1 [&::-webkit-calendar-picker-indicator]:invert"
                        />
                    </div>
                    <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-purple-300 hover:text-white underline">초기화</button>
               </div>
           )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 bg-[#1e1b2e] p-6 overflow-y-auto space-y-6 scrollbar-transparent">
            {filteredMessages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                    <Icons.Chat size={40} className="opacity-20" />
                    <p className="text-sm">대화 내용이 없습니다.</p>
                 </div>
            ) : (
                <>
                {filteredMessages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
                            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-gray-600' : 'bg-purple-100'}`}>
                            {msg.role === 'user' ? (
                                <div className="w-full h-full rounded-full bg-gray-500" /> 
                            ) : (
                                <div className="w-6 h-6 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full" />
                            )}
                            </div>
                            
                            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-lg ${
                                    msg.role === 'user' 
                                    ? 'bg-gray-700 text-white rounded-tr-sm' 
                                    : 'bg-[#2d2b42] text-gray-100 rounded-tl-sm border border-gray-700'
                                }`}>
                                    {highlightText(msg.text, searchTerm)}
                                </div>
                                <div className="flex items-center gap-2 mt-1 px-1">
                                    <span className="text-[10px] text-gray-500">{msg.timestamp}</span>
                                    {isConnected && (
                                        <span title="Saved to Azure">
                                            <Cloud size={10} className="text-purple-400" />
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Inline Satisfaction Survey */}
                {showSurvey && (
                    <SatisfactionSurvey 
                        onDismiss={() => setShowSurvey(false)} 
                        onSubmit={() => setShowSurvey(false)} 
                    />
                )}
                </>
            )}
            
            {isTyping && (
                 <div className="flex w-full justify-start animate-pulse">
                     <div className="flex gap-3">
                         <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                             <div className="w-6 h-6 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full" />
                         </div>
                         <div className="bg-[#2d2b42] p-4 rounded-2xl rounded-tl-sm border border-gray-700 flex items-center gap-1">
                             <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-0"></span>
                             <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                             <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-300"></span>
                         </div>
                     </div>
                 </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-[#1e1b2e] p-4 border-t border-gray-800">
           <div className="relative">
               <input 
                 type="text" 
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={handleKeyPress}
                 placeholder="Hey, Me! 무엇이든 물어보세요..." 
                 className="w-full bg-[#2d2b42] text-white placeholder-gray-500 rounded-xl pl-6 pr-14 py-4 focus:outline-none focus:ring-1 focus:ring-purple-500 border border-gray-700"
               />
               <button 
                 onClick={handleSend}
                 disabled={!input.trim() || isTyping}
                 className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                     input.trim() && !isTyping ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-gray-700 text-gray-500'
                 }`}
               >
                   <Icons.Send size={18} />
               </button>
           </div>
           <div className="flex justify-between items-center mt-3 px-2">
               <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                   {isConnected ? (
                       <>
                           <Cloud size={10} className="text-green-500" />
                           <span className="text-green-500/80">Cloud Sync Active</span>
                       </>
                   ) : (
                       <>
                           <CloudOff size={10} className="text-gray-600" />
                           <span>Local Mode</span>
                       </>
                   )}
               </div>
               <p className="text-[10px] text-gray-500">
                   Powered by <CodeMeLogo size="xs" showCursor={false} theme="dark" showBrackets={false} className="inline-flex" /> Client-Side AI
               </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
