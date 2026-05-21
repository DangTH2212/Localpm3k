const mongoose = require("mongoose");

const videoUploadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "TikTokUser", required: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

videoUploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("VideoUpload", videoUploadSchema);
