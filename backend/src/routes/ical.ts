import type { FastifyInstance } from 'fastify';

function escapeIcal(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcalDate(date: string, time: string): string {
  // date: "2026-04-29", time: "18:30" → "20260429T183000"
  return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
}

export async function icalRoutes(app: FastifyInstance) {
  // GET /cal/feed.ics?token=xxx
  app.get('/feed.ics', async (req, reply) => {
    const { token } = req.query as { token?: string };
    const expected = process.env.ICAL_TOKEN || process.env.ADMIN_TOKEN;
    if (!expected || token !== expected) {
      return reply.status(401).send('Unauthorized');
    }

    // 取得未取消的預約（未來 + 近 30 天已完成的）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    const bookings = await app.prisma.booking.findMany({
      where: {
        status: { not: '已取消' },
        date: { gte: cutoff },
      },
      orderBy: { date: 'asc' },
    });

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ShanShan Studio//Booking//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:ShanShan Studio 預約',
      'X-WR-TIMEZONE:Asia/Taipei',
    ];

    for (const b of bookings) {
      const dtStart = toIcalDate(b.date, b.time);
      // 用 duration 計算結束時間，預設 60 分鐘
      const durMin = b.duration ?? 60;
      const startDate = new Date(`${b.date}T${b.time}:00+08:00`);
      const endDate = new Date(startDate.getTime() + durMin * 60000);
      const dtEnd = toIcalDate(
        endDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }),
        endDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' }),
      );

      const summary = `${b.name} · ${b.items}`;
      const description = [
        `客戶：${b.name}`,
        `電話：${b.phone}`,
        `項目：${b.items}`,
        `金額：NT$ ${b.total}`,
        `狀態：${b.status}`,
        b.remarks ? `備註：${b.remarks}` : '',
      ].filter(Boolean).join('\\n');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${b.id}@shanshan-studio`);
      lines.push(`DTSTART;TZID=Asia/Taipei:${dtStart}`);
      lines.push(`DTEND;TZID=Asia/Taipei:${dtEnd}`);
      lines.push(`SUMMARY:${escapeIcal(summary)}`);
      lines.push(`DESCRIPTION:${escapeIcal(description)}`);
      lines.push(`STATUS:${b.status === '已完成' ? 'COMPLETED' : 'CONFIRMED'}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'inline; filename="shanshan-studio.ics"')
      .send(lines.join('\r\n'));
  });
}
