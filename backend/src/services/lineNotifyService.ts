import { messagingApi } from '@line/bot-sdk';

const { MessagingApiClient } = messagingApi;

let client: InstanceType<typeof MessagingApiClient> | null = null;

function getClient() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
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
  const c = getClient();
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
export async function pushToOa(text: string): Promise<void> {
  const ownerUserId = process.env.LINE_OWNER_USER_ID;
  if (!getClient() || !ownerUserId) {
    console.log(`[LINE stub] pushToOa: ${text}`);
    return;
  }
  await pushToUser(ownerUserId, text);
}

export function buildNewBookingMessage(booking: {
  name: string;
  phone: string;
  date: string;
  time: string;
  items: string;
  total: number;
}): string {
  return [
    '📥 新預約通知',
    `姓名：${booking.name}`,
    `電話：${booking.phone}`,
    `日期：${booking.date} ${booking.time}`,
    `項目：${booking.items}`,
    `金額：$${booking.total}`,
  ].join('\n');
}

export function buildBookingConfirmedMessage(booking: { date: string; time: string }): string {
  return `✅ 您的預約已確認：${booking.date} ${booking.time}，期待您的光臨！`;
}

export function buildBookingCancelledMessage(booking: { date: string; time: string }): string {
  return `❌ 您的預約已取消：${booking.date} ${booking.time}。如需重新預約歡迎再次聯繫～`;
}

export function buildBookingReminderMessage(booking: { date: string; time: string }): string {
  return `⏰ 明日預約提醒：${booking.date} ${booking.time}，別忘了喔！`;
}

/**
 * 建構預約成功 Flex Message 卡片
 */
export function buildBookingFlexMessage(booking: {
  name: string;
  date: string;
  time: string;
  items: string;
  total: number;
}): object {
  return {
    type: 'flex',
    altText: `預約成功 - ${booking.date} ${booking.time}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#655b55',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: 'SHANSHAN.STUDIO',
            color: '#ffffff',
            size: 'xs',
            weight: 'bold',
          },
          {
            type: 'text',
            text: '預約成功',
            color: '#ffffff',
            size: 'xl',
            weight: 'bold',
            margin: 'md',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '姓名', size: 'sm', color: '#b0aba7', flex: 2 },
              { type: 'text', text: booking.name, size: 'sm', weight: 'bold', color: '#4a423d', flex: 3, align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '日期', size: 'sm', color: '#b0aba7', flex: 2 },
              { type: 'text', text: booking.date, size: 'sm', weight: 'bold', color: '#4a423d', flex: 3, align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '時段', size: 'sm', color: '#b0aba7', flex: 2 },
              { type: 'text', text: booking.time, size: 'sm', weight: 'bold', color: '#4a423d', flex: 3, align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '項目', size: 'sm', color: '#b0aba7', flex: 2 },
              { type: 'text', text: booking.items, size: 'sm', weight: 'bold', color: '#4a423d', flex: 3, align: 'end', wrap: true },
            ],
          },
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'lg',
            contents: [
              { type: 'text', text: '合計', size: 'md', weight: 'bold', color: '#655b55', flex: 2 },
              { type: 'text', text: `NT$ ${booking.total}`, size: 'md', weight: 'bold', color: '#655b55', flex: 3, align: 'end' },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '如需異動請透過 LINE 私訊小編',
            size: 'xxs',
            color: '#b0aba7',
            align: 'center',
          },
        ],
      },
    },
  };
}
