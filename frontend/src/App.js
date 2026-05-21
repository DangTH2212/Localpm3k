import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { api } from "./services/api";
import LoginPage from "./components/LoginPage";
import PostPage from "./components/PostPage";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadUser = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const login = params.get("login");
    const message = params.get("message");

    if (login === "success") {
      setToast({ type: "success", text: "Đăng nhập TikTok thành công. Token đã lưu vào database." });
    } else if (login === "error") {
      setToast({ type: "error", text: decodeURIComponent(message || "Đăng nhập thất bại") });
    }

    if (login) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    loadUser();
  }, [loadUser]);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  if (loading) {
    return <div className="loading-screen">Đang tải...</div>;
  }

  return (
    <>
      {toast && (
        <div className={`toast toast-${toast.type}`} onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
      {user ? <PostPage user={user} onLogout={handleLogout} /> : <LoginPage />}
    </>
  );
}

export default App;
