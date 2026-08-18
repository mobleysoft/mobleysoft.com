const ACTIVE_KEY = "mobleysoft.eventwake.active.v1";
const ARCHIVE_KEY = "mobleysoft.eventwake.archive.v1";
const MAX_ARCHIVED_RUNS = 8;

function parse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export class BrowserSessionRepository {
  constructor(storage = window.localStorage) {
    this.storage = storage;
  }

  loadActive() {
    const session = parse(this.storage.getItem(ACTIVE_KEY), null);
    if (!session || session.state?.mission?.status !== "active") return null;
    return session;
  }

  saveActive(session) {
    this.storage.setItem(ACTIVE_KEY, JSON.stringify(session));
  }

  archive(engine, fingerprint) {
    const archive = parse(this.storage.getItem(ARCHIVE_KEY), []);
    archive.unshift({
      completedAt: new Date().toISOString(),
      fingerprint,
      session: engine,
      status: engine?.state?.mission?.status || "unknown",
    });
    this.storage.setItem(ARCHIVE_KEY, JSON.stringify(archive.slice(0, MAX_ARCHIVED_RUNS)));
    this.storage.removeItem(ACTIVE_KEY);
  }

  clearActive() {
    this.storage.removeItem(ACTIVE_KEY);
  }

  diagnostics() {
    return {
      active: Boolean(this.storage.getItem(ACTIVE_KEY)),
      archivedRuns: parse(this.storage.getItem(ARCHIVE_KEY), []).length,
    };
  }
}
