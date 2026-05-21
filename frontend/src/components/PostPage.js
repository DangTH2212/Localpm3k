import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";

const PRIVACY_LABELS = {
  PUBLIC_TO_EVERYONE: "Public",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

function logTime() {
  const d = new Date();
  return `[${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}]`;
}

export default function PostPage({ user, onLogout }) {
  const [mediaType, setMediaType] = useState("video");
  const [creatorInfo, setCreatorInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [upload, setUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [postMode, setPostMode] = useState("post_now");
  const [title, setTitle] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [allowComment, setAllowComment] = useState(true);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [discloseContent, setDiscloseContent] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [posting, setPosting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Upload a video first.");
  const [logs, setLogs] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!upload?.uploadId) {
      setPreviewSrc(null);
      return undefined;
    }

    let objectUrl;
    fetch(api.previewUrl(upload.uploadId), { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Preview failed");
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPreviewSrc(objectUrl);
      })
      .catch(() => setPreviewSrc(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [upload]);

  const appendLog = useCallback((msg) => {
    setLogs((prev) => [...prev, `${logTime()} ${msg}`]);
  }, []);

  useEffect(() => {
    api
      .creatorInfo()
      .then((info) => {
        setCreatorInfo(info);
        const options = info.privacy_level_options || ["SELF_ONLY"];
        setPrivacy(options[0]);
        if (info.comment_disabled) setAllowComment(false);
        if (!info.duet_disabled) setAllowDuet(true);
        if (!info.stitch_disabled) setAllowStitch(true);
      })
      .catch((e) => appendLog(`Lỗi creator info: ${e.message}`));
  }, [appendLog]);

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".mp4") && !ext.endsWith(".mov") && !ext.endsWith(".webm")) {
      appendLog("Chỉ hỗ trợ .mp4, .mov, .webm");
      return;
    }
    setSelectedFile(file);
    setUpload(null);
    setStatusMsg("Chọn Upload để tải video lên server.");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatusMsg("Chưa chọn file.");
      return;
    }
    setUploading(true);
    try {
      const result = await api.uploadVideo(selectedFile);
      setUpload(result);
      setStatusMsg(`Đã upload: ${result.originalName}`);
      appendLog(
        `Uploaded: ${result.originalName}. TTL ${result.ttlDays} days. Uploads this cycle: ${result.uploadsThisCycle}/${result.maxUploadsPerCycle}.`
      );
    } catch (e) {
      appendLog(`Upload lỗi: ${e.message}`);
      setStatusMsg(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    if (upload?.uploadId) {
      try {
        await api.resetUpload(upload.uploadId);
      } catch {
        /* ignore */
      }
    }
    setSelectedFile(null);
    setUpload(null);
    setPreviewSrc(null);
    setStatusMsg("Upload a video first.");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePost = async () => {
    if (!upload?.uploadId) {
      setStatusMsg("Upload a video first.");
      return;
    }
    if (!rightsConfirmed) {
      setStatusMsg("Vui lòng xác nhận quyền sử dụng nội dung.");
      return;
    }

    setPosting(true);
    const privacyLabel = PRIVACY_LABELS[privacy] || privacy;

    if (postMode === "post_now") {
      appendLog(`Sending TikTok post now (privacy: ${privacyLabel})...`);
    }

    try {
      const result = await api.postVideo({
        uploadId: upload.uploadId,
        title,
        privacyLevel: privacy,
        disableComment: !allowComment,
        disableDuet: !allowDuet,
        disableStitch: !allowStitch,
        brandContentToggle: discloseContent,
        brandOrganicToggle: false,
        mode: postMode === "get_link" ? "get_link" : postMode === "schedule" ? "schedule" : "post_now",
      });

      if (postMode === "get_link") {
        appendLog(`Init JSON: publish_id=${result.publish_id}`);
        setStatusMsg("Đã lấy link & JSON (chưa gửi file lên TikTok).");
      } else if (postMode === "schedule") {
        setStatusMsg(result.message);
        appendLog(result.message);
      } else {
        appendLog(`TikTok post created (privacy: ${privacyLabel}).`);
        appendLog(`publish_id=${result.publish_id}`);
        setStatusMsg(`Đã đăng! publish_id=${result.publish_id}`);
      }
    } catch (e) {
      appendLog(`Lỗi: ${e.message}`);
      setStatusMsg(e.message);
    } finally {
      setPosting(false);
    }
  };

  const privacyOptions = creatorInfo?.privacy_level_options || ["SELF_ONLY"];
  const handle = user.username ? `@${user.username}` : user.displayName || "TikTok user";

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="brand">TikTok Post (Sandbox)</span>
        <div className="top-bar-right">
          <span className="user-badge">{handle}</span>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="main-grid">
        <section className="panel panel-left">
          <div className="mode-tabs">
            <label>
              <input
                type="radio"
                name="media"
                checked={mediaType === "video"}
                onChange={() => setMediaType("video")}
              />
              Video
            </label>
            <label className="disabled">
              <input type="radio" name="media" disabled />
              Photo (PULL_FROM_URL)
            </label>
          </div>

          <p className="hint">Drag &amp; drop a video (.mp4/.mov) or choose a file:</p>

          <div
            className={`drop-zone ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files[0]);
            }}
          >
            Drop video here
          </div>

          <div className="upload-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.mov,.webm,video/*"
              hidden
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </button>
            <span className="file-name">{selectedFile?.name || "No file selected"}</span>
            <button type="button" className="btn-primary" disabled={!selectedFile || uploading} onClick={handleUpload}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>

          <button type="button" className="btn-ghost reset-btn" onClick={handleReset}>
            Reset upload
          </button>

          {upload && (
            <p className="upload-status">
              Uploaded: {upload.originalName}. TTL {upload.ttlDays} days. Uploads this cycle:{" "}
              {upload.uploadsThisCycle}/{upload.maxUploadsPerCycle}.
            </p>
          )}

          <div className="preview-box">
            {previewSrc && upload?.uploadId ? (
              <video key={upload.uploadId} src={previewSrc} controls className="preview-video" />
            ) : upload ? (
              <span className="preview-placeholder">Loading preview...</span>
            ) : (
              <span className="preview-placeholder">Preview</span>
            )}
          </div>
        </section>

        <section className="panel panel-right">
          <div className="account-row">
            {user.avatarUrl && <img src={user.avatarUrl} alt="" className="avatar" />}
            <div>
              <p className="account-label">You are posting to</p>
              <p className="account-handle">{handle}</p>
            </div>
          </div>

          <div className="post-modes">
            <label>
              <input type="radio" name="postMode" checked={postMode === "post_now"} onChange={() => setPostMode("post_now")} />
              Post now
            </label>
            <label>
              <input type="radio" name="postMode" checked={postMode === "schedule"} onChange={() => setPostMode("schedule")} />
              Schedule
            </label>
            <label>
              <input type="radio" name="postMode" checked={postMode === "get_link"} onChange={() => setPostMode("get_link")} />
              Get link &amp; JSON
            </label>
          </div>

          <label className="field">
            Title
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Caption..." />
          </label>

          <label className="field">
            Privacy (required)
            <select value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
              {privacyOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {PRIVACY_LABELS[opt] || opt}
                </option>
              ))}
            </select>
          </label>

          <div className="checkbox-group">
            <label>
              <input type="checkbox" checked={allowComment} onChange={(e) => setAllowComment(e.target.checked)} />
              Allow comments
            </label>
            <label>
              <input type="checkbox" checked={allowDuet} onChange={(e) => setAllowDuet(e.target.checked)} />
              Allow duets
            </label>
            <label>
              <input type="checkbox" checked={allowStitch} onChange={(e) => setAllowStitch(e.target.checked)} />
              Allow stitches
            </label>
          </div>

          <label className="checkbox-line">
            <input type="checkbox" checked={discloseContent} onChange={(e) => setDiscloseContent(e.target.checked)} />
            Disclose video content (paid partnership or advertising)
          </label>

          <label className="checkbox-line required">
            <input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} />
            I confirm I have the rights to post this content and to use the audio in this video
          </label>

          <div className="submit-row">
            <button
              type="button"
              className="btn-primary btn-post"
              disabled={!upload || posting || !rightsConfirmed}
              onClick={handlePost}
            >
              {postMode === "get_link" ? "Get link & JSON" : postMode === "schedule" ? "Schedule" : "Post now"}
            </button>
            <span className="submit-status">{statusMsg}</span>
          </div>

          <pre className="log-console">{logs.join("\n") || "—"}</pre>
        </section>
      </main>
    </div>
  );
}
