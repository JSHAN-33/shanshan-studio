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

/** 預約金轉帳資訊（推給新客，預約送出後自動發送） */
export function buildDepositInfoMessage(booking: {
  name: string;
  date: string;
  time: string;
  items: string;
  total: number;
  depositAmount: number;
  bankInfo: string;
}): object {
  const bankLines = booking.bankInfo.split('\n').filter(Boolean);
  const bankContents: object[] = bankLines.map((line) => ({
    type: 'text', text: line, size: 'sm', color: '#4a423d', weight: 'bold', wrap: true,
  }));

  return {
    type: 'flex',
    altText: '預約金轉帳資訊',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#3b3530', paddingAll: '20px',
        contents: [
          { type: 'text', text: 'SHANSHAN.STUDIO', color: '#ffffff50', size: 'xxs', weight: 'bold' },
          { type: 'text', text: '預約金轉帳資訊', color: '#ffffff', size: 'xl', weight: 'bold', margin: 'md' },
          { type: 'text', text: `DEPOSIT  NT$ ${booking.depositAmount}`, color: '#c8a96e', size: 'sm', weight: 'bold', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
        contents: [
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: '姓名', size: 'sm', color: '#b0aba7', flex: 2 },
              { type: 'text', text: booking.name, size: 'sm', weight: 'bold', color: '#4a423d', flex: 3, align: 'end' },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: '日期', size: 'sm', color: '#b0aba7', flex: 2 },
              { type: 'text', text: booking.date, size: 'sm', weight: 'bold', color: '#4a423d', flex: 3, align: 'end' },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: '時段', size: 'sm', color: '#b0aba7', flex: 2 },
              { type: 'text', text: booking.time, size: 'sm', weight: 'bold', color: '#4a423d', flex: 3, align: 'end' },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: '項目', size: 'sm', color: '#b0aba7', flex: 2 },
              { type: 'text', text: booking.items, size: 'sm', weight: 'bold', color: '#4a423d', flex: 3, align: 'end', wrap: true },
            ],
          },
          { type: 'separator', margin: 'lg' },
          {
            type: 'box', layout: 'vertical', margin: 'lg', backgroundColor: '#f8f7f5',
            cornerRadius: '12px', paddingAll: '14px', spacing: 'sm',
            contents: [
              { type: 'text', text: '匯款資訊', size: 'xxs', color: '#b0aba7', weight: 'bold' },
              ...bankContents,
            ],
          },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: '● 轉帳完成後請截圖傳至 LINE 告知小編', size: 'xxs', color: '#7a726d', wrap: true, margin: 'lg' },
          { type: 'text', text: '● 確認收款後將為您正式登記預約', size: 'xxs', color: '#7a726d', wrap: true },
          { type: 'text', text: '● 逾時未付款，預約將自動取消', size: 'xxs', color: '#b0aba7', wrap: true },
          { type: 'text', text: '● 臨時取消或未到場者，預約金恕不退還', size: 'xxs', color: '#b0aba7', wrap: true },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        contents: [
          { type: 'text', text: '請於 24 小時內完成轉帳', size: 'xs', color: '#8b6914', weight: 'bold', align: 'center' },
        ],
      },
    },
  };
}

/** 熱蠟後保養注意事項（推給客人，預約結束後 1 小時） */
export function buildAftercareMessage(): object {
  return {
    type: 'flex',
    altText: '[SHANSHAN.STUDIO x RICA] 熱蠟後保養及注意事項',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#655b55', paddingAll: '20px',
        contents: [
          { type: 'text', text: 'SHANSHAN.STUDIO', color: '#ffffff80', size: 'xxs', weight: 'bold' },
          { type: 'text', text: '熱蠟後保養及注意事項', color: '#ffffff', size: 'lg', weight: 'bold', margin: 'md' },
          { type: 'text', text: 'SHANSHAN.STUDIO x RICA', color: '#ffffffaa', size: 'xs', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'lg',
        contents: [
          {
            type: 'box', layout: 'vertical', spacing: 'sm',
            contents: [
              { type: 'text', text: '❶ 穿著寬鬆衣服', size: 'sm', weight: 'bold', color: '#4a423d' },
              { type: 'text', text: '除毛後肌膚較脆弱，勿穿著緊身衣褲，以免過度摩擦造成肌膚不適！', size: 'sm', color: '#7a726d', wrap: true },
            ],
          },
          {
            type: 'box', layout: 'vertical', spacing: 'sm',
            contents: [
              { type: 'text', text: '❷ 避開高溫＆公共浴池', size: 'sm', weight: 'bold', color: '#4a423d' },
              { type: 'text', text: '2 日內不要洗高溫的熱水，也避免大量流汗的活動！\n3-5 天不要去游泳池、海邊、溫泉等地方，避免毛孔刺激敏感。', size: 'sm', color: '#7a726d', wrap: true },
            ],
          },
          {
            type: 'box', layout: 'vertical', spacing: 'sm',
            contents: [
              { type: 'text', text: '❸ 記得去角質', size: 'sm', weight: 'bold', color: '#4a423d' },
              { type: 'text', text: '除毛後讓肌膚休息 3-5 天後，就可以使用溫和的去角質產品，來避免毛囊炎的情況', size: 'sm', color: '#7a726d', wrap: true },
            ],
          },
          {
            type: 'box', layout: 'vertical', spacing: 'sm',
            contents: [
              { type: 'text', text: '❹ 記得要保養 🧴', size: 'sm', weight: 'bold', color: '#4a423d' },
              { type: 'text', text: '使用溫和單純成分的清爽乳液，可以幫助肌膚舒緩，喝飽水的皮膚還會水嫩透亮噢！\n一個禮拜內避開美白產品', size: 'sm', color: '#7a726d', wrap: true },
            ],
          },
        ],
      },
    },
  };
}

/** 感謝回饋訊息（推給客人，預約結束後 1 小時） */
export function buildFeedbackMessage(name: string, googleReviewUrl?: string): object {
  const bodyContents: object[] = [
    { type: 'text', text: `謝謝${name}今天的來訪 💛`, size: 'sm', weight: 'bold', color: '#4a423d' },
    { type: 'text', text: '如果妳喜歡今天的服務，也歡迎告訴我妳的感受，或幫我們分享給身邊的朋友 ✨\n每一份回饋與分享，都是讓我們有更好的動力 💛', size: 'sm', color: '#7a726d', wrap: true, margin: 'md' },
  ];

  const footerContents: object[] = [];
  if (googleReviewUrl) {
    footerContents.push({
      type: 'button',
      style: 'primary',
      color: '#655b55',
      height: 'sm',
      action: { type: 'uri', label: '⭐ 留下 Google 評論', uri: googleReviewUrl },
    });
  }

  const bubble: Record<string, unknown> = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: '#655b55', paddingAll: '20px',
      contents: [
        { type: 'text', text: 'SHANSHAN.STUDIO', color: '#ffffff80', size: 'xxs', weight: 'bold' },
        { type: 'text', text: '感謝您的來訪', color: '#ffffff', size: 'xl', weight: 'bold', margin: 'md' },
      ],
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: '20px', spacing: 'md',
      contents: bodyContents,
    },
  };
  if (footerContents.length > 0) {
    bubble.footer = {
      type: 'box', layout: 'vertical', paddingAll: '16px',
      contents: footerContents,
    };
  }

  return { type: 'flex', altText: '感謝您的來訪', contents: bubble };
}

