"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Search } from "lucide-react";
import { issueLoanAction } from "@/app/actions";
import { EMPTY_RESULT, hasError, isSuccess } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import type { Book, Member } from "@/lib/types";

/* ==========================================================================
   Form cho mượn, 2 bước: chọn sách rồi chọn hội viên.
   Toàn bộ kiểm tra nghiệp vụ nằm ở server (issueLoan trong lib/api.ts),
   phía client chỉ hiển thị trước để thủ thư đọc nhanh.
   ========================================================================== */

export type IssueOption = {
  book: Book;
  copies: { id: string; copyLabel: string; taken: boolean }[];
};

export type IssueMember = Member & {
  activeCount: number;
  overdueCount: number;
  overdueFine: number;
};

export function IssueForm({
  bookOptions,
  memberOptions,
  loanDays,
}: {
  bookOptions: IssueOption[];
  memberOptions: IssueMember[];
  finePerDay: number;
  loanDays: number;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    issueLoanAction,
    EMPTY_RESULT,
  );
  const [query, setQuery] = useState("");
  const [bookId, setBookId] = useState("");
  const [copyId, setCopyId] = useState("");
  const [memberId, setMemberId] = useState("");

  const filteredBooks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bookOptions;
    return bookOptions.filter(
      (o) =>
        o.book.title.toLowerCase().includes(needle) ||
        o.book.code.toLowerCase().includes(needle),
    );
  }, [query, bookOptions]);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return memberOptions;
    return memberOptions.filter(
      (m) =>
        m.name.toLowerCase().includes(needle) ||
        m.code.includes(needle),
    );
  }, [query, memberOptions]);

  const book = bookOptions.find((o) => o.book.id === bookId)?.book ?? null;
  const member = memberOptions.find((m) => m.id === memberId) ?? null;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dueDate = new Date(today.getTime() + loanDays * 86_400_000);
  const dueAt = dueDate.toISOString().slice(0, 10);

  // Điều kiện chặn, hiển thị ngay dưới phiếu.
  const blockReason = !member
    ? null
    : member.expiryDate < todayStr
      ? `Thẻ đã hết hạn ngày ${member.expiryDate}. Cần gia hạn trước.`
      : member.activeCount >= member.maxBooks
        ? `Đã đạt hạn mức mượn: đang mượn ${member.activeCount} trên ${member.maxBooks} cuốn.`
        : member.overdueCount > 0
          ? `Còn ${member.overdueCount} cuốn quá hạn, nợ ${member.overdueFine.toLocaleString("vi-VN")} đ. Cần thu phí trước khi mượn tiếp.`
          : null;

  const selectedOption = bookOptions.find((o) => o.book.id === bookId);
  const selectedCopy = selectedOption?.copies.find((c) => c.id === copyId);

  const canSubmit = Boolean(book && member && copyId && !blockReason);

  return (
    <>
      {isSuccess(state) ? (
        <div className="notice is-ok">
          <Check size={15} strokeWidth={2.2} aria-hidden />
          <div>
            <strong>{state.message}</strong>
            <span>Đã trừ 1 bản trong kho. Xem tại danh sách phiếu mượn.</span>
          </div>
        </div>
      ) : null}

      <div className="issue-grid">
        <div>
          <section className="section">
            <h2 className="section-heading">Bước 1, chọn sách</h2>
            <div className="fieldset">
              <label className="search-inline">
                <Search size={14} strokeWidth={2} aria-hidden />
                <input
                  type="search"
                  placeholder="Tên sách hoặc mã kho"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Tìm sách"
                />
              </label>
              <span className="filter-count">Chỉ hiện cuốn còn bản sẵn có</span>
            </div>

            <div className="rows">
              {filteredBooks.slice(0, 6).map((o) => (
                <div key={o.book.id} className="row c3">
                  <span className="no code">{o.book.code}</span>
                  <div>
                    <span className="title">{o.book.title}</span>
                    <span className="sub">
                      {o.book.author}, còn {o.book.available} trên {o.book.copies} bản
                    </span>
                  </div>
                  <button
                    type="button"
                    className={bookId === o.book.id ? "btn is-on" : "btn btn-quiet"}
                    onClick={() => {
                      setBookId(o.book.id);
                      setCopyId("");
                    }}
                  >
                    {bookId === o.book.id ? "Đã chọn" : "Chọn"}
                  </button>
                </div>
              ))}
              {filteredBooks.length === 0 ? (
                <p className="muted">Không còn cuốn nào sẵn có khớp từ khoá.</p>
              ) : null}
            </div>

            {selectedOption ? (
              <div className="copy-picker">
                <h3>Chọn bản vật lý</h3>
                <div className="copy-grid">
                  {selectedOption.copies.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={c.taken}
                      className={copyId === c.id ? "copy-chip is-on" : "copy-chip"}
                      onClick={() => setCopyId(c.id)}
                    >
                      {c.copyLabel}
                    </button>
                  ))}
                </div>
                <span className="hint">
                  Bản đang được mượn sẽ bị khoá. Bản trong kệ mới giao được.
                </span>
              </div>
            ) : null}
          </section>

          <section className="section">
            <h2 className="section-heading">Bước 2, chọn hội viên</h2>
            <div className="rows">
              {filteredMembers.slice(0, 6).map((m) => (
                <div key={m.id} className="row c3">
                  <span className="no code">{m.code}</span>
                  <div>
                    <span className="title">{m.name}</span>
                    <span className="sub">
                      Hạng {m.tier}, đang mượn {m.activeCount} trên {m.maxBooks}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={memberId === m.id ? "btn is-on" : "btn btn-quiet"}
                    onClick={() => setMemberId(m.id)}
                  >
                    {memberId === m.id ? "Đã chọn" : "Chọn"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="slip issue-slip">
          <h2>Phiếu mượn</h2>
          <p className="when-label">Kiểm tra trước khi giao sách</p>

          <div className="slip-group">
            <div className="slip-row">
              <span className="t">{book ? book.title : "Chưa chọn sách"}</span>
              <span className="m">
                {book
                  ? `${book.author}${selectedCopy ? `, bản ${selectedCopy.copyLabel}` : ""}`
                  : "Tìm và chọn một cuốn ở bước 1"}
              </span>
            </div>
            <div className="slip-row">
              <span className="t">{member ? member.name : "Chưa chọn hội viên"}</span>
              <span className="m">
                {member
                  ? `Thẻ ${member.code}, hạng ${member.tier}`
                  : "Tìm và chọn một thẻ ở bước 2"}
              </span>
            </div>
            <div className="slip-row">
              <span className="t code">{dueAt}</span>
              <span className="m">Hạn trả sau {loanDays} ngày</span>
            </div>
          </div>

          {blockReason ? (
            <div className="notice is-bad">
              <AlertTriangle size={15} strokeWidth={2.2} aria-hidden />
              <div>
                <strong>Chưa đủ điều kiện mượn.</strong>
                <span>{blockReason}</span>
              </div>
            </div>
          ) : null}

          {hasError(state) ? (
            <div className="notice is-bad">
              <AlertTriangle size={15} strokeWidth={2.2} aria-hidden />
              <div>
                <strong>Không tạo được phiếu.</strong>
                <span>{state.message}</span>
              </div>
            </div>
          ) : null}

          <form action={formAction}>
            <input type="hidden" name="bookId" value={bookId} />
            <input type="hidden" name="copyId" value={copyId} />
            <input type="hidden" name="memberId" value={memberId} />
            <button className="btn btn-full" type="submit" disabled={!canSubmit}>
              {canSubmit ? "Giao sách và tạo phiếu" : "Chưa đủ điều kiện"}
            </button>
          </form>

          <Link className="back-link" href="/loans">
            Quay lại danh sách phiếu
          </Link>
        </aside>
      </div>
    </>
  );
}