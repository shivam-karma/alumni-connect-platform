// frontend/src/pages/Profile.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth.js";
import RequestsList from "../components/RequestsList.jsx";
import ResumeParser from "../pages/ResumeParser.jsx"; // resume parser component/page
import FloatingAIChat from "../components/FloatingAIChat.jsx"; // floating AI chat (external component)

// Developer-provided fallback local preview path (will be transformed to URL in your environment)
const DEV_FALLBACK_PREVIEW = "/mnt/data/ca2ef488-5f17-4c14-8759-b95a4b441584.png";

export default function Profile() {
  const { user, login } = useAuth();
  const [showResumeBox, setShowResumeBox] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [parsedPreview, setParsedPreview] = useState(null);

  useEffect(() => {
    // Try load stored preview from localStorage (ResumeParser page can save here after successful parse)
    try {
      const savedUrl = localStorage.getItem("lastUploadedResumeUrl");
      const savedParsed = localStorage.getItem("lastParsedResume");
      if (savedUrl) setPreviewUrl(savedUrl);
      else setPreviewUrl(DEV_FALLBACK_PREVIEW); // fallback developer-provided path
      if (savedParsed) setParsedPreview(JSON.parse(savedParsed));
      else setParsedPreview(null);
    } catch (e) {
      setPreviewUrl(DEV_FALLBACK_PREVIEW);
      setParsedPreview(null);
    }
  }, []);

  function triggerParseResume() {
    setShowResumeBox(true);
    const el = document.querySelector("#resume-parser-anchor");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (!user) {
    return <div className="p-4 text-gray-600">Loading profile...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>

      {/* PROFILE CARD */}
      <div className="card p-4 bg-white rounded-xl shadow-md">
        <div className="flex items-center gap-4">
          <div
            className="h-12 w-12 rounded-full bg-blue-600 text-white grid place-items-center font-semibold text-lg"
            aria-hidden
          >
            {user?.name
              ? user.name
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
              : "U"}
          </div>

          <div>
            <div className="font-semibold text-lg">{user?.name}</div>
            <div className="text-sm text-gray-600">{user?.email}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            Role: <b>{user?.role || "-"}</b>
          </div>
          <div>
            Department: <b>{user?.department || "-"}</b>
          </div>
          <div>
            Batch: <b>{user?.batch || "-"}</b>
          </div>
          <div>
            Location: <b>{user?.location || "-"}</b>
          </div>
        </div>

        {/* CONNECTION COUNT */}
        <div className="mt-4 text-sm text-gray-700">
          <b>Connections:</b> {user?.connections || 0}
        </div>

        {/* ACTIONS */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setShowResumeBox((s) => !s)}
            className="btn btn-primary"
          >
            {showResumeBox ? "Hide Resume AI" : "Upload Resume (Auto-Fill Profile)"}
          </button>

          <button
            onClick={() => setShowPreview(true)}
            className="btn"
            title="Preview last uploaded resume image / parsed JSON"
            disabled={!previewUrl && !parsedPreview}
          >
            Preview Last Upload
          </button>
        </div>

        {/* RESUME PARSER SECTION */}
        {showResumeBox && (
          <div className="mt-6" id="resume-parser-anchor">
            <ResumeParser
              onAutofillSuccess={(updatedUser, parsed) => {
                try {
                  const token = localStorage.getItem("token");
                  if (updatedUser && typeof login === "function") {
                    login({ token, user: updatedUser });
                  }
                  // If parser returns parsed JSON as second arg, store it
                  if (parsed) {
                    try {
                      localStorage.setItem("lastParsedResume", JSON.stringify(parsed));
                      setParsedPreview(parsed);
                    } catch (err) {
                      console.warn("Failed saving parsed resume to localStorage", err);
                    }
                  }
                } catch (err) {
                  console.warn("onAutofillSuccess handler error:", err);
                }
              }}
            />
          </div>
        )}

        {/* PREVIEW PANEL (inline modal-like) */}
        {showPreview && (
          <div className="mt-6 p-4 border rounded bg-gray-50 relative">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-semibold">Last Upload Preview</div>
                <div className="text-xs text-gray-500">Image and parsed JSON (if available)</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // refresh preview values from localStorage in case ResumeParser just saved them
                    try {
                      const savedUrl = localStorage.getItem("lastUploadedResumeUrl");
                      const savedParsed = localStorage.getItem("lastParsedResume");
                      if (savedUrl) setPreviewUrl(savedUrl);
                      else setPreviewUrl(DEV_FALLBACK_PREVIEW);
                      if (savedParsed) setParsedPreview(JSON.parse(savedParsed));
                      else setParsedPreview(null);
                    } catch (e) {
                      setPreviewUrl(DEV_FALLBACK_PREVIEW);
                      setParsedPreview(null);
                    }
                  }}
                  className="btn btn-sm"
                >
                  Refresh
                </button>
                <button onClick={() => setShowPreview(false)} className="btn btn-sm">
                  Close
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col items-center">
                <div className="text-sm text-gray-600 mb-2">Preview Image</div>
                <div className="w-full flex items-center justify-center bg-white p-2 rounded border">
                  {/* Using developer-provided path as fallback */}
                  <img
                    src={previewUrl || DEV_FALLBACK_PREVIEW}
                    alt="resume preview"
                    style={{ maxHeight: 240, width: "auto", maxWidth: "100%" }}
                    className="object-contain"
                  />
                </div>
                <div className="text-xs text-gray-500 mt-2 break-all">{previewUrl || DEV_FALLBACK_PREVIEW}</div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-2">Parsed JSON</div>
                {parsedPreview ? (
                  <pre className="text-xs max-h-60 overflow-auto bg-white p-2 rounded border">
                    {JSON.stringify(parsedPreview, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-gray-500">
                    No parsed JSON found. The Resume Parser page can save parsed results to localStorage under <code>lastParsedResume</code>.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PENDING CONNECTION REQUESTS */}
      <div className="mt-6">
        <RequestsList profileUserId={user.id} />
      </div>

      {/* Floating AI Chat (non-blocking) */}
      <FloatingAIChat parsedPreview={parsedPreview} onOpenParser={triggerParseResume} />
    </div>
  );
}
