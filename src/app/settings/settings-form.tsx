"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { updateSettingsAction } from "@/app/actions";
import { EMPTY_RESULT, hasError, isSuccess } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import type { LibrarySettings } from "@/lib/types";

export function SettingsForm({ settings }: { settings: LibrarySettings }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(
    updateSettingsAction,
    EMPTY_RESULT,
  );

  return (
    <>
      <form action={formAction} className="form-card">
        <div className="field">
          <label htmlFor="name">Tên thư viện</label>
          <input
            id="name"
            name="name"
            required
            defaultValue={settings.name}
            placeholder="Thư viện Trung tâm"
          />
          <span className="hint">Hiển thị ở góc trên bên phải và trên phiếu mượn.</span>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="loanDays">Số ngày mượn</label>
            <input
              id="loanDays"
              name="loanDays"
              type="number"
              min={1}
              max={365}
              required
              defaultValue={settings.loanDays}
            />
            <span className="hint">Hạn trả tính từ ngày mượn.</span>
          </div>
          <div className="field">
            <label htmlFor="maxRenewals">Số lần gia hạn tối đa</label>
            <input
              id="maxRenewals"
              name="maxRenewals"
              type="number"
              min={0}
              max={10}
              required
              defaultValue={settings.maxRenewals}
            />
            <span className="hint">Đặt 0 nếu không cho gia hạn.</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="finePerDay">Phí trễ hạn mỗi ngày (đ)</label>
          <input
            id="finePerDay"
            name="finePerDay"
            type="number"
            min={0}
            step={1000}
            required
            defaultValue={settings.finePerDay}
          />
          <span className="hint">
            Tính trên số ngày trễ tính đến ngày trả sách.
          </span>
        </div>

        {hasError(state) ? (
          <p className="form-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <div className="form-actions">
          <SubmitButton />
        </div>
      </form>

      {isSuccess(state) ? (
        <div className="notice is-ok">
          <Check size={15} strokeWidth={2.2} aria-hidden />
          <div>
            <strong>{state.message}</strong>
            <span>Cấu hình mới đã có hiệu lực với các phiếu tạo sau này.</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Đang lưu" : "Lưu cấu hình"}
    </button>
  );
}
