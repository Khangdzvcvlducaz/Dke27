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

---
Task ID: 2
Agent: main (orchestrator)
Task: Thêm Web Push notification feature cho website quán cà phê. Không redesign, giữ UI/routes/auth/logic hiện có, thêm như module mở rộng.

Work Log:
- Cài web-push package, sinh VAPID keys bằng `webpush.generateVAPIDKeys()`, ghi vào .env (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUBLIC_BASE_URL).
- Mở rộng prisma/schema.prisma:
  - Staff: thêm onShift Boolean, notifyEnabled Boolean, relations subscriptions + notifLogs
  - Order: thêm notifiedAt DateTime?, assignedTo String?, status enum mở rộng với 'notified'
  - Mới: PushSubscription (id, staffId, endpoint unique, p256dhKey, authKey, userAgent)
  - Mới: NotificationLog (orderId, staffId, staffName, event='sent|delivered|failed|accepted|dismissed|timeout', status int?, reason)
- Chạy bun run db:push — schema sync OK.
- Sinh icon PWA: public/icon-192.png, icon-512.png, apple-touch-icon.png, icon-maskable.png bằng sharp từ SVG brand coffee cup + "ĐKE".
- Tạo public/manifest.json: name, short_name, start_url="/?source=pwa", scope="/", display=standalone, theme_color=#b3202c, background_color=#f4ecdd, icons (192/512/maskable/180), shortcuts (pos/kitchen/pay).
- Tạo public/sw.js:
  - install/activate: skipWaiting + clients.claim
  - push event: parse payload, showNotification với vibrate=[300,150,300,150,300], silent=false, requireInteraction=true, actions=[accept, view], badge/icon
  - notificationclick: action 'accept' → POST /api/orders/accept, action 'view'/body click → focusOrOpenApp('?open=kitchen&order=ID')
  - pushsubscriptionchange: postMessage tới page để re-subscribe
  - message: SKIP_WAITING handler
- src/components/register-sw.tsx: useEffect register '/sw.js' scope '/', chỉ register khi secureContext (HTTPS/localhost), đợi load, lắng nghe message 'pushsubscriptionchange'.
- src/app/layout.tsx: thêm metadata.manifest, metadata.icons (icon + apple), appleWebApp (capable, title, statusBarStyle). Mount <RegisterSW /> tại root cùng Toaster.
- src/lib/push.ts:
  - ensureConfigured() đọc VAPID env, gọi webpush.setVapidDetails
  - getVapidPublicKey() trả public key
  - sendNewOrderPush(order): query eligible staff (view=kitchen, onShift=true, notifyEnabled=true) + include subscriptions; với mỗi sub: webpush.sendNotification với payload { title: "Đơn mới #125", body: "2 Peach Tea, 1 Milk Coffee — Table 4", tag, data: {orderId, staffId, staffName, targetView='kitchen'}, actions: [{accept:'✓ Nhận pha'},{view:'👀 Xem đơn'}] }; log sent/failed vào NotificationLog; với 404/410 tự xóa sub khỏi DB
  - sendTestPush(staffId, staffName): gửi payload test với vibrate pattern
  - urlBase64ToUint8Array cho applicationServerKey
- API routes mới:
  - GET /api/push/vapid — trả {publicKey} (safe to expose)
  - POST /api/push/subscribe — body {staffId, subscription{endpoint,keys{p256dh,auth}}}, upsert theo endpoint, set notifyEnabled=true
  - POST /api/push/unsubscribe — body {endpoint} OR {staffId}, xóa sub, set notifyEnabled=false nếu không còn sub
  - POST /api/push/test — body {staffId}, gọi sendTestPush, trả {sent, failed}
  - POST /api/staff/shift — body {staffId, onShift}, toggle onShift
  - GET /api/staff/on-shift — trả staff[] với {id,name,view,onShift,notifyEnabled,hasSubscription,subscriptionCount,lastLogin} + admin info. Không trả endpoint/keys (privacy)
  - POST /api/orders/accept — body {orderId, staffId, staffName}, idempotent — nếu đã 'making' trả alreadyAccepted=true; set status=making, assignedTo=staffName; log 'accepted'; broadcast socket order:update
  - POST /api/orders/assign — body {orderId, staffName} (admin manual fallback), set status=making, assignedTo, log 'accepted' reason='manual-assign', broadcast
