import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "sapekkho-tasks";

const FILTERS = ["all", "today", "done"];

function formatTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const tom = new Date(today);
  tom.setDate(today.getDate() + 1);
  if (d.toDateString() === tom.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function isToday(iso) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

function isPast(iso) {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

export default function Sapekkho() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [form, setForm] = useState({ title: "", note: "", reminderDate: "", reminderTime: "", priority: "দরকারি" });
  const [notificationStatus, setNotificationStatus] = useState("default");
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [theme, setTheme] = useState(() => window.localStorage.getItem("sapekkho-theme") || window.localStorage.getItem("taskly-theme") || "light");
  const [isStandalone, setIsStandalone] = useState(false);
  const inputRef = useRef(null);

  // Theme switching persistence
  useEffect(() => {
    window.localStorage.setItem("sapekkho-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Service Worker and Standalone setup
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js")
        .then(reg => console.log("Service Worker registered", reg))
        .catch(err => console.error("Service Worker registration failed", err));
    }

    if (!("Notification" in window)) return;
    setNotificationStatus(Notification.permission);
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    setIsStandalone(mediaQuery.matches);
    const handleMediaChange = (e) => setIsStandalone(e.matches);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  // Listen for Service Worker messages
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === "COMPLETE_TASK") {
        const taskId = event.data.taskId;
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: true } : t));
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", handleMessage);
  }, []);

  // Helper to show native notifications
  const showNotification = (titleText, bodyText, tagId) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const options = {
      body: bodyText,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: tagId || "sapekkho-alert",
      requireInteraction: true,
      actions: [
        { action: "complete-action", title: "Mark Done" }
      ]
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(titleText, options);
      }).catch(() => {
        const notification = new Notification(titleText, options);
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      });
    } else {
      const notification = new Notification(titleText, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  };

  const requestDesktopPrompt = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
    if (permission === "granted") {
      showNotification("Sapekkho Alerts Active", "You will receive notifications for task reminders here!", "welcome");
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }
    window.alert("Browser install is available from the browser menu. Choose Install app to place a shortcut on your desktop.");
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res) setTasks(JSON.parse(res.value));
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set(STORAGE_KEY, JSON.stringify(tasks)).catch(() => {});
  }, [tasks, loaded]);

  useEffect(() => {
    if (showAdd) setTimeout(() => inputRef.current?.focus(), 80);
  }, [showAdd]);

  // Periodic reminder checking interval (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let changed = false;

      setTasks(prev => {
        const updated = prev.map(t => {
          if (!t.reminder || t.done || t.notified) return t;
          const rem = new Date(t.reminder);
          if (rem <= now && (now - rem) < 600000) {
            showNotification("Sapekkho Reminder", t.title, t.id);
            changed = true;
            return { ...t, notified: true };
          }
          return t;
        });
        return changed ? updated : prev;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const addTask = () => {
    if (!form.title.trim()) return;
    const task = {
      id: Date.now().toString(),
      title: form.title.trim(),
      note: form.note.trim(),
      reminder: form.reminderDate ? `${form.reminderDate}${form.reminderTime ? `T${form.reminderTime}` : "T00:00"}` : null,
      priority: form.priority || "দরকারি",
      done: false,
      notified: false,
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [task, ...prev]);
    setForm({ title: "", note: "", reminderDate: "", reminderTime: "", priority: "দরকারি" });
    setShowAdd(false);
  };

  const toggle = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = (id) => { setTasks(prev => prev.filter(t => t.id !== id)); setExpandedId(null); };
  const clearDone = () => setTasks(prev => prev.filter(t => !t.done));

  const filtered = tasks.filter(t => {
    if (filter === "done") return t.done;
    if (filter === "today") return isToday(t.reminder) || isToday(t.createdAt);
    return !t.done;
  });

  const doneCount = tasks.filter(t => t.done).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-background-tertiary)",
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
      maxWidth: 420,
      margin: "0 auto",
      paddingBottom: 100,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "24px 20px 8px",
        background: "var(--color-background-tertiary)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(59,130,246,0.25)" }}>
                <svg width="18" height="18" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="sLogoGradVibe" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  <path d="M190 170 C240 120, 320 120, 320 190 C320 250, 192 260, 192 320 C192 390, 272 390, 322 340" fill="none" stroke="url(#sLogoGradVibe)" strokeWidth="64" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "0.01em" }}>Sapekkho</span>
            </div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>
              {new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <h1 style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 300, color: "var(--color-text-primary)", letterSpacing: "-0.5px" }}>
              My tasks
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--color-text-primary)",
                cursor: "pointer",
                padding: "8px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
              }}
              title="Toggle light/dark mode"
            >
              {theme === "light" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>
            {doneCount > 0 && (
              <button onClick={clearDone} style={{
                background: "none", border: "0.5px solid var(--color-border-secondary)",
                color: "var(--color-text-secondary)", fontSize: 11, padding: "5px 10px",
                borderRadius: 20, cursor: "pointer", letterSpacing: "0.04em",
              }}>
                Clear done ({doneCount})
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        {!isStandalone && (
          deferredPrompt ? (
            <div style={{
              background: "var(--color-card-install-bg)",
              color: "var(--color-card-install-text)",
              borderRadius: 16,
              padding: "16px 20px",
              marginTop: 14,
              marginBottom: 8,
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
              border: "1px solid var(--color-card-install-border)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 44, height: 44, 
                  background: "var(--color-background-primary)", 
                  color: "var(--color-text-primary)",
                  borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}>✓</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Install Sapekkho on Desktop</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                    Install as a desktop app for native Windows notifications and offline access.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={() => setDeferredPrompt(null)}
                  style={{ border: "none", background: "transparent", color: "inherit", opacity: 0.7, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                >
                  Later
                </button>
                <button
                  onClick={handleInstallApp}
                  style={{ border: "none", background: "#3b82f6", color: "white", borderRadius: 999, padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)" }}
                >
                  Install App
                </button>
              </div>
            </div>
          ) : (
            <button onClick={handleInstallApp} style={{
              marginTop: 14,
              border: "1px solid var(--color-border-secondary)",
              background: "var(--color-text-primary)",
              color: "var(--color-background-primary)",
              borderRadius: 999,
              padding: "8px 12px",
              fontSize: 12,
              cursor: "pointer",
              width: "100%",
            }}>
              Add to Desktop / Install Shortcut
            </button>
          )
        )}
        <div style={{ display: "flex", gap: 4, marginTop: 12, marginBottom: 4 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 400,
              cursor: "pointer", border: "0.5px solid",
              borderColor: filter === f ? "var(--color-border-primary)" : "var(--color-border-tertiary)",
              background: filter === f ? "var(--color-background-primary)" : "transparent",
              color: filter === f ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              transition: "all 0.15s",
              textTransform: "capitalize",
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {typeof window !== "undefined" && "Notification" in window && notificationStatus !== "granted" && (
        <div style={{
          margin: "0 16px 10px",
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(17, 24, 39, 0.04)",
          border: "0.5px solid var(--color-border-secondary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Enable desktop reminders for task alerts.</span>
          <button onClick={requestDesktopPrompt} style={{
            border: "none",
            background: "var(--color-text-primary)",
            color: "var(--color-background-primary)",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 11,
            cursor: "pointer",
          }}>
            Enable
          </button>
        </div>
      )}

      {/* Task list */}
      <div style={{ padding: "8px 16px" }}>
        {!loaded ? (
          <p style={{ textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13, marginTop: 40 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <i className="ti ti-checks" style={{ fontSize: 36, color: "var(--color-text-tertiary)", opacity: 0.4 }} aria-hidden="true" />
            <p style={{ color: "var(--color-text-tertiary)", fontSize: 13, marginTop: 8 }}>
              {filter === "done" ? "Nothing completed yet" : "All clear — add a task below"}
            </p>
          </div>
        ) : (
          filtered.map(task => {
            const expanded = expandedId === task.id;
            const overdue = task.reminder && !task.done && isPast(task.reminder);
            const isCritical = task.priority === "আম্মু বলসে";
            return (
              <div key={task.id} style={{
              background: isCritical ? "rgba(254, 242, 242, 0.95)" : "var(--color-background-primary)",
                borderRadius: "var(--border-radius-lg)",
                border: `1.5px solid ${isCritical ? "#dc2626" : overdue ? "var(--color-border-danger)" : "var(--color-border-tertiary)"}`,
                marginBottom: 8,
                overflow: "hidden",
                transition: "border-color 0.2s",
                boxShadow: isCritical ? "0 0 0 1px rgba(220, 38, 38, 0.12)" : "none",
              }}>
                <div
                  style={{ display: "flex", alignItems: "flex-start", padding: "12px 14px", gap: 12, cursor: "pointer" }}
                  onClick={() => setExpandedId(expanded ? null : task.id)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={e => { e.stopPropagation(); toggle(task.id); }}
                    aria-label={task.done ? "Mark incomplete" : "Mark complete"}
                    style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                      border: `1.5px solid ${task.done ? "var(--color-border-success)" : "var(--color-border-secondary)"}`,
                      background: task.done ? "var(--color-background-success)" : "transparent",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    {task.done && <i className="ti ti-check" style={{ fontSize: 11, color: "var(--color-text-success)" }} aria-hidden="true" />}
                  </button>

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      {isCritical && (
                        <span style={{ fontSize: 13, lineHeight: 1, color: "#dc2626" }} aria-hidden="true">
                          ⚠️
                        </span>
                      )}
                      <p style={{
                        margin: 0, fontSize: 14, fontWeight: 400,
                        color: task.done ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
                        textDecoration: task.done ? "line-through" : "none",
                        lineHeight: 1.4,
                      }}>
                        {task.title}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      {task.reminder && (
                        <span style={{
                          fontSize: 11, display: "flex", alignItems: "center", gap: 3,
                          color: overdue ? "var(--color-text-danger)" : "var(--color-text-tertiary)",
                        }}>
                          <i className="ti ti-clock" style={{ fontSize: 11 }} aria-hidden="true" />
                          {formatDate(task.reminder)} {formatTime(task.reminder)}
                        </span>
                      )}
                      {task.note && (
                        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: 3 }}>
                          <i className="ti ti-notes" style={{ fontSize: 11 }} aria-hidden="true" />
                          note
                        </span>
                      )}
                      {task.priority && (
                        <span style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: task.priority === "আম্মু বলসে" || task.priority === "ফরয" ? "rgba(220, 38, 38, 0.16)" : task.priority === "দরকারি" ? "rgba(59, 130, 246, 0.14)" : task.priority === "কালকে করব" ? "rgba(245, 158, 11, 0.16)" : "rgba(107, 114, 128, 0.12)",
                          color: task.priority === "আম্মু বলসে" || task.priority === "ফরয" ? "#b91c1c" : task.priority === "দরকারি" ? "#1d4ed8" : task.priority === "কালকে করব" ? "#b45309" : "#374151",
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand arrow */}
                  <i className={`ti ti-chevron-${expanded ? "up" : "down"}`}
                    style={{ fontSize: 14, color: "var(--color-text-tertiary)", flexShrink: 0, marginTop: 3 }}
                    aria-hidden="true" />
                </div>

                {/* Expanded note + delete */}
                {expanded && (
                  <div style={{
                    borderTop: "0.5px solid var(--color-border-tertiary)",
                    padding: "10px 14px 12px 46px",
                  }}>
                    {task.note && (
                      <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                        {task.note}
                      </p>
                    )}
                    <button
                      onClick={() => remove(task.id)}
                      style={{
                        background: "none", border: "0.5px solid var(--color-border-danger)",
                        color: "var(--color-text-danger)", fontSize: 12, padding: "5px 12px",
                        borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add task sheet */}
      {showAdd && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(17, 24, 39, 0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, zIndex: 100,
        }}>
          <div style={{
            width: "100%", maxWidth: 480, background: "var(--color-background-primary)", borderRadius: 24,
            padding: "24px 20px", boxSizing: "border-box", boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, color: "var(--color-text-primary)" }}>নতুন টাস্ক</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-tertiary)" }}>অগ্রাধিকার বেছে নিন আর সাবমিট করুন।</p>
              </div>
              <button onClick={() => { setShowAdd(false); setForm({ title: "", note: "", reminderDate: "", reminderTime: "", priority: "দরকারি" }); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 4, fontSize: 20 }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>টাস্কের নাম</label>
            <input
              ref={inputRef}
              type="text"
              placeholder="কি করতে হবে?"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && addTask()}
              style={{
                width: "100%", fontSize: 16, padding: "12px 14px",
                border: "1px solid var(--color-border-secondary)", borderRadius: 12,
                background: "transparent", color: "var(--color-text-primary)",
                outline: "none", marginBottom: 12, boxSizing: "border-box",
              }}
            />

            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>নোট</label>
            <textarea
              placeholder="এখানে নোট লিখুন..."
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={3}
              style={{
                width: "100%", fontSize: 15, padding: "12px 14px",
                border: "1px solid var(--color-border-tertiary)", borderRadius: 12,
                background: "transparent", color: "var(--color-text-secondary)",
                outline: "none", resize: "vertical", marginBottom: 12,
                fontFamily: "inherit", boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>তারিখ</label>
                <input
                  type="date"
                  value={form.reminderDate}
                  onChange={e => setForm(f => ({ ...f, reminderDate: e.target.value }))}
                  style={{
                    width: "100%", fontSize: 15, padding: "12px 14px", borderRadius: 12,
                    border: "1px solid var(--color-border-secondary)", background: "transparent",
                    color: "var(--color-text-secondary)", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>সময়</label>
                <input
                  type="time"
                  value={form.reminderTime}
                  onChange={e => setForm(f => ({ ...f, reminderTime: e.target.value }))}
                  style={{
                    width: "100%", fontSize: 15, padding: "12px 14px", borderRadius: 12,
                    border: "1px solid var(--color-border-secondary)", background: "transparent",
                    color: "var(--color-text-secondary)", fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>অগ্রাধিকার নির্ধারণ</label>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              style={{
                width: "100%",
                fontSize: 15,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--color-border-tertiary)",
                background: "var(--color-background-primary)",
                color: "var(--color-text-primary)",
                fontFamily: "inherit",
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            >
              <option value="পরে করি">পরে করি</option>
              <option value="কালকে করব">কালকে করব</option>
              <option value="দরকারি">দরকারি</option>
              <option value="আম্মু বলসে">আম্মু বলসে</option>
              <option value="ফরয">ফরয</option>
            </select>

            <button
              onClick={addTask}
              disabled={!form.title.trim()}
              style={{
                width: "100%", padding: "12px", borderRadius: 12,
                background: form.title.trim() ? "var(--color-text-primary)" : "var(--color-background-secondary)",
                color: form.title.trim() ? "var(--color-background-primary)" : "var(--color-text-tertiary)",
                border: "none", fontSize: 15, fontWeight: 600, cursor: form.title.trim() ? "pointer" : "default",
                transition: "all 0.15s", fontFamily: "inherit",
              }}
            >
              সাবমিট
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          aria-label="Add task"
          style={{
            position: "fixed", bottom: 28, right: "calc(50% - 196px)",
            width: 52, height: 52, borderRadius: "50%",
            background: "var(--color-text-primary)", border: "none",
            color: "var(--color-background-primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 50,
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 22 }} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
