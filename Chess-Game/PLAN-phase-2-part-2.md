# Phase 2 — Part 2: Giai đoạn chọn thẻ trước trận (Card Selection)

## Trạng thái: Đã hoàn thành (code + test + build xanh)

Tính năng: thêm một **giai đoạn chọn thẻ** giữa phòng chờ và trận đấu. Mỗi người
chọn **3 trong 6 thẻ**, tối đa **30s**, có **nút Sẵn sàng**; khi **cả 2 xong** (hoặc
hết giờ) thì vào trận. Người chơi được chọn **ít hơn 3** (0–3 thẻ).

> Part 1 (đã có ở `PLAN-phase-2-part-1.md`) là hạ tầng engine/commit-reveal chung.
> Phần này **không dùng commit-hash** — theo yêu cầu, dùng **nút sẵn sàng** đơn giản.
> Hai plan độc lập: part-2 này chạy được ngay trên Phase 1 mà không cần part-1.

**Đã thực thi (phần này = các bước 2–7 trong mục "Bước thực thi"):**
- `src/cards/catalog.ts` + `catalog.test.ts` — 6 thẻ, `isValidDeck`.
- `src/types/room.ts` — `card_select`, `RoomMode: card`, `prepStartMs`, `ready`.
- `roomService.ts` — `createRoom(mode)`, `CARD_SELECT_MS`, `enterCardSelect`,
  `selectCards`, `commitCardSelect`.
- `database.rules.json` — `cardState/$color` owner-only, deck ≤3, ready một chiều.
- `CreateRoomScreen` (toggle Classic/Card), `WaitingRoomScreen` (navigate
  card_select), `CardSelectScreen` mới (grid 6 thẻ, countdown 30s, Sẵn sàng,
  auto-ready, host commit), route `/card-select/:roomId`.
- `pieceImages.ts` — `transformedPieceImage` (data mapping tower/charmer).
- Docs §3/§4/§5 cập nhật.

**Lưu ý môi trường:** Node ≥ 26 làm hỏng pool mặc định của vitest 5.1.0
(lỗi `Cannot read properties of undefined (reading 'config')`). Đã pin
`pool: 'vmThreads'` trong `vite.config.ts` (import từ `vitest/config`) để
`npm test` hoạt động.

## Nguyên tắc (tuân thủ `claude_agent_rules.md`)

- Client-first: không backend. Validate ở client, RTDB Rules chặn ghi sai.
- Không sửa `StandardEngine` (classic); card chỉ nằm ở **lớp chọn thẻ + lớp hiển thị**,
  chưa đụng logic hiệu ứng trong trận (để part-3).
- Doc-driven: cập nhật `docs/chess_system_architecture_document.md` (schema) +
  `docs/chess_game_ui_design_document.md` (UI chọn thẻ) trước khi code.

## Bộ 6 thẻ (catalog)

| id | Tên | Màu | Điểm* | Quân/vùng tác động | Ghi chú hiệu ứng |
|---|---|---|---|---|---|
| `tower` | The Tower | Vàng | 3 | Xe | Biến thành pháo đài (icon `the-tower.png`) |
| `charmer` | The Charmer | Bạc | 3 | Tốt | Thôi miên 1 quân địch (icon `the-charmer.png`) |
| `small_reinforcements` | Small Reinforcements | Xanh Lá | 1 | Triệu hồi | Mã hoặc Tượng 1 ô (trận, khi đồng hồ < ngưỡng) |
| `abyss` | The Abyss (Vực Thẳm) | Xanh Lam | 2 | Bàn cờ | 3 ô trống → hố |
| `redeployment` | Redeployment (Tái Bố Trí) | Đồng | 2 | Hàng sau | Sắp xếp lại Xe/Mã/Tượng |
| `major_conflict` | Major Conflict | Tím | 5 | Kết giới | 6×6 giam quân, tan sau ≤10 lượt |