- src/lib/socket-server-broadcast.ts: singleton socket.io-client kết nối tới mini-service realtime-sync ở localhost:3030 (REALTIME_URL env), emit order:new/update từ server-side (dùng cho /api/orders/accept+assign vì không có client socket ở đó).
- Sửa POST /api/orders (action=create): sau khi tạo order + update table, gọi sendNewOrderPush({id, code, customer, tableCode, type, items}), update order với status='notified', notifiedAt=now; bắt lỗi (không block order nếu push fail).
- Sửa SQLite compatibility: xóa `mode: 'insensitive'` (Postgres-only) trong /api/auth/route.ts và /api/staff/route.ts, thay bằng findMany + filter lowercase cho case-insensitive match.
- src/components/profile-sheet.tsx:
  - Hiển thị identity (👤/👑 name, role)
  - Section "Thông báo đơn mới": permBadge (Đã bật/Bị chặn/Không hỗ trợ/Chưa yêu cầu)
  - Khi 'denied': amber box hướng dẫn bật lại trên Chrome Android, Safari iOS, Chrome Desktop
  - Khi 'unsupported': muted box
  - Khi 'default': hint bấm nút
  - Khi 'granted': emerald box "Đã bật thông báo"
  - Button "Bật thông báo đơn mới": chỉ gọi Notification.requestPermission() SAU click; nếu granted → subscribe push + POST /api/push/subscribe
  - Khi đã có sub: 2 nút "Gửi thông báo thử" (POST /api/push/test) + "Gỡ thiết bị này" (unsubscribe + POST /api/push/unsubscribe)
  - Switch "Trên ca" toggle POST /api/staff/shift
  - Section "Cài app vào màn hình chính": phát hiện standalone mode + hướng dẫn iOS Safari (Share → Add to Home Screen) + Chrome/Edge Android + Chrome Desktop
  - Footer note về Web Push RFC 8030, Vibration API chỉ Android, iOS tôn trọng DND
- src/components/app-shell.tsx:
  - Thêm button "Hồ sơ & thông báo" (icon User) kế bên Lock button
  - useEffect deep link handler: đọc ?open={view}&order={id} từ URL, switchView; clean URL sau khi xử lý
  - render <ProfileSheet />
  - refreshBadges cập nhật: kitchen badge = new + notified count; pay badge = done count
- src/components/views/kitchen-view.tsx:
  - load(): fetch cả status=new và status=notified, merge (notified lên đầu)
  - onUpdate socket handler: status 'new' hoặc 'notified' đều vào wait column
  - doAction('start'): đổi sang gọi POST /api/orders/accept (đồng nhất với SW action), toast "Bắt đầu pha" hoặc "đã có người nhận" nếu alreadyAccepted
  - KitchenCard: isNotified = status==='notified', highlight bg-amber-50/50, Badge "🔔 Đã gửi thông báo"; late = (status==='new' || 'notified') && minsAgo>8; button label đổi từ "Bắt đầu pha" → "Nhận pha" nếu notified
- src/components/views/report-view.tsx:
  - Thêm component OnShiftStaffSection: load /api/staff/on-shift + /api/orders?status=notified mỗi 15s; card list staff với border màu theo trạng thái (emerald = onShift+hasSubscription, amber = onShift only, neutral = offShift); Switch toggle onShift cho từng staff; nếu có đơn notified chưa được nhận, hiện card amber "⚠ Đơn chưa được nhận (N)" với select "Giao cho..." chọn staff kitchen → POST /api/orders/assign
  - Thêm component UnacceptedAlert: load /api/orders?status=new + status=notified mỗi 10s; tính các đơn quá 2 phút (THRESHOLD_MIN configurable) → amber box "⚠ N đơn chưa được nhận quá 2 phút" + list 5 đơn đầu
  - Cả hai component render ngay sau Stats cards, chỉ cho admin
- src/lib/format.ts: STATUSNAME thêm 'notified': 'đã gửi thông báo'
- Lint: PASS (sau khi xóa 2 unused eslint-disable comments, dùng useCallback cho UnacceptedAlert.load, disable react-hooks/set-state-in-effect cho initial fetch pattern)
- Browser test (agent-browser):
  - Đăng nhập admin "An" PIN 1234 OK
  - Tạo staff "Bếp A" PIN 1111 view=kitchen qua report view OK
  - Đăng xuất, đăng nhập "Bếp A" → vào Kitchen view (role staff chỉ thấy 1 tab) OK
  - Mở Profile sheet: thấy "Thông báo đơn mới" section với permBadge "Chưa yêu cầu", nút "Bật thông báo đơn mới" + switch "Trên ca" + A2HS guidance
  - Click "Bật thông báo" trong headless → permission denied (correct, headless không grant) → UI chuyển sang "Bị chặn" + amber help box với 3 hướng dẫn (Chrome Android, Safari iOS, Chrome Desktop) → button disabled (đúng, không re-request được)
  - Backend test (curl): tạo order qua POST /api/orders → response có status='notified', notifiedAt set; NotificationLog có entry 'failed' với reason 'The subscription p256dh value should be 65 bytes long.' (vì test sub key giả, nhưng flow push đã chạy đúng)
  - POST /api/orders/assign (admin manual fallback) → status='making', assignedTo='Bếp A' OK
  - POST /api/orders/accept (SW click path) → status='making', assignedTo='Bếp A', log 'accepted' OK
  - NotificationLog cuối: #03 có 2 entries — [02:21:15] failed (push attempt) + [02:21:15] accepted (SW click). Audit trail đầy đủ.
  - PWA assets verify: GET /sw.js 200, /manifest.json 200, /icon-192.png 200, /api/push/vapid 200 với publicKey đúng.

