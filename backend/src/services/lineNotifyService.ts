import { messagingApi } from '@line/bot-sdk';

const { MessagingApiClient } = messagingApi;

let client: InstanceType<typeof MessagingApiClient> | null = null;
let tokenExpiresAt = 0;

/**
 * 使用 Channel ID + Secret 透過 API 取得新的 access token（有效 30 天）。
 */
async function refreshToken(): Promise<string | null> {
  const id = process.env.LINE_CHANNEL_ID ?? '2003855683';
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return null;

  try {
    const res = await fetch('https://api.line.me/v2/oauth/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${id}&client_secret=${secret}`,
    });
    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (data.access_token) {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = data.access_token;
      tokenExpiresAt = Date.now() + (data.expires_in ?? 2592000) * 1000 - 86400000; // refresh 1 day before expiry
      client = null; // force re-create client
      console.log('[LINE] Token refreshed, expires in', data.expires_in, 'seconds');
      return data.access_token;
    }
  } catch (err) {
    console.error('[LINE] Token refresh failed:', err);
  }
  return null;
}

async function getClient(): Promise<InstanceType<typeof MessagingApiClient> | null> {
  let token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;

  // Auto-refresh if close to expiry
  if (tokenExpiresAt > 0 && Date.now() > tokenExpiresAt) {
    token = await refreshToken() ?? token;
  }

  if (!client) {
    client = new MessagingApiClient({ channelAccessToken: token });
  }
  return client;
}

/**
 * 推播訊息給指定 LINE 使用者。
 * 若未設定 LINE_CHANNEL_ACCESS_TOKEN，則降級為 console log。
 */
export async function pushToUser(userId: string, message: string | object): Promise<void> {
  const c = await getClient();
  if (!c) {
    console.log(`[LINE stub] pushToUser(${userId}):`, typeof message === 'string' ? message : JSON.stringify(message));
    return;
  }
  try {
    const msg = typeof message === 'string' ? { type: 'text' as const, text: message } : message;
    await c.pushMessage({
      to: userId,
      messages: [msg as any],
    });
  } catch (err) {
    console.error('[LINE] pushToUser failed', err);
  }
}

/**
 * 推播訊息給店家 OA（使用 LINE_OA_ID）。
 * 注意：push 到 @OA id 需要先取得對應的 userId；
 * 實務上建議另存店家自己的 LINE userId 作為 LINE_OWNER_USER_ID。
 */
export async function pushToOa(message: string | object): Promise<void> {
  const ownerUserId = process.env.LINE_OWNER_USER_ID;
  if (!(await getClient()) || !ownerUserId) {
    console.log(`[LINE stub] pushToOa:`, typeof message === 'string' ? message : JSON.stringify(message));
    return;
  }
  await pushToUser(ownerUserId, message);
}

/** 通用 Flex 卡片 helper：header + body rows */
function flexCard(opts: {
  headerBg: string;
  headerTitle: string;
  headerSub?: string;
  rows: Array<{ label: string; value: string }>;
  totalLabel?: string;
  totalValue?: string;
  footer?: string;
  footerAction?: { label: string; uri: string };
}): object {
  const bodyContents: object[] = opts.rows.map((r) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: r.label, size: 'sm', color: '#b0aba7', flex: 2 },
      { type: 'text', text: r.value, size: 'sm', weight: 'bold', color: '#4a423d', flex: 3, align: 'end', wrap: true },
    ],
  }));

  if (opts.totalLabel && opts.totalValue) {
    bodyContents.push({ type: 'separator', margin: 'lg' });
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      margin: 'lg',
      contents: [
        { type: 'text', text: opts.totalLabel, size: 'md', weight: 'bold', color: '#655b55', flex: 2 },
        { type: 'text', text: opts.totalValue, size: 'md', weight: 'bold', color: '#655b55', flex: 3, align: 'end' },
      ],
    });
  }

  const headerContents: object[] = [
    { type: 'text', text: 'SHANSHAN.STUDIO', color: '#ffffff80', size: 'xxs', weight: 'bold' },
    { type: 'text', text: opts.headerTitle, color: '#ffffff', size: 'xl', weight: 'bold', margin: 'md' },
  ];
  if (opts.headerSub) {
    headerContents.push({ type: 'text', text: opts.headerSub, color: '#ffffffaa', size: 'xs', margin: 'sm' });
  }

  const bubble: Record<string, unknown> = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: opts.headerBg, paddingAll: '20px',
      contents: headerContents,
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
      contents: bodyContents,
    },
  };

  const footerContents: object[] = [];
  if (opts.footer) {
    footerContents.push({ type: 'text', text: opts.footer, size: 'xxs', color: '#b0aba7', align: 'center' });
  }
  if (opts.footerAction) {
    footerContents.push({
      type: 'button',
      style: 'link',
      height: 'sm',
      action: { type: 'uri', label: opts.footerAction.label, uri: opts.footerAction.uri },
      color: '#655b55',
      ...(opts.footer ? { margin: 'sm' } : {}),
    });
  }
  if (footerContents.length > 0) {
    bubble.footer = {
      type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
      contents: footerContents,
    };
  }

  return { type: 'flex', altText: opts.headerTitle, contents: bubble };
}

