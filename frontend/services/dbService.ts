
import { ChatMessage, QALog, DocumentEntity, DashboardStats } from '../types';

// Cloud endpoints는 사용하지 않고 로컬 스토리지 전용으로 둔다.
const API_BASE_URL = '';
let CONNECTION_STATUS: 'connected' | 'disconnected' | 'config_error' = 'disconnected';

const getUserId = () => {
    try {
        const session = localStorage.getItem('codeme_session');
        if (session) {
            const user = JSON.parse(session);
            return user.email || 'anonymous';
        }
    } catch(e) {}
    return 'anonymous';
};

export const dbService = {
    initDB: async (): Promise<string> => {
        // Always use local storage; no external health check
        CONNECTION_STATUS = 'disconnected';
        return CONNECTION_STATUS;
    },

    isConnected: () => CONNECTION_STATUS === 'connected',
    getApiUrl: () => API_BASE_URL,

    // --- New Dashboard Aggregated Fetch ---
    getDashboardStats: async (): Promise<DashboardStats | null> => {
        if (CONNECTION_STATUS !== 'connected') return null;

        try {
            // Parallel fetch for dashboard widgets
            const userId = getUserId();
            const queryParams = userId !== 'anonymous' ? `?userId=${encodeURIComponent(userId)}` : '';

            // Appending queryParams to requests to ensure user-specific aggregation
            const [keywords, recent, documents, stats, failures] = await Promise.all([
                fetch(`${API_BASE_URL}/dashboard/keywords${queryParams}`).then(r => r.json()),
                fetch(`${API_BASE_URL}/dashboard/recent${queryParams ? queryParams + '&limit=10' : '?limit=10'}`).then(r => r.json()),
                fetch(`${API_BASE_URL}/dashboard/documents${queryParams}`).then(r => r.json()),
                fetch(`${API_BASE_URL}/dashboard/stats${queryParams}`).then(r => r.json()), // Returns { totalChats, dailyStats }
                fetch(`${API_BASE_URL}/dashboard/failures${queryParams}`).then(r => r.json())
            ]);

            return {
                topKeywords: keywords,
                recentChats: recent,
                documents: documents,
                dailyStats: stats.dailyStats || [],
                failures: failures,
                totalChats: stats.totalChats || 0
            };
        } catch (e) {
            console.error("Dashboard Fetch Error:", e);
            return null;
        }
    },

    // --- Chat Operations ---
    
    // Updated: Save Q&A Pair (Question + Answer)
    saveQAPair: async (data: { question: string, answer: string, sessionId: string, isFailed: boolean }) => {
        if (CONNECTION_STATUS === 'connected') {
            try {
                const payload = {
                    ...data,
                    userId: getUserId(),
                    createdAt: new Date().toISOString(),
                    botId: 'hey-me-v1',
                    entityType: 'qa_log'
                };

                await fetch(`${API_BASE_URL}/qa-logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (e) { 
                console.error("Failed to save to server:", e); 
            }
        }
    },

    saveDocumentMetadata: async (file: {name: string, size: number, type: string}) => {
        if (CONNECTION_STATUS === 'connected') {
            try {
                const payload = {
                    title: file.name,
                    originalFileName: file.name,
                    sizeBytes: file.size,
                    mimeType: file.type,
                    userId: getUserId(),
                    createdAt: new Date().toISOString(),
                    status: 'uploaded',
                    entityType: 'document'
                };

                await fetch(`${API_BASE_URL}/documents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (e) { console.error("Doc Save Error:", e); }
        }
    }
};
