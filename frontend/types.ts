
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  createdAt: string; 
  isTyping?: boolean;
  sessionId?: string; 
}

// --- New Cosmos DB Schema Types (CodeMeCos Container) ---

// Base Entity
export interface BaseEntity {
  id: string;
  entityType: 'qa_log' | 'document';
  userId: string; // Partition Key
  createdAt: string;
}

// 1. QA Log (Chat History & Failures)
export interface QALog extends BaseEntity {
  entityType: 'qa_log';
  botId: string;
  question: string;
  normalizedQuestion?: string;
  mainKeyword?: string;
  answer: string; 
  isFailed: boolean;
  model?: string;
  sessionId?: string;
  role?: string; 
}

// 2. Document (Uploaded Files)
export interface DocumentEntity extends BaseEntity {
  entityType: 'document';
  title: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
}

export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'failed';

export interface Document {
  id: string;
  user_id: string;
  title: string;
  original_file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  blob_path: string;
  source: string;
  group_id: string | null;
  status: DocumentStatus;
  chunk_count: number;
  last_indexed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentGroup {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  persona_prompt?: string | null;
  created_at: string;
  updated_at: string;
}

// 3. Dashboard Data Transfer Objects (DTO)
export interface DashboardKeyword {
  keyword: string;
  count: number;
}

export interface DashboardRecentQuestion {
  id: string;
  question: string;
  created_at: string | null;
}

export interface DashboardDocumentSummary {
  id: string;
  title: string;
  original_file_name: string;
  mime_type: string | null;
  status: string;
  created_at: string | null;
  group_id: string | null;
}

export interface DashboardDailyCount {
  date: string;
  count: number;
}

export interface DashboardFailedQuestion {
  normalized_question: string;
  sample_question: string;
  fail_count: number;
  last_asked_at: string | null;
}

export interface DashboardOverview {
  keywords: DashboardKeyword[];
  recent_questions: DashboardRecentQuestion[];
  recent_documents: DashboardDocumentSummary[];
  daily_counts: DashboardDailyCount[];
  failed_questions: DashboardFailedQuestion[];
}

export interface User {
  id?: string;
  email: string;
  name: string | null;
  provider?: string;
  created_at?: string;
  picture?: string;
}

export interface FileItem {
  id: string;
  name: string;
  size: string;
  date: string;
  type: string;
  uploadStatus: 'uploading' | 'done' | 'error';
  uploadProgress?: number;
}

export interface Contact {
  id: string;
  date: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
  website: string;
  phone: string;
  industry: string;
}

export enum PageRoute {
  HOME = '/',
  AGENT = '/agent',
  CHAT = '/agent', // backward compat
  SHARE_CHAT = '/share-chat',
  DASHBOARD = '/dashboard',
  UPLOAD = '/upload',
  PRICING = '/pricing',
  SETTINGS = '/settings'
}

export interface Link {
  id: string;
  user_id: string;
  document_id?: string | null;
  group_id?: string | null;
  title?: string | null;
  is_active: boolean;
  expires_at?: string | null;
  created_at?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (notification?: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
        };
      };
    };
  }
}
