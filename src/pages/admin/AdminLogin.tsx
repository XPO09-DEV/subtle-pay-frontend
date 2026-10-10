import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, saveAdminToken } from "../../api/admin";

export default function AdminLogin() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.login(name, password);
      saveAdminToken(res.token);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500">SUBTLE</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">Super Admin</h1>
          <p className="mt-1 text-sm text-gray-500">Authorized administrators only.</p>
        </div>
        <label className="block text-sm">
          <span className="text-gray-600">Name</span>
          <input
            type="text"
            required
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-gray-900"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-gray-900"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
