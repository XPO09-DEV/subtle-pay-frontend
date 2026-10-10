type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "light" | "danger";
};

const styles = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  light: "bg-white border border-gray-200 text-brand",
  danger: "bg-red-50 text-red-600",
};

export default function Button({ variant = "primary", className = "", ...rest }: Props) {
  return (
    <button
      className={`min-h-12 w-full rounded-xl px-4 py-3 font-medium transition active:scale-[0.98] disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
