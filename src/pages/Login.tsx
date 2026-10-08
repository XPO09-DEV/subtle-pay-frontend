import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/Button";
import Input from "../components/Input";

export default function Login() {
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Prevent empty submission and type the event parameter
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent form submission
    if (!accountId || !password) {
      setError("Please fill in all fields.");
      return;
    }
    submit();
  };

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const { token } = await api.login(accountId, password);
      login(token);
      navigate("/");
    } catch (e) {
      setError((e as Error).message || "An error occurred during login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-6 pt-24">
      <h1 className="text-center text-3xl font-bold text-brand">SUBTLE PAY</h1>
      <p className="pb-4 text-center text-sm text-gray-500">Simple money. Bigger possibilities.</p>
      <form onSubmit={handleSubmit}>
        <Input
          label="Account ID"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>
      <p className="text-center text-sm">
        Don't have an account? <Link to="/register" className="text-brand">Create one</Link>
      </p>
    </div>
  );
}