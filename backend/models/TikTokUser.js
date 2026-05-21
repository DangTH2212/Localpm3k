const mongoose = require("mongoose");

const tikTokUserSchema = new mongoose.Schema(
  {
    openId: { type: String, required: true, unique: true, index: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    tokenType: { type: String, default: "Bearer" },
    scope: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
    refreshExpiresAt: { type: Date, required: true },
    displayName: { type: String, default: "" },
    username: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TikTokUser", tikTokUserSchema);
