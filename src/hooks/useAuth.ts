import { useNavigate } from "react-router-dom";
<<<<<<< HEAD
import { clearToken, getToken, saveToken } from "../api/client";
=======
import { api, clearToken, getToken, saveToken } from "../api/client";
>>>>>>> a26f18097bfee4d553da3f1a17dee27e2f322425

export function useAuth() {
  const navigate = useNavigate();
  return {
    isLoggedIn: !!getToken(),
    login: (token: string) => saveToken(token),
    logout: () => {
<<<<<<< HEAD
=======
      api.logout().catch(() => undefined);
>>>>>>> a26f18097bfee4d553da3f1a17dee27e2f322425
      clearToken();
      navigate("/login");
    },
  };
<<<<<<< HEAD
}
=======
}
>>>>>>> a26f18097bfee4d553da3f1a17dee27e2f322425
