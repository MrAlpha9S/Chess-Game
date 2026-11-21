# Phase 2 (Part 1): Nền móng hạ tầng Cờ Vua Thẻ Bài

## Trạng thái: Chờ duyệt — chưa viết code

Part 1 xây **nền móng hạ tầng + luồng chuẩn bị (prep)** theo đúng quyết định đã chốt
trong **Part 2**: dùng **nút Sẵn sàng + timer 30s** (không dùng commit-hash), catalog
**6 thẻ** (1 thẻ/màu), và luồng `card_select` → `in_progress`.

> **Quan hệ giữa 2 plan:**
> - Part-1 (file này) = ** hạ tầng**: catalog, schema `cardState`, extension engine
>   (Strategy/Factory), rules RTDB. **Chưa có UI chọn thẻ, chưa có hiệu ứng trong trận.**
> - Part-2 (`PLAN-phase-2-part-2.md`) = **tính năng người dùng thấy**: màn chọn thẻ
>   (3/6, 30s, Sẵn sàng) + sprite chuyển đổi. Part-2 **nằm trên** part-1.
> - Hai plan **thuật toán cùng một luồng prep** (ready-based), không xung đột.

## Nguyên tắc (từ `claude_agent_rules.md` + docs đã chốt)

- **Doc-Driven:** mọi bước bắt đầu bằng cập nhật `docs/chess_system_architecture_document.md`
  và/hoặc `docs/chess_game_ui_design_document.md` trước khi code.
- **Không thêm backend:** mọi logic vẫn client-first; RTDB + Security Rules là hàng rào duy nhất.
- **Không phá Phase 1:** `StandardEngine` (classic) giữ nguyên, không sửa; variant chạy
  qua adapter mới theo Strategy/Factory đã chốt trong docs §1.
- **Điểm sai docs cần sửa trước (phát hiện khi đọc code):**
  1. Docs §6.2 khai báo `MoveRequest.cardPayload` và `IChessEngine.useCard()` —
     nhưng `src/engine/core/IChessEngine.ts` **không có cả hai**. → Bước P2.2 bổ sung.
  2. Docs §2.2 mô tả "commit hash → simultaneous reveal" — **đã bị thay thế** bởi
     quyết định Part 2: dùng **nút Sẵn sàng + timer 30s**, không commit-hash.
     → Bước P2.3 đồng bộ lại (đã sửa trong bản plan này).

## Đã chốt (theo quyết định Part 2, không cần hỏi lại)

| # | Quyết định | Giá trị |
|---|---|---|
| Q1 | **Spec thẻ** | 6 thẻ, 1/màu, có sẵn trong Part 2 (catalog). Mở rộng sau. |
| Q2 | **Chọn deck** | **Nút Sẵn sàng + timer 30s** (không commit-hash, không random draw). Người chọn 0–3 thẻ. |
| Q3 | **Khi nào dùng thẻ** | Chốt trong Part 3 (hiệu ứng). Part 1 chỉ đặt infrastructure. |
| Q4 | **Phạm vi** | `card_casual` trước (không tính rank ở Part 1). |

> Nếu có thay đổi, báo trước khi chạy bước P2.x.

## Các bước

### P2.1 — Catalog & schema thẻ (`src/cards/`, `src/types/room.ts`)
- **`src/cards/catalog.ts`**: 6 thẻ (id, name, color, points, description,
  `transformedIcon?` cho `tower`/`charmer`). **File dữ liệu, không logic.**
- **`src/types/room.ts`**: mở rộng `RoomCardSide` — thêm trường `ready: boolean`,
  giữ nguyên `deck` (≤3), `used`, `cooldowns`. Thêm `metadata.prepStartMs`.
- **`RoomMode`**: thêm `'card'` (song song `'classic'`).
- **`cardState` shape giữ nguyên** (đã có sẵn `deck`/`used`/`cooldowns`),
  chỉ bổ sung `ready`. Không phá Phase 1.
- **File docs:** §3 architecture doc thêm `ready`, `prepStartMs`, `RoomMode: card`.

### P2.2 — Nở rộng interface engine (đúng docs §6.2, nhưng **chưa dùng cardPayload** ở Part 1)
- `MoveRequest` thêm `cardPayload?: { cardId, targetSquare?, args? }` (docs đã có sẵn,
  chỉ cần đồng bộ code; **không ai gọi ở Part 1**).
- `IChessEngine` thêm `useCard(req: CardRequest): CardResult` + `hasCardEffect(square)`.
- `StandardEngine` giữ nguyên (classic không thẻ); tạo `VariantEngine` (Strategy)
  bao quanh `StandardEngine` + `BoardGrid10x10` (dùng đúng hooks `unlockSquare`/
  `setHole` docs §6.1) — **không fork logic cờ**.
- **Part 1 không gọi `useCard` trong trận** — chỉ đặt interface. Part 3 mới hiệu ứng.
- Test: mọi nước đi hợp lệ ở classic vẫn hợp lệ khi không dùng thẻ (regression).

