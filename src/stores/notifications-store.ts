import { create } from "zustand";

// Estado de notificaciones compartido entre bell, bottom bar y drawer.
// El flujo SSE (/api/notifications/stream) alimenta `setItems` y `push`.

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  href?: string;
  kind?: string;
  severity?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsState {
  items: AppNotification[];
  connected: boolean;
  unread: number;
  push: (n: AppNotification) => void;
  setItems: (items: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setConnected: (connected: boolean) => void;
}

function countUnread(items: AppNotification[]): number {
  return items.filter((n) => !n.read).length;
}

function apiUrl(path: string): string {
  return `/api/notifications${path}`;
}

async function markReadRemote(id: string) {
  try {
    await fetch(apiUrl(`/${id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) });
  } catch {
    // La marca local prevalece; el reintento ocurre con la próxima acción.
  }
}

async function markAllReadRemote() {
  try {
    await fetch(apiUrl("/read-all"), { method: "POST" });
  } catch {
    // silencioso
  }
}

export const useNotificationStore = create<NotificationsState>((set) => ({
  items: [],
  connected: false,
  unread: 0,
  push: (n) =>
    set((s) => ({
      items: [n, ...s.items].slice(0, 60),
      unread: s.unread + (n.read ? 0 : 1),
    })),
  setItems: (items) => set({ items, unread: countUnread(items) }),
  markRead: (id) => {
    markReadRemote(id);
    set((s) => {
      const items = s.items.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return { items, unread: countUnread(items) };
    });
  },
  markAllRead: () => {
    markAllReadRemote();
    set((s) => ({
      items: s.items.map((n) => ({ ...n, read: true })),
      unread: 0,
    }));
  },
  setConnected: (connected) => set({ connected }),
}));