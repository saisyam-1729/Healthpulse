import { v4 as uuidv4 } from 'uuid';

const API_URL = window.location.hostname === "localhost" ? 'http://localhost:5001/api' : 'https://health-931r.onrender.com/api';
const TRACKING_ENDPOINT = `${API_URL}/track`;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const FLUSH_INTERVAL = 10000; // 10 seconds

interface TrackEvent {
  sessionId: string;
  userId?: string;
  eventType: 'pageview' | 'click' | 'time';
  path: string;
  elementId?: string;
  timeSpent?: number;
  deviceType: string;
  timestamp: string;
}

class Tracker {
  private sessionId: string;
  private queue: TrackEvent[] = [];
  private lastActive: number;
  private flushTimer: any;
  private pageStartTime: number;
  private currentPath: string;

  constructor() {
    this.sessionId = this.getOrCreateSession();
    this.lastActive = Date.now();
    this.pageStartTime = Date.now();
    this.currentPath = window.location.pathname;

    this.setupListeners();
    this.startPeriodicFlush();
  }

  private getOrCreateSession(): string {
    const stored = sessionStorage.getItem('__hp_session');
    const storedTime = sessionStorage.getItem('__hp_session_time');
    const now = Date.now();

    if (stored && storedTime && (now - parseInt(storedTime, 10) < SESSION_TIMEOUT)) {
      sessionStorage.setItem('__hp_session_time', now.toString());
      return stored;
    }

    const newSession = uuidv4();
    sessionStorage.setItem('__hp_session', newSession);
    sessionStorage.setItem('__hp_session_time', now.toString());
    return newSession;
  }

  private updateSessionTime() {
    this.lastActive = Date.now();
    sessionStorage.setItem('__hp_session_time', this.lastActive.toString());
  }

  private getDeviceType(): string {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  private getUser(): string | undefined {
    const auth = localStorage.getItem('supabase.auth.token');
    if (auth) {
      try {
        const parsed = JSON.parse(auth);
        return parsed?.currentSession?.user?.id;
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }

  public track(eventType: 'pageview' | 'click' | 'time', data: Partial<TrackEvent> = {}) {
    const currentPath = data.path || window.location.pathname;
    
    if (currentPath.startsWith('/admin') || currentPath === '/login' || localStorage.getItem('admin_token')) {
      return;
    }

    this.updateSessionTime();
    
    const event: TrackEvent = {
      sessionId: this.sessionId,
      userId: this.getUser(),
      eventType,
      path: data.path || window.location.pathname,
      elementId: data.elementId,
      timeSpent: data.timeSpent,
      deviceType: this.getDeviceType(),
      timestamp: new Date().toISOString(),
    };

    this.queue.push(event);

    if (this.queue.length >= 20) {
      this.flush();
    }
  }

  public pageview(path: string) {
    // Before tracking new page, record time spent on previous page
    if (this.currentPath && this.currentPath !== path) {
      const timeSpent = Math.round((Date.now() - this.pageStartTime) / 1000);
      if (timeSpent > 0) {
        this.track('time', { path: this.currentPath, timeSpent });
      }
    }

    this.currentPath = path;
    this.pageStartTime = Date.now();
    this.track('pageview', { path });
  }

  public click(elementId: string) {
    this.track('click', { elementId });
  }

  private flush() {
    if (this.queue.length === 0) return;

    const payload = JSON.stringify({ events: this.queue });
    this.queue = [];

    // Use sendBeacon for reliable delivery, especially on unload
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(TRACKING_ENDPOINT, blob);
    } else {
      fetch(TRACKING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(err => console.error('Tracking flush failed:', err));
    }
  }

  private startPeriodicFlush() {
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);
  }

  private setupListeners() {
    // Flush on page hide/unload
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Record time spent on current page before hiding
        const timeSpent = Math.round((Date.now() - this.pageStartTime) / 1000);
        this.track('time', { path: this.currentPath, timeSpent });
        this.flush();
      } else {
        this.pageStartTime = Date.now(); // Reset on return
        this.updateSessionTime();
      }
    });

    window.addEventListener('beforeunload', () => {
      const timeSpent = Math.round((Date.now() - this.pageStartTime) / 1000);
      this.track('time', { path: this.currentPath, timeSpent });
      this.flush();
    });

    // Global click listener for actionable elements
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest('button, a, [role="button"], [data-track]');
      if (clickable) {
        const id = clickable.getAttribute('id') || clickable.getAttribute('data-track') || clickable.textContent?.trim().slice(0, 30) || clickable.tagName.toLowerCase();
        if (id) {
          this.click(`Click: ${id}`);
        }
      }
    }, { capture: true, passive: true });
  }
}

// Export singleton instance
export const tracker = new Tracker();
