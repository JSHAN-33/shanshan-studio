import { http } from './axios';
import type { DepositSetting } from './types';

export const settingsApi = {
  async getDeposit(): Promise<DepositSetting> {
    const res = await http.get<DepositSetting>('/settings/deposit');
    return res.data;
  },
  async updateDeposit(data: Partial<DepositSetting>): Promise<void> {
    await http.put('/settings/deposit', data);
  },
};
