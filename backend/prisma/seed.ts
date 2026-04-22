import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const services = [
  // 睫毛管理
  { id: 'e-top', name: '上睫毛', nameEn: 'Top Eyelash', cat: 'eyelash', price: 1200, duration: 90, sortOrder: 10 },
  { id: 'e-bottom', name: '下睫毛', nameEn: 'Bottom Eyelash', cat: 'eyelash', price: 600, duration: 30, sortOrder: 11 },
  // 女生除毛 — 優惠組合
  { id: 'w-combo-1', name: '腋下 X 私密肌除毛', nameEn: 'Underarm + Brazilian', cat: 'women', price: 2000, duration: 60, note: '腋下＋私密肌全除', isCombo: true, sortOrder: 1 },
  { id: 'w-combo-2', name: '告別毛手毛腳', nameEn: 'Full Arms + Full Legs', cat: 'women', price: 3000, duration: 60, note: '全手＋全腿', isCombo: true, sortOrder: 2 },
  // 女生除毛 — 單次
  { id: 'w-nose', name: '鼻毛', nameEn: 'Nose', cat: 'women', price: 300, duration: 5, sortOrder: 10 },
  { id: 'w-mustache', name: '小鬍鬚', nameEn: 'Mustache', cat: 'women', price: 400, duration: 5, sortOrder: 11 },
  { id: 'w-underarm', name: '腋下', nameEn: 'Underarm', cat: 'women', price: 600, duration: 30, sortOrder: 12 },
  { id: 'w-eyebrow', name: '眉毛', nameEn: 'Eyebrow', cat: 'women', price: 800, duration: 15, sortOrder: 13 },
  { id: 'w-upper-arm', name: '上手臂', nameEn: 'Upper Arm', cat: 'women', price: 800, duration: 30, sortOrder: 20 },
  { id: 'w-forearm', name: '下手臂', nameEn: 'Forearm', cat: 'women', price: 800, duration: 30, sortOrder: 21 },
  { id: 'w-full-arms', name: '全手', nameEn: 'Full Arms', cat: 'women', price: 1500, duration: 30, note: '送手指除毛', sortOrder: 22 },
  { id: 'w-calf', name: '小腿', nameEn: 'Calf', cat: 'women', price: 900, duration: 30, sortOrder: 30 },
  { id: 'w-thigh', name: '大腿', nameEn: 'Thigh', cat: 'women', price: 1200, duration: 30, sortOrder: 31 },
  { id: 'w-full-legs', name: '全腿', nameEn: 'Full Legs', cat: 'women', price: 2000, duration: 45, note: '送腳指除毛', sortOrder: 32 },
  { id: 'w-bikini', name: '比基尼線', nameEn: 'Bikini', cat: 'women', price: 1200, duration: 45, note: '部分V.I.O', sortOrder: 40 },
  { id: 'w-french', name: '法式除毛', nameEn: 'French', cat: 'women', price: 1600, duration: 60, note: '保留V全除I.O', sortOrder: 41 },
  { id: 'w-brazilian', name: '私密肌全除', nameEn: 'Brazilian', cat: 'women', price: 1800, duration: 60, note: '全除V.I.O', sortOrder: 42 },
  { id: 'w-facial', name: '煥白明亮護理軟糖膜', nameEn: 'Brightening Facial Treatment', cat: 'women', price: 400, note: '熱蠟後必敷', sortOrder: 50 },
  // 男士除毛
  { id: 'm-nose', name: '鼻毛', nameEn: 'Nose', cat: 'men', price: 300, duration: 10, sortOrder: 10 },
  { id: 'm-eyebrow', name: '眉毛', nameEn: 'Eyebrow', cat: 'men', price: 1000, duration: 30, sortOrder: 11 },
  { id: 'm-underarm', name: '腋下', nameEn: 'Underarm', cat: 'men', price: 1000, duration: 30, sortOrder: 12 },
  { id: 'm-facial-hair', name: '鬍子', nameEn: 'Facial Hair', cat: 'men', price: 1500, duration: 60, sortOrder: 13 },
  { id: 'm-chest', name: '胸部', nameEn: 'Chest', cat: 'men', price: 1300, duration: 30, sortOrder: 20 },
  { id: 'm-abdomen', name: '腹部', nameEn: 'Abdomen', cat: 'men', price: 1300, duration: 30, sortOrder: 21 },
  { id: 'm-upper-arm', name: '上手臂', nameEn: 'Upper Arm', cat: 'men', price: 1200, duration: 30, sortOrder: 30 },
  { id: 'm-forearm', name: '下手臂', nameEn: 'Forearm', cat: 'men', price: 1200, duration: 30, sortOrder: 31 },
  { id: 'm-full-arms', name: '全手', nameEn: 'Full Arms', cat: 'men', price: 2400, duration: 60, sortOrder: 32 },
  { id: 'm-calf', name: '小腿', nameEn: 'Calf', cat: 'men', price: 1400, duration: 60, sortOrder: 40 },
  { id: 'm-thigh', name: '大腿', nameEn: 'Thigh', cat: 'men', price: 2000, duration: 30, sortOrder: 41 },
  { id: 'm-full-legs', name: '全腿', nameEn: 'Full Legs', cat: 'men', price: 3400, duration: 60, sortOrder: 42 },
  { id: 'm-facial', name: '煥白明亮護理軟糖膜', nameEn: 'Brightening Facial Treatment', cat: 'men', price: 400, note: '熱蠟後必敷', sortOrder: 50 },
  // 產品
  { id: 'p-bs-serum', name: 'BS睫毛精華', nameEn: 'MHH Awesome', cat: 'products', price: 680, sortOrder: 10 },
  { id: 'p-rica-opuntia', name: 'RICA仙女油', nameEn: 'Opuntia Oil Treatment', cat: 'products', price: 2000, sortOrder: 11 },
  { id: 'p-rica-scrub', name: 'RICA火山石角質霜', nameEn: 'Detoxifying Comfort Scrub', cat: 'products', price: 1200, sortOrder: 12 },
  { id: 'p-rica-argan', name: 'RICA堅果保濕乳液', nameEn: 'Argan Oil After Wax Emulsion', cat: 'products', price: 1800, sortOrder: 13 },
  { id: 'p-rica-avocado', name: 'RICA酪梨奶油卸毛精華', nameEn: 'Avocado After Wax Serum', cat: 'products', price: 1700, sortOrder: 14 },
  { id: 'p-rica-rose', name: 'RICA玫瑰精華噴霧', nameEn: 'Rose After Wax Lotion', cat: 'products', price: 1680, sortOrder: 15 },
];

const defaultSlots = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'];

async function main() {
  console.log('[seed] upserting services…');
  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: s,
      create: s,
    });
  }

  console.log('[seed] ensuring default SlotConfig…');
  const existing = await prisma.slotConfig.findFirst();
  if (!existing) {
    await prisma.slotConfig.create({ data: { slots: defaultSlots } });
  }

  console.log('[seed] done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
