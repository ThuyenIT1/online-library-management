"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Check, TriangleAlert } from "lucide-react";
import { importMembersAction } from "@/app/actions";
import { EMPTY_RESULT, hasError, isSuccess } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";

/**
 * Nhập hội viên hàng loạt từ CSV.
 *
 * Hai cách nhập:
 *  - Dán thẳng nội dung CSV vào ô nhập.
 *  - Tải file .csv lên, nội dung file được đọc bằng FileReader.
 *
 * Dùng useActionState để hiện kết quả ngay tại trang, không cần chuyển hướng.
 */
export function MemberImportForm() {
  const [csv, setCsv] = useState("");
  const [state, formAction] = useActionState<ActionResult, FormData>(
    importMembersAction,
    EMPTY_RESULT,
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    setCsv(await file.text());
  }

  return (
    <>
      <div className="form-card">
        <div className="field">
          <label htmlFor="csvFile">Tệp CSV</label>
          <input
            id="csvFile"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <span className="hint">
            Cột bắt buộc: <code className="code">Họ tên</code> và{" "}
            <code className="code">Ngày hết hạn</code>. Tuỳ chọn:{" "}
            <code className="code">Email</code>, <code className="code">Điện thoại</code>,{" "}
            <code className="code">Hạng</code>, <code className="code">Hạn mức</code>,{" "}
            <code className="code">Ngày cấp</code>, <code className="code">Ghi chú</code>.
          </span>
        </div>

        <form action={formAction}>
          <div className="field">
            <label htmlFor="csv">Nội dung CSV</label>
            <textarea
              id="csv"
              name="csv"
              rows={10}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={
                "Họ tên,Email,Điện thoại,Hạng,Hạn mức,Ngày cấp,Ngày hết hạn,Ghi chú\n" +
                "Nguyễn Văn A,a@example.com,090 000 0000,Thường,5,2026-01-01,2027-01-01,"
              }
            />
          </div>

          <div className="form-actions">
            <SubmitButton disabled={!csv.trim()} />
            <Link className="btn btn-quiet" href="/members">
              Huỷ
            </Link>
          </div>
        </form>
      </div>

      {hasError(state) ? (
        <div className="notice is-bad">
          <TriangleAlert size={15} strokeWidth={2.2} aria-hidden />
          <div>
            <strong>Không nhập được</strong>
            <span>{state.message}</span>
          </div>
        </div>
      ) : null}

      {isSuccess(state) ? (
        <div className="notice is-ok">
          <Check size={15} strokeWidth={2.2} aria-hidden />
          <div>
            <strong>{state.message}</strong>
            <span>
              <Link href="/members">Quay lại danh sách hội viên</Link>
            </span>
          </div>
        </div>
      ) : null}

      <p className="hint">
        Mẫu CSV: mỗi dòng là một hội viên, các cột phân tách bằng dấu phẩy.
        Ngày viết theo dạng YYYY-MM-DD.
      </p>
    </>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={disabled || pending}>
      {pending ? "Đang nhập" : "Nhập hội viên"}
    </button>
  );
}
