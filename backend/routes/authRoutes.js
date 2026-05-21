const express = require("express");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const TikTokUser = require("../models/TikTokUser");
const {
  buildAuthUrl,
  exchangeCodeForToken,
  getUserInfo,
} = require("../services/tiktokService");
const { ensureValidToken } = require("../middleware/auth");

const router = express.Router();

const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const cookieSecure = (process.env.TIKTOK_REDIRECT_URI || "").startsWith("https://");

const sessionCookie = {
  httpOnly: true,
  sameSite: "lax",
  secure: cookieSecure,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function signSession(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.get("/tiktok", (req, res) => {
  try {
    const state = uuidv4();
    res.cookie("tiktok_oauth_state", state, { ...sessionCookie, maxAge: 10 * 60 * 1000 });
    res.redirect(buildAuthUrl(state));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/tiktok/callback", async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.redirect(`${frontendUrl}?login=error&message=${encodeURIComponent(error_description || error)}`);
    }

    const savedState = req.cookies?.tiktok_oauth_state;
    if (!savedState || savedState !== state) {
      return res.redirect(`${frontendUrl}?login=error&message=${encodeURIComponent("CSRF state không hợp lệ")}`);
    }

    res.clearCookie("tiktok_oauth_state", { path: "/", httpOnly: true, sameSite: "lax", secure: cookieSecure });

    const tokenData = await exchangeCodeForToken(code);
    const userInfo = await getUserInfo(tokenData.access_token);
    const now = Date.now();

    const userPayload = {
      openId: tokenData.open_id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      expiresAt: new Date(now + tokenData.expires_in * 1000),
      refreshExpiresAt: new Date(now + tokenData.refresh_expires_in * 1000),
      displayName: userInfo.display_name || "",
      username: userInfo.username || "",
      avatarUrl: userInfo.avatar_url || "",
    };

    const user = await TikTokUser.findOneAndUpdate(
      { openId: tokenData.open_id },
      userPayload,
      { upsert: true, new: true }
    );

    const sessionToken = signSession(user._id);
    res.cookie("auth_token", sessionToken, sessionCookie);
    res.redirect(`${frontendUrl}?login=success`);
  } catch (err) {
    const message = err.response?.data?.error_description || err.message;
    res.redirect(`${frontendUrl}?login=error&message=${encodeURIComponent(message)}`);
  }
});

// Trả 200 + user: null khi chưa có session (không dùng 401 — tránh hiểu nhầm khi đang ở màn login)
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.auth_token;
    if (!token) {
      return res.json({ user: null });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = await TikTokUser.findById(decoded.userId);
    if (!user) {
      return res.json({ user: null });
    }

    user = await ensureValidToken(user);
    res.json({
      user: {
        id: user._id,
        openId: user.openId,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        scope: user.scope,
      },
    });
  } catch {
    res.json({ user: null });
  }
});

router.post("/logout", (req, res) => {
  const clear = { path: "/", httpOnly: true, sameSite: "lax", secure: cookieSecure };
  res.clearCookie("auth_token", clear);
  res.clearCookie("tiktok_oauth_state", clear);
  res.json({ message: "Đã đăng xuất" });
});

module.exports = router;
