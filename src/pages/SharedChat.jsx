import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import api from "../api.js";

function Shell({ children }) {
  return (
    <main className="flex min-h-dvh flex-col bg-[#212121] text-[#ececec]">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Shared chat
          </h1>
          <p className="text-xs text-[#a8a8a8]">Read-only</p>
        </div>
        <Link
          to="/"
          className="rounded-full px-3 py-1.5 text-sm text-[#b4b4b4] hover:bg-[#303030] hover:text-white">
          My chats
        </Link>
      </header>
      {children}
    </main>
  );
}

export default function SharedChat() {
  const { shareId } = useParams();
  const location = useLocation();

  // loading | ready | login | denied | error
  const [status, setStatus] = useState("loading");
  const [messages, setMessages] = useState([]);
  const [deniedMessage, setDeniedMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSharedChat() {
      setStatus("loading");

      try {
        const response = await api.get(`/chat/share/${shareId}`);
        if (!active) return;

        const ordered = [...response.data.messages].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );
        setMessages(ordered);
        setStatus("ready");
      } catch (error) {
        if (!active) return;

        if (error.response?.status === 401) {
          setStatus("login");
        } else if (error.response?.status === 403) {
          setDeniedMessage(
            error.response.data?.message || "You can't open this chat.",
          );
          setStatus("denied");
        } else {
          setStatus("error");
        }
      }
    }

    loadSharedChat();
    return () => {
      active = false;
    };
  }, [shareId]);

  if (status === "loading") {
    return (
      <Shell>
        <p className="p-8 text-sm text-[#a8a8a8]">Loading shared chat...</p>
      </Shell>
    );
  }

  if (status === "login") {
    return (
      <Shell>
        <section className="mx-4 mt-16 max-w-md rounded-3xl border border-[#3f3f3f] bg-[#252525] p-8 shadow-xl sm:mx-auto">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight text-[#f4f4f4]">
            Log in to read this chat
          </h2>
          <p className="mb-6 text-sm text-[#b4b4b4]">
            You need an account to open shared chats. You'll come back to this
            page after you log in.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              state={{ from: location.pathname }}
              className="rounded-full bg-white px-5 py-2.5 font-medium text-[#171717] hover:bg-[#e5e5e5]">
              Log in
            </Link>
            <Link
              to="/signup"
              state={{ from: location.pathname }}
              className="text-sm text-[#ececec] underline underline-offset-4">
              Create an account
            </Link>
          </div>
        </section>
      </Shell>
    );
  }

  if (status === "denied") {
    return (
      <Shell>
        <p role="alert" className="p-8 text-sm text-[#f87171]">
          {deniedMessage}
        </p>
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell>
        <p role="alert" className="p-8 text-sm text-[#f87171]">
          Could not load this shared chat. Check the link and refresh.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <section
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6"
        aria-label="Shared conversation">
        {messages.length === 0 && (
          <p className="text-sm text-[#a8a8a8]">This chat has no messages.</p>
        )}

        {messages.map((message) => (
          <div
            key={message._id}
            className={`whitespace-pre-wrap ${
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-3xl bg-[#303030] px-4 py-3"
                : "w-full py-2"
            }`}>
            <p className="mb-1 text-xs font-medium text-[#b4b4b4]">
              {message.role === "user" ? "User" : "Assistant"}
            </p>
            <p className="leading-7 text-[#ececec]">{message.content}</p>
          </div>
        ))}
      </section>
    </Shell>
  );
}
