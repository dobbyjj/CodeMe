import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../components/Icons';
import type { ChatMessage, DocumentGroup } from '../types';
import { documentService } from '../services/documentService';
import { chatService } from '../services/chatService';
import { linkService } from '../services/linkService';
import { apiClient } from '../services/api';

const ShareChatPage: React.FC = () => {
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await documentService.listGroups();
        setGroups(res);
      } catch (err: any) {
        setError(err.message || '폴더 목록을 불러오지 못했습니다.');
      }
    };
    fetchGroups();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!apiClient.token) {
      alert('로그인이 필요합니다. JWT 토큰을 설정해주세요.');
      return;
    }

    const question = input.trim();
    setInput('');
    setIsLoading(true);
    setError(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await chatService.chatWithRag({
        question,
        group_id: selectedGroupId,
        top_k: 5,
      });
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setError(err.message || '답변을 가져오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!selectedGroupId) {
      alert('공유할 폴더를 선택하세요.');
      return;
    }
    if (!apiClient.token) {
      alert('로그인이 필요합니다. JWT 토큰을 설정해주세요.');
      return;
    }
    try {
      setIsLoading(true);
      const link = await linkService.createForGroup(selectedGroupId);
      const base = window.location.origin;
      const url = `${base}/c/${link.id}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      alert(`공유 링크가 생성되었습니다.\n\n${url}\n\n클립보드에도 복사했습니다.`);
    } catch (err: any) {
      setError(err.message || '공유 링크를 생성하지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white shadow-sm border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-gray-900">공유용 챗봇</h2>
              <span className="text-xs text-gray-500">
                폴더를 선택하면 해당 폴더 문서만 기반으로 답변합니다.
              </span>
              {shareUrl && (
                <span className="text-xs text-purple-600 mt-1 break-all">
                  공유 링크: {shareUrl}
                </span>
              )}
            </div>
            <button
              disabled={!selectedGroupId || isLoading}
              onClick={handleCreateShareLink}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs ${
                selectedGroupId
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Icons.Link size={14} />
              링크 생성하기
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4 overflow-x-auto text-sm">
            <button
              onClick={() => {
                setSelectedGroupId(null);
                setMessages([]);
              }}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs ${
                selectedGroupId === null
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <Icons.FolderOpen size={14} />
              전체 문서
            </button>
            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setMessages([]);
                }}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs ${
                  selectedGroupId === group.id
                    ? 'bg-purple-50 border-purple-300 text-purple-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                <Icons.Folder size={14} />
                {group.name}
              </button>
            ))}
          </div>

          <div className="border border-gray-100 rounded-2xl bg-gray-50 min-h-[400px] flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
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
                    <div className="mt-1 text-[10px] text-gray-400">{msg.timestamp}</div>
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
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="질문을 입력하세요"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="px-4 py-3 rounded-xl bg-purple-600 text-white font-medium flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-purple-500 transition-colors"
                >
                  {isLoading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.Send size={18} />}
                  {isLoading ? '전송 중' : '전송'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareChatPage;
