# Phase 2 — Part 3: The Abyss (B3) — Đã triển khai, CHỜ deploy rules

> **Trạng thái (2026-07-22):** Code B3 xong: service `useCard` (free action, không đổi lượt,
> cooldown 15 tick trong `playMove`), `cardLogic.ts` + 18 test, `CardPanel`/`PlayerCardIcons`
> (tippy) đã mount trong `MatchScreen` (sidebar desktop + bottom bar mobile),
> `BoardGrid` render `holes`/`targetCells`, legal moves qua `VariantEngine`,
> rules `boardState` cho phép card-action không đổi lượt. 97/97 test, tsc 0, build OK.
> **Còn thiếu: `firebase deploy --only database` (rules mới) + `firebase deploy --only hosting`
> (bản mobile fix) + reload trang.** Emulator database crash trên Windows
> (exit 3221225786) nên chưa verify rules bằng emulator — chỉ verify bằng đọc logic rules.

## Context

B1 (VariantEngine + schema) và B2 (Redeployment) đã xong. B3 đưa **The Abyss**
(blue, 2pt) vào trận: click lá trong thanh bên phải → chọn **đúng 3 ô trống**
trên bàn → xác nhận → ghi hố vào `gridConfig.holes` realtime cho 2 bên.
Quân trượt bị chặn bởi VariantEngine (đã có sẵn ở B1).

