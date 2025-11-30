import { apiClient } from './api';
import type { Link } from '../types';

export const linkService = {
  async createForGroup(groupId: string, title?: string): Promise<Link> {
    return apiClient.request<Link>('/api/v1/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: groupId,
        title: title || '폴더 기반 공유 링크',
      }),
    });
  },
};
