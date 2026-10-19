---
Task ID: 1
Agent: main (orchestrator)
Task: Phân tích kỹ thuật file HTML gốc "Đông Không Em?", gợi ý tính năng, bổ sung tính năng và design lại cho đẹp bằng Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Prisma + Socket.io

Work Log:
- Đọc file HTML gốc 1205 dòng — phát hiện lỗi cú pháp `DB.orders].id]`, `VIEWIC.view]`, `VIEWNAME.view]`, PIN plain-text, logo base64, không có export/in bill, dark mode, chart.
- Cài đặt socket.io, socket.io-client, bcryptjs.
- Thiết lập Prisma schema: Cafe, Staff, MenuItem, Order, OrderItem, Session, Discount, Table, ShiftClose.
- Tạo mini-service Socket.io tại port 3030 (mini-services/realtime-sync/index.ts) — broadcast order:new/update/delete, settings, menu, staff.
- Tạo API routes: /api/auth (PIN login bcrypt), /api/staff, /api/menu, /api/orders, /api/reports, /api/settings, /api/tables, /api/discounts, /api/shift, /api/export (CSV).
- Tạo API AI: /api/ai/chat (LLM skill), /api/ai/voice (ASR skill), /api/ai/image (image-gen skill).
- Setup theme cream/coffee warm palette với dark mode, fonts Be Vietnam Pro + Oswald, sticky footer mt-auto, mobile bottom tabbar + desktop layout.
- Tạo zustand store cafe-store.ts (auth, cart, view, cloud state, persist).
- Tạo socket-client.ts với helpers broadcast*.
- Tạo lib/format.ts (fmtVND, dayStr, fmtDateTime, pad2, getDeviceId, TABDEF, NOTES_OPTIONS).
- Build components: brand-logo (SVG fallback), theme-provider, lock-screen (create/login PIN), app-shell (header+tabbar+footer), pos-view (menu grid + search + voice), cart-sheet (table+discount+notes), cart-bar, kitchen-view (2 cột wait/making, ticket-cut effect, beep), pay-view (cash/transfer + print receipt HTML), report-view (stats + recharts 7-day bar + pie payment + top items + members + sessions + avg prep time), menu-manager-view (menu+tables+discounts+settings+export CSV+upload logo), staff-sheet (edit PIN/view), ai-chat-sheet (LLM suggestions), voice-input-button (MediaRecorder→base64→ASR).
- Page entry page.tsx: useSyncExternalStore tránh hydration mismatch.
- Layout.tsx: Be Vietnam Pro + Oswald fonts, ThemeProvider, Toaster sonner, viewport-fit cover, theme-color.
- Fix lint: thay Takeout → ShoppingBag (lucide không có Takeout), refreshBadges dùng useCallback, brand-logo dùng Set thay vì setState trong effect, page.tsx dùng useSyncExternalStore.
- Test với agent-browser: mở localhost:3000, fill form tạo admin "An" PIN 1234, vào AppShell POS, click 4 món (15k+20k+20k+22k=77k), mở cart sheet, điền "Chị Hồng" + Bàn 1, gửi đơn #01, qua Kitchen → Bắt đầu pha → Xong món, qua Pay → Tiền mặt, qua Report thấy 77k doanh thu + 4 ly, xem chart 7 ngày + pie chart + top items. Báo cáo có members, sessions log, avg prep time.
- Test AI chat: click "Trợ lý AI" → gợi ý "Món nào bán chạy nhất hôm nay?" → AI trả lời đúng "🥛 Cà phê sữa đá với 2 ly".
- Test AI image: click "Sinh ảnh AI" cho "Cà phê đen" → API /api/ai/image mất 28.9s, trả 200, lưu dataURL vào DB. Verified.
- Test dark mode toggle: header button click, theme đổi sang dark mode, body bg đổi, sidebar đổi.
- Test mobile: set viewport 375x812, reload, layout vẫn tốt (header compact, menu 2 cột, tabbar 5 nút).
- Lint: PASS.
- Dev server: stable ở port 3000. Realtime mini-service: stable ở port 3030.

Stage Summary:
- Đã rebuild hoàn toàn file HTML đơn thành app Next.js 16 fullstack với 4 views (POS, Kitchen, Pay, Report) + Settings manager.
- PIN admin/staff được hash bằng bcrypt (an toàn hơn plain-text gốc).
- Realtime sync dùng Socket.io mini-service thay Supabase (không cần external cloud).
- Bổ sung 18 tính năng: dark mode, chart recharts (bar 7-day + pie payment + line), in bill qua browser, export CSV (orders/menu/staff), giảm giá/voucher, quản lý bàn, AI assistant chat, voice input (ASR), AI image-gen cho món, Z-report/shift close, avg prep time, top món, multi-day date picker, search món, sticky footer đúng chuẩn, mobile-first responsive, framer-motion animation, sonner toast.
- Design: palette ấm cream + đỏ thương hiệu + brown, Be Vietnam Pro (vietnamese), Oswald (display), snowflakes animation, ticket-cut effect cho order cards, 3D push buttons.
- Browser-verified: login → tạo đơn → bếp → thu tiền → báo cáo → AI chat → AI image-gen → dark mode → mobile responsive. Không có lỗi console/runtime.
