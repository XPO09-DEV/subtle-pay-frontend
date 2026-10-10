import { useNavigate } from "react-router-dom";
import { clearToken, getToken, saveToken } from "../api/client";

export function useAuth() {
  const navigate = useNavigate();
  return {
    isLoggedIn: !!getToken(),
    login: (token: string) => saveToken(token),
    logout: () => {
      clearToken();
      navigate("/login");
    },
  };
}