Stage Summary:
- Đã thêm đầy đủ Web Push feature như spec: staff notification settings với explicit enable button (không auto-request), push subscription backend lưu per-staff (không lộ keys ra UI), new drink order flow gửi push cho on-shift kitchen staff với title/body concise, click notification → focus/open app tới kitchen view, 'notified' state tách biệt với 'accepted', vibration pattern [300,150,300,150,300] + silent=false, staff shift toggle + manager view on-shift status, fallback manual assign + 2-min alert, PWA manifest+icons+SW register từ root, auth required cho subscribe/test, NotificationLog audit không log payload, staff có thể remove device.
- Toàn bộ UI/routing/auth/logic/design cũ giữ nguyên — chỉ thêm nút User ở header + 2 components mới trong report view + 1 sheet mới. Sticky footer, mobile responsive, design system (cream/red, Be Vietnam Pro/Oswald, shadcn/ui, framer-motion) đều không đổi.
- Production note: thay VAPID keys trong .env bằng keys của user. Web Push yêu cầu HTTPS (Caddy gateway đã lo). iOS 16.4+ cần PWA installed. Android Chrome works as-is.

---
Task ID: 3
Agent: main (orchestrator)
Task: Chèn file âm thanh "Ho Ho Ho Merry Christmas Sound Effect.mp3" cho thông báo + kitchen rung liên tục khi có đơn chờ nhận + quy tắc mỗi nhân viên chỉ pha 1 đơn 1 lúc (không pha 2 đơn cùng lúc).

Work Log:
- Copy /home/z/my-project/upload/Ho Ho Ho Merry Christmas Sound Effect.mp3 → /home/z/my-project/public/notif.mp3 (157KB, serve qua Next.js static).
- Cập nhật public/sw.js: thêm `sound: '/notif.mp3'` vào showNotification options (best-effort — Chrome bỏ qua field này, Safari/iOS PWA có thể honor; system default sound vẫn phát cho background push).
- Cập nhật src/lib/push.ts: thêm `sound: '/notif.mp3'`, `vibrate: [300,150,300,150,300]`, `silent: false`, `requireInteraction: true` vào payload gửi tới SW.
- Cập nhật src/app/api/orders/accept/route.ts: thêm check 1-order-at-a-time — trước khi set status=making, query `findFirst({ where: { status: 'making', assignedTo: staffName } })`; nếu đã có đơn khác đang pha, trả 409 với `{ error, inProgressOrderId, inProgressCode }`. Backend đảm bảo rule không phụ thuộc client.
- Cập nhật src/app/api/orders/assign/route.ts: cũng thêm check tương tự cho admin manual-assign — nếu staff đã đang pha 1 đơn, không cho giao thêm.
- Cập nhật src/components/views/kitchen-view.tsx:
  - OrderDTO thêm `notifiedAt: string | null`, `assignedTo: string | null`
  - Thêm `audioRef` (useRef<HTMLAudioElement | null>) + element `<audio src="/notif.mp3" preload="auto" />` ẩn trong JSX
  - Thêm `myInProgress = making.find(o => o.assignedTo === user?.name) || null` — order đang pha của user này
  - Khi có order mới tới (socket 'order:new' hoặc 'order:update' với status=new/notified): gọi `playNotifSound()` (audio.currentTime=0; audio.play().catch(fallback beep))
  - useEffect vibration: khi `wait.length > 0 && !myInProgress && user.staffId`: setInterval 1500ms gọi `navigator.vibrate([300,150,300,150,300])` — rung liên tục; khi myInProgress được set hoặc wait list trống, clear interval + `navigator.vibrate(0)` để dừng. Skip nếu admin view (không staffId) hoặc browser không hỗ trợ Vibration API.
  - `doAction('start')`: client-side check — nếu myInProgress !== null, toast.error và return; gọi POST /api/orders/accept; nếu response 409 + inProgressCode, throw Error với message "Bạn đang pha {inProgressCode}..."
  - Render thêm:
    1. `<audio ref={audioRef} src="/notif.mp3" preload="auto" />` ẩn
    2. Banner amber "Bạn đang pha đơn #XX" với 2 nút "Xong #XX" + "Hủy" — chỉ hiện khi myInProgress !== null
    3. Indicator đỏ pulse "Thiết bị đang rung liên tục để báo có đơn chờ — bấm 'Nhận pha' để dừng" — chỉ hiện khi wait.length > 0 && !myInProgress && user.staffId
  - Truyền `disableAccept={!!myInProgress}` cho KitchenCard; KitchenCard thêm prop `disableAccept?: boolean`; button "Nhận pha" thêm `disabled={disableAccept}` + title "Bạn đang pha một đơn khác — hoàn thành hoặc hủy đơn đó trước"
