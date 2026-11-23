"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { signUpAction } from "@/app/actions";
import { EMPTY_RESULT, hasError } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-block" type="submit" disabled={pending}>
      {pending ? "Đang tạo" : "Tạo tài khoản"}
    </button>
  );
}

export default function JoinPage() {
  const [state, formAction] = useActionState(signUpAction, EMPTY_RESULT);

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="wordmark dark">
          Sổ <b>Mượn</b>
        </div>
        <p className="auth-sub">Cấp tài khoản thủ thư mới</p>

        <form action={formAction}>
          <div className="field">
            <label htmlFor="fullName">Họ và tên</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              placeholder="Trần Thanh"
            />
            {state?.fieldErrors?.fullName ? (
              <span className="hint is-error">{state.fieldErrors.fullName}</span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="thu.thu@thuvien.vn"
            />
            {state?.fieldErrors?.email ? (
              <span className="hint is-error">{state.fieldErrors.email}</span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Tối thiểu 8 ký tự"
            />
            {state?.fieldErrors?.password ? (
              <span className="hint is-error">{state.fieldErrors.password}</span>
            ) : null}
          </div>

          {hasError(state) && !state.fieldErrors ? (
            <p className="form-error" role="alert">
              {state.message}
            </p>
          ) : null}

          <SubmitButton />
        </form>

        <p className="auth-alt">
          Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </p>
      </div>
    </main>
  );
}
