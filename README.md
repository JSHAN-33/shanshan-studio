# SHANSHAN.STUDIO

LINE LIFF 預約系統 — Vue 3 前端 + Fastify 後端 + PostgreSQL。

## 專案結構

```
shanshan-studio/
├── docker-compose.yml    # PostgreSQL 16
├── backend/              # Fastify + Prisma + TypeScript
└── frontend/             # Vue 3 + Vite + Tailwind + TypeScript
```

## 環境需求

- Node.js ≥ 20 LTS
- Docker + Docker Compose
- npm（或 pnpm / yarn）

## 快速開始

### 1. 啟動 PostgreSQL

```bash
docker compose up -d
```

等 container 進入 `healthy` 狀態即可繼續。

### 2. 後端

```bash
cd backend
cp .env.example .env           # 視需要調整 ADMIN_TOKEN 等
npm install
npx prisma migrate dev --name init
npx prisma db seed             # 匯入示範服務項目 + 預設時段
npm run dev                    # Fastify on http://localhost:3000
```

驗證：

```bash
curl http://localhost:3000/api/services
```

應該會回傳 10 筆示範服務項目。

### 3. 前端

另開一個終端機：

```bash
cd frontend
cp .env.example .env           # VITE_LIFF_ID 可先留空
npm install
npm run dev                    # Vite on http://localhost:5173
```

瀏覽器打開 <http://localhost:5173/> 即可看到登入頁（LIFF_ID 為空時會降級成手動填單模式）。

## 後台管理入口

後台入口是隱藏的：在任意頁面底部導覽列，**連續點擊中央 logo 5 下**，會跳出 admin 密碼提示框。密碼即 `backend/.env` 裡的 `ADMIN_TOKEN`（預設 `change-me`，請改）。

進入後可使用 5 個管理分頁：

1. **預約管理** — 月曆、今日統計、狀態切換、新增／編輯預約
2. **會員管理** — 搜尋、儲值金調整
3. **結帳記錄** — 待結帳清單、付款方式、本月營收
4. **財務統計** — 今日／本月 KPI、成本記帳本
5. **庫存管理** — 品項 CRUD、不足警示

## LINE 整合

本地開發時 LINE 相關功能會自動降級：

| 服務 | 無憑證時行為 |
|------|--------------|
| `useLiff` composable | 跳過 LIFF 初始化，頁面走手動填單模式 |
| `lineNotifyService` | 印 `[LINE stub]` 到後端 console，不實際呼叫 LINE API |

要啟用正式整合，請填入以下環境變數並重啟：

`backend/.env`:
```env
LINE_CHANNEL_ACCESS_TOKEN=<你的 Channel Access Token>
LINE_CHANNEL_SECRET=<你的 Channel Secret>
LINE_OA_ID=@yourOaId
```

`frontend/.env`:
```env
VITE_LIFF_ID=<你的 LIFF ID>
```

## API 速覽

全部路由掛在 `/api` 底下：

| 分類 | 路由 |
|------|------|
| 預約 | `GET/POST/PATCH/DELETE /bookings`, `GET /bookings/available-slots` |
| 會員 | `GET /members`, `GET /members/:phone`, `POST /members`, `PATCH /members/:phone/wallet` |
| 服務 | `GET/POST /services`, `PATCH/DELETE /services/:id` |
| 時段 | `GET/PUT /slots/config`, `GET/POST/DELETE /slots/blocked` |
| 成本 | `GET/POST /costs`, `DELETE /costs/:id` |
| 財務 | `GET /finance/summary` |
| 庫存 | `GET/POST /inventory`, `PATCH/DELETE /inventory/:id` |

後台路由透過 `X-Admin-Token` header 驗證。

## 常見問題

**Q: `prisma migrate dev` 卡住？**
A: 確認 `docker compose ps` 看 db 是否 healthy；`DATABASE_URL` 是否與 docker-compose.yml 一致。

**Q: 前端連不到後端？**
A: 檢查 `frontend/.env` 的 `VITE_API_BASE_URL`；後端的 CORS 預設放行 `http://localhost:5173`。

**Q: 如何重置 DB？**
A: `docker compose down -v && docker compose up -d && cd backend && npx prisma migrate reset`。
