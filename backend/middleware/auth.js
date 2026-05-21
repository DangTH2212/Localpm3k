const jwt = require("jsonwebtoken");
const TikTokUser = require("../models/TikTokUser");
const { refreshAccessToken } = require("../services/tiktokService");

async function ensureValidToken(user) {
  if (user.expiresAt > new Date()) {
    return user;
  }

  const tokenData = await refreshAccessToken(user.refreshToken);
  const now = Date.now();

  user.accessToken = tokenData.access_token;
  user.refreshToken = tokenData.refresh_token;
  user.scope = tokenData.scope;
  user.expiresAt = new Date(now + tokenData.expires_in * 1000);
  user.refreshExpiresAt = new Date(now + tokenData.refresh_expires_in * 1000);
  await user.save();

  return user;
}

async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.auth_token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    if (!token) {
      return res.status(401).json({ message: "Chưa đăng nhập TikTok" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = await TikTokUser.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ" });
    }

    user = await ensureValidToken(user);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Phiên đăng nhập hết hạn hoặc không hợp lệ" });
  }
}

module.exports = { requireAuth, ensureValidToken };
