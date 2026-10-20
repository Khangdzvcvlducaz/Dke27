# Đông Không Em? — Quản lý quán cà phê

Hệ thống quản lý đơn hàng, bếp, thu tiền và báo cáo cho quán cà phê.

## Tính năng

- **POS (Tạo đơn)**: menu grid, giỏ hàng, nhập đơn bằng giọng nói (ASR), quản lý bàn, mã giảm giá
- **Quầy pha (Kitchen)**: real-time order cards, âm thanh "Ho Ho Ho", rung liên tục, quy tắc 1-đơn-một-lúc
- **Thu tiền (Pay)**: âm thanh "Cha-Ching", QR banking dialog, in bill, xuất CSV
- **Báo cáo**: biểu đồ doanh thu 7 ngày, top món, thành viên, lịch sử, đóng ca (Z-report)
- **Cài đặt**: logo upload, QR upload, quản lý menu, bàn, mã giảm giá
- **AI**: trợ lý chat (LLM), nhập đơn giọng nói (ASR), sinh ảnh món (image-gen)
- **PWA**: manifest, service worker, icons, offline-ready
- **Web Push**: VAPID, tự động bật khi đăng nhập, push cho kitchen (Ho Ho Ho) + pay (Cha-Ching)
- **Realtime**: Socket.io mini-service, server-side broadcast, polling fallback
- **Dark mode**, framer-motion animations, responsive mobile-first

## Yêu cầu hệ thống

- Node.js 18+ hoặc Bun
- SQLite (đã có sẵn — không cần cài đặt database server)

## Cài đặt

### 1. Clone repo

```bash
git clone https://github.com/Khangdzvcvlducaz/Dke27.git
cd Dke27
```

### 2. Cài đặt dependencies

```bash
bun install
```

### 3. Tạo file .env

```bash
cp .env.example .env
```

Sinh VAPID keys mới (cho Web Push):
```bash
npx web-push generate-vapid-keys
```
Cập nhật `VAPID_PUBLIC_KEY` và `VAPID_PRIVATE_KEY` trong `.env`.

### 4. Khởi tạo database

```bash
bun run db:push
```

### 5. Chạy ứng dụng

Mở 2 terminal:

**Terminal 1 — Next.js app (port 3000):**
```bash
bun run dev
```

**Terminal 2 — Realtime mini-service (port 3030):**
```bash
cd mini-services/realtime-sync
bun install
bun run dev
```

### 6. Mở trình duyệt

Vào `http://localhost:3000`

## Tài khoản mặc định

Lần đầu chạy, bạn sẽ thấy màn hình tạo nhóm:
- **Tên quán**: Đông Không Em?
- **Tên Admin**: An (hoặc tên bạn)
- **PIN Admin**: 4 chữ số (VD: 1234)

Sau khi tạo, đăng nhập với:
- **Admin**: tên An + PIN 1234
- **Nhân viên**: do Admin tạo trong mục Báo cáo → Thành viên

## Cấu trúc thư mục

```
├── prisma/
│   └── schema.prisma          # Database schema (8 models)
├── public/
│   ├── sw.js                   # Service Worker (push + click handler)
│   ├── manifest.json           # PWA manifest
│   ├── notif.mp3               # Ho Ho Ho sound (kitchen)
│   └── pay-notif.mp3           # Cha-Ching sound (pay)
├── mini-services/
│   └── realtime-sync/          # Socket.io server (port 3030)
│       ├── index.ts
│       └── package.json
├── src/
│   ├── app/
│   │   ├── api/                # API routes (auth, orders, push, staff, etc.)
│   │   ├── layout.tsx          # Root layout (fonts, theme, SW register)
│   │   ├── page.tsx            # Entry point (LockScreen ↔ AppShell)
│   │   └── globals.css         # Coffee theme + dark mode
│   ├── components/
│   │   ├── views/              # POS, Kitchen, Pay, Report, MenuManager
│   │   ├── app-shell.tsx       # Header + tabbar + footer + Cha-Ching
│   │   ├── lock-screen.tsx     # Login + auto-enable push
│   │   ├── profile-sheet.tsx   # Notification settings + shift toggle
│   │   ├── qr-payment-sheet.tsx# QR banking dialog
│   │   ├── cart-sheet.tsx      # Order creation
│   │   ├── register-sw.tsx     # SW registration + sound playback
│   │   └── ...
│   ├── lib/
│   │   ├── push.ts             # Server-side push (sendNewOrderPush, sendDoneOrderPush)
│   │   ├── push-client.ts      # Client-side auto-enable push
│   │   ├── socket-client.ts    # Browser socket.io client
│   │   ├── socket-server-broadcast.ts # Server-side socket broadcast
│   │   └── format.ts           # VND formatting, dates, constants
│   └── store/
│       └── cafe-store.ts       # Zustand store (auth, cart, view)
└── .env.example                # Environment variables template
```

## Âm thanh thông báo

| Event | Âm thanh | Ai nghe |
|---|---|---|
| Đơn mới tạo | Ho Ho Ho (kitchen) + Cha-Ching (pay) | Kitchen + Pay staff |
| Bếp xong đơn | Cha-Ching | Pay staff (trên Pay view) |
| Push khi app đóng | Ho Ho Ho / Cha-Ching (iOS PWA) | Tất cả staff có subscription |

## Platform support

| Platform | Push (app đóng) | Push (app mở) | Vibration | Sound |
|---|---|---|---|---|
| iOS PWA (16.4+) | ✅ Cha-Ching | ✅ | ❌ (Apple) | ✅ loop 6s |
| Android Chrome | ⚠️ system ting | ✅ Cha-Ching | ✅ liên tục | ✅ |
| Desktop Chrome | ⚠️ system ting | ✅ Cha-Ching | ❌ | ✅ |

## License

Private — Đông Không Em? Coffee & Singing ☕🎶
