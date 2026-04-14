import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const services = [
  // 女生除毛
  { id: 'w-bikini', name: '比基尼線', nameEn: 'Bikini Line', cat: 'women', price: 800, duration: 30, sortOrder: 10 },
  { id: 'w-bikini-full', name: '巴西式（全除）', nameEn: 'Brazilian', cat: 'women', price: 1500, oldPrice: 1800, duration: 45, sortOrder: 20 },
  { id: 'w-underarm', name: '腋下', nameEn: 'Underarm', cat: 'women', price: 400, duration: 20, sortOrder: 30 },
  { id: 'w-legs', name: '全腿', nameEn: 'Full Legs', cat: 'women', price: 1200, duration: 40, sortOrder: 40 },
  { id: 'w-half-legs', name: '半腿', nameEn: 'Half Legs', cat: 'women', price: 700, duration: 25, sortOrder: 50 },
  { id: 'w-arms', name: '全手臂', nameEn: 'Full Arms', cat: 'women', price: 900, duration: 30, sortOrder: 60 },
  // 男士除毛
  { id: 'm-back', name: '男士背部', nameEn: 'Men Back', cat: 'men', price: 1500, duration: 40, sortOrder: 10 },
  { id: 'm-chest', name: '男士胸部', nameEn: 'Men Chest', cat: 'men', price: 1200, duration: 35, sortOrder: 20 },
  { id: 'm-beard', name: '男士鬍鬚線條', nameEn: 'Beard Line', cat: 'men', price: 600, duration: 20, sortOrder: 30 },
  // 產品
  { id: 'p-aftercare', name: '術後修護乳', nameEn: 'Aftercare Lotion', cat: 'products', price: 680, sortOrder: 10, note: '50ml' },
  { id: 'p-soothing', name: '鎮靜舒緩凝膠', nameEn: 'Soothing Gel', cat: 'products', price: 580, sortOrder: 20, note: '30ml' },
];

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
  const defaultSlots = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
  if (!existing) {
    await prisma.slotConfig.create({ data: { slots: defaultSlots } });
  }

  console.log('[seed] seeding sample inventory…');
  const inv = [
    { name: '不織布床單', qty: 120, unit: '張', minQty: 30 },
    { name: '拋棄式內褲', qty: 80, unit: '件', minQty: 20 },
    { name: '鎮靜凝膠', qty: 5, unit: '瓶', minQty: 3 },
  ];
  for (const i of inv) {
    const exists = await prisma.inventory.findFirst({ where: { name: i.name } });
    if (!exists) await prisma.inventory.create({ data: i });
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
