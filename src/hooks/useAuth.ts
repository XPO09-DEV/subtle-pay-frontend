import { useNavigate } from "react-router-dom";
import { api, clearToken, getToken, saveToken } from "../api/client";

export function useAuth() {
  const navigate = useNavigate();
  return {
    isLoggedIn: !!getToken(),
    login: (token: string) => saveToken(token),
    logout: () => {
      api.logout().catch(() => undefined);
      clearToken();
      navigate("/login");
    },
  };
}
