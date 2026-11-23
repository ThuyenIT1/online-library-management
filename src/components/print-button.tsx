"use client";

import { Printer } from "lucide-react";

/**
 * Nút in trang. Gọi window.print() nên người dùng chọn máy in hoặc
 * "Lưu thành PDF" trong hộp thoại của trình duyệt.
 */
export function PrintButton({ label = "In báo cáo" }: { label?: string }) {
  return (
    <button className="btn" onClick={() => window.print()}>
      <Printer size={13} strokeWidth={1.8} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
