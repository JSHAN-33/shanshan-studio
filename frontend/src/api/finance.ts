import { http } from './axios';
import type { FinanceSummary } from './types';

export const financeApi = {
  async summary(): Promise<FinanceSummary> {
    const res = await http.get<FinanceSummary>('/finance/summary');
    return res.data;
  },
};
