"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { updateReservationAction } from "@/app/actions";
import { EMPTY_RESULT, isSuccess } from "@/lib/action-result";
import type { ReservationStatus } from "@/lib/types";

/**
 * Đổi trạng thái một lượt đặt trước.
 *
 * Chỉ hiện nút hợp lệ với trạng thái hiện tại:
 *  - `waiting`: báo sẵn sàng, hoặc huỷ.
 *  - `ready`: báo đã lấy, hoặc huỷ.
 */
export function ReservationActions({
  reservationId,
  status,
}: {
  reservationId: string;
  status: ReservationStatus;
}) {
  const [state, formAction] = useActionState(
    updateReservationAction,
    EMPTY_RESULT,
  );

  if (isSuccess(state)) {
    return (
      <span className="status is-ok-inline">
        <Check size={13} strokeWidth={2.4} aria-hidden />
        Đã cập nhật
      </span>
    );
  }

  if (status === "picked_up" || status === "cancelled") return null;

  const next: ReservationStatus = status === "waiting" ? "ready" : "picked_up";
  const nextLabel = status === "waiting" ? "Báo sẵn sàng" : "Đã lấy sách";

  return (
    <>
      <form action={formAction} className="inline-form">
        <input type="hidden" name="id" value={reservationId} />
        <input type="hidden" name="status" value={next} />
        <button className="btn btn-quiet" type="submit">
          {nextLabel}
        </button>
      </form>

      {status === "waiting" ? (
        <form action={formAction} className="inline-form">
          <input type="hidden" name="id" value={reservationId} />
          <input type="hidden" name="status" value="cancelled" />
          <button className="btn btn-quiet" type="submit">
            Huỷ
          </button>
        </form>
      ) : null}
    </>
  );
}
