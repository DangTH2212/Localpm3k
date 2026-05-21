import { api } from "../services/api";

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Đăng video lên TikTok</h1>
        <p className="login-sub">
          Sandbox — đăng nhập TikTok (redirect URI phải là HTTPS ngrok trong .env và trên Developer Portal).
        </p>
        <button
          type="button"
          className="btn-tiktok"
          onClick={() => {
            window.location.href = api.loginUrl();
          }}
        >
          <span className="tiktok-icon">♪</span>
          Đăng nhập bằng TikTok
        </button>
        <p className="login-hint">
          Sau khi đăng nhập, access token và refresh token sẽ được lưu vào MongoDB.
        </p>
      </div>
    </div>
  );
}
