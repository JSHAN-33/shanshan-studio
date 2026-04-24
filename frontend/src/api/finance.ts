import { http } from './axios';
import type { FinanceSummary, YearSummary, MonthSummary, AnalyticsSummary } from './types';

export const financeApi = {
  async summary(): Promise<FinanceSummary> {
    const res = await http.get<FinanceSummary>('/finance/summary');
    return res.data;
  },
  async year(year: number): Promise<YearSummary> {
    const res = await http.get<YearSummary>('/finance/year', { params: { year } });
    return res.data;
  },
  async month(month: string): Promise<MonthSummary> {
    const res = await http.get<MonthSummary>('/finance/month', { params: { month } });
    return res.data;
  },
  async analytics(): Promise<AnalyticsSummary> {
    const res = await http.get<AnalyticsSummary>('/finance/analytics');
    return res.data;
  },
};
