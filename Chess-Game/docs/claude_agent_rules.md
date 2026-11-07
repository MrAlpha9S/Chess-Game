# AI Agent Operating Guidelines & Governance Rules

## 1. Nguyên Tắc Cốt Lõi (Core Directives)
* **Doc-Driven Development (DDD):** Mọi dòng code, cấu trúc dữ liệu, và luồng logic phải tuân thủ 100% các tài liệu thiết kế đã thống nhất (`chess_game_architecture.md`, `chess_game_ui_design.md`, `phase_1_roadmap.md`).
* **Không Tự Ý Thay Đổi Kiến Trúc:** Không tự thêm backend riêng, Cloud Functions, hoặc đổi thư viện khác với Tech Stack đã chốt ngoại trừ khi có sự đồng ý của người dùng.
* **Stop-on-Error Protocol:** Khi gặp lỗi compile, lỗi runtime, hoặc xung đột logic giữa các component:
  1. Dừng ngay công việc hiện tại.
  2. Báo cáo nguyên nhân gốc rễ (Root Cause Analysis).
  3. Đưa ra 2-3 phương án khắc phục kèm ưu/nhược điểm để người dùng chọn.

## 2. Quy Trình Kiểm Tra & Tự Cập Nhật Doc (Self-Correction & Synchronization)

### A. Trước Khi Thực Thi Nhiệm Vụ Mới
* **Check Alignment:** Đọc lại các tài liệu kiến trúc liên quan để đảm bảo giải pháp code không làm hỏng tính năng sẵn sàng cho Phase 2 (như ma trận bàn cờ 10x10, schema RTDB, interface `IChessEngine`).

### B. Khi Người Dùng Yêu Cầu Tính Năng Mới/Hướng Đi Mới
* **Auto-Update Doc:** Nếu yêu cầu mới làm thay đổi luồng hoạt động, cấu trúc UI hoặc schema dữ liệu:
  1. Tiến hành cập nhật trực tiếp vào file tài liệu Markdown tương ứng (`architecture.md`, `ui_design.md`, hoặc `roadmap.md`).
  2. Thông báo ngắn gọn các điểm vừa thay đổi trong tài liệu trước khi bắt đầu viết code.

### C. Trong Quá Trình Viết Code
* **Tối ưu hóa Code Production-Ready:** Code TypeScript phải được định kiểu chặt chẽ (Strong Typing), có comment rõ ràng, và chia nhỏ module theo đúng cây thư mục thiết kế.

## 3. Quy Định Tương Tác Với Người Dùng
* Trình bày ngắn gọn, trực diện vào vấn đề.
* Khi kết thúc một công việc trong Roadmap, chủ động xác nhận kết quả và gợi ý bước tiếp theo theo đúng Phase trong `phase_1_roadmap.md`.