### P2.3 — Luồng Prep (ready-based, theo Part 2) trong `WaitingRoomScreen`
- **Không dùng commit-hash** (đã thay thế bằng nút Sẵn sàng).
- **`prepState` shape (theo Part 2, không phải commit-hash):**
  ```ts
  prepState: {
    white: { deck: string[], ready: boolean },
    black: { deck: string[], ready: boolean },
    revealed: boolean,
    deadlineMs: number
  }
  ```
  Nhưng **Part 1 không cần `prepState` tách riêng** — dùng thẳng `cardState.deck` +
  `cardState.ready` (đã có trong schema) + `metadata.prepStartMs` (30s timer).
- Status `waiting → card_select → in_progress` (schema đã có `prep_phase`,
  **dùng lại tên `card_select`** cho rõ nghĩa — thêm vào `RoomStatus`).
- **Hết 30s**: mỗi client auto-Sẵn sàng (giữ lựa chọn hiện tại, có thể 0 thẻ).
  Điều kiện vào trận: `(ready.white && ready.black) || cả 2 hết 30s`.
  Host ghi `in_progress`.
- **Rules:** `database.rules.json` — mỗi player ghi được `cardState.<màu mình>`
  (`deck` + `ready`), `deck` độ dài ≤3, không trùng, card id hợp lệ;
  `ready` không được quay về `false` khi đối thủ đã `ready`; host ghi
  `status: in_progress` chỉ khi cả 2 ready (hoặc hết giờ).
- **File docs:** §3 architecture doc sửa theo schema Part 2 (bỏ commit-hash,
  thêm `ready`, `prepStartMs`, `card_select`).

### P2.4 — Sync & rules cho thẻ
- `roomService.ts`: action `enterCardSelect` (host start mode=card →
  `card_select`), `selectCard(color, ids)` (ghi `deck`), `readyCard(color)`
  (ghi `ready`), `commitCardSelect` (cả 2 ready hoặc hết giờ → `in_progress`).
- `useGameSync`: không cần thay đổi ở Part 1 (chưa có hiệu ứng trong trận).
  **Part 3 mới sync `variantState`/`gridConfig` hiệu ứng.**
- **Rules:** `deck` không sửa sau `in_progress`; `ready` một chiều (true không
  quay false khi đối thủ ready); chỉ host ghi `status`.
- Test 2-tab với emulator: cả 2 chọn → Sẵn sàng → vào trận.

### P2.5 — UI chọn thẻ — **CHUYỂN SANG PART 2**
- Part 1 **không build UI chọn thẻ** (chỉ đặt infrastructure).
- `CardSelectScreen` + `CardTray` + HUD cooldown → **Part 2** (đã có trong
  `PLAN-phase-2-part-2.md`).
- Part 1 chỉ đảm bảo: schema, service, rules, catalog, engine interface **sẵn sàng**
  cho Part 2 gọi.

### P2.6 — Chốt part-1 & bàn giao
- `npm test` xanh (kèm test mới), `tsc` 0 lỗi, build OK.
- Manual 2 tài khoản thật: create room mode=card → cả 2 chọn thẻ + Sẵn sàng →
  vào `in_progress`; test chặn rules (sửa `deck` màu đối thủ, `ready` quay về false
  sau khi đối thủ ready, đi sai lượt).
- README + docs cập nhật; phần chưa làm (UI chọn thẻ, hiệu ứng trong trận, catalog
  41 thẻ, ranked) ghi rõ trong PLAN-phase-2-part-2.md / part-3.md.

## Rủi ro / giới hạn

- **Timer 30s client-side:** lệch vài trăm ms giữa 2 máy; host là nguồn ghi
  kết quả cuối, fallback hết giờ. Ghi rõ trong README.
- **Không có backend:** mọi validate client-first; Rules RTDB chỉ chặn ghi
  sai (sai màu, deck không hợp lệ, ready một chiều), không chặn hết mọi gian lận.
- **`cardPayload`/`useCard` chưa gọi ở Part 1:** chỉ đặt interface; Part 3 mới
  dùng. Đừng để Part 1 có dead code gọi — chỉ có `VariantEngine` class rỗng
  (mở rộng ở Part 3), không có logic hiệu ứng.
- **`hiddenPieces` vs FEN:** (chỉ liên quan Part 3) `variantState.hiddenPieces`
  nằm ngoài FEN chuẩn → replay/hồi trạng thái phải restore từ snapshot RTDB,
  không tin FEN. Part 1 không đụng, nhưng ghi chú để Part 3 nhớ.

## Verification checklist (chạy trước khi báo xong)
- [ ] `npx tsc --noEmit -p tsconfig.app.json` — 0 lỗi
- [ ] `npm test` — 100% xanh (kèm test regression classic + test rules card)
- [ ] `npm run build` — OK
- [ ] `npm run emulators` + 2 tab: mode=card, cả 2 chọn thẻ + Sẵn sàng → in_progress
- [ ] Rules: sửa `cardState` màu đối thủ / deck >3 / thẻ trùng / `ready` quay false → PERMISSION_DENIED
- [ ] Classic vẫn hoạt động như Phase 1 (regression)
