import React, { useEffect, useState } from 'react';
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

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await dashboardService.getOverview();
        setData(res);
      } catch (err) {
        setError('대시보드 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-6 text-gray-600">로딩 중...</div>;
  if (error || !data) return <div className="p-6 text-red-500">{error ?? '데이터가 없습니다.'}</div>;

  return (
    <div className="p-6 grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:col-span-8 bg-gradient-to-br from-purple-700 to-purple-800 rounded-3xl p-6 text-white flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">사용자들은 무엇을 물어볼까요?</h2>
        </div>
        <KeywordCloud keywords={data.keywords} />
      </div>

      <div className="col-span-12 lg:col-span-4 bg-purple-800 rounded-3xl p-5 text-white flex flex-col">
        <h3 className="text-sm font-semibold mb-3">최근 Hey Me 내용</h3>
        <RecentQuestionList items={data.recent_questions} />
      </div>

      <div className="col-span-12 lg:col-span-8 bg-purple-800 rounded-3xl p-5 text-white">
        <h3 className="text-sm font-semibold mb-3">대화량 추이</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.daily_counts}>
              <CartesianGrid stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#e9d5ff' }} />
              <YAxis tick={{ fontSize: 10, fill: '#e9d5ff' }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#fbbf24" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4 bg-purple-800 rounded-3xl p-5 text-white flex flex-col">
        <h3 className="text-sm font-semibold mb-3">학습된 지식 데이터</h3>
        <DocumentList items={data.recent_documents} />
      </div>

      <div className="col-span-12 lg:col-span-4 lg:col-start-9 bg-purple-800 rounded-3xl p-5 text-white flex flex-col">
        <h3 className="text-sm font-semibold mb-3">응답 실패 목록</h3>
        <FailedQuestionList items={data.failed_questions} />
      </div>
    </div>
  );
};

export default DashboardPage;

const KeywordCloud: React.FC<{ keywords: DashboardKeyword[] }> = ({ keywords }) => {
  if (!keywords.length) {
    return <div className="text-sm text-purple-100/70">아직 수집된 키워드가 없습니다.</div>;
  }
  const counts = keywords.map(k => k.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const scaleFont = (count: number) => {
    const minSize = 12;
    const maxSize = 32;
    if (max === min) return (minSize + maxSize) / 2;
    const ratio = (count - min) / (max - min);
    return minSize + ratio * (maxSize - minSize);
  };
  return (
    <div className="flex-1 flex flex-wrap items-center content-start gap-3 overflow-auto">
      {keywords.map(k => (
        <span
          key={k.keyword}
          style={{ fontSize: `${scaleFont(k.count)}px` }}
          className="px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-default"
          title={`${k.keyword} · ${k.count}회`}
        >
          {k.keyword}
        </span>
      ))}
    </div>
  );
};

const RecentQuestionList: React.FC<{ items: DashboardRecentQuestion[] }> = ({ items }) => {
  if (!items.length) return <div className="text-xs text-purple-100/70">최근 질문이 없습니다.</div>;
  return (
    <ul className="space-y-2 text-xs">
      {items.map(q => (
        <li key={q.id} className="flex flex-col">
          <span className="truncate">{q.question}</span>
          <span className="text-[10px] text-purple-200/80">
            {q.created_at ? new Date(q.created_at).toLocaleString() : ''}
          </span>
        </li>
      ))}
    </ul>
  );
};

const DocumentList: React.FC<{ items: DashboardDocumentSummary[] }> = ({ items }) => {
  if (!items.length) return <div className="text-xs text-purple-100/70">업로드된 문서가 없습니다.</div>;
  return (
    <ul className="space-y-2 text-xs">
      {items.map(doc => (
        <li key={doc.id} className="flex flex-col">
          <span className="font-medium truncate">{doc.title}</span>
          <span className="text-[10px] text-purple-200/80">
            {doc.mime_type ?? 'unknown'} · {doc.created_at ? new Date(doc.created_at).toLocaleString() : ''}
          </span>
        </li>
      ))}
    </ul>
  );
};

const FailedQuestionList: React.FC<{ items: DashboardFailedQuestion[] }> = ({ items }) => {
  if (!items.length) return <div className="text-xs text-purple-100/70">응답 실패 기록이 없습니다.</div>;
  const totalFails = items.reduce((sum, i) => sum + i.fail_count, 0);
  return (
    <ul className="space-y-2 text-xs">
      {items.map(item => {
        const ratio = totalFails ? Math.round((item.fail_count / totalFails) * 100) : 0;
        return (
          <li key={item.normalized_question} className="flex flex-col gap-1">
            <div className="flex justify-between items-center gap-2">
              <span className="truncate" title={item.sample_question}>
                {item.sample_question}
              </span>
              <span className="text-[10px] text-purple-200/80">
                {item.fail_count}회 · {ratio}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-purple-900/80 overflow-hidden">
              <div className="h-full bg-pink-400" style={{ width: `${ratio}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
};
