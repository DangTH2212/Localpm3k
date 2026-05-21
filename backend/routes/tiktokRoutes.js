const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const VideoUpload = require("../models/VideoUpload");
const { requireAuth } = require("../middleware/auth");
const {
  queryCreatorInfo,
  initVideoPost,
  uploadVideoChunk,
  fetchPostStatus,
} = require("../services/tiktokService");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const MAX_UPLOADS_PER_CYCLE = 3;
const UPLOAD_TTL_DAYS = 3;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOAD_DIR, String(req.user._id));
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["video/mp4", "video/quicktime", "video/webm"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || [".mp4", ".mov", ".webm"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ video .mp4, .mov, .webm"));
    }
  },
});

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  return "video/mp4";
}

async function countActiveUploads(userId) {
  return VideoUpload.countDocuments({
    userId,
    expiresAt: { $gt: new Date() },
  });
}

router.get("/creator-info", requireAuth, async (req, res) => {
  try {
    const data = await queryCreatorInfo(req.user.accessToken);
    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/upload", requireAuth, upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng chọn file video" });
    }

    const count = await countActiveUploads(req.user._id);
    if (count >= MAX_UPLOADS_PER_CYCLE) {
      fs.unlinkSync(req.file.path);
      return res.status(429).json({
        message: `Đã đạt giới hạn ${MAX_UPLOADS_PER_CYCLE} upload trong chu kỳ ${UPLOAD_TTL_DAYS} ngày`,
      });
    }

    const expiresAt = new Date(Date.now() + UPLOAD_TTL_DAYS * 24 * 60 * 60 * 1000);
    const record = await VideoUpload.create({
      userId: req.user._id,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype || getMimeType(req.file.originalname),
      size: req.file.size,
      expiresAt,
    });

    const uploadCount = await countActiveUploads(req.user._id);

    res.json({
      uploadId: record._id,
      originalName: record.originalName,
      size: record.size,
      previewUrl: `/api/tiktok/uploads/${record._id}/preview`,
      expiresAt: record.expiresAt,
      uploadsThisCycle: uploadCount,
      maxUploadsPerCycle: MAX_UPLOADS_PER_CYCLE,
      ttlDays: UPLOAD_TTL_DAYS,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/uploads/:uploadId/preview", requireAuth, async (req, res) => {
  try {
    const record = await VideoUpload.findOne({
      _id: req.params.uploadId,
      userId: req.user._id,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return res.status(404).json({ message: "Upload không tồn tại hoặc đã hết hạn" });
    }

    const filePath = path.join(UPLOAD_DIR, String(req.user._id), record.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File không tìm thấy" });
    }

    res.setHeader("Content-Type", record.mimeType);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/uploads/:uploadId", requireAuth, async (req, res) => {
  try {
    const record = await VideoUpload.findOne({
      _id: req.params.uploadId,
      userId: req.user._id,
    });

    if (!record) {
      return res.status(404).json({ message: "Upload không tồn tại" });
    }

    const filePath = path.join(UPLOAD_DIR, String(req.user._id), record.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await record.deleteOne();

    res.json({ message: "Đã reset upload" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/post", requireAuth, async (req, res) => {
  try {
    const {
      uploadId,
      title = "",
      privacyLevel,
      disableComment = false,
      disableDuet = false,
      disableStitch = false,
      brandContentToggle = false,
      brandOrganicToggle = false,
      mode = "post_now",
    } = req.body;

    if (!uploadId) {
      return res.status(400).json({ message: "Upload a video first." });
    }

    const record = await VideoUpload.findOne({
      _id: uploadId,
      userId: req.user._id,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return res.status(400).json({ message: "Upload a video first." });
    }

    const filePath = path.join(UPLOAD_DIR, String(req.user._id), record.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ message: "File video không tồn tại" });
    }

    const creatorInfo = await queryCreatorInfo(req.user.accessToken);
    const allowedPrivacy = creatorInfo.privacy_level_options || ["SELF_ONLY"];
    const privacy = privacyLevel || allowedPrivacy[0];

    if (!allowedPrivacy.includes(privacy)) {
      return res.status(400).json({
        message: `privacy_level không hợp lệ. Chỉ được: ${allowedPrivacy.join(", ")}`,
      });
    }

    const postInfo = {
      title: String(title).slice(0, 2200),
      privacy_level: privacy,
      disable_comment: Boolean(disableComment),
      disable_duet: Boolean(disableDuet),
      disable_stitch: Boolean(disableStitch),
      brand_content_toggle: Boolean(brandContentToggle),
      brand_organic_toggle: Boolean(brandOrganicToggle),
    };

    const videoSize = record.size;
    const chunkSize = videoSize;
    const totalChunkCount = 1;

    const initData = await initVideoPost(req.user.accessToken, postInfo, {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: chunkSize,          
      total_chunk_count: totalChunkCount,
    }); 

    const responsePayload = {
      publish_id: initData.publish_id,
      upload_url: initData.upload_url,
      privacy,
      mode,
      post_info: postInfo,
    };

    if (mode === "get_link") {
      return res.json({
        message: "Init response (chưa upload lên TikTok)",
        ...responsePayload,
      });
    }

    if (mode === "schedule") {
      return res.status(400).json({
        message: "Sandbox/API hiện chưa hỗ trợ lên lịch đăng. Dùng Post now.",
      });
    }

    if (initData.upload_url) {
      await uploadVideoChunk(initData.upload_url, filePath, record.mimeType);
    }

    let status = null;
    try {
      status = await fetchPostStatus(req.user.accessToken, initData.publish_id);
    } catch {
      /* status có thể chưa sẵn sàng ngay */
    }

    res.json({
      message: `TikTok post created (privacy: ${privacyLabel(privacy)}).`,
      publish_id: initData.publish_id,
      privacy,
      status,
    });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    res.status(400).json({ message: msg });
  }
});

router.get("/post-status/:publishId", requireAuth, async (req, res) => {
  try {
    const status = await fetchPostStatus(req.user.accessToken, req.params.publishId);
    res.json(status);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

function privacyLabel(level) {
  const map = {
    PUBLIC_TO_EVERYONE: "Public",
    MUTUAL_FOLLOW_FRIENDS: "Friends",
    FOLLOWER_OF_CREATOR: "Followers",
    SELF_ONLY: "Only me",
  };
  return map[level] || level;
}

module.exports = router;
