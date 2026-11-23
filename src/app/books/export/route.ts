import { listBooks } from "@/lib/api";

/**
 * Xuất danh mục sách ra file CSV.
 *
 *   GET /books/export?subject=Văn học&shelf=Khoang 3, tầng 2
 *
 * Bộ lọc dùng chung với trang /books nên file xuất khớp với
 * những gì thủ thư đang xem trên màn hình.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const subject = url.searchParams.get("subject") ?? "";
  const shelf = url.searchParams.get("shelf") ?? "";
  const q = url.searchParams.get("q") ?? "";

  const books = await listBooks({
    search: q,
    subject: subject || undefined,
    shelf: shelf || undefined,
  });

  const header = [
    "Mã sách",
    "Tên sách",
    "Tác giả",
    "Chủ đề",
    "Nhà xuất bản",
    "Năm",
    "Số trang",
    "Vị trí kệ",
    "Từ khoá",
    "Tổng bản",
    "Còn trong kệ",
  ];

  const rows = books.map((b) => [
    b.code,
    b.title,
    b.author,
    b.subject,
    b.publisher ?? "",
    b.year === null ? "" : String(b.year),
    b.pages === null ? "" : String(b.pages),
    b.shelf ?? "",
    b.keywords ?? "",
    String(b.copies),
    String(b.available),
  ]);

  const csv = toCsv([header, ...rows]);

  const name = `danh-muc-sach-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Bọc giá trị theo chuẩn CSV và nối các cột bằng dấu phẩy. */
function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell);
          // Dấu nháy, phẩy và xuống dòng phải được bọc trong nháy kép.
          return /["\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\r\n");
}