\*Điểm theo GDD "Cân bằng". 6 thẻ này **1 thẻ/ màu** nên chọn 3 → tự động 3 màu khác nhau
(đúng luật GDD "3 thẻ khác màu"). Catalog là **file dữ liệu** (`src/cards/catalog.ts`)
để sau này dễ mở rộng lên 41 thẻ.

## Ghi chú sprite (đã có sẵn ở `public/assets/pieces/`)

- `the-tower.png` và `the-charmer.png` tồn tại ở cả `white/` và `black/`.
- **Sau khi quân biến đổi** (dùng The Tower cho 1 Xe / The Charmer cho 1 Tốt),
  quân đó render bằng sprite riêng thay vì `rook.png`/`pawn.png`.
- Impl hiện ở `pieceImages.ts`: mở rộng mapping — sprite phụ thuộc
  `(color, kind, cardId?)`. Đây là bước **hiển thị**, thuộc part-3 (hiệu ứng),
  nhưng **data mapping chốt ngay** để part-3 không phải đoán:
  `transformedPiece(color, cardId)` → `/assets/pieces/{color}/the-tower.png` | `the-charmer.png`.

## Luồng & trạng thái

Thêm trạng thái `card_select` (dùng lại `prep_phase` đã có sẵn trong schema):

```
waiting ──(host Start, mode=card)──> card_select ──(cả 2 ready HẾT 30s)──> in_progress
                                          │
                                    mỗi player: chọn 0–3 thẻ + nút Sẵn sàng
```

- **Lobby/CreateRoom:** thêm lựa chọn chế độ `card` (song song `classic`).
  Khi mode `card`, host bấm Start → status `card_select` (không `in_progress`).
- **Route mới** `/card-select/:roomId` (ProtectedRoute) → `CardSelectScreen`.
  `WaitingRoomScreen` hiện tự navigate khi `in_progress`; bổ sung navigate khi
  `card_select`.
- Khi cả 2 ready → `metadata.status: in_progress` (host ghi) → cả 2 vào `/match/:roomId`.
- `card_state` dùng cho classic: bỏ qua (chọn 0 thẻ), vẫn vào trận như Phase 1.

## Schema RTDB (mở rộng `src/types/room.ts`)

Thêm vào `RoomCardSide` (đã có `deck` ≤3, `used`, `cooldowns`):
```ts
deck: string[];      // card id đã chọn, 0–3 (tái dùng trường có sẵn)
ready: boolean;      // NEW: player đã bấm Sẵn sàng
// used, cooldowns giữ nguyên (phục vụ part-3)
```
- Thêm `metadata.prepStartMs: number` (thời điểm vào `card_select`, để 2 client sync đếm 30s).
- `RoomMode`: `'classic' | 'card'`.

**Rules (`database.rules.json`):**
- Mỗi player chỉ ghi được `cardState.<color>/{deck,ready}` của chính màu mình.
- `deck` chỉ chứa card id hợp lệ, độ dài ≤3, không trùng.
- Chặn `ready` quay lại `false` sau khi **đối thủ** đã `ready` (ngăn "un-ready" gây kẹt).
- Host ghi `status: in_progress` chỉ khi **cả 2 `ready == true`** (hoặc host tự ép khi hết giờ).

## Timer 30s

- Client-side countdown từ `prepStartMs` (không tin giờ máy riêng).
- Hết 30s → player đó **auto Sẵn sàng** (giữ lựa chọn hiện tại, có thể là 0 thẻ).
- Điều kiện vào trận: `(ready.white && ready.black) || hết 30s cho cả 2`.
- Host là người ghi `in_progress`; nếu host rớt, fallback: hết giờ → auto.
- Rủi ro (ghi trong plan): đồng hồ client-based, lệch vài trăm ms giữa 2 máy —
  chấp nhận ở scope này, ghi README.

## UI (`CardSelectScreen.tsx` + `components/cards/*`)

