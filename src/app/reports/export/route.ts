import { listDebts, listLoans } from "@/lib/api";
import { todayISO } from "@/lib/types";

/**
 * Xuất báo cáo ra file CSV.
 *
 *   GET /reports/export?period=30&kind=loans|debts|all
 *
 * - `loans`: danh sách phiếu mượn trong kỳ.
 * - `debts`: danh sách khoản nợ trễ hạn.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = Number(url.searchParams.get("period") ?? "30");
  const kind = url.searchParams.get("kind") ?? "all";
  const days = Number.isFinite(period) && period > 0 ? period : 30;

  const today = todayISO();
  const from = shiftDays(today, -days);

  // Mỗi khối là một bảng: hàng tiêu đề + các dòng dữ liệu.
  const blocks: string[][][] = [];

  if (kind === "loans" || kind === "all") {
    const loans = await listLoans(today);
    const rows: string[][] = loans
      .filter((l) => l.borrowedAt >= from && l.borrowedAt <= today)
      .map((l) => [
        l.receiptCode,
        l.borrowedAt,
        l.dueAt,
        l.returnedAt ?? "",
        l.status,
        String(l.renewCount),
        String(l.fineAmount),
      ]);
    blocks.push([
      [
        "Mã phiếu",
        "Ngày mượn",
        "Hạn trả",
        "Ngày trả",
        "Trạng thái",
        "Số lần gia hạn",
        "Phí",
      ],
      ...rows,
    ]);
  }

  if (kind === "debts" || kind === "all") {
    const debts = await listDebts();
    const rows: string[][] = debts.map((d) => [
      d.receiptCode,
      d.memberCode,
      d.memberName,
      d.bookTitle,
      String(d.daysLate),
      String(d.amount),
      d.paid ? "Đã thu" : "Chưa thu",
      d.paidOn ?? "",
    ]);
    blocks.push([
      [
        "Mã phiếu",
        "Số thẻ",
        "Hội viên",
        "Sách",
        "Ngày trễ",
        "Số tiền",
        "Trạng thái",
        "Ngày thu",
      ],
      ...rows,
    ]);
  }

  const csv = blocks.map((b) => toCsv(b)).join("\r\n\r\n");
  const name = `bao-cao-${days}-ngay-${today}.csv`;

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

function shiftDays(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell);
          return /["\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\r\n");
}
