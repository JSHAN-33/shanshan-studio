import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';

interface LineEvent {
  type: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
  replyToken?: string;
}

interface LineWebhookBody {
  events: LineEvent[];
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64');
  return hash === signature;
}

async function replyMessage(replyToken: string, messages: object[]) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    });
  } catch (err) {
    console.error('[Webhook] Reply failed:', err);
  }
}

/** 正規化手機號碼：移除空白、橫線，+886 轉 0 開頭 */
function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-()]/g, '');
  if (p.startsWith('+886')) p = '0' + p.slice(4);
  return p;
}

export async function lineWebhookRoutes(app: FastifyInstance) {
  // LINE webhook needs raw body for signature verification
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    done(null, body);
  });

  app.post('/webhook', async (req, reply) => {
    const rawBody = req.body as string;
    const signature = req.headers['x-line-signature'] as string;
    const secret = process.env.LINE_CHANNEL_SECRET;

    if (secret && signature) {
      if (!verifySignature(rawBody, signature, secret)) {
        return reply.status(403).send({ error: 'Invalid signature' });
      }
    }

    const body: LineWebhookBody = JSON.parse(rawBody);

    for (const event of body.events) {
      const userId = event.source?.userId;
      if (!userId) continue;

      console.log(`[Webhook] Event: ${event.type} from ${userId}`);

      // ── follow 事件：歡迎 + 請輸入手機綁定 ──
      if (event.type === 'follow') {
        const alreadyLinked = await app.prisma.member.findFirst({ where: { lineOaUserId: userId } });
        if (alreadyLinked) {
          await replyMessage(event.replyToken!, [
            { type: 'text', text: `歡迎回來 ${alreadyLinked.name} ✨\n之後的預約通知會從這裡發送給您` },
          ]);
        } else {
          await replyMessage(event.replyToken!, [
            {
              type: 'text',
              text: '歡迎加入 SHANSHAN.STUDIO ✨\n\n請輸入您的手機號碼（例如 0912345678），即可啟用預約通知功能 📲',
            },
          ]);
        }
        continue;
      }

      // ── message 事件：僅處理手機號碼綁定，其他訊息不自動回覆（讓店家手動聊天）──
      if (event.type === 'message' && event.message?.type === 'text') {
        const text = (event.message.text ?? '').trim();

        // 已綁定 → 不處理，讓店家自己回覆
        const alreadyLinked = await app.prisma.member.findFirst({ where: { lineOaUserId: userId } });
        if (alreadyLinked) continue;

        // 支援「綁定 09xxxxxxxx」或直接輸入手機號碼
        const stripped = text.replace(/^綁定\s*/i, '');
        const phone = normalizePhone(stripped);
        const isPhone = /^09\d{8}$/.test(phone);
        if (!isPhone) continue;

        // 用手機號碼找會員
        const member = await app.prisma.member.findUnique({ where: { phone } });
        if (!member) {
          await replyMessage(event.replyToken!, [
            {
              type: 'text',
              text: '找不到此手機號碼的預約紀錄 🤔\n請先透過預約系統完成登入後再試一次',
            },
          ]);
          continue;
        }

        // 綁定成功
        await app.prisma.member.update({
          where: { id: member.id },
          data: { lineOaUserId: userId },
        });
        console.log(`[Webhook] Linked by phone: ${member.name} (${phone}) → ${userId}`);

        await replyMessage(event.replyToken!, [
          {
            type: 'text',
            text: `${member.name} 您好 ✨\n預約通知已啟用！之後所有預約相關訊息都會從這裡發送給您 💕`,
          },
        ]);
      }
    }

    return reply.status(200).send({ ok: true });
  });
}
