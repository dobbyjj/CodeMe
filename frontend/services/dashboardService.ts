import { apiClient } from './api';
import type { DashboardOverview } from '../types';

export const dashboardService = {
  async getOverview(): Promise<DashboardOverview> {
    return apiClient.request<DashboardOverview>('/api/v1/dashboard/overview');
  },
};
