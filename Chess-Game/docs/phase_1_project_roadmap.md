# Phase 1: Core Chess & Infrastructure Roadmap

Kế hoạch chi tiết để xây dựng hoàn chỉnh một ứng dụng cờ vua trực tuyến 1v1 trên nền tảng Serverless (Firebase Spark Plan + Vercel Static Hosting) với kiến trúc sẵn sàng mở rộng sang Cờ Vua Thẻ Bài (Phase 2).

> **Trạng thái (cập nhật):**
> - **1.1** — Đã hoàn thành: Vite + React + TS + Tailwind v4, theme token, Firebase Auth (Google), `LoadingAnimation`.
> - **1.2** — Đã hoàn thành: `BoardGrid10x10`, `IChessEngine`/`StandardEngine` (chessops), `BoardGrid`/`Piece` (PNG 512px), engine test suite.
> - **1.3** — Đã hoàn thành: schema `/rooms` + `/presence`, `roomService`, `useGameSync`, Security Rules chặn đi sai lượt, đồng hồ đồng bộ `useTimer`.
> - **1.4** — Đã hoàn thành: `MoveLog`, âm thanh Web Audio (`lib/audio.ts`), `usePointerField`, màn kết quả `ResultScreen`.
> - **1.5** — Đang tiến hành: tối ưu `React.memo`, README, deploy.
>
> Lưu ý: Luồng matchmaking tự động (queue) đã bị loại bỏ theo quyết định client-first — chỉ dùng `/rooms` (tạo + nhập mã 6 ký tự). Phần nền móng thẻ bài (card) bị trì hoãn sang Phase 2, container `cardState` vẫn tồn tại rỗng trong schema.

---

## Phase 1.1: Khởi tạo Môi trường & Thiết kế Hệ thống Cơ bản (Sprint 1)
**Mục tiêu:** Thiết lập nền tảng dự án, cấu hình công cụ, kết nối Firebase Auth và xây dựng khung giao diện tĩnh chuẩn Dark Theme.

* **Công việc chính:**
  - Khởi tạo project với Vite, React, TypeScript và Tailwind CSS v4.
  - Cấu hình token màu sắc, font chữ (Inter, JetBrains Mono) và bo góc trong CSS theme.
  - Tích hợp thư viện `shadcn/ui` và cấu trúc thư mục theo tính năng (`features/board`, `features/match`, v.v.).
  - Cấu hình Firebase SDK (Auth, Realtime Database) và tạo Custom Hook `useAuth` cho Google Sign-In.
  - Xây dựng component `LoadingAnimation.tsx` dùng chung cho toàn bộ trạng thái chờ/tải.
* **Tiêu chí hoàn thành (Definition of Done):**
  - Chạy lệnh `npm run dev` không báo lỗi TypeScript.
  - Người dùng có thể đăng nhập bằng tài khoản Google thành công và hiển thị Avatar/Tên trên Header.

---

## Phase 1.2: Xây dựng Core Engine & Bàn cờ 10x10 (Sprint 2 - 3)
**Mục tiêu:** Tích hợp `chessops` và xây dựng lớp quản lý bàn cờ, đồng thời cài đặt khung lưới $10 \times 10$ khóa biên để sẵn sàng cho thẻ Xanh Lam ở Phase 2.

* **Công việc chính:**
  - Viết `BoardGrid10x10.ts` để quản lý ma trận tọa độ, khóa cứng 36 ô biên ngoài và chỉ cho phép ô $8 \times 8$ trung tâm hoạt động.
  - Tạo Interface `IChessEngine.ts` và Adapter `StandardEngine.ts` sử dụng `chessops` để validate nước đi, bắt quân, chiếu (check), chiếu bí (checkmate).
  - Xây dựng UI Component `Board.tsx` và `Square.tsx` render bàn cờ linh hoạt.
  - Xây dựng `Piece.tsx` tích hợp tải file ảnh PNG 512px (White/Black) cho từng loại quân.
