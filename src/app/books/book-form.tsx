"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { createBookAction, updateBookAction } from "@/app/actions";
import { EMPTY_RESULT, hasError, isSuccess } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import type { Book } from "@/lib/types";

export function BookForm({
  book,
  mode = "create",
}: {
  /** Đầu sách đang sửa. Bỏ trống thì form dùng để nhập sách mới. */
  book?: Book;
  mode?: "create" | "edit";
}) {
  const isEdit = mode === "edit" && Boolean(book);

  const [state, formAction] = useActionState<ActionResult, FormData>(
    isEdit ? updateBookAction : createBookAction,
    EMPTY_RESULT,
  );

  const backHref = isEdit ? `/books/${book!.id}` : "/books";

  if (isSuccess(state)) {
    return (
      <div className="notice is-ok">
        <Check size={15} strokeWidth={2.2} aria-hidden />
        <div>
          <strong>{state.message}</strong>
          <span>
            {state.id ? (
              <Link href={`/books/${state.id}`}>Xem hồ sơ đầu sách</Link>
            ) : (
              <Link href={backHref}>Quay lại kho sách</Link>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="form-card">
      {isEdit ? <input type="hidden" name="id" value={book!.id} /> : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="code">Mã sách</label>
          <input
            id="code"
            name="code"
            required
            defaultValue={book?.code ?? ""}
            placeholder="8432-B"
          />
        </div>
        <div className="field">
          <label htmlFor="subject">Chủ đề</label>
          <input
            id="subject"
            name="subject"
            required
            defaultValue={book?.subject ?? ""}
            placeholder="Văn học"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="title">Tên sách</label>
        <input
          id="title"
          name="title"
          required
          defaultValue={book?.title ?? ""}
          placeholder="Bên kia sông"
        />
      </div>

      <div className="field">
        <label htmlFor="author">Tác giả</label>
        <input
          id="author"
          name="author"
          required
          defaultValue={book?.author ?? ""}
          placeholder="Nguyễn Quang Thiều"
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="publisher">Nhà xuất bản</label>
          <input
            id="publisher"
            name="publisher"
            defaultValue={book?.publisher ?? ""}
            placeholder="NXB Văn học"
          />
        </div>
        <div className="field">
          <label htmlFor="year">Năm xuất bản</label>
          <input
            id="year"
            name="year"
            type="number"
            min={1000}
            max={2100}
            defaultValue={book?.year ?? ""}
            placeholder="1987"
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="pages">Số trang</label>
          <input
            id="pages"
            name="pages"
            type="number"
            min={1}
            defaultValue={book?.pages ?? ""}
            placeholder="312"
          />
        </div>
        <div className="field">
          <label htmlFor="shelf">Vị trí kệ</label>
          <input
            id="shelf"
            name="shelf"
            defaultValue={book?.shelf ?? ""}
            placeholder="Khoang 3, tầng 2"
          />
        </div>
      </div>

      {isEdit ? (
        <div className="field">
          <label htmlFor="extraCopies">Thêm bản vật lý</label>
          <input
            id="extraCopies"
            name="extraCopies"
            type="number"
            min={0}
            max={50}
            defaultValue={0}
          />
          <span className="hint">
            Số bản vật lý cần nhập thêm. Hiện có {book!.copies} bản,{" "}
            {book!.available} bản còn trong kệ.
          </span>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="copies">Số bản vật lý</label>
          <input
            id="copies"
            name="copies"
            type="number"
            min={1}
            max={50}
            defaultValue={1}
          />
          <span className="hint">Mỗi bản được đánh số A1, A2, A3…</span>
        </div>
      )}

      <div className="field">
        <label htmlFor="keywords">Từ khoá</label>
        <input
          id="keywords"
          name="keywords"
          defaultValue={book?.keywords ?? ""}
          placeholder="chiến tranh, nông thôn"
        />
      </div>

      <div className="field">
        <label htmlFor="summary">Tóm tắt</label>
        <textarea
          id="summary"
          name="summary"
          rows={5}
          defaultValue={book?.summary ?? ""}
          placeholder="Giới thiệu nội dung đầu sách"
        />
      </div>

      {hasError(state) ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="form-actions">
        <SubmitButton isEdit={isEdit} />
        <Link className="btn btn-quiet" href={backHref}>
          Huỷ
        </Link>
      </div>
    </form>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Đang lưu" : isEdit ? "Lưu hồ sơ" : "Nhập sách"}
    </button>
  );
}
