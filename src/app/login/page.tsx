"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { signInAction } from "@/app/actions";
import { EMPTY_RESULT, hasError } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-block" type="submit" disabled={pending}>
      {pending ? "Đang kiểm tra" : "Vào bàn làm việc"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(signInAction, EMPTY_RESULT);

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="wordmark dark">
          Sổ <b>Mượn</b>
        </div>
        <p className="auth-sub">Thư viện Trung tâm, bàn làm việc của thủ thư</p>

        <form action={formAction}>
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
          </div>

          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>

          {hasError(state) ? (
            <p className="form-error" role="alert">
              {state.message}
            </p>
          ) : null}

          <SubmitButton />
        </form>

        <p className="auth-alt">
          Chưa có tài khoản? <Link href="/join">Đăng ký thủ thư</Link>
        </p>
      </div>
    </main>
  );
}