**Quyết định đã chốt với user:**
- **Free action:** dùng Abyss KHÔNG đổi lượt — người chơi vẫn có thể đi quân
  sau đó (đúng 1 hành động / lượt không áp dụng với thẻ free; GDD "1 hành
  động/lượt" chỉ áp với hành động trong lượt tiêu phí lượt).
- **Reusable:** cooldown **15 lượt của chính chủ** (giảm 1 mỗi lượt người chơi
  đó đi quân). Không ghi `used` — lá dùng lại được khi cooldown về 0.
- **Khóa khai cuộc:** chỉ dùng được từ **lượt 6** (`fullMoveNumber >= 6`).
- Tooltip icon lá cạnh tên 2 người chơi dùng **tippy.js** (đã cài).

## Schema / service

### `roomService.useCard(roomId, uid, cardId:'abyss', targets: [GridPair x3])`
1. Đọc room; enforce: `status==='in_progress'`, có `boardState`,
   `turn === getPlayerColor(room,uid)` (chỉ dùng trong lượt của mình).
2. Validate card: trong `cardState.<color>.deck`, `cooldowns.abyss` phải
   `0/undefined` (RTDB trả object numeric-keys → normalize), `fullMoveNumber>=6`.
3. `VariantEngine(fen, effects).applyAbyss(targets)` — đã có B1: đúng 3 ô,
   ô trống, active region, không promotion rank, board liên thông.
4. **Patch atomic, KHÔNG đổi turn** (free action):
   - `boardState.gridConfig.holes`: +3 ô mới (preserve min/max row/col)
   - `boardState.lastMove`: `{from:'', to:'', san:'The Abyss', type:'card', cardId, by, timestamp}`
   - `boardState.turn`: **không đổi** (vẫn bên đang chơi)
   - `cardState.<color>.cooldowns.abyss = 15`
   - `moveHistory/<nextIndex>`, `metadata/updatedAt`
   - Không ghi clock (free action)
5. `RoomMove.type` đã có `'card'` (B1), thêm `cardId` (B1) ✓.

### Cooldown tick trong `playMove`
Mỗi `playMove` của bên màu `C`: patch thêm
`cardState/<C>/cooldowns/<id>: max(0, n-1)` cho mọi card trong deck C có
cooldown > 0 (deck ≤3 → ≤3 path). RTDB rules cho phép owner ghi cardState của
mình ✓. (Free action không tick — đúng "mỗi lượt người chơi đó đi quân".)

### Rules (`database.rules.json`)
- **boardState `.write`**: thêm nhánh card-action cùng lượt:
  khi `lastMove/type === 'card'` cho phép `newData.turn === data.turn` và
  writer là chủ bên đến lượt. Cụ thể:
  ```
  (data.child('turn').val() === 'white' && writerWhite
     && (newData.child('turn').val() === 'black'
         || newData.child('lastMove/type').val() === 'card'))
  ```
  (bản đen tương tự). Normal move vẫn phải đổi lượt.
- **moveHistory `.validate`**: giữ `hasChildren(['from','to','san','timestamp'])`
  — entry card có `from:''/to:''` (RTDB giữ chuỗi rỗng) ✓. Nếu muốn chặt hơn:
  `newData.child('type').val() === 'card' || newData.hasChildren(['from','to'])`.
- **cardState `.write`**: owner-only đã có ✓ (tick cooldown + gán 15 đều là
  chính chủ bên đó).
- Emulator rules engine: chỉ dùng `.val()`/`.hasChildren` (không `numKeys`) —
  theo ghi nhớ [[vitest-node26]] về rules.

## UI

### Thanh bên phải (Cards panel) — `src/components/hud/CardPanel.tsx` (mới)
- Trong `aside` desktop của MatchScreen (khung "Cards"): mỗi lá trong
  `cardState.<myColor>.deck` render 1 tile: icon theo màu lá (
  `/assets/card-icon/<color>-card-icon.png`), tên, badge cooldown "X lượt"
  nếu >0, dim nếu khóa (lượt <6) / chưa đến lượt / cooldown.
- Click Abyss tile → set `targetingCard='abyss'` (local state trong
  MatchScreen), không ghi DB. Hiện banner hướng dẫn "Chọn 3 ô trống" + đếm
  `n/3` + nút Hủy (bỏ chọn / thoát chế độ).
- Chọn đủ 3 → nút **Xác nhận** gọi `actions.useCard(...)`; pending thì khóa
  cả board lẫn thẻ (ref guard chống double-submit).
- Mobile: hàng 3 nút thẻ trên bottom-bar (md:hidden), cùng hành vi.

### Targeting trên bàn — `BoardGrid` thêm props
- `holes?: string[]` (từ `gridConfig.holes`): ô hố render nền sẫm + dấu X
  mờ, không có quân.
- `targetingCells?: GridPair[]` + `isTargeting: boolean`: ô đang chọn có ring
  card-blue + số thứ tự (1/2/3); ô hợp lệ candidate (trống, không hố, active,
  không promotion rank) highlight mờ khi đang targeting.
- `handleCellClick` (MatchScreen): nếu `targetingCard` active → click ô hợp lệ
  toggle thêm/bớt vào danh sách chọn (thay cho flow chọn quân bình thường;
  click ô khác thì bỏ chế độ). Không chọn quân trong lúc targeting.
- **Legal moves qua VariantEngine**: `computeValidMoves` (MatchScreen) đổi
  `new StandardEngine(fen)` → `new VariantEngine(fen, effects)` (effects từ
  `gridConfig.holes` + `variantState`) để quân trượt bị chặn bởi hố đúng.

### Card icons cạnh tên + tooltip — `PlayerCardIcons.tsx` (mới)
- Header (đối thủ) và bottom bar (mình): sau tên/avatar, render hàng icon
  nhỏ (16px) của `cardState.<color>.deck` (mỗi lá 1 icon theo màu, có thể
  dim nếu đã dùng / cooldown, badge số nếu cooldown>0).
- Tooltip **tippy.js**: hover/focus icon → hiện `CardTooltipContent` (tên,
  mô tả, trạng thái "Sẵn sàng"/"Hồi chiêu còn X lượt"/"Đã dùng").
  `tippy(el, {content, theme:'light', trigger:'mouseenter focus'})`, cập nhật
  nội dung khi room thay đổi (thư viện tippy.js + import CSS).
- Component dùng chung `CardIcon` (img + tippy), reuse trong cả 2 chỗ.

### MoveLog
- Entry `type==='card'` hiện riêng (badge "The Abyss" bên cạnh số nước),
  không trộn vào cặp nước chuẩn (vì free action không tăng fullMoveNumber —
  moveHistory hiện index-sequence, giữ nguyên là an toàn; MoveLog hiện
  `san` → 'The Abyss' vẫn đọc được).

## Files sửa/tạo
1. `src/services/roomService.ts` — `useCard`, tick cooldown trong `playMove`,
   helper `normalizeCardSide` (RTDB object→array, fallback empty).
2. `src/hooks/useGameSync.ts` — thêm `actions.useCard`, expose
   `cardState`/`holes`/`cooldowns` trong snapshot.
3. `src/components/hud/CardPanel.tsx` (mới) — thanh thẻ bên phải + targeting
   controls.
4. `src/components/hud/PlayerCardIcons.tsx` (mới) — icon cạnh tên + tippy.
5. `src/features/board/components/BoardGrid.tsx` — `holes` + `targetingCells`
   + `isTargeting` props.
6. `src/features/match/MatchScreen.tsx` — state `targetingCard`,
   `targetCells`, wiring click/confirm/cancel, legal moves qua VariantEngine,
   chèn CardPanel (aside + mobile row) + PlayerCardIcons (header + bottom).
7. `database.rules.json` — boardState card-action branch + moveHistory (test
   rules load sạch bằng emulator trước khi deploy).
8. `docs/...md` §3 (lưu `used/cooldowns`) + §6 (useCard flow) + GDD card
   effects note.

## Verification
- **Unit (mới)**: helper normalize card side; `applyAbyss` edge cases đã có
  B1; tick cooldown function (pure, tách ra trong service để test): giảm
  đúng, không âm, chỉ card trong deck; `canUseAbyss(room,uid)` (pure
  validate): không đến lượt, chưa có thẻ, cooldown>0, fullMoveNumber<6, target
  trùng/chiếm/promotion rank/đứt liên thông.
- **tsc 0 / npm test xanh (giữ regression engine + classic) / build OK.**
- **Emulator rules**: load rules sau sửa, xác nhận không error; (enforce
  auth-check bằng REST như trước — chỉ xác nhận rules compile).
- **Manual 2 tab (bắt buộc)**:
  1. 2 tab cùng phòng card-mode, cả 2 chọn The Abyss + 1 lá khác, bấm
     Sẵn sàng, trận bắt đầu.
  2. Lượt mình: click The Abyss trong thanh bên → chọn đúng 3 ô trống → xác
     nhận. **Cả 2 tab thấy 3 ô biến hố ngay lập tức.**
  3. Di 1 quân Xe/Tượng xuyên qua khu vực có hố → ô đích bị chặn (chỉ đi
     được đến trước hố). Mã vẫn nhảy qua.
  4. Dùng Abyss ở lượt 1–5 bị chặn (badge "mở khóa lượt 6"); sau lượt 6 dùng
     được, cooldown hiện 15 và giảm mỗi lượt mình đi, lá sáng lại khi về 0.
  5. Hover icon lá cạnh tên 2 người chơi → tooltip hiện đúng; icon lá dùng
     thì dim + badge cooldown.
  6. Tab khác dùng Abyss trong lượt của họ, mình thấy hố + legal moves
     của mình bị ảnh hưởng realtime.
  7. Free action: sau khi dùng Abyss, mình vẫn đi được 1 nước quân trong
     cùng lượt đó (turn chưa đổi sau khi dùng thẻ).
- **Ghi nhận giới hạn**: client-first — validate client, rules backstop
  turn; không có server authoritative.
