"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Receipt } from "lucide-react";
import { payFineAction } from "@/app/actions";
import { EMPTY_RESULT, hasError, isSuccess } from "@/lib/action-result";
import { formatVNDFull } from "@/lib/types";

/**
 * Nút thu phí trễ hạn.
 *
 * Nợ có hai dạng:
 *  - Đã có dòng phí trong bảng `fines` (fineId khác null): đánh dấu đã thu.
 *  - Phiếu đang mượn quá hạn (fineId null): tạo dòng phí đã thu với số tiền nợ.
 */
export function PayFineButton({
  fineId,
  loanId,
  amount,
  label,
}: {
  fineId: string | null;
  loanId: string | null;
  amount: number;
  label?: string;
}) {
  const [state, formAction] = useActionState(payFineAction, EMPTY_RESULT);
  const [open, setOpen] = useState(false);

  if (isSuccess(state)) {
    return (
      <span className="status is-ok-inline">
        <Check size={13} strokeWidth={2.4} aria-hidden />
        Đã thu
      </span>
    );
  }

  return (
    <>
      <button className="btn btn-quiet" onClick={() => setOpen(true)}>
        <Receipt size={12} strokeWidth={2} aria-hidden />
        {label ?? "Thu phí"}
      </button>

      {open ? (
        <div className="confirm" role="dialog" aria-label="Xác nhận thu phí">
          <p>
            Ghi nhận đã thu{" "}
            <strong>{formatVNDFull(amount)}</strong> cho khoản nợ này?
          </p>
          {hasError(state) ? (
            <p className="form-error" role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="confirm-actions">
            <form action={formAction}>
              {fineId ? <input type="hidden" name="fineId" value={fineId} /> : null}
              {loanId ? <input type="hidden" name="loanId" value={loanId} /> : null}
              <input type="hidden" name="amount" value={String(amount)} />
              <ConfirmSubmit />
            </form>
            <button className="btn btn-quiet" onClick={() => setOpen(false)}>
              Huỷ
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Đang ghi" : "Xác nhận thu"}
    </button>
  );
}
