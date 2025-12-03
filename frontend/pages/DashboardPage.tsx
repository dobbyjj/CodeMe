import React, { useEffect, useMemo, useState } from 'react';
import { dashboardService } from '../services/dashboardService';
import type {
  DashboardOverview,
  DashboardKeyword,
  DashboardRecentQuestion,
  DashboardDocumentSummary,
  DashboardFailedQuestion,
} from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { HeyMeLogo } from '../components/HeyMeLogo';

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await dashboardService.getOverview();
        setData(res);
      } catch (err: any) {
        setError(err.message || '데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const aggregatedCounts = useMemo(() => {
    if (!data) return [];
    const parsed = data.daily_counts
      .map((d) => ({ date: new Date(d.date), count: d.count }))
      .filter((d) => !isNaN(d.date.getTime()));

    if (timeframe === 'daily') {
      return parsed
        .map((d) => ({
          label: d.date.toISOString().slice(0, 10),
          count: d.count,
        }))
        .sort((a, b) => (a.label < b.label ? -1 : 1));
    }

    const formatter = (d: Date) => {
      if (timeframe === 'weekly') {
        const onejan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${week.toString().padStart(2, '0')}`;
      }
      if (timeframe === 'monthly') {
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      }
      return `${d.getFullYear()}`;
    };

    const grouped: Record<string, number> = {};
    parsed.forEach(({ date, count }) => {
      const key = formatter(date);
      grouped[key] = (grouped[key] ?? 0) + count;
    });

    return Object.entries(grouped)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => (a.label < b.label ? -1 : 1));
  }, [data, timeframe]);

  const totalConversations = useMemo(() => {
    if (!data) return 0;
    return data.daily_counts.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  if (loading) return <div className="p-6 text-gray-400">로딩 중...</div>;
  if (error || !data) return <div className="p-6 text-red-400">{error ?? '데이터가 없습니다.'}</div>;

  return (
    <div className="p-6 flex flex-col items-center bg-[#0f0a1a]" style={{ paddingBottom: '60px', paddingTop: '8px' }}>
      {/* 총 대화수 박스 - 고정 크기 40px × 1400px */}
      <div 
        className="bg-[#1a0b2e] rounded-lg px-6 text-white flex items-center justify-between border border-purple-900/50"
        style={{ width: '1400px', height: '40px', marginBottom: '5px' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-purple-200">💬 총 대화수</span>
          <span className="font-semibold text-white">{totalConversations.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-4">
          {[
            { key: 'daily', label: '일간' },
            { key: 'weekly', label: '주간' },
            { key: 'monthly', label: '월간' },
            { key: 'yearly', label: '연간' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTimeframe(item.key as typeof timeframe)}
              className={`text-sm px-3 py-1 rounded transition-colors ${
                timeframe === item.key
                  ? 'bg-purple-600 text-white border border-purple-300'
                  : 'text-purple-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex" style={{ width: '1400px', gap: '5px' }}>
        {/* 좌측 영역 */}
        <div className="flex flex-col" style={{ width: '928px', gap: '5px' }}>
          {/* 사용자들은 무엇을 물어볼까요? - 고정 크기 336px × 928px */}
          <div 
            className="bg-[#1a0b2e] rounded-lg p-6 text-white flex flex-col overflow-hidden border border-purple-900/50"
            style={{ width: '928px', height: '336px' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span>✨</span>
              <h2 className="font-semibold text-white">사용자들은 무엇을 물어볼까요?</h2>
            </div>
            <KeywordCloud keywords={data.keywords} />
          </div>

          {/* 대화량 추이 - 고정 크기 164px × 928px */}
          <div 
            className="bg-[#1a0b2e] rounded-lg p-5 text-white overflow-hidden border border-purple-900/50"
            style={{ width: '928px', height: '164px' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span>📈</span>
              <h3 className="font-semibold text-white">대화량 추이</h3>
            </div>
            <div style={{ height: 'calc(164px - 80px)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aggregatedCounts}>
                  <CartesianGrid stroke="rgba(167,139,250,0.1)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#c4b5fd' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#c4b5fd' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#a78bfa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 우측 영역 */}
        <div className="flex flex-col" style={{ width: '464px', gap: '5px' }}>
          {/* 최근 Hey Me 내용 - 고정 크기 464px × 164px */}
          <div 
            className="bg-[#1a0b2e] rounded-lg p-5 text-white flex flex-col overflow-hidden border border-purple-900/50"
            style={{ width: '464px', height: '164px' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span>💬</span>
              <h3 className="font-semibold text-white">최근 <HeyMeLogo size="xs" showCursor={false} theme="dark" className="inline-flex" /> 내용</h3>
            </div>
            <div 
              className="flex-1 overflow-y-auto scrollbar-hide"
              style={{ 
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <RecentQuestionList items={data.recent_questions} />
            </div>
          </div>

          {/* 업로드 변경 사항 - 고정 크기 464px × 164px */}
          <div 
            className="bg-[#1a0b2e] rounded-lg p-5 text-white flex flex-col overflow-hidden border border-purple-900/50"
            style={{ width: '464px', height: '164px' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span>📤</span>
              <h3 className="font-semibold text-white">업로드 변경 사항</h3>
            </div>
            <div 
              className="flex-1 overflow-y-auto scrollbar-hide"
              style={{ 
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <DocumentList items={data.recent_documents} />
            </div>
          </div>

          {/* 응답 실패 목록 - 고정 크기 464px × 164px */}
          <div 
            className="bg-[#1a0b2e] rounded-lg p-5 text-white flex flex-col overflow-hidden border border-purple-900/50"
            style={{ width: '464px', height: '164px' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span>⚠️</span>
              <h3 className="font-semibold text-white">응답 실패 목록</h3>
            </div>
            <div 
              className="flex-1 overflow-y-auto scrollbar-hide"
              style={{ 
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <FailedQuestionList items={data.failed_questions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

const KeywordCloud: React.FC<{ keywords: DashboardKeyword[] }> = ({ keywords }) => {
  if (!keywords.length) {
    return <div className="text-sm text-purple-300/50">아직 수집된 키워드가 없습니다.</div>;
  }
  
  const counts = keywords.map(k => k.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  
  const scaleFont = (count: number) => {
    const minSize = 14;
    const maxSize = 56;
    if (max === min) return (minSize + maxSize) / 2;
    const ratio = (count - min) / (max - min);
    return minSize + ratio * (maxSize - minSize);
  };
  
  // 퍼플/핑크 그라데이션 톤의 색상 배열
  const colors = [
    '#a78bfa', '#c4b5fd', '#e9d5ff', '#f0abfc', '#f9a8d4',
    '#a78bfa', '#c4b5fd', '#e9d5ff', '#f0abfc', '#f9a8d4',
    '#a78bfa', '#c4b5fd', '#e9d5ff', '#f0abfc', '#f9a8d4',
    '#a78bfa', '#c4b5fd', '#e9d5ff', '#f0abfc', '#f9a8d4',
    '#a78bfa', '#c4b5fd', '#e9d5ff', '#f0abfc', '#f9a8d4'
  ];
  
  // 각 키워드에 랜덤 속성 부여 (시드 기반으로 일관성 유지)
  const getRandomProps = (keyword: string, index: number) => {
    const seed = keyword.length + index;
    const colorIndex = seed % colors.length;
    
    return {
      color: colors[colorIndex]
    };
  };
  
  return (
    <div className="flex-1 flex flex-wrap items-center justify-center content-center gap-4 overflow-auto p-4">
      {keywords.map((k, index) => {
        const props = getRandomProps(k.keyword, index);
        return (
          <span
            key={k.keyword}
            style={{ 
              fontSize: `${scaleFont(k.count)}px`,
              color: props.color,
              display: 'inline-block',
              fontWeight: 'bold',
              textShadow: '2px 2px 6px rgba(0,0,0,0.5)',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              lineHeight: 1.2
            }}
            className="hover:scale-110"
            title={`${k.keyword} · ${k.count}회`}
          >
            {k.keyword}
          </span>
        );
      })}
    </div>
  );
};

const RecentQuestionList: React.FC<{ items: DashboardRecentQuestion[] }> = ({ items }) => {
  if (!items.length) return <div className="text-xs text-purple-300/50">최근 질문이 없습니다.</div>;
  return (
    <ul className="space-y-2 text-xs">
      {items.map(q => (
        <li key={q.id} className="flex flex-col">
          <span className="truncate text-purple-100">{q.question}</span>
          <span className="text-[10px] text-purple-300/60">
            {q.created_at ? new Date(q.created_at).toLocaleString() : ''}
          </span>
        </li>
      ))}
    </ul>
  );
};

const DocumentList: React.FC<{ items: DashboardDocumentSummary[] }> = ({ items }) => {
  if (!items.length) return <div className="text-xs text-purple-300/50">업로드된 문서가 없습니다.</div>;
  return (
    <ul className="space-y-2 text-xs">
      {items.map(doc => (
        <li key={doc.id} className="flex flex-col">
          <span className="font-medium truncate text-purple-100">{doc.title}</span>
          <span className="text-[10px] text-purple-300/60">
            {doc.mime_type ?? 'unknown'} · {doc.created_at ? new Date(doc.created_at).toLocaleString() : ''}
          </span>
        </li>
      ))}
    </ul>
  );
};

const FailedQuestionList: React.FC<{ items: DashboardFailedQuestion[] }> = ({ items }) => {
  if (!items.length) return <div className="text-xs text-purple-300/50">응답 실패 기록이 없습니다.</div>;
  const totalFails = items.reduce((sum, i) => sum + i.fail_count, 0);
  return (
    <ul className="space-y-2 text-xs">
      {items.map(item => {
        const ratio = totalFails ? Math.round((item.fail_count / totalFails) * 100) : 0;
        return (
          <li key={item.normalized_question} className="flex flex-col gap-1">
            <div className="flex justify-between items-center gap-2">
              <span className="truncate text-purple-100" title={item.sample_question}>
                {item.sample_question}
              </span>
              <span className="text-[10px] text-purple-300/60">
                {item.fail_count}회 · {ratio}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-purple-900/50 overflow-hidden">
              <div className="h-full bg-purple-400" style={{ width: `${ratio}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
};
