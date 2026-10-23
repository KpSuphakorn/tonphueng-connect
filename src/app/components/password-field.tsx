"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./icons";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & { label: ReactNode };

/**
 * Password input with a show/hide toggle. The toggle sits outside the <label> so the input's accessible name stays
 * the label text alone; it is type="button" so it never submits the form.
 */
export function PasswordField({ label, ...input }: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input {...input} id={id} type={shown ? "text" : "password"} autoCapitalize="none" spellCheck={false} />
        <button type="button" className="password-toggle" aria-label={shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={shown} aria-controls={id} disabled={input.disabled} onClick={() => setShown((value) => !value)}>
          <Icon name={shown ? "eyeOff" : "eye"} size={20} />
        </button>
      </div>
    </div>
  );
}
