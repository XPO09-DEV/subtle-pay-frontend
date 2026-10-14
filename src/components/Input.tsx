import { useState } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

/** Shared form field; password fields include an accessible visibility toggle. */
export default function Input({ label, type, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="block rounded-xl border border-gray-200 bg-white px-4 py-2 focus-within:border-brand">
      <span className="text-xs text-gray-500">{label}</span>
      <div className={isPassword ? "relative" : undefined}>
        <input
          {...rest}
          type={isPassword && visible ? "text" : type}
          className={`mt-1 block w-full bg-transparent outline-none ${isPassword ? "pr-14" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-brand"
            onClick={(event) => { event.preventDefault(); setVisible((current) => !current); }}
            aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={visible}
          >
            {visible ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </label>
  );
}
