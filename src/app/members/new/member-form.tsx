"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { createMemberAction, updateMemberAction } from "@/app/actions";
import { EMPTY_RESULT, hasError, isSuccess } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import type { Member } from "@/lib/types";

export function MemberForm({
  member,
  mode = "create",
}: {
  /** Hồ sơ đang sửa. Bỏ trống thì form dùng để cấp thẻ mới. */
  member?: Member;
  mode?: "create" | "edit";
}) {
  const isEdit = mode === "edit" && Boolean(member);

  const [state, formAction] = useActionState<ActionResult, FormData>(
    isEdit ? updateMemberAction : createMemberAction,
    EMPTY_RESULT,
  );

  const backHref = isEdit ? `/members/${member!.id}` : "/members";

  if (isSuccess(state)) {
    return (
      <div className="notice is-ok">
        <Check size={15} strokeWidth={2.2} aria-hidden />
        <div>
          <strong>{state.message}</strong>
          <span>
            <Link href={backHref}>Quay lại hồ sơ hội viên</Link>
          </span>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="form-card">
      {isEdit ? <input type="hidden" name="id" value={member!.id} /> : null}

      <div className="field">
        <label htmlFor="fullName">Họ và tên</label>
        <input
          id="fullName"
          name="fullName"
          required
          defaultValue={member?.name ?? ""}
          placeholder="Nguyễn Văn A"
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={member?.email ?? ""}
            placeholder="a@example.com"
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Điện thoại</label>
          <input
            id="phone"
            name="phone"
            defaultValue={member?.phone ?? ""}
            placeholder="090 000 0000"
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="tier">Hạng thẻ</label>
          <select id="tier" name="tier" defaultValue={member?.tier ?? "Thường"}>
            <option value="Thường">Thường, tối đa 5 cuốn</option>
            <option value="Vàng">Vàng, tối đa 8 cuốn</option>
            <option value="Đọc tại chỗ">Đọc tại chỗ, không mượn</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="maxBooks">Hạn mức mượn</label>
          <input
            id="maxBooks"
            name="maxBooks"
            type="number"
            min={0}
            max={20}
            defaultValue={member?.maxBooks ?? 5}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="joinedOn">Ngày cấp thẻ</label>
          <input
            id="joinedOn"
            name="joinedOn"
            type="date"
            defaultValue={member?.joinedAt ?? new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="field">
          <label htmlFor="expiresOn">Ngày hết hạn</label>
          <input
            id="expiresOn"
            name="expiresOn"
            type="date"
            required
            defaultValue={member?.expiryDate ?? ""}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="status">Trạng thái</label>
        <select id="status" name="status" defaultValue={member?.status ?? "active"}>
          <option value="active">Đang hoạt động</option>
          <option value="suspended">Tạm khoá</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="notes">Ghi chú</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={member?.notes ?? ""}
          placeholder="Ghi chú nội bộ"
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
      {pending ? "Đang lưu" : isEdit ? "Lưu hồ sơ" : "Cấp thẻ"}
    </button>
  );
}
