import { apiClient } from './api';

export interface RagChatRequest {
  question: string;
  group_id?: string | null;
  top_k?: number;
}

export interface RagChatSource {
  id: string;
  title?: string | null;
  original_file_name?: string | null;
  chunk_id?: number | null;
  score: number;
}

export interface RagChatResponse {
  question: string;
  answer: string;
  sources: RagChatSource[];
}

export interface ChatLog {
  id: string;
  question: string;
  answer: string;
  created_at?: string | null;
}

export const chatService = {
  async chatWithRag(payload: RagChatRequest): Promise<RagChatResponse> {
    return apiClient.request<RagChatResponse>('/api/v1/chat/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async listLogs(): Promise<ChatLog[]> {
    return apiClient.request<ChatLog[]>('/api/v1/chat/logs');
  },

  async clearLogs(): Promise<void> {
    return apiClient.request<void>('/api/v1/chat/logs', {
      method: 'DELETE',
    });
  },
};