* **Tiêu chí hoàn thành (Definition of Done):**
  - Người dùng có thể kéo thả hoặc click chọn quân, hiển thị chấm tròn nước đi hợp lệ đúng luật FIDE.
  - Chặn hoàn toàn các nước đi sai luật hoặc đi ra ngoài vùng bàn cờ $8 \times 8$.

---

## Phase 1.3: Realtime Matchmaking & Đồng bộ RTDB (Sprint 4 - 5)
**Mục tiêu:** Xây dựng luồng tạo phòng, tham gia ván đấu và đồng bộ trạng thái nước đi theo thời gian thực qua Firebase Realtime Database.

* **Công việc chính:**
  - Thiết kế cấu trúc JSON cho `/rooms` và `/presence` trên Firebase RTDB.
  - Xây dựng màn hình Lobby (chọn chế độ phòng Classic).
  - Viết Custom Hook `useGameSync.ts` để lắng nghe sự thay đổi bàn cờ từ Firebase theo thời gian thực.
  - Cấu hình **Firebase Security Rules** (`database.rules.json`) để phân quyền ghi dữ liệu dựa trên `auth.uid` và lượt đi (`turn`).
  - Xây dựng đồng hồ đếm giờ (Chess Timer) đồng bộ thời gian thực giữa hai người chơi.
* **Tiêu chí hoàn thành (Definition of Done):**
  - Hai trình duyệt khác nhau (hoặc hai tab ẩn danh) đăng nhập 2 tài khoản Google khác nhau có thể tạo/vào phòng và chơi cờ 1v1 mượt mà.
  - Cố tình gian lận sửa code phía client để đi sai lượt sẽ bị Firebase Security Rules từ chối cập nhật database.

---

## Phase 1.4: Hoàn thiện HUD, Âm thanh & Trải nghiệm Người dùng (Sprint 6)
**Mục tiêu:** Bổ sung các tính năng phụ trợ quan trọng như lịch sử nước đi, hiệu ứng tương tác chuột, âm thanh và xử lý kết thúc ván đấu.

* **Công việc chính:**
  - Xây dựng component `MoveLog.tsx` hiển thị danh sách nước đi theo chuẩn ký hiệu SAN.
  - Tích hợp hệ thống âm thanh (tiếng đặt quân, bắt quân, chiếu, hết giờ) qua Web Audio API / Howler.js với `useSettingsStore` quản lý âm lượng.
  - Tích hợp hiệu ứng chuột nghiêng 3D nhẹ (`usePointerField`) cho các quân cờ khi rê chuột (có hỗ trợ tự tắt khi bật chế độ giảm chuyển động).
  - Xây dựng Modal kết quả trận đấu (Thắng/Thua/Hòa/Hết giờ) và nút chơi lại / về Lobby.
* **Tiêu chí hoàn thành (Definition of Done):**
  - Giao diện phản hồi âm thanh và chuyển động nhạy bén, không giật lag (đạt 60 FPS).
  - Ván cờ tự động kết thúc khi có chiếu bí hoặc hết giờ, hiển thị bảng tổng kết chính xác.

---

## Phase 1.5: Kiểm thử, Tối ưu & Đóng gói Portfolio (Sprint 7)
**Mục tiêu:** Kiểm tra tổng thể, fix lỗi edge cases, viết tài liệu README hoàn chỉnh và deploy lên môi trường production miễn phí.

* **Công việc chính:**
  - Kiểm thử các trường hợp đặc biệt: người chơi thoát giữa trận (disconnect), hòa do lặp 3 lần / pat, đồng hồ về 0.
  - Tối ưu hóa performance (sử dụng `React.memo` cho các ô cờ và quân cờ).
  - Viết tài liệu hướng dẫn sử dụng và mô tả kiến trúc trong file `README.md` (nhấn mạnh điểm cộng Serverless + Security Rules).
  - Deploy Frontend lên Vercel/Netlify và cấu hình Production Firebase Realtime Database Rules.
* **Tiêu chí hoàn thành (Definition of Done):**
  - Website chạy ổn định trên link production công khai, hoàn toàn miễn phí ($0/tháng trên Spark Plan).
  - Hoàn thành portfolio item sẵn sàng chia sẻ với nhà tuyển dụng.