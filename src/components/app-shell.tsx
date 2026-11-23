import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Rail, Topbar } from "@/components/shell";
import type { Notice } from "@/components/shell";
import { getSettings, listBooks, listLoans, listMembers, listReservations } from "@/lib/api";
import { daysLate, daysLeft, todayISO } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Vỏ ứng dụng cho mọi trang cần đăng nhập.
 * Kiểm tra phiên, tải cấu hình thư viện, rồi dựng thanh trên và rail.
 */
export async function AppShell({
  children,
  panel,
}: {
  children: ReactNode;
  panel?: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const settings = await getSettings();
  const notices = await buildNotices();

  return (
    <>
      <Topbar user={user as User} libraryName={settings.name} notices={notices} />
      <div className={panel ? "shell" : "shell no-panel"}>
        <Rail />
        <main className="center">{children}</main>
        {panel}
      </div>
    </>
  );
}

/**
 * Gom các việc đang treo thành danh sách thông báo cho nút chuông.
 *
 * Chỉ tính những việc thủ thư cần can thiệp: sách hết bản, thẻ sắp hết
 * hạn, phiếu quá hạn và lượt đặt trước đang chờ.
 */
async function buildNotices(): Promise<Notice[]> {
  const today = todayISO();

  const [books, members, loans, reservations] = await Promise.all([
    listBooks(),
    listMembers(),
    listLoans(today),
    listReservations(),
  ]);

  const notices: Notice[] = [];

  for (const b of books) {
    if (b.available === 0) {
      notices.push({
        id: `book-${b.id}`,
        text: `${b.title} đã hết bản trong kệ`,
        href: `/books/${b.id}`,
        tone: "late",
      });
    }
  }

  for (const m of members) {
    const left = daysLeft(m.expiryDate, today);
    if (left >= 0 && left <= 30) {
      notices.push({
        id: `member-${m.id}`,
        text: `Thẻ ${m.name} hết hạn sau ${left} ngày`,
        href: `/members/${m.id}`,
        tone: left <= 7 ? "late" : "neutral",
      });
    }
  }

  for (const l of loans) {
    if (l.returnedAt) continue;
    if (daysLate(l.dueAt, today) > 0) {
      notices.push({
        id: `loan-${l.id}`,
        text: `Phiếu ${l.receiptCode} đã quá hạn`,
        href: `/loans?tab=overdue`,
        tone: "late",
      });
    }
  }

  const waiting = reservations.filter(
    (r) => r.status === "waiting" || r.status === "ready",
  );
  const bookTitle = new Map(books.map((b) => [b.id, b.title]));
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  for (const r of waiting) {
    const title = bookTitle.get(r.bookId) ?? "Sách";
    const who = memberName.get(r.memberId) ?? "Hội viên";
    notices.push({
      id: `res-${r.id}`,
      text: `${who} đang chờ đặt trước "${title}"`,
      href: "/reservations",
      tone: "neutral",
    });
  }

  return notices;
}
