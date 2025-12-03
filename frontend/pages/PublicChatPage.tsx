import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { askLinkChat, getLinkInfo, LinkInfoResponse } from '../services/api';
import { Icons } from '../components/Icons';

type ChatRole = 'user' | 'bot';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
}

const PublicChatPage: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfoResponse | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 링크 정보 불러오기
    const loadLinkInfo = async () => {
      if (!linkId) {
        setError('유효하지 않은 링크입니다.');
        setIsLoadingInfo(false);
        return;
      }

      try {
        const info = await getLinkInfo(linkId);
        setLinkInfo(info);
        setError(null);
        
        // 안내 메시지
        setMessages([
          {
            id: 'welcome',
            role: 'bot',
            text: `${info.user_name}님이 선택한 문서에 기반한 챗봇입니다. 궁금한 내용을 물어보세요.`,
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } catch (e: any) {
        // 링크 정보 조회가 실패해도 채팅이 동작할 수 있으므로 배너는 띄우지 않는다.
        setError(null);
      } finally {
        setIsLoadingInfo(false);
      }
    };

    loadLinkInfo();
  }, [linkId]);

  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // }, [messages]);

  const handleSend = async () => {
    if (!linkId || !input.trim() || isSending) return;
    setError(null);
    const now = new Date();
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      text: input,
      timestamp: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const resp = await askLinkChat({ link_id: linkId, question: userMsg.text });
      const botMsg: ChatMessage = {
        id: `${Date.now()}-b`,
        role: 'bot',
        text: resp.answer,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e: any) {
      setError('링크가 존재하지 않거나 만료되었거나, 일시적인 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col h-[80vh]">
        <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
          <div>
            {isLoadingInfo ? (
              <>
                <p className="text-sm text-purple-100">로딩 중...</p>
                <h1 className="text-xl font-bold">정보를 불러오는 중입니다</h1>
              </>
            ) : linkInfo ? (
              <>
                <p className="text-sm text-purple-100">{linkInfo.user_name}님의 공개 링크 챗봇</p>
                <h1 className="text-xl font-bold">
                  {linkInfo.folder_name || linkInfo.title || '선택된 문서'} 기반으로 답변합니다
                </h1>
              </>
            ) : (
              <>
                <p className="text-sm text-purple-100">공개 링크 챗봇</p>
                <h1 className="text-xl font-bold">선택된 문서 기반으로 답변합니다</h1>
              </>
            )}
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"
          >
            <Icons.Home size={16} />
            홈으로
          </button>
        </div>

        {error && !linkInfo && (
          <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 text-sm">
            {error}{' '}
            <button
              onClick={() => navigate('/')}
              className="underline font-semibold"
            >
              홈으로 가기
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                }`}
              >
                {msg.text}
                <div className="mt-1 text-[10px] text-gray-400">
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="무엇이 궁금하신가요?"
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="px-4 py-3 rounded-xl bg-purple-600 text-white font-medium flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-purple-500 transition-colors"
            >
              {isSending ? (
                <Icons.Loader2 className="animate-spin" size={18} />
              ) : (
                <Icons.Send size={18} />
              )}
              {isSending ? '전송 중' : '전송'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicChatPage;
