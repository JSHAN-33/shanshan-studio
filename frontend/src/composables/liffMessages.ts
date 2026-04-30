import liff from '@line/liff';

/** 通用 Flex 卡片 builder（與後端 flexCard 結構一致） */
function flexCard(opts: {
  headerTitle: string;
  headerSub?: string;
  rows: Array<{ label: string; value: string }>;
  totalLabel?: string;
  totalValue?: string;
}) {
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

  return {
    type: 'flex' as const,
    altText: opts.headerTitle,
    contents: {
      type: 'bubble' as const,
      size: 'kilo' as const,
      header: {
        type: 'box' as const, layout: 'vertical' as const, backgroundColor: '#655b55', paddingAll: '20px',
        contents: headerContents,
      },
      body: {
        type: 'box' as const, layout: 'vertical' as const, paddingAll: '20px', spacing: 'md',
        contents: bodyContents,
      },
    },
  };
}

/** 新預約通知 Flex（客人 → OA 聊天室） */
export function buildNewBookingFlex(booking: {
  name: string;
  phone: string;
  date: string;
  time: string;
  items: string;
  total: number;
}) {
  return flexCard({
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

/** 新會員註冊 Flex（客人 → OA 聊天室） */
export function buildNewMemberFlex(member: {
  name: string;
  phone: string;
  gender: string;
  bday?: string | null;
}) {
  const rows = [
    { label: '姓名', value: member.name },
    { label: '電話', value: member.phone },
    { label: '性別', value: member.gender || '未填' },
  ];
  if (member.bday) rows.push({ label: '生日', value: member.bday });

  return flexCard({
    headerTitle: '新會員註冊',
    headerSub: '歡迎新朋友加入 ✨',
    rows,
  });
}

/**
 * 透過 liff.sendMessages() 發送 Flex 卡片到 OA 聊天室。
 * 訊息會顯示在左邊（客人發的），店家在 OA Manager 看到。
 * 僅在 LIFF 環境內有效，失敗時靜默降級。
 */
export async function sendFlexToChat(message: ReturnType<typeof flexCard>): Promise<void> {
  try {
    if (!liff.isInClient()) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await liff.sendMessages([message as any]);
  } catch (err) {
    console.warn('[liffMessages] sendMessages failed (降級為後端推播)', err);
  }
}

/**
 * 註冊後同時發送 Flex 卡片 + 手機號碼到 OA 聊天室。
 * 手機號碼會觸發 webhook 自動綁定 lineOaUserId，
 * 讓推播功能不需要客人額外操作就能啟用。
 */
export async function sendFlexAndLinkPhone(message: ReturnType<typeof flexCard>, phone: string): Promise<void> {
  try {
    if (!liff.isInClient()) return;
    await liff.sendMessages([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      message as any,
      { type: 'text' as const, text: phone },
    ]);
  } catch (err) {
    console.warn('[liffMessages] sendMessages+link failed (降級為後端推播)', err);
  }
}
