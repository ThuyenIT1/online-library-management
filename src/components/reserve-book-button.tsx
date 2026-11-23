"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { BookmarkPlus, Check } from "lucide-react";
import { reserveBookAction } from "@/app/actions";
import { EMPTY_RESULT, hasError, isSuccess } from "@/lib/action-result";

/**
 * Nút đặt trước sách.
 *
 * Chọn hội viên trong danh sách rồi ghi nhận một lượt đặt trước với
 * trạng thái `waiting`.
 */
export function ReserveBookButton({
  bookId,
  members,
}: {
  bookId: string;
  members: { id: string; name: string; code: string }[];
}) {
  const [state, formAction] = useActionState(reserveBookAction, EMPTY_RESULT);
  const [open, setOpen] = useState(false);

  if (isSuccess(state)) {
    return (
      <span className="status is-ok-inline">
        <Check size={13} strokeWidth={2.4} aria-hidden />
        Đã đặt trước
      </span>
    );
  }

  return (
    <>
      <button className="btn btn-quiet" onClick={() => setOpen(true)}>
        <BookmarkPlus size={12} strokeWidth={2} aria-hidden />
        Đặt trước
      </button>

      {open ? (
        <div className="confirm" role="dialog" aria-label="Đặt trước sách">
          <p>Chọn hội viên muốn đặt trước cuốn sách này.</p>
          {hasError(state) ? (
            <p className="form-error" role="alert">
              {state.message}
            </p>
          ) : null}
          <form action={formAction}>
            <input type="hidden" name="bookId" value={bookId} />
            <div className="field">
              <label htmlFor={`reserve-member-${bookId}`}>Hội viên</label>
              <select
                id={`reserve-member-${bookId}`}
                name="memberId"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Chọn hội viên…
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · thẻ {m.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="confirm-actions">
              <ConfirmSubmit />
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setOpen(false)}
              >
                Huỷ
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Đang ghi" : "Ghi nhận đặt trước"}
    </button>
  );
}
