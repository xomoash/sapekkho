const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;

const STORAGE_KEY = "sapekkho-tasks";

const renderPriorityIcon = (priorityStr, customColor) => {
    let stars = null;
    if (priorityStr === "দরকারি" || priorityStr === "Medium") {
        stars = <span style={{ color: customColor || "#f59e0b", display: "flex", gap: 2 }}><i className="ti ti-star-filled"></i><i className="ti ti-star-filled"></i><i className="ti ti-star-filled"></i></span>;
    } else if (priorityStr === "কালকে করব") {
        stars = <span style={{ color: customColor || "#0ea5e9", display: "flex", gap: 2 }}><i className="ti ti-star-filled"></i><i className="ti ti-star-filled"></i></span>;
    } else if (priorityStr === "পরে করি" || priorityStr === "Low") {
        stars = <span style={{ color: customColor || "#3b82f6", display: "flex", gap: 2 }}><i className="ti ti-star-filled"></i></span>;
    }
    
    if (stars) {
        return <div style={{ fontSize: 14 }}>{stars}</div>;
    }
    
    if (priorityStr === "ফরয") return <i className="ti ti-radioactive" style={{ fontSize: 18, color: customColor || "#991b1b" }}></i>;
    return <i className="ti ti-alert-triangle" style={{ fontSize: 18, color: customColor || "#dc2626" }}></i>;
};

function PriorityDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const priorities = ["পরে করি", "কালকে করব", "দরকারি", "আম্মু বলসে", "ফরয"];
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);
  
  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <div className="win-input" style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 160 }} onClick={() => setOpen(!open)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {value} {renderPriorityIcon(value)}
        </div>
        <i className="ti ti-chevron-down"></i>
      </div>
      {open && (
        <div style={{ position: "absolute", bottom: "100%", marginBottom: 4, left: 0, right: 0, background: "var(--color-background-card)", border: "1px solid var(--color-border-card)", borderRadius: "var(--border-radius-sm)", boxShadow: "0 -4px 12px rgba(0,0,0,0.1)", zIndex: 100, maxHeight: 220, overflowY: "auto" }}>
          {priorities.map(p => (
            <div key={p} style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background 0.1s" }} 
                 className="context-menu-item"
                 onClick={() => { onChange(p); setOpen(false); }}>
              <div style={{ flex: 1 }}>{p}</div>
              {renderPriorityIcon(p)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

let sharedAudioCtx = null;
function getAudioContext() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

function formatTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

function Sapekkho() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [form, setForm] = useState({ title: "", note: "", tempDate: "", tempTime: "", reminders: [], priority: "দরকারি" });
  
  // Settings States
  const [theme, setTheme] = useState(() => window.localStorage.getItem("sapekkho-theme") || window.localStorage.getItem("taskly-theme") || "light");
  const [autoLaunch, setAutoLaunch] = useState(() => {
    const val = window.localStorage.getItem("sapekkho-autolaunch");
    return val ? val === "true" : true;
  });
  const [globalShortcut, setGlobalShortcut] = useState(() => window.localStorage.getItem("sapekkho-hotkey") || "CommandOrControl+T");
  const [reminderSound, setReminderSound] = useState(() => window.localStorage.getItem("sapekkho-sound") || "ping");
  const [customSoundData, setCustomSoundData] = useState(() => window.localStorage.getItem("sapekkho-custom-sound") || "");
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [soundMode, setSoundMode] = useState(() => (window.localStorage.getItem("sapekkho-sound") || "ping") === 'custom' ? 'custom' : 'preset');
  const [calendarAutoFill, setCalendarAutoFill] = useState(() => window.localStorage.getItem("sapekkho-cal-autofill") !== "false");
  const [startupBehavior, setStartupBehavior] = useState('normal');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  
  // New feature states
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [isCheckingDeleted, setIsCheckingDeleted] = useState(false);
  const [addReminderError, setAddReminderError] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
        setConfirmSignOut(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  useEffect(() => {
    if (window.electronAPI) {
      if (window.electronAPI.getStartupBehavior) {
        window.electronAPI.getStartupBehavior().then(setStartupBehavior);
      }
      if (window.electronAPI.getGoogleStatus) {
        window.electronAPI.getGoogleStatus().then(status => {
          setGoogleConnected(status.connected);
          setGoogleEmail(status.email || '');
        });
      }
      if (window.electronAPI.onGoogleAuthSuccess) {
        window.electronAPI.onGoogleAuthSuccess(info => {
          setGoogleConnected(info.connected);
          setGoogleEmail(info.email || '');
        });
      }
      if (window.electronAPI.onUpdateAvailable) {
        window.electronAPI.onUpdateAvailable((version) => {
          setUpdateStatus(`Update available: v${version}`);
          setIsCheckingUpdates(false);
        });
      }
      if (window.electronAPI.onUpdateNotAvailable) {
        window.electronAPI.onUpdateNotAvailable(() => {
          setUpdateStatus('You are on the latest version.');
          setIsCheckingUpdates(false);
        });
      }
    }
  }, []);
  
  const isRecordingRef = useRef(isRecordingHotkey);
  isRecordingRef.current = isRecordingHotkey;
  
  const filterRef = useRef(filter);
  filterRef.current = filter;
  
  const calendarDateRef = useRef(calendarDate);
  calendarDateRef.current = calendarDate;
  
  const calendarAutoFillRef = useRef(calendarAutoFill);
  calendarAutoFillRef.current = calendarAutoFill;

  const inputRef = useRef(null);
  const editorRef = useRef(null);
  const editEditorRef = useRef(null);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, taskId }
  // Edit modal state
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", note: "", tempDate: "", tempTime: "", reminders: [], priority: "দরকারি" });

  // Close context menu on any click
  useEffect(() => {
    const handler = () => setCtxMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // Theme sync
  useEffect(() => {
    window.localStorage.setItem("sapekkho-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      // Update native titlebar to match dark theme
      const titlebarEl = document.querySelector('.titlebar');
      if (titlebarEl) titlebarEl.style.background = '#282828';
    } else {
      document.documentElement.classList.remove("dark");
      const titlebarEl = document.querySelector('.titlebar');
      if (titlebarEl) titlebarEl.style.background = '';
    }
    if (window.electronAPI && window.electronAPI.setTheme) {
      window.electronAPI.setTheme(theme);
    }
  }, [theme]);

  // AutoLaunch & AutoFill sync
  useEffect(() => {
    window.localStorage.setItem("sapekkho-autolaunch", autoLaunch);
    if (window.electronAPI && window.electronAPI.setAutoLaunch) {
      window.electronAPI.setAutoLaunch(autoLaunch);
    }
  }, [autoLaunch]);

  useEffect(() => {
    window.localStorage.setItem("sapekkho-cal-autofill", calendarAutoFill);
  }, [calendarAutoFill]);

  // Hotkey sync & recording
  useEffect(() => {
    window.localStorage.setItem("sapekkho-hotkey", globalShortcut);
    if (window.electronAPI && window.electronAPI.setGlobalShortcut) {
      window.electronAPI.setGlobalShortcut(globalShortcut);
    }
  }, [globalShortcut]);

  useEffect(() => {
    if (!isRecordingHotkey) return;
    const handleKeyDown = (e) => {
        e.preventDefault();
        const mods = [];
        if (e.ctrlKey || e.metaKey) mods.push("CommandOrControl");
        if (e.altKey) mods.push("Alt");
        if (e.shiftKey) mods.push("Shift");
        
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return; 
        
        let key = e.key.toUpperCase();
        if (key === ' ') key = 'Space';
        
        const combo = [...mods, key].join('+');
        setGlobalShortcut(combo);
        setIsRecordingHotkey(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordingHotkey]);

  // Sound sync
  useEffect(() => {
    window.localStorage.setItem("sapekkho-sound", reminderSound);
    if (customSoundData) {
        window.localStorage.setItem("sapekkho-custom-sound", customSoundData);
    }
  }, [reminderSound, customSoundData]);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res) setTasks(JSON.parse(res.value));
        else {
          const local = window.localStorage.getItem("sapekkho-demo") || window.localStorage.getItem("taskly-demo");
          if (local) setTasks(JSON.parse(local));
        }
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  // Save data & Sync Tray
  useEffect(() => {
    if (!loaded) return;
    window.storage.set(STORAGE_KEY, JSON.stringify(tasks)).catch(() => {});
    window.localStorage.setItem("sapekkho-demo", JSON.stringify(tasks));

    if (window.electronAPI && window.electronAPI.updateTrayTasks) {
      const highPriority = tasks
        .filter(t => !t.done && (t.priority === "আম্মু বলসে" || t.priority === "High" || t.priority === "ফরয"))
        .slice(0, 3);
      window.electronAPI.updateTrayTasks(highPriority);
    }
  }, [tasks, loaded]);

  // Global shortcut for quick add
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onQuickAdd) {
      window.electronAPI.onQuickAdd(() => {
        if (isRecordingRef.current) return;
        handleOpenAddTask();
      });
    }
  }, []);

  const handleOpenAddTask = () => {
    let initialDate = "";
    if (calendarAutoFillRef.current && filterRef.current === 'calendar') {
         const cDate = calendarDateRef.current;
         const yyyy = cDate.getFullYear();
         const mm = String(cDate.getMonth() + 1).padStart(2, '0');
         const dd = String(cDate.getDate()).padStart(2, '0');
         initialDate = `${yyyy}-${mm}-${dd}`;
    }
    
    setForm({ title: "", note: "", tempDate: initialDate, tempTime: "", reminders: [], priority: "দরকারি" });
    if (editorRef.current) editorRef.current.innerHTML = "";
    
    setShowAdd(true);
    if (filterRef.current === 'calendar' || filterRef.current === 'settings') {
         setFilter('all');
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const playSound = (soundType) => {
    if (soundType === 'none') return;
    
    setIsPlayingSound(true);
    if (soundType === 'custom' && customSoundData) {
        const audio = new Audio(customSoundData);
        audio.onended = () => setIsPlayingSound(false);
        audio.play().catch(e => {
            console.error(e);
            setIsPlayingSound(false);
        });
        return;
    }

    // Simple synth beep instead of base64 to ensure it works across all PCs without external assets
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        if (soundType === 'ping') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gainNode.gain.setValueAtTime(1, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
            setTimeout(() => setIsPlayingSound(false), 500);
        } else if (soundType === 'chime') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
            gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1);
            setTimeout(() => setIsPlayingSound(false), 1000);
        }
    } catch(e) {
        setIsPlayingSound(false);
    }
  };

  const showNotification = (titleText, bodyText, tagId) => {
    if (window.electronAPI && window.electronAPI.isElectron) {
      window.electronAPI.showNotification(titleText, bodyText, tagId || "sapekkho-alert");
      playSound(reminderSound);
    }
  };

  // Periodic reminder check
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let changed = false;
      setTasks(prev => {
        const updated = prev.map(t => {
          if (t.done) return t;
          
          const taskReminders = t.reminders && t.reminders.length > 0 ? t.reminders : (t.reminder ? [t.reminder] : []);
          const notifiedTimes = t.notifiedTimes || [];
          let newNotifiedTimes = [...notifiedTimes];
          let shouldNotify = false;
          
          taskReminders.forEach(r => {
            if (newNotifiedTimes.includes(r)) return;
            const rem = new Date(r);
            if (rem <= now && (now - rem) < 600000) {
              showNotification("Sapekkho Reminder", t.title, `${t.id}-${r}`);
              newNotifiedTimes.push(r);
              shouldNotify = true;
            }
          });

          // Also fall back to check old t.reminder (string) and t.notified for backward compatibility
          if (t.reminder && !t.notified && !newNotifiedTimes.includes(t.reminder)) {
            const rem = new Date(t.reminder);
            if (rem <= now && (now - rem) < 600000) {
              showNotification("Sapekkho Reminder", t.title, t.id);
              newNotifiedTimes.push(t.reminder);
              shouldNotify = true;
            }
          }

          if (shouldNotify) {
            changed = true;
            return { ...t, notified: true, notifiedTimes: newNotifiedTimes };
          }
          return t;
        });
        return changed ? updated : prev;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [reminderSound]);

  const handleFormat = (command) => {
    document.execCommand(command, false, null);
    editorRef.current.focus();
  };

  const addTask = () => {
    if (!form.title.trim()) return;
    const noteHTML = editorRef.current ? editorRef.current.innerHTML : "";
    
    let reminders = [...form.reminders];
    if (form.tempDate) {
      const rStr = `${form.tempDate}${form.tempTime ? `T${form.tempTime}` : "T00:00"}`;
      if (!reminders.includes(rStr)) {
        reminders.push(rStr);
      }
    }
    reminders.sort();

    const primaryReminder = reminders[0] || null;
    
    let task = {
      id: Date.now().toString(),
      title: form.title.trim(),
      note: noteHTML,
      reminder: primaryReminder,
      reminders: reminders,
      priority: form.priority || "দরকারি",
      done: false,
      notified: false,
      notifiedTimes: [],
      createdAt: new Date().toISOString(),
      gcalSyncState: primaryReminder && googleConnected ? 'syncing' : null
    };

    // Add locally first
    setTasks(prev => [task, ...prev]);
    setForm({ title: "", note: "", tempDate: "", tempTime: "", reminders: [], priority: "দরকারি" });
    if (editorRef.current) editorRef.current.innerHTML = "";
    setShowAdd(false);

    // Sync in background
    if (primaryReminder && window.electronAPI && window.electronAPI.syncTaskToGCal && googleConnected) {
      window.electronAPI.syncTaskToGCal(task).then(eventId => {
        setTasks(prev => prev.map(t => t.id === task.id ? { 
          ...t, 
          gcalEventId: eventId || t.gcalEventId, 
          gcalSyncState: eventId ? 'synced' : 'failed' 
        } : t));
      }).catch(err => {
        console.error(err);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, gcalSyncState: 'failed' } : t));
      });
    }
  };

  const toggle = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const toggledTask = { 
      ...task, 
      done: !task.done,
      gcalSyncState: task.reminder && googleConnected ? 'syncing' : null
    };
    
    setTasks(prev => prev.map(t => t.id === id ? toggledTask : t));

    if (window.electronAPI && window.electronAPI.syncTaskToGCal && toggledTask.reminder && googleConnected) {
      window.electronAPI.syncTaskToGCal(toggledTask).then(eventId => {
        setTasks(prev => prev.map(t => t.id === id ? { 
          ...t, 
          gcalEventId: eventId || t.gcalEventId, 
          gcalSyncState: eventId ? 'synced' : 'failed' 
        } : t));
      }).catch(err => {
        console.error(err);
        setTasks(prev => prev.map(t => t.id === id ? { ...t, gcalSyncState: 'failed' } : t));
      });
    }
  };

  const remove = (id) => {
    const task = tasks.find(t => t.id === id);
    if (task && task.gcalEventId && window.electronAPI && window.electronAPI.deleteGCalEvent) {
      window.electronAPI.deleteGCalEvent(task.gcalEventId);
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const resyncTask = (task) => {
    const resyncedTask = { ...task, gcalEventId: null, gcalSyncState: 'syncing' };
    setTasks(prev => prev.map(t => t.id === task.id ? resyncedTask : t));
    
    if (window.electronAPI && window.electronAPI.syncTaskToGCal && resyncedTask.reminder && googleConnected) {
      window.electronAPI.syncTaskToGCal(resyncedTask).then(eventId => {
        setTasks(prev => prev.map(t => t.id === task.id ? { 
          ...t, 
          gcalEventId: eventId || t.gcalEventId, 
          gcalSyncState: eventId ? 'synced' : 'failed' 
        } : t));
      }).catch(err => {
        console.error(err);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, gcalSyncState: 'failed' } : t));
      });
    }
  };

  const checkDeletedCalendarEvents = async () => {
    if (!googleConnected || isCheckingDeleted) return;
    setIsCheckingDeleted(true);
    try {
      if (window.electronAPI && window.electronAPI.listGCalEvents) {
        const events = await window.electronAPI.listGCalEvents();
        const activeEventIds = new Set(events.map(ev => ev.id));
        
        setTasks(prev => prev.map(t => {
          if (t.gcalEventId) {
            if (!activeEventIds.has(t.gcalEventId)) {
              return { ...t, gcalSyncState: 'deleted_on_gcal' };
            } else if (t.gcalSyncState === 'deleted_on_gcal') {
              return { ...t, gcalSyncState: 'synced' };
            }
          }
          return t;
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingDeleted(false);
    }
  };

  // Run deleted check on startup if connected
  useEffect(() => {
    if (googleConnected) {
      const timer = setTimeout(() => {
        checkDeletedCalendarEvents();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [googleConnected]);

  const openEditModal = (task) => {
    setEditForm({
      title: task.title,
      note: task.note || "",
      tempDate: "",
      tempTime: "",
      reminders: task.reminders || (task.reminder ? [task.reminder] : []),
      priority: task.priority || "দরকারি",
    });
    setEditingTask(task);
    setCtxMenu(null);
    setTimeout(() => {
      if (editEditorRef.current) editEditorRef.current.innerHTML = task.note || "";
    }, 50);
  };

  const saveEdit = () => {
    if (!editingTask) return;
    const noteHTML = editEditorRef.current ? editEditorRef.current.innerHTML : editForm.note;
    
    let reminders = [...editForm.reminders];
    if (editForm.tempDate) {
      const rStr = `${editForm.tempDate}${editForm.tempTime ? `T${editForm.tempTime}` : "T00:00"}`;
      if (!reminders.includes(rStr)) {
        reminders.push(rStr);
      }
    }
    reminders.sort();
    const primaryReminder = reminders[0] || null;

    let updatedTask = {
        ...editingTask,
        title: editForm.title.trim() || editingTask.title,
        note: noteHTML,
        reminder: primaryReminder,
        reminders: reminders,
        priority: editForm.priority,
        notified: false,
        notifiedTimes: (JSON.stringify(editingTask.reminders) === JSON.stringify(reminders)) ? (editingTask.notifiedTimes || []) : [],
        gcalSyncState: primaryReminder && googleConnected ? 'syncing' : null
    };

    setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));
    setEditingTask(null);

    if (primaryReminder && window.electronAPI && window.electronAPI.syncTaskToGCal && googleConnected) {
      window.electronAPI.syncTaskToGCal(updatedTask).then(eventId => {
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? { 
          ...t, 
          gcalEventId: eventId || t.gcalEventId, 
          gcalSyncState: eventId ? 'synced' : 'failed' 
        } : t));
      }).catch(err => {
        console.error(err);
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? { ...t, gcalSyncState: 'failed' } : t));
      });
    }
  };

  const handleTaskContextMenu = (e, task) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, task });
  };
  
  const filtered = tasks.filter(t => {
    if (filter === "done") return t.done;
    if (filter === "priority_foroz") return !t.done && t.priority === "ফরয";
    if (filter === "priority_high") return !t.done && (t.priority === "আম্মু বলসে" || t.priority === "High");
    if (filter === "priority_medium") return !t.done && (t.priority === "দরকারি" || t.priority === "Medium");
    if (filter === "priority_kalke") return !t.done && t.priority === "কালকে করব";
    if (filter === "priority_low") return !t.done && (t.priority === "পরে করি" || t.priority === "Low");
    if (filter === "calendar") {
        const d = new Date(t.reminder || t.createdAt);
        return !t.done && d.toDateString() === calendarDate.toDateString();
    }
    if (filter === "settings") return false;
    if (filter === "today") return isToday(t.reminder) || isToday(t.createdAt);
    return !t.done;
  });

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
  
  const renderCalendar = () => {
    const days = getDaysInMonth(calendarDate.getFullYear(), calendarDate.getMonth());
    const grid = [];
    
    for (let i = 0; i < firstDayOfMonth; i++) {
      grid.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    }
    
    for (let i = 1; i <= days; i++) {
      const d = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), i);
      const isSelected = d.toDateString() === calendarDate.toDateString();
      const isTodayDate = d.toDateString() === new Date().toDateString();
      
      const hasTask = tasks.some(t => !t.done && new Date(t.reminder || t.createdAt).toDateString() === d.toDateString());

      grid.push(
        <div 
          key={i} 
          className={`cal-day ${isSelected ? 'active-day' : ''} ${isTodayDate ? 'today' : ''}`}
          onClick={() => { setCalendarDate(d); setFilter('calendar'); }}
        >
          {i}
          {hasTask && <div className="task-dot"></div>}
        </div>
      );
    }
    return grid;
  };

  return (
    <React.Fragment>
      <div className="titlebar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, WebkitAppRegion: "no-drag" }}>
          <div style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="logo.svg" alt="Sapekkho Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Sapekkho</span>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ WebkitAppRegion: "no-drag", marginRight: 140, position: "relative" }} ref={profileMenuRef}>
          <div className="profile-badge" onClick={() => setShowProfileMenu(!showProfileMenu)}>
            {googleConnected && googleEmail ? googleEmail[0].toUpperCase() : <i className="ti ti-user-circle" style={{ fontSize: 18 }}></i>}
          </div>
          {showProfileMenu && (
            <div style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: 260,
              padding: 12,
              background: "var(--color-background-card)",
              border: "1px solid var(--color-border-card)",
              borderRadius: "var(--border-radius-md)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              zIndex: 9999,
              animation: "ctxFadeIn 0.1s ease"
            }}>
              {googleConnected ? (
                <>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{googleEmail}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>Connected to Google Calendar</div>
                  <button className="win-btn" style={{ width: "100%", justifyContent: "center", color: confirmSignOut ? "#dc2626" : "inherit" }} onClick={async () => {
                    if (!confirmSignOut) {
                      setConfirmSignOut(true);
                    } else {
                      setShowProfileMenu(false);
                      setConfirmSignOut(false);
                      setIsDisconnecting(true);
                      if (window.electronAPI) await window.electronAPI.disconnectGoogle();
                      setGoogleConnected(false);
                      setGoogleEmail('');
                      setIsDisconnecting(false);
                    }
                  }}>
                    {isDisconnecting ? 'Disconnecting...' : confirmSignOut ? 'Are you sure?' : 'Sign Out'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Sign In</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16, lineHeight: 1.4 }}>Signing in syncs your tasks and reminders directly to your Google Calendar.</div>
                  <button className="win-btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => {
                    if (window.electronAPI) window.electronAPI.startGoogleAuth();
                    setShowProfileMenu(false);
                  }}>
                    <i className="ti ti-brand-google"></i> Sign In with Google
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar">
        <div style={{ padding: "12px 12px 24px", WebkitAppRegion: "no-drag" }}>
          <div className="nav-item" onClick={handleOpenAddTask} style={{ background: "var(--color-accent)", color: "var(--color-accent-text)", justifyContent: "center", fontWeight: 600, padding: "10px" }}>
            <i className="ti ti-plus" style={{ fontSize: 18 }}></i> New Task
          </div>
        </div>

        <div style={{ flex: 1, WebkitAppRegion: "no-drag", overflowY: "auto", overflowX: "hidden" }}>
          <div className={`nav-item ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            <i className="ti ti-inbox" style={{ fontSize: 18 }}></i> All Tasks
          </div>
          <div className={`nav-item ${filter === 'today' ? 'active' : ''}`} onClick={() => setFilter('today')}>
            <i className="ti ti-calendar-event" style={{ fontSize: 18 }}></i> Today
          </div>
          <div className={`nav-item ${filter === 'calendar' ? 'active' : ''}`} onClick={() => setFilter('calendar')}>
            <i className="ti ti-calendar" style={{ fontSize: 18 }}></i> Calendar
          </div>
          <div className={`nav-item ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')}>
            <i className="ti ti-checks" style={{ fontSize: 18 }}></i> Completed
          </div>
          
          <div style={{ margin: "20px 0 8px 12px", fontSize: 12, fontWeight: 600, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Priorities</div>
          
          <div className={`nav-item ${filter === 'priority_foroz' ? 'active' : ''}`} onClick={() => setFilter('priority_foroz')}>
            <span style={{ flex: 1 }}>ফরয</span> {renderPriorityIcon("ফরয")}
          </div>
          <div className={`nav-item ${filter === 'priority_high' ? 'active' : ''}`} onClick={() => setFilter('priority_high')}>
            <span style={{ flex: 1 }}>আম্মু বলসে</span> {renderPriorityIcon("আম্মু বলসে")}
          </div>
          <div className={`nav-item ${filter === 'priority_medium' ? 'active' : ''}`} onClick={() => setFilter('priority_medium')}>
            <span style={{ flex: 1 }}>দরকারি</span> {renderPriorityIcon("দরকারি")}
          </div>
          <div className={`nav-item ${filter === 'priority_kalke' ? 'active' : ''}`} onClick={() => setFilter('priority_kalke')}>
            <span style={{ flex: 1 }}>কালকে করব</span> {renderPriorityIcon("কালকে করব")}
          </div>
          <div className={`nav-item ${filter === 'priority_low' ? 'active' : ''}`} onClick={() => setFilter('priority_low')}>
            <span style={{ flex: 1 }}>পরে করি</span> {renderPriorityIcon("পরে করি")}
          </div>
        </div>

        <div style={{ WebkitAppRegion: "no-drag", marginTop: "auto" }}>
          <div className={`nav-item ${filter === 'settings' ? 'active' : ''}`} onClick={() => setFilter('settings')}>
            <i className="ti ti-settings" style={{ fontSize: 18 }}></i>
            Settings
          </div>
        </div>
      </div>

      <div className="main-content">
        <div style={{ padding: "24px 32px 12px", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
              {filter === 'all' && 'All Tasks'}
              {filter === 'today' && 'My Day'}
              {filter === 'done' && 'Completed'}
              {filter === 'settings' && 'Settings'}
              {filter === 'priority_foroz' && 'ফরয'}
              {filter === 'priority_high' && 'আম্মু বলসে'}
              {filter === 'priority_medium' && 'দরকারি'}
              {filter === 'priority_kalke' && 'কালকে করব'}
              {filter === 'priority_low' && 'পরে করি'}
              {filter === 'calendar' && 'Calendar'}
            </h1>
            {googleConnected && filter !== 'settings' && (
              <button 
                className="win-toolbar-btn" 
                title="Check Google Calendar Sync Status" 
                disabled={isCheckingDeleted}
                onClick={checkDeletedCalendarEvents}
                style={{ alignSelf: "center", padding: "6px", borderRadius: "50%" }}
              >
                <i className={`ti ti-refresh ${isCheckingDeleted ? 'ti-spin' : ''}`} style={{ display: "inline-block", animation: isCheckingDeleted ? "spin 1s linear infinite" : "none" }}></i>
              </button>
            )}
          </div>
          {filter !== 'settings' && (
              <p style={{ margin: "4px 0 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
              {filter === 'calendar' ? calendarDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              </p>
          )}
          {filter === 'calendar' && (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <button className="win-toolbar-btn" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}><i className="ti ti-chevron-left"></i></button>
                <span style={{ fontWeight: 600 }}>{calendarDate.toLocaleDateString([], { month: "long", year: "numeric" })}</span>
                <button className="win-toolbar-btn" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}><i className="ti ti-chevron-right"></i></button>
            </div>
          )}
        </div>

        <div className="scrollable-area">

          {filter === 'settings' && (
            <div style={{ maxWidth: 700 }}>
                <div className="settings-card">
                    <div className="settings-card-title">General</div>
                    <div className="settings-row" style={{ paddingTop: 0 }}>
                        <div>
                            <div style={{ fontWeight: 500, fontSize: 15 }}>Theme</div>
                            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Choose between light and dark mode.</div>
                        </div>
                        <div className={`toggle-switch ${theme === 'dark' ? 'on' : ''}`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                            <div className="toggle-switch-handle"></div>
                        </div>
                    </div>

                    <div className="settings-row">
                        <div>
                            <div style={{ fontWeight: 500, fontSize: 15 }}>Auto-Launch at Startup</div>
                            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Start Sapekkho automatically when Windows boots.</div>
                            {!autoLaunch && (
                                <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                                    <i className="ti ti-alert-circle"></i> Warning: Desktop reminders will not trigger if Sapekkho is not running!
                                </div>
                            )}
                        </div>
                        <div className={`toggle-switch ${autoLaunch ? 'on' : ''}`} onClick={() => setAutoLaunch(!autoLaunch)}>
                            <div className="toggle-switch-handle"></div>
                        </div>
                    </div>

                    <div className="settings-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                            <div>
                                <div style={{ fontWeight: 500, fontSize: 15 }}>Startup Behavior</div>
                                <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Choose how Sapekkho opens on startup.</div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 16, width: "100%" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                <input type="radio" checked={startupBehavior === 'normal'} onChange={() => { setStartupBehavior('normal'); if (window.electronAPI) window.electronAPI.setStartupBehavior('normal'); }} />
                                Normal
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                <input type="radio" checked={startupBehavior === 'minimized'} onChange={() => { setStartupBehavior('minimized'); if (window.electronAPI) window.electronAPI.setStartupBehavior('minimized'); }} />
                                Start Minimized
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                <input type="radio" checked={startupBehavior === 'tray'} onChange={() => { setStartupBehavior('tray'); if (window.electronAPI) window.electronAPI.setStartupBehavior('tray'); }} />
                                Start to Tray
                            </label>
                        </div>
                    </div>

                    <div className="settings-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
                        <div>
                            <div style={{ fontWeight: 500, fontSize: 15 }}>Global Hotkey</div>
                            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Shortcut to quickly open Sapekkho from anywhere.</div>
                        </div>
                        <div>
                            <button 
                                className={`win-btn ${isRecordingHotkey ? 'primary' : ''}`} 
                                onClick={() => setIsRecordingHotkey(true)}
                                style={{ width: 180, justifyContent: "center" }}
                            >
                                {isRecordingHotkey ? "Listening..." : globalShortcut || "Record Shortcut"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-title">Task Defaults</div>
                    <div className="settings-row" style={{ paddingTop: 0, borderBottom: "none", paddingBottom: 0 }}>
                        <div>
                            <div style={{ fontWeight: 500, fontSize: 15 }}>Auto-fill Date from Calendar</div>
                            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Automatically use the selected calendar date for new tasks.</div>
                        </div>
                        <div className={`toggle-switch ${calendarAutoFill ? 'on' : ''}`} onClick={() => setCalendarAutoFill(!calendarAutoFill)}>
                            <div className="toggle-switch-handle"></div>
                        </div>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-title">Notifications & Sounds</div>
                    <div className="settings-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 16, paddingTop: 0, borderBottom: "none", paddingBottom: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                            <div>
                                <div style={{ fontWeight: 500, fontSize: 15 }}>Reminder Sound</div>
                                <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Choose how you'd like to be notified.</div>
                            </div>
                            <button className="win-btn" onClick={() => playSound(reminderSound)} title="Play Sound">
                                <i className={isPlayingSound ? "ti ti-player-pause" : "ti ti-player-play"}></i> {isPlayingSound ? "Pause" : "Play"}
                            </button>
                        </div>
                        
                        <div style={{ width: "100%", padding: 12, background: "var(--color-background-card-hover)", borderRadius: "var(--border-radius-md)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <input type="radio" checked={soundMode === 'preset'} onChange={() => {
                                    setSoundMode('preset');
                                    if (reminderSound === 'custom') setReminderSound('ping');
                                }} />
                                <span style={{ fontWeight: 500 }}>Preset Sound</span>
                            </div>
                            <select className="win-input" value={soundMode === 'preset' ? reminderSound : 'ping'} 
                                    disabled={soundMode !== 'preset'}
                                    onChange={e => setReminderSound(e.target.value)} style={{ width: 200, marginLeft: 24 }}>
                                <option value="ping">Default Ping</option>
                                <option value="chime">Chime</option>
                                <option value="none">No Sound</option>
                            </select>
                        </div>

                        <div style={{ width: "100%", padding: 12, background: "var(--color-background-card-hover)", borderRadius: "var(--border-radius-md)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <input type="radio" checked={soundMode === 'custom'} onChange={() => {
                                    setSoundMode('custom');
                                    setReminderSound('custom');
                                }} />
                                <span style={{ fontWeight: 500 }}>Custom Audio File</span>
                            </div>
                            <input type="file" accept="audio/*" className="win-input" 
                                   disabled={soundMode !== 'custom'}
                                   style={{ width: "calc(100% - 24px)", padding: 4, marginLeft: 24 }} 
                                   onChange={e => {
                                       const file = e.target.files[0];
                                       if (file) {
                                           if (file.size > 2 * 1024 * 1024) { alert("File too large. Please select an audio file under 2MB."); return; }
                                           const reader = new FileReader();
                                           reader.onload = (ev) => { setCustomSoundData(ev.target.result); setReminderSound('custom'); setSoundMode('custom'); };
                                           reader.readAsDataURL(file);
                                       }
                                   }} />
                            {customSoundData && soundMode === 'custom' && <div style={{ marginLeft: 24, marginTop: 8, fontSize: 12, color: "var(--color-accent)" }}>Custom audio loaded successfully.</div>}
                        </div>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-title">Integrations</div>
                    <div className="settings-row" style={{ paddingTop: 0 }}>
                        <div>
                            <div style={{ fontWeight: 500, fontSize: 15 }}>Google Calendar Sync</div>
                            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5, marginTop: 4, maxWidth: "90%" }}>One-way sync your tasks to a dedicated 'Sapekkho' calendar so you can get native reminders on your phone and other devices.</div>
                            {googleConnected && googleEmail && (
                                <div style={{ fontSize: 13, color: "var(--color-accent)", marginTop: 8, fontWeight: 500 }}>
                                    <i className="ti ti-check" style={{ marginRight: 4 }}></i> Connected as {googleEmail}
                                </div>
                            )}
                        </div>
                        <div>
                            {!googleConnected ? (
                                <button className="win-btn primary" onClick={() => window.electronAPI && window.electronAPI.startGoogleAuth()}>
                                    <i className="ti ti-brand-google"></i> Connect Google
                                </button>
                            ) : (
                                <button className="win-btn" disabled={isDisconnecting} onClick={async () => {
                                    setIsDisconnecting(true);
                                    if (window.electronAPI) await window.electronAPI.disconnectGoogle();
                                    setGoogleConnected(false);
                                    setGoogleEmail('');
                                    setIsDisconnecting(false);
                                }}>
                                    {isDisconnecting ? <><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite", marginRight: 6 }}></i> Disconnecting...</> : 'Disconnect'}
                                </button>
                            )}
                        </div>
                    </div>
                    {googleConnected && (
                        <>
                            <div className="settings-row">
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: 15 }}>Sync Unsynced Tasks</div>
                                    <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>
                                        {(() => {
                                            const unsyncedCount = tasks.filter(t => t.reminder && !t.gcalEventId && !t.done).length;
                                            return syncResult ? syncResult : `${unsyncedCount} task${unsyncedCount !== 1 ? 's' : ''} with reminders not yet synced to Google Calendar.`;
                                        })()}
                                    </div>
                                </div>
                                <div>
                                    <button className="win-btn" disabled={isSyncing || tasks.filter(t => t.reminder && !t.gcalEventId && !t.done).length === 0} onClick={async () => {
                                        setIsSyncing(true);
                                        setSyncResult('');
                                        const unsynced = tasks.filter(t => t.reminder && !t.gcalEventId && !t.done);
                                        let synced = 0;
                                        for (const task of unsynced) {
                                            setSyncResult(`Syncing ${synced + 1} of ${unsynced.length}...`);
                                            if (window.electronAPI && window.electronAPI.syncTaskToGCal) {
                                                const eventId = await window.electronAPI.syncTaskToGCal(task);
                                                if (eventId) {
                                                    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, gcalEventId: eventId, gcalSyncState: 'synced' } : t));
                                                    synced++;
                                                }
                                            }
                                        }
                                        setSyncResult(`Done! ${synced} task${synced !== 1 ? 's' : ''} synced successfully.`);
                                        setIsSyncing(false);
                                    }}>
                                        {isSyncing ? <><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite", marginRight: 6 }}></i> Syncing...</> : <><i className="ti ti-refresh" style={{ marginRight: 4 }}></i> Sync Now</>}
                                    </button>
                                </div>
                            </div>
                            <div className="settings-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: 15 }}>Refresh Calendar Sync Status</div>
                                    <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>Checks Google Calendar to see if any local tasks were deleted from your calendar.</div>
                                </div>
                                <div>
                                    <button className="win-btn" disabled={isCheckingDeleted} onClick={checkDeletedCalendarEvents}>
                                        {isCheckingDeleted ? <><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite", marginRight: 6 }}></i> Checking...</> : <><i className="ti ti-refresh" style={{ marginRight: 4 }}></i> Check Deleted Events</>}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="settings-card">
                    <div className="settings-card-title">About & Updates</div>
                    <div className="settings-row" style={{ paddingTop: 0 }}>
                        <div>
                            <div style={{ fontWeight: 500, fontSize: 15 }}>Sapekkho Version 1.1.2</div>
                            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>
                                {updateStatus ? updateStatus : "Check to see if there's a newer version available."}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="win-btn" onClick={() => setShowHelpDialog(true)}>
                                <i className="ti ti-info-circle"></i> What's New & Help
                            </button>
                            <button className="win-btn primary" disabled={isCheckingUpdates} onClick={async () => {
                                setIsCheckingUpdates(true);
                                setUpdateStatus("Checking...");
                                if (window.electronAPI && window.electronAPI.checkForUpdates) {
                                    const res = await window.electronAPI.checkForUpdates();
                                    if (res && res.error) {
                                        setUpdateStatus("Error checking for updates.");
                                        setIsCheckingUpdates(false);
                                    }
                                }
                            }}>
                                {isCheckingUpdates ? <><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite", marginRight: 6 }}></i> Checking...</> : 'Check for Updates'}
                            </button>
                        </div>
                    </div>
                    <div className="settings-row">
                        <div>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>Official Website</div>
                            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>Visit our website for news, guides and updates.</div>
                        </div>
                        <button className="win-btn" onClick={() => window.electronAPI && window.electronAPI.openExternal('https://sapekkho.github.io')}>
                            <i className="ti ti-external-link"></i> sapekkho.github.io
                        </button>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="settings-card-title">How to Use</div>

                    <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)", marginBottom: 6 }}>Adding a Task</div>
                        <ol style={{ margin: 0, paddingLeft: 20 }}>
                          <li>Click the <strong>+ New Task</strong> button in the sidebar, or press <kbd style={{ background: 'var(--color-background-sidebar)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>Ctrl+T</kbd> anywhere.</li>
                          <li>Type a task name. Press <kbd style={{ background: 'var(--color-background-sidebar)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>Enter</kbd> or click <strong>Add Task</strong> to save.</li>
                          <li>Optionally add a note using the rich text editor (supports <strong>Bold</strong>, <em>Italic</em>, and bullet lists).</li>
                          <li>Set a <strong>Priority</strong> from the dropdown — from "পরে করি" (low) to "ফরয" (critical).</li>
                        </ol>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)", marginBottom: 6 }}>Setting Reminders</div>
                        <ol style={{ margin: 0, paddingLeft: 20 }}>
                          <li>In the New Task or Edit Task modal, go to the <strong>Add Reminder Time</strong> section.</li>
                          <li>Pick a <strong>date</strong> first (required), then optionally a <strong>time</strong>.</li>
                          <li>Click <strong>+ Add</strong> to add it. You can add multiple reminders per task!</li>
                          <li>At the reminder time, Sapekkho will show a system notification and play a sound.</li>
                          <li>To remove a reminder, click the <strong>✕</strong> next to it.</li>
                        </ol>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)", marginBottom: 6 }}>Editing & Managing Tasks</div>
                        <ol style={{ margin: 0, paddingLeft: 20 }}>
                          <li><strong>Right-click</strong> any task card to open the context menu (Edit, Delete, Mark Done).</li>
                          <li>Click the <strong>checkbox</strong> on a task card to mark it complete/incomplete.</li>
                          <li>Use the sidebar to filter tasks: <strong>All Tasks</strong>, <strong>Today</strong>, <strong>Calendar</strong>, <strong>Completed</strong>, or by priority.</li>
                        </ol>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)", marginBottom: 6 }}>Google Calendar Sync</div>
                        <ol style={{ margin: 0, paddingLeft: 20 }}>
                          <li>Go to <strong>Settings → Integrations</strong> and click <strong>Sign in with Google</strong>.</li>
                          <li>Once connected, every task with a reminder will automatically sync to a "Sapekkho" calendar in Google Calendar.</li>
                          <li>Tasks sync in the background — look for the spinning indicator on a task card during sync.</li>
                          <li>If you delete an event from Google Calendar, click the <strong>Refresh</strong> button (↻) in the main header to detect and handle deletions.</li>
                        </ol>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)", marginBottom: 6 }}>Keyboard Shortcuts</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <tbody>
                            {[['Ctrl+T', 'Open New Task anywhere'], ['Enter', 'Submit task form'], ['Right-click task', 'Edit / Delete / Complete']].map(([key, desc]) => (
                              <tr key={key} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                <td style={{ padding: '6px 0', width: 160 }}><kbd style={{ background: 'var(--color-background-sidebar)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>{key}</kbd></td>
                                <td style={{ padding: '6px 0', color: 'var(--color-text-secondary)' }}>{desc}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                </div>
            </div>
          )}

          {filter === 'calendar' && (
              <div style={{ marginBottom: 32 }}>
                  <div className="cal-grid">
                      <div className="cal-header">Sun</div><div className="cal-header">Mon</div><div className="cal-header">Tue</div>
                      <div className="cal-header">Wed</div><div className="cal-header">Thu</div><div className="cal-header">Fri</div><div className="cal-header">Sat</div>
                      {renderCalendar()}
                  </div>
              </div>
          )}

          {/* Task List */}
          {filter !== 'settings' && (
            !loaded ? (
                <p>Loading tasks...</p>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", marginTop: 60, color: "var(--color-text-tertiary)" }}>
                <i className="ti ti-check" style={{ fontSize: 48, opacity: 0.5 }}></i>
                <p>No tasks here. Enjoy your day!</p>
                </div>
            ) : (
                filtered.map(task => {
                const overdue = task.reminder && !task.done && isPast(task.reminder);
                
                // Color from blue to red for pore kori -> foroz
                let borderColor = "var(--color-border-card)";
                let colorValue = "var(--color-text-tertiary)";
                
                if (task.priority === "ফরয") {
                    borderColor = "#991b1b"; // Dark Red
                    colorValue = "#991b1b";
                } else if (task.priority === "আম্মু বলসে" || task.priority === "High") {
                    borderColor = "#dc2626"; // Red
                    colorValue = "#dc2626";
                } else if (task.priority === "দরকারি" || task.priority === "Medium") {
                    borderColor = "#f59e0b"; // Amber/Orange
                    colorValue = "#f59e0b";
                } else if (task.priority === "কালকে করব") {
                    borderColor = "#0ea5e9"; // Cyan
                    colorValue = "#0ea5e9";
                } else if (task.priority === "পরে করি" || task.priority === "Low") {
                    borderColor = "#3b82f6"; // Blue
                    colorValue = "#3b82f6";
                }
                
                const allReminders = task.reminders && task.reminders.length > 0 ? task.reminders : (task.reminder ? [task.reminder] : []);
                
                return (
                    <div key={task.id} className="task-card" style={{ borderLeft: `4px solid ${borderColor}` }} onContextMenu={(e) => handleTaskContextMenu(e, task)}>
                    <div className={`win-checkbox ${task.done ? 'checked' : ''}`} onClick={() => toggle(task.id)}>
                        {task.done && <i className="ti ti-check" style={{ fontSize: 14 }}></i>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, textDecoration: task.done ? "line-through" : "none", color: task.done ? "var(--color-text-secondary)" : "var(--color-text-primary)" }}>
                        {task.title}
                        </p>
                        {task.note && <div className="rich-content" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }} dangerouslySetInnerHTML={{ __html: task.note }}></div>}
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ color: colorValue }}>{task.priority}</span> {renderPriorityIcon(task.priority, colorValue)}
                            </span>
                            
                            {task.gcalSyncState === 'syncing' && (
                                <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                                    <i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }}></i> Syncing...
                                </span>
                            )}
                            {task.gcalSyncState === 'failed' && (
                                <span style={{ fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }} title="Sync failed. Right click task card to edit/retry.">
                                    <i className="ti ti-alert-circle"></i> Sync Failed
                                </span>
                            )}
                            {task.gcalSyncState === 'deleted_on_gcal' && (
                                <span style={{ fontSize: 12, color: "#d97706", display: "flex", alignItems: "center", gap: 4 }}>
                                    <i className="ti ti-alert-triangle"></i> Deleted from Google Calendar
                                </span>
                            )}
                            {task.gcalEventId && task.gcalSyncState !== 'syncing' && task.gcalSyncState !== 'failed' && task.gcalSyncState !== 'deleted_on_gcal' && (
                                <span style={{ fontSize: 12, color: "var(--color-accent)", display: "flex", alignItems: "center", gap: 4 }} title="Synced to Google Calendar">
                                    <i className="ti ti-brand-google"></i> Synced
                                </span>
                            )}
                          </div>
                          
                          {allReminders.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {allReminders.map((r, rIdx) => {
                                const isOverdue = !task.done && isPast(r);
                                return (
                                  <span key={rIdx} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--color-background-sidebar)", color: isOverdue ? "#dc2626" : "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
                                    <i className="ti ti-clock"></i> {formatDate(r)} {formatTime(r)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          
                          {task.gcalSyncState === 'deleted_on_gcal' && (
                            <div style={{ display: "flex", gap: 8, marginTop: 2, alignItems: "center" }}>
                                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
                                  You deleted this task from Google Calendar.
                                </span>
                                <button className="win-btn" style={{ padding: "2px 6px", fontSize: 11, border: "none", background: "rgba(220, 38, 38, 0.1)", color: "#dc2626" }} onClick={(e) => { e.stopPropagation(); remove(task.id); }}>
                                    Remove Locally
                                </button>
                                <button className="win-btn" style={{ padding: "2px 6px", fontSize: 11, border: "none", background: "rgba(0, 103, 192, 0.1)", color: "var(--color-accent)" }} onClick={(e) => { e.stopPropagation(); resyncTask(task); }}>
                                    Re-sync
                                </button>
                            </div>
                          )}
                        </div>
                    </div>
                    <button className="win-btn" onClick={() => remove(task.id)} style={{ padding: "4px 8px", background: "transparent", border: "none", color: "var(--color-text-tertiary)" }} title="Delete">
                        <i className="ti ti-trash"></i>
                    </button>
                    </div>
                );
                })
            )
          )}
        </div>
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <div className="context-menu-item" onClick={() => openEditModal(ctxMenu.task)}>
            <i className="ti ti-pencil"></i> Edit Task
          </div>
          <div className="context-menu-item" onClick={() => { toggle(ctxMenu.task.id); setCtxMenu(null); }}>
            <i className={ctxMenu.task.done ? "ti ti-rotate-clockwise" : "ti ti-check"}></i> {ctxMenu.task.done ? 'Mark Undone' : 'Mark Done'}
          </div>
          {ctxMenu.task.gcalSyncState === 'failed' && (
            <div className="context-menu-item" onClick={() => { resyncTask(ctxMenu.task); setCtxMenu(null); }}>
              <i className="ti ti-refresh"></i> Retry Sync
            </div>
          )}
          <div className="context-menu-separator"></div>
          <div className="context-menu-item danger" onClick={() => { remove(ctxMenu.task.id); setCtxMenu(null); }}>
            <i className="ti ti-trash"></i> Delete Task
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <div className="edit-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingTask(null); }}>
          <div className="edit-modal">
            <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 600 }}>Edit Task</h2>
            <input
              className="win-input"
              placeholder="Task name"
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } }}
              style={{ marginBottom: 12, fontSize: 16, fontWeight: 500 }}
            />
            
            <div style={{ display: "flex", gap: 4, padding: "4px 8px", background: "var(--color-background-app)", border: "1px solid var(--color-border-card)", borderBottom: "none", borderTopLeftRadius: "var(--border-radius-sm)", borderTopRightRadius: "var(--border-radius-sm)" }}>
              <button className="win-toolbar-btn" onClick={() => { document.execCommand('bold', false, null); editEditorRef.current.focus(); }} title="Bold"><i className="ti ti-bold"></i></button>
              <button className="win-toolbar-btn" onClick={() => { document.execCommand('italic', false, null); editEditorRef.current.focus(); }} title="Italic"><i className="ti ti-italic"></i></button>
              <button className="win-toolbar-btn" onClick={() => { document.execCommand('insertUnorderedList', false, null); editEditorRef.current.focus(); }} title="Bullet List"><i className="ti ti-list"></i></button>
            </div>
            <div
              ref={editEditorRef}
              className="rich-text-editor"
              contentEditable={true}
              data-placeholder="Add a note (optional)..."
              style={{ marginBottom: 12, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
            ></div>

            <div style={{ display: "flex", gap: 8, flexDirection: "column", marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>Add Reminder Time:</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="date" className="win-input" value={editForm.tempDate} onChange={e => setEditForm(f => ({ ...f, tempDate: e.target.value }))} />
                <input type="time" className="win-input" value={editForm.tempTime} onChange={e => setEditForm(f => ({ ...f, tempTime: e.target.value }))} />
                <button 
                  className="win-btn primary" 
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => {
                    if (!editForm.tempDate) return;
                    const rStr = `${editForm.tempDate}${editForm.tempTime ? `T${editForm.tempTime}` : "T00:00"}`;
                    if (!editForm.reminders.includes(rStr)) {
                      setEditForm(f => ({
                        ...f,
                        reminders: [...f.reminders, rStr].sort(),
                        tempTime: "" // Clear time for next entry
                      }));
                    }
                  }}
                >
                  + Add
                </button>
              </div>
            </div>

            {editForm.reminders.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8 }}>Active Reminders:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxH: 80, overflowY: "auto" }}>
                  {editForm.reminders.map((r, idx) => (
                    <span key={idx} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, background: "var(--color-background-sidebar)", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{formatDate(r)} {formatTime(r)}</span>
                      <i 
                        className="ti ti-x" 
                        style={{ cursor: "pointer", fontSize: 12 }} 
                        onClick={() => setEditForm(f => ({ ...f, reminders: f.reminders.filter(rem => rem !== r) }))}
                      ></i>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Priority:</span>
              <PriorityDropdown value={editForm.priority} onChange={val => setEditForm(f => ({ ...f, priority: val }))} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="win-btn" onClick={() => setEditingTask(null)}>Cancel</button>
              <button className="win-btn primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="edit-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="edit-modal">
            <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 600 }}>New Task</h2>
            <input
              ref={inputRef}
              className="win-input"
              placeholder="Task name"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
              style={{ marginBottom: 12, fontSize: 16, fontWeight: 500 }}
              autoFocus
            />
            
            <div style={{ display: "flex", gap: 4, padding: "4px 8px", background: "var(--color-background-app)", border: "1px solid var(--color-border-card)", borderBottom: "none", borderTopLeftRadius: "var(--border-radius-sm)", borderTopRightRadius: "var(--border-radius-sm)" }}>
              <button className="win-toolbar-btn" onClick={() => handleFormat('bold')} title="Bold"><i className="ti ti-bold"></i></button>
              <button className="win-toolbar-btn" onClick={() => handleFormat('italic')} title="Italic"><i className="ti ti-italic"></i></button>
              <button className="win-toolbar-btn" onClick={() => handleFormat('insertUnorderedList')} title="Bullet List"><i className="ti ti-list"></i></button>
            </div>
            <div
              ref={editorRef}
              className="rich-text-editor"
              contentEditable={true}
              data-placeholder="Add a note (optional)..."
              style={{ marginBottom: 12, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
            ></div>

            <div style={{ display: "flex", gap: 8, flexDirection: "column", marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>Add Reminder Time:</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="date" className="win-input" value={form.tempDate}
                  style={addReminderError ? { borderBottomColor: '#dc2626' } : {}}
                  onChange={e => { 
                    setForm(f => ({ ...f, tempDate: e.target.value })); 
                    if (e.target.value) setAddReminderError(false);
                  }} />
                <input type="time" className="win-input" value={form.tempTime} 
                  onChange={e => {
                    setForm(f => ({ ...f, tempTime: e.target.value }));
                    if (form.tempDate) setAddReminderError(false);
                  }} />
                <button 
                  className="win-btn primary" 
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => {
                    if (!form.tempDate) { 
                      setAddReminderError(true); 
                      return; 
                    }
                    const rStr = `${form.tempDate}${form.tempTime ? `T${form.tempTime}` : "T00:00"}`;
                    if (!form.reminders.includes(rStr)) {
                      setForm(f => ({
                        ...f,
                        reminders: [...f.reminders, rStr].sort(),
                        tempTime: ""
                      }));
                    }
                    setAddReminderError(false);
                  }}
                >
                  + Add
                </button>
              </div>
              {addReminderError && (
                <div style={{ color: '#dc2626', fontSize: 12, fontWeight: 500, marginTop: 4 }}>
                  Please select a date first before adding a reminder.
                </div>
              )}
            </div>

            {form.reminders.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8 }}>Active Reminders:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxH: 80, overflowY: "auto" }}>
                  {form.reminders.map((r, idx) => (
                    <span key={idx} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, background: "var(--color-background-sidebar)", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{formatDate(r)} {formatTime(r)}</span>
                      <i 
                        className="ti ti-x" 
                        style={{ cursor: "pointer", fontSize: 12 }} 
                        onClick={() => setForm(f => ({ ...f, reminders: f.reminders.filter(rem => rem !== r) }))}
                      ></i>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Priority:</span>
              <PriorityDropdown value={form.priority} onChange={val => setForm(f => ({ ...f, priority: val }))} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="win-btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="win-btn primary" onClick={addTask}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Help & What's New Modal */}
      {showHelpDialog && (
        <div className="edit-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowHelpDialog(false); }}>
          <div className="edit-modal" style={{ width: 550, maxHeight: "80vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <i className="ti ti-info-circle" style={{ color: "var(--color-accent)" }}></i>
              What's New in Sapekkho 1.1.2
            </h2>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>✨ New Features</h3>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                <li><strong>Multiple Reminders:</strong> Add multiple reminder times to a single task. Receive separate alert notifications for each reminder!</li>
                <li><strong>Keyboard Shortcuts:</strong> Press the <code>Enter</code> key inside modal fields to instantly submit/add a task.</li>
                <li><strong>Responsive Local Sync:</strong> Adding/modifying/toggling tasks updates the local screen instantly with a clean syncing animation, with the Google Calendar sync performing in the background.</li>
                <li><strong>Google Calendar Verification:</strong> A new refresh feature in settings and the main header scans for tasks deleted from Google Calendar. It tags affected tasks, allowing you to delete locally or re-sync with a single click.</li>
                <li><strong>Instant Startup:</strong> Fully pre-compiled local React codebase. No white flashes or blank screens on startup, and fully operational offline!</li>
              </ul>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>How Sign-in Works</h3>
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                Signing in connects Sapekkho securely to your Google account using OAuth. Sapekkho only requests permission to manage your Calendar, ensuring your personal data remains private. Your login tokens are stored securely on your local device.
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>How Sync Works</h3>
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                This is a <strong>one-way sync</strong>. When you create a task with a reminder time in Sapekkho, it automatically pushes it to a dedicated "Sapekkho" calendar on your Google account. This allows you to receive native notifications on your phone or smartwatch exactly when the task is due!
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button className="win-btn primary" onClick={() => setShowHelpDialog(false)}>Got it!</button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<Sapekkho />);
