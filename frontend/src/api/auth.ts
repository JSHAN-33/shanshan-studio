import { http } from './axios';
import type { Member } from './types';

export interface LineLoginResponse {
  registered: boolean;
  member?: Member;
}

export interface CredentialLoginResponse {
  ok: boolean;
  role: 'admin' | 'user';
  token: string;
}

export const authApi = {
  async lineLogin(lineUserId: string, pictureUrl?: string | null): Promise<LineLoginResponse> {
    const res = await http.post<LineLoginResponse>('/auth/line-login', { lineUserId, pictureUrl });
    return res.data;
  },

  async credentialLogin(account: string, password: string): Promise<CredentialLoginResponse> {
    const res = await http.post<CredentialLoginResponse>('/auth/login', { account, password });
    return res.data;
  },

  async register(data: {
    lineUserId: string;
    displayName?: string | null;
    pictureUrl?: string | null;
    name: string;
    phone: string;
    gender: '男' | '女';
    bday?: string | null;
    inLiff?: boolean;
  }): Promise<{ registered: boolean; member: Member }> {
    const res = await http.post<{ registered: boolean; member: Member }>('/auth/register', data);
    return res.data;
  },
};
