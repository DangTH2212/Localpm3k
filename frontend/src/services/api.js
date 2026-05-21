const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:9999").replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export const api = {
  baseUrl: API_BASE,
  health: () => request("/api/health"),
  me: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  loginUrl: () => `${API_BASE}/api/auth/tiktok`,
  creatorInfo: () => request("/api/tiktok/creator-info"),
  uploadVideo: (file) => {
    const form = new FormData();
    form.append("video", file);
    return request("/api/tiktok/upload", { method: "POST", body: form });
  },
  resetUpload: (uploadId) => request(`/api/tiktok/uploads/${uploadId}`, { method: "DELETE" }),
  postVideo: (body) => request("/api/tiktok/post", { method: "POST", body: JSON.stringify(body) }),
  postStatus: (publishId) => request(`/api/tiktok/post-status/${publishId}`),
  previewUrl: (uploadId) => `${API_BASE}/api/tiktok/uploads/${uploadId}/preview`,
};
