type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

export default function Input({ label, ...rest }: Props) {
  return (
<<<<<<< HEAD
    <label className="block rounded-xl border border-gray-200 bg-white px-4 py-2 focus-within:border-brand">
=======
    <label className="block rounded-xl border border-gray-200 bg-white px-4 py-2">
>>>>>>> a26f18097bfee4d553da3f1a17dee27e2f322425
      <span className="text-xs text-gray-500">{label}</span>
      <input className="mt-1 block w-full bg-transparent outline-none" {...rest} />
    </label>
  );
}