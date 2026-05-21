const axios = require("axios");
const fs = require("fs");

const TIKTOK_API = "https://open.tiktokapis.com";

const api = axios.create({
  baseURL: TIKTOK_API,
  headers: {
    "Content-Type": "application/json; charset=UTF-8",
    "ngrok-skip-browser-warning": "true",
  },
});

function getConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;

  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error(
      "Thiếu TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET hoặc TIKTOK_REDIRECT_URI trong .env"
    );
  }

  return { clientKey, clientSecret, redirectUri };
}

function buildAuthUrl(state) {
  const { clientKey, redirectUri } = getConfig();
  const scopes = process.env.TIKTOK_SCOPES || "user.info.basic,user.info.profile,video.publish";

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: scopes,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    disable_auto_auth: 1,
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const { clientKey, clientSecret, redirectUri } = getConfig();

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const { data } = await axios.post(`${TIKTOK_API}/v2/oauth/token/`, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "ngrok-skip-browser-warning": "true",
    },
  });

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return data;
}

async function refreshAccessToken(refreshToken) {
  const { clientKey, clientSecret } = getConfig();

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const { data } = await axios.post(`${TIKTOK_API}/v2/oauth/token/`, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "ngrok-skip-browser-warning": "true",
    },
  });

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return data;
}

async function getUserInfo(accessToken) {
  const fields = "open_id,display_name,avatar_url,username";
  const { data } = await api.get(`/v2/user/info/?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (data.error?.code !== "ok") {
    throw new Error(data.error?.message || "Không lấy được thông tin user");
  }

  return data.data?.user || {};
}

async function queryCreatorInfo(accessToken) {
  const { data } = await api.post(
    "/v2/post/publish/creator_info/query/",
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (data.error?.code !== "ok") {
    throw new Error(data.error?.message || "Không lấy được creator info");
  }

  return data.data;
}

async function initVideoPost(accessToken, postInfo, sourceInfo) {
  const { data } = await api.post(
    "/v2/post/publish/video/init/",
    { post_info: postInfo, source_info: sourceInfo },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (data.error?.code !== "ok") {
    throw new Error(data.error?.message || data.error?.code || "Khởi tạo đăng video thất bại");
  }

  return data.data;
}

async function uploadVideoChunk(uploadUrl, filePath, mimeType) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;

  await axios.put(uploadUrl, fileBuffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": fileSize,
      "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
}

async function fetchPostStatus(accessToken, publishId) {
  const { data } = await api.post(
    "/v2/post/publish/status/fetch/",
    { publish_id: publishId },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (data.error?.code !== "ok") {
    throw new Error(data.error?.message || "Không lấy được trạng thái đăng");
  }

  return data.data;
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getUserInfo,
  queryCreatorInfo,
  initVideoPost,
  uploadVideoChunk,
  fetchPostStatus,
};