/** 新預約通知（推給店家） */
export function buildNewBookingMessage(booking: {
  name: string;
  phone: string;
  date: string;
  time: string;
  items: string;
  total: number;
}): object {
  return flexCard({
    headerBg: '#655b55',
    headerTitle: '新預約通知',
    rows: [
      { label: '姓名', value: booking.name },
      { label: '電話', value: booking.phone },
      { label: '日期', value: booking.date },
      { label: '時段', value: booking.time },
      { label: '項目', value: booking.items },
    ],
    totalLabel: '金額',
    totalValue: `NT$ ${booking.total}`,
  });
}

/** 預約確認通知（推給客人） */
export function buildBookingConfirmedMessage(booking: { name: string; date: string; time: string; items: string; total: number }): object {
  return flexCard({
    headerBg: '#655b55',
    headerTitle: '預約已確認',
    headerSub: '期待您的光臨 ✨',
    rows: [
      { label: '姓名', value: booking.name },
      { label: '日期', value: booking.date },
      { label: '時段', value: booking.time },
      { label: '項目', value: booking.items },
    ],
    totalLabel: '合計',
    totalValue: `NT$ ${booking.total}`,
    footer: '如需異動請透過 LINE 私訊小編',
    footerAction: { label: '📍 查看店面位置', uri: 'https://maps.app.goo.gl/itw3jVbvuNajf2kp8?g_st=ic' },
  });
}

/** 預約取消通知（推給客人） */
export function buildBookingCancelledMessage(booking: { name: string; date: string; time: string; items: string }): object {
  return flexCard({
    headerBg: '#655b55',
    headerTitle: '預約已取消',
    rows: [
      { label: '姓名', value: booking.name },
      { label: '日期', value: booking.date },
      { label: '時段', value: booking.time },
      { label: '項目', value: booking.items },
    ],
    footer: '如需重新預約歡迎再次聯繫',
  });
}

/** 明日預約提醒（推給客人） */
export function buildBookingReminderMessage(booking: { name: string; date: string; time: string; items: string }): object {
  return flexCard({
    headerBg: '#655b55',
    headerTitle: '明日預約提醒',
    headerSub: '別忘了喔 ⏰',
    rows: [
      { label: '姓名', value: booking.name },
      { label: '日期', value: booking.date },
      { label: '時段', value: booking.time },
      { label: '項目', value: booking.items },
    ],
    footer: '如需異動請透過 LINE 私訊小編',
    footerAction: { label: '📍 查看店面位置', uri: 'https://maps.app.goo.gl/itw3jVbvuNajf2kp8?g_st=ic' },
  });
}

/** 新會員註冊通知（推給店家） */
export function buildNewMemberMessage(member: {
  name: string;
  phone: string;
  gender?: string | null;
  bday?: string | null;
}): object {
  const rows = [
    { label: '姓名', value: member.name },
    { label: '電話', value: member.phone },
    { label: '性別', value: member.gender ?? '未填' },
  ];
  if (member.bday) rows.push({ label: '生日', value: member.bday });

  return flexCard({
    headerBg: '#655b55',
    headerTitle: '新會員註冊',
    headerSub: '歡迎新朋友加入 ✨',
    rows,
  });
}

/** 綁定通知提醒（推給客人，一鍵開啟綁定） */
export function buildBindPromptMessage(name: string, phone: string): object {
  const prefillUri = `https://line.me/R/oaMessage/%40903zzutx/?${encodeURIComponent('綁定 ' + phone)}`;
  return {
    type: 'flex',
    altText: '開啟預約提醒通知',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#06C755', paddingAll: '20px',
        contents: [
          { type: 'text', text: 'SHANSHAN.STUDIO', color: '#ffffff80', size: 'xxs', weight: 'bold' },
          { type: 'text', text: '開啟預約提醒通知', color: '#ffffff', size: 'xl', weight: 'bold', margin: 'md' },
          { type: 'text', text: '只需設定一次，之後自動收到通知', color: '#ffffffaa', size: 'xs', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
        contents: [
          { type: 'text', text: `${name} 您好 ✨`, size: 'sm', weight: 'bold', color: '#4a423d' },
          { type: 'text', text: '點擊下方按鈕，按送出即可完成綁定，之後預約確認、提醒通知都會自動傳送給您！', size: 'sm', color: '#7a726d', wrap: true, margin: 'md' },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: '💡 綁定後即享有：', size: 'sm', weight: 'bold', color: '#4a423d', margin: 'lg' },
          { type: 'text', text: '• 預約確認通知\n• 明日預約提醒\n• 預約異動通知', size: 'sm', color: '#7a726d', wrap: true, margin: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#06C755',
            height: 'sm',
            action: { type: 'uri', label: '一鍵綁定通知', uri: prefillUri },
          },
        ],
      },
    },
  };
}

