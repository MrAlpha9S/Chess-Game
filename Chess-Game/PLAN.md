# Phase 1 Implementation Plan — Client-First Architecture

## Trạng thái: Đã hoàn thành (2026-08-20)

Toàn bộ 9 bước dưới đây đã được thực hiện. Xem `docs/` cho đặc tả
chi tiết và `README.md` cho hướng dẫn chạy.

## Context

Dự án đã lệch khỏi docs. Người dùng đã chốt hướng: **client-first theo
`phase_1_project_roadmap.md` + `chess_system_architecture_document.md`**
(serverless, không backend riêng), và bắt đầu bằng **đồng bộ docs↔code**
trước khi làm tính năng mới.

Ràng buộc bổ sung:
- `claude_agent_rules.md` cấm tự thêm backend/Cloud Functions → đã **xoá**
  `functions/`, `server/`, `packages/game-service`.
- TypeScript strict, không placeholder/TODO.

## Quyết định đã chốt

1. **Kiến trúc**: client-first. RTDB `/rooms` + `/presence`. Không Cloud Functions, không Express server.
2. **Cờ classic 8×8 trên nền lưới 10×10**: giữ cấu trúc dữ liệu 10×10 (`GridBoard`), vùng hoạt động **chính giữa** (rows 1–8, cols 1–8, 0-indexed) ⇒ 64 ô chơi được, 36 ô biên khóa cứng.
3. **Bỏ hẳn luồng `/matches` + matchmaking queue**: chỉ dùng `/rooms` (create + join bằng mã phòng 6 ký tự).
4. **Validate ở client, chặn gian lận bằng Rules**: `database.rules.json` kiểm tra `boardState.turn` + `players.white.uid/black.uid` **và** bắt buộc turn phải đổi.
5. **Xoá hẳn card scaffolding (Phase 2)**: `cardState` container vẫn **tồn tại rỗng** trong schema RTDB.

## Điểm sai đã phát hiện và sửa trong docs

- **Lỗi số học 8×8**: doc ghi `minRow: 2, maxRow: 7` ⇒ chỉ **6 hàng**, không phải 8. Đã sửa thành 1–8 ở `chess_system_architecture_document.md` §3 và §6.1.
- **`chessops` 0.15 dùng `isErr` là property, không phải method** (`if (parsed.isErr())` trong doc blueprint → sai).
- **`dests.has(toSq)` loại bỏ nhầm castling và en passant**: castling được encode là vua-ăn-quân, EP nhắm ô trống. Phải dùng `pos.isLegal(move)`. Đây là lý do blueprint trong doc cần sửa (đã sửa §6.3).
- **Blueprint doc gọi `algebraicToGrid`/`gridToAlgebraic` là method của `BoardGrid10x10`**: thực tế mapping nằm ở `src/engine/grid/coords.ts` dùng chung, để tránh hai nguồn sự thật.

## Các bước đã thực hiện

| Bước | Nội dung | File chính |
|---|---|---|
| 1 | Engine theo blueprint docs | `src/engine/{index,core/*,grid/*,engine.test.ts,move.test.ts}` |
| 2 | Schema RTDB `/rooms` + `/presence` | `src/types/room.ts` |
| 3 | Service client-first duy nhất | `src/services/roomService.ts` |
| 4 | Security Rules chặn đi sai lượt | `database.rules.json` |
| 5 | Clock đồng bộ 2 người | `src/hooks/useTimer.ts` |
| 6 | PNG 512px + bỏ dead code + `LoadingAnimation` | `scripts/generate-pieces.mjs`, `public/assets/pieces/`, `src/components/common/LoadingAnimation.tsx` |
| 7 | HUD, âm thanh, hiệu ứng | `src/components/hud/MoveLog.tsx`, `src/lib/audio.ts`, `src/hooks/usePointerField.ts`, `src/hooks/useGameSync.ts` |
| 8 | Xoá backend | `functions/`, `server/`, `packages/` đã xoá; `firebase.json` + `package.json` cập nhật |
| 9 | Test, tối ưu, README | 39 test, `README.md` |

## Verification (đã chạy)

1. `npx tsc --noEmit -p tsconfig.app.json` — **0 lỗi**.
2. `npm test` — **39/39 xanh** (27 engine + 12 move/replay).
3. `npm run build` — **thành công**.
4. 12 sprite PNG 512×512 hợp lệ, nền trong suốt, kiểm tra bằng script.
5. Cần kiểm tra thủ công với 2 tài khoản thật (không làm được trong môi trường này):
   - Tạo phòng ở tab A → mã 6 ký tự → vào ở tab B.
   - Cả 2 vào ván, đi nước hợp lệ → đối thủ thấy realtime (< 1s).
   - Test chặn gian lận: `update(ref(rtdb), {'rooms/{id}/boardState/turn': 'white'})` khi đang lượt đen → phải bị **PERMISSION_DENIED**.
   - Hết giờ → `terminationReason='timeout'`. Resign → `terminationReason='resignation'`.

## Rủi ro còn lại

- **Rules chặn gian lận chỉ là hàng rào mỏng**: client validate là chính, rules chỉ chặn đi sai lượt/người lạ. Đã ghi rõ giới hạn này trong README.
- **Đồng hồ client-based** có thể lệch vài trăm ms giữa 2 máy → chấp nhận ở Phase 1.
- **File `src/features/match/components/CardTray.tsx` và `ClockDisplay.tsx`** còn sót lại (không được import) — xoá khi có thể thao tác xoá file.