- Lint PASS (sau khi xóa unused eslint-disable ở effect dependency).
- Browser test (agent-browser):
  - Login Bếp A (PIN 1111) → vào Kitchen view. State: đang pha #07 (từ test trước).
  - UI: banner "Bạn đang pha đơn #07" + 2 nút "Xong #07" + "Hủy"; making column 1; wait column 0.
  - Tạo order mới #08 qua API cashier (An tạo): tạo xong status=notified, push attempted.
  - Reload: order #08 hiện trong wait column với badge "🔔 Đã gửi thông báo"; "Nhận pha" button DISABLED (disableAccept=true vì myInProgress). Tabbar badge "Quầy pha 1".
  - Click "Xong #07" (trong banner) → #07 status=done → making column rỗng, banner biến mất, vibration indicator "Thiết bị đang rung liên tục..." xuất hiện, "Nhận pha" của #08 ENABLED.
  - Click "Nhận pha" #08 → #08 status=making assignedTo=Bếp A, banner "Bạn đang pha đơn #08", vibration indicator biến mất (vì myInProgress đã set, dừng vibrate), wait column rỗng, making column 1.
- API curl test 1-order-at-a-time:
  - Tạo order #06 (An) → status=notified OK
  - POST /api/orders/accept order #06 với staffName=Bếp A → 200, status=making assignedTo=Bếp A OK
  - Tạo order #07 (An) → status=notified OK
  - POST /api/orders/accept order #07 với staffName=Bếp A → 409 + `{"error":"Bạn đang pha đơn #06. Hoàn thành hoặc hủy đơn đó trước khi nhận đơn khác.","inProgressOrderId":"...","inProgressCode":"#06"}` ✓
  - POST /api/orders/assign order #07 staffName=Bếp A → 409 + `{"error":"Bếp A đang pha đơn #06. Hoàn thành đơn đó trước khi giao đơn khác."}` ✓
  - POST /api/orders update order #06 status=done → 200
  - POST /api/orders/accept order #07 staffName=Bếp A → 200 (sau khi #06 done, Bếp A free) ✓
- Audit: NotificationLog không log payload sound hay customer data, chỉ log event='sent'|'failed'|'accepted' với orderId + staffName + status HTTP + reason ngắn.

Stage Summary:
- Âm thanh "Ho Ho Ho Merry Christmas" đã chèn: foreground (page mở) — audio element play() khi có đơn mới tới; background (push) — sound:'/notif.mp3' field trong SW showNotification (best-effort, Safari/iOS có thể honor).
- Vibration liên tục ở Kitchen view: setInterval 1500ms lặp pattern [300,150,300,150,300] khi wait.length>0 && !myInProgress && user.staffId; dừng ngay khi staff accept (myInProgress set) hoặc hết đơn chờ. UI indicator pulse báo "Thiết bị đang rung liên tục..." cho user biết.
- 1-order-at-a-time rule: backend enforce (409 Conflict với inProgressCode trả về client), frontend disable button + show banner "Bạn đang pha đơn #XX" với quick actions. Áp dụng cho cả /api/orders/accept (SW click + kitchen button) và /api/orders/assign (admin manual). Staff phải done/cancel đơn hiện tại trước khi nhận đơn khác.
- Không redesign gì — chỉ thêm audio element ẩn + 1 banner + 1 indicator trong kitchen view + prop disableAccept cho KitchenCard. Design system (cream/red, Be Vietnam Pro/Oswald, shadcn/ui, framer-motion) giữ nguyên.
