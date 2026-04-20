import { http } from './axios';
import type { Member } from './types';

export const membersApi = {
  async list(): Promise<Member[]> {
    const res = await http.get<{ members: Member[] }>('/members');
    return res.data.members;
  },
  async getByPhone(phone: string): Promise<Member | null> {
    try {
      const res = await http.get<{ member: Member }>(`/members/${phone}`);
      return res.data.member;
    } catch (err) {
      if ((err as { response?: { status?: number } }).response?.status === 404) return null;
      throw err;
    }
  },
  async upsert(data: {
    phone: string;
    name: string;
    bday?: string | null;
    gender?: '男' | '女' | null;
    note?: string | null;
    lineUserId?: string | null;
  }): Promise<Member> {
    const res = await http.post<{ member: Member }>('/members', data);
    return res.data.member;
  },
  async adjustWallet(phone: string, delta: number, reason?: string): Promise<Member> {
    const res = await http.patch<{ member: Member }>(`/members/${phone}/wallet`, { delta, reason });
    return res.data.member;
  },
  async remove(phone: string): Promise<void> {
    await http.delete(`/members/${phone}`);
  },
};
