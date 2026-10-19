import { useEffect, useState } from "react";
import api from "../api.js";
import { useAuthStore } from "../store/useAuthStore.js";

// The backend has no route that returns "the share for this chat", so the
// share id is remembered in this browser. Without it the viewers list
// could not be reopened after a refresh.
const storageKey = (chatId) => `shareId:${chatId}`;

// The backend logs every visit, so one person can appear many times.
// Collapse the log into one row per person and hide the owner.
function groupViewers(entries, ownerEmail) {
  const people = new Map();

  for (const entry of entries) {
    const person = entry.userId;
    if (!person || person.email === ownerEmail) continue;

    const existing = people.get(person._id);
    if (!existing) {
      people.set(person._id, {
        id: person._id,
        name: person.name,
        email: person.email,
        lastSeen: entry.accessedAt,
        blocked: Boolean(entry.blockFlag),
      });
      continue;
    }

    existing.blocked = existing.blocked || Boolean(entry.blockFlag);
    if (new Date(entry.accessedAt) > new Date(existing.lastSeen)) {
      existing.lastSeen = entry.accessedAt;
    }
  }

  return [...people.values()];
}

export default function ShareButton({ chatId }) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [open, setOpen] = useState(false);
  const [shareId, setShareId] = useState(() =>
    localStorage.getItem(storageKey(chatId)),
  );
  const [viewers, setViewers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [blockingId, setBlockingId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // The link points at this app's own page, not at the API.
  const shareUrl = shareId
    ? `${window.location.origin}/chat/share/${shareId}`
    : "";

  function handleError(error, fallback) {
    if (error.response?.status === 401) {
      setUser(null);
      return;
    }
    setError(error.response?.data?.message || fallback);
  }

  // Reload the viewers every time the panel opens.
  useEffect(() => {
    if (!open || !shareId) return;
    let active = true;

    async function loadViewers() {
      setLoadingViewers(true);
      setError("");

      try {
        const response = await api.get(`/chat/share/${shareId}/list`);
        if (active) {
          setViewers(groupViewers(response.data.viewers, user?.email));
        }
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 403) {
          // This share is gone or isn't ours, so forget it.
          localStorage.removeItem(storageKey(chatId));
          setShareId(null);
        } else {
          handleError(error, "Could not load viewers.");
        }
      } finally {
        if (active) setLoadingViewers(false);
      }
    }

    loadViewers();
    return () => {
      active = false;
    };
  }, [open, shareId]);

  async function handleCreate() {
    setCreating(true);
    setError("");

    try {
      const response = await api.post("/chat/share", { chatId });
      const id = response.data.share._id;
      localStorage.setItem(storageKey(chatId), id);
      setViewers([]);
      setShareId(id);
    } catch (error) {
      handleError(error, "Could not create the share link. Try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link. Select it and copy it manually.");
    }
  }

  async function handleBlock(viewer) {
    if (
      blockingId ||
      !window.confirm(`Block ${viewer.name} from this shared chat?`)
    )
      return;

    setBlockingId(viewer.id);
    setError("");

    try {
      await api.patch(`/chat/share/${shareId}/block/${viewer.id}`);
      setViewers((current) =>
        current.map((item) =>
          item.id === viewer.id ? { ...item, blocked: true } : item,
        ),
      );
    } catch (error) {
      handleError(error, "Could not block this user. Try again.");
    } finally {
      setBlockingId(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rounded-full border border-[#424242] px-3 py-1.5 text-sm text-[#d4d4d4] hover:bg-[#303030] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a8a8a8]">
        Share
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#424242] bg-[#2b2b2b] p-4 shadow-xl">
          <h2 className="text-sm font-semibold text-[#f4f4f4]">
            Share this chat
          </h2>
          <p className="mt-1 text-xs text-[#a8a8a8]">
            People with the link can read this conversation after they log in.
          </p>

          {!shareId && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="mt-4 w-full rounded-full bg-white p-2.5 text-sm font-medium text-[#171717] hover:bg-[#e5e5e5] disabled:opacity-50">
              {creating ? "Creating link..." : "Create share link"}
            </button>
          )}

          {shareId && (
            <>
              <div className="mt-4 flex items-center gap-2">
                <label htmlFor="share-link" className="sr-only">
                  Share link
                </label>
                <input
                  id="share-link"
                  readOnly
                  value={shareUrl}
                  onFocus={(event) => event.target.select()}
                  className="min-w-0 flex-1 truncate rounded-xl border border-[#4a4a4a] bg-[#303030] px-3 py-2 text-xs text-[#ececec] focus:border-[#a8a8a8] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#171717] hover:bg-[#e5e5e5]">
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>

              <h3 className="mt-5 mb-2 text-xs font-medium text-[#a8a8a8]">
                People who opened the link
              </h3>

              {loadingViewers && (
                <p className="text-sm text-[#a8a8a8]">Loading viewers...</p>
              )}
              {!loadingViewers && viewers.length === 0 && (
                <p className="text-sm text-[#a8a8a8]">
                  Nobody has opened the link yet.
                </p>
              )}

              <ul className="max-h-60 space-y-1 overflow-y-auto">
                {viewers.map((viewer) => (
                  <li
                    key={viewer.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-[#303030]">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[#ececec]">
                        {viewer.name}
                      </p>
                      <p className="truncate text-xs text-[#a8a8a8]">
                        {viewer.email}
                      </p>
                      <p className="text-xs text-[#8e8e8e]">
                        Last opened {new Date(viewer.lastSeen).toLocaleString()}
                      </p>
                    </div>

                    {viewer.blocked ? (
                      <span className="shrink-0 text-xs text-[#f87171]">
                        Blocked
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBlock(viewer)}
                        disabled={Boolean(blockingId)}
                        className="shrink-0 rounded-full border border-[#4a4a4a] px-3 py-1 text-xs text-[#d4d4d4] hover:border-[#f87171] hover:text-[#f87171] disabled:opacity-50">
                        {blockingId === viewer.id ? "Blocking..." : "Block"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-[#f87171]">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
