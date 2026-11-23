// Kiểu dữ liệu dùng chung giữa giao diện và lớp truy cập Supabase.
// Đây là hợp đồng: đổi cách lấy dữ liệu thì giao diện không phải sửa.

export type LoanStatus = "borrowed" | "returned" | "overdue";

export type MemberTier = "Thường" | "Vàng" | "Đọc tại chỗ";

export type MemberStatus = "active" | "suspended";

export type ReservationStatus = "waiting" | "ready" | "picked_up" | "cancelled";

export type CopyCondition = "Tốt" | "Khá" | "Hư cần sửa" | "Hư";

export type Book = {
  id: string;
  code: string;
  title: string;
  author: string;
  subject: string;
  publisher: string | null;
  year: number | null;
  pages: number | null;
  shelf: string | null;
  keywords: string | null;
  summary: string | null;
  copies: number;
  available: number;
  coverTitle: string;
};

export type BookCopy = {
  id: string;
  bookId: string;
  copyLabel: string;
  condition: CopyCondition;
  acquiredOn: string | null;
};

export type Member = {
  id: string;
  code: string;
  name: string;
  tier: MemberTier;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  expiryDate: string;
  status: MemberStatus;
  maxBooks: number;
  /** Số cuốn đang mượn. Tính từ bảng loans, không lưu trong members. */
  borrowCount: number;
  /** Ghi chú nội bộ về hội viên. */
  notes: string | null;
};

export type Loan = {
  id: string;
  receiptCode: string;
  bookId: string;
  copyId: string | null;
  memberId: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: LoanStatus;
  copyLabel: string;
  fineAmount: number;
  /** Số lần đã gia hạn. Đếm từ nhật ký thao tác, không lưu trong bảng loans. */
  renewCount: number;
};

/**
 * Một khoản nợ của hội viên.
 *
 * Nợ có hai nguồn:
 *  - Dòng phí đã ghi khi trả sách trễ hạn (fineId khác null).
 *  - Phiếu đang mượn nhưng đã quá hạn (fineId null, tiền tính theo ngày).
 */
export type Debt = {
  /** Mã dòng phí. Null nghĩa là phiếu còn đang mượn, chưa ghi dòng phí. */
  fineId: string | null;
  loanId: string | null;
  receiptCode: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  bookTitle: string;
  daysLate: number;
  amount: number;
  paid: boolean;
  paidOn: string | null;
};

export type Fine = {
  id: string;
  loanId: string | null;
  memberId: string;
  daysLate: number;
  amount: number;
  paid: boolean;
  paidAt: string | null;
};

export type Reservation = {
  id: string;
  bookId: string;
  memberId: string;
  reservedAt: string;
  status: ReservationStatus;
};

export type LibrarySettings = {
  name: string;
  loanDays: number;
  finePerDay: number;
  maxRenewals: number;
};

/* ==========================================================================
   Hằng số và hàm thuần khiết
   Không phụ thuộc Supabase, dùng được cả ở server lẫn client.
   ========================================================================== */

/** Số ngày trễ tính từ hạn trả. Trả về 0 nếu chưa quá hạn. */
export function daysLate(dueAt: string, today: string): number {
  const due = new Date(dueAt + "T00:00:00").getTime();
  const now = new Date(today + "T00:00:00").getTime();
  const diff = Math.floor((now - due) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Số ngày còn lại trước hạn. Âm nếu đã quá hạn. */
export function daysLeft(dueAt: string, today: string): number {
  const due = new Date(dueAt + "T00:00:00").getTime();
  const now = new Date(today + "T00:00:00").getTime();
  return Math.floor((due - now) / 86_400_000);
}

/** Định dạng ngày kiểu Việt Nam: 15/11/2026 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Định dạng ngày ngắn: 15/11 */
export function formatDateShort(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

/** Định dạng số tiền rút gọn: 12,4tr */
export function formatVND(n: number): string {
  if (n >= 1_000_000) {
    return (
      (n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "tr"
    );
  }
  if (n >= 1000) return Math.round(n / 1000) + "ng";
  return n.toLocaleString("vi-VN");
}

/** Số tiền đầy đủ: 85.000 đ */
export function formatVNDFull(n: number): string {
  return n.toLocaleString("vi-VN") + " đ";
}

/** Thẻ còn hiệu lực chưa. */
export function isMembershipValid(expiryDate: string, today: string): boolean {
  return (
    new Date(expiryDate + "T00:00:00").getTime() >=
    new Date(today + "T00:00:00").getTime()
  );
}

/** Hội viên còn được mượn bao nhiêu cuốn. */
export function remainingQuota(member: Member, activeLoans: number): number {
  return Math.max(0, member.maxBooks - activeLoans);
}

/** Ngày hôm nay theo giờ địa phương, dạng YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/** Cộng số ngày vào một chuỗi ngày, trả về YYYY-MM-DD. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/** Số tiền phạt trễ hạn. */
export function computeFine(lateDays: number, finePerDay: number): number {
  return Math.max(0, lateDays) * finePerDay;
}