- 6 thẻ render dạng lưới; chọn tối đa 3 (nút toggle; chọn thẻ thứ 4 → loại thẻ đã chọn
  cũ nhất hoặc chặn + thông báo).
- Mỗi thẻ: màu viền theo token CSS có sẵn (`--color-card-*` trong UI design doc),
  tên, điểm, mô tả ngắn.
- Thanh countdown 30s (cùng hiển thị countdown của đối thủ: "Đang chọn...").
- Nút **Sẵn sàng** (disabled khi chưa chọn thẻ nào? — **đề xuất cho phép 0 thẻ**,
  xem Câu hỏi mở #2). Khi ready: khóa lựa chọn, hiện "Đợi đối thủ...".
- Trạng thái xong: cả 2 ready → toast "Vào trận" → redirect.

## Bước thực thi (thứ tự)

1. **Docs:** cập nhật §3 schema + UI design (màn chọn thẻ, token màu thẻ, countdown).
2. **`src/cards/catalog.ts`:** 6 thẻ (id, name, color, points, description,
   `transformedIcon?` cho tower/charmer) + hàm validate `isValidDeck(ids)`.
3. **`src/types/room.ts`:** `ready`, `prepStartMs`, `RoomMode: card`.
4. **`roomService.ts`:** `enterCardSelect` (host start → card_select), `selectCard`
   (ghi deck+ready của 1 màu), `commitCardSelect` (cả 2 ready → in_progress).
   **Rules** bổ sung tương ứng.
5. **`CardSelectScreen.tsx`:** UI + countdown + nút Sẵn sàng.
6. **`WaitingRoomScreen`/route:** mode card + navigate qua card_select.
7. **`pieceImages.ts`:** mapping sprite tower/charmer (chưa render, chỉ data).
8. **Test:** validate deck (độ dài, trùng, card hợp lệ), 2-tab flow, rules chặn
   ghi sai màu, auto-ready khi hết giờ.

## Câu hỏi mở (đề xuất mặc định nếu không chọn)

1. **Ceiling điểm giá trị 9:** vài combo chứa Major Conflict (5) vượt 9
   (vd 5+3+3=11). → **Mặc định: KHÔNG enforce** ở pool 6 thẻ playtest này;
   enforce khi lên catalog đầy đủ. (Bật enforce = disable tổ hợp >9 khi chọn.)
2. **Cho phép 0 thẻ?** "ít hơn 3" → **Mặc định: cho phép 0** (nút Sẵn sàng luôn
   khả dụng). Nếu muốn tối thiểu 1: khóa nút tới khi chọn ≥1.
3. **Nơi chọn chế độ:** **Mặc định: nút "Classic / Card" ở Lobby & CreateRoom.**
4. **Thẻ Tím (Major Conflict) chỉ 1 trong deck:** tự động thỏa (pool 1 thẻ/ màu).

## Rủi ro / giới hạn

- **Hết giờ đồng bộ:** 2 client đếm từ cùng `prepStartMs` nhưng lệch clock →
  có thể khác nhau vài ms khi auto-ready; fallback host ghi kết quả cuối.
- **Disconnected:** player rớt giữa chọn thẻ → 30s auto-ready, ván vẫn chạy;
  ghi README.
- **Hiệu ứng trong trận (biến đổi, triệu hồi, kết giới) chưa làm ở part này** —
  chỉ chọn thẻ + hiển thị sprite data. Part-3 xử lý.

## Verification checklist

- [ ] `tsc` 0 lỗi, `npm test` xanh (kèm test validate deck + 2-tab)
- [ ] Mode card: room → card_select → cả 2 chọn 3/2/1/0 thẻ → Sẵn sàng → in_progress
- [ ] Countdown 30s → auto Sẵn sàng đúng hạn
- [ ] Rules: sửa `cardState` màu đối thủ / deck >3 / thẻ trùng → PERMISSION_DENIED
- [ ] Classic vẫn hoạt động như Phase 1 (regression)
