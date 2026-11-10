/* Version-checked sync; storage and transport are injected for deterministic tests. */
(function (root) {
  class BookWordsSync {
    static equal(a, b) {
      const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
      return JSON.stringify(canonical([a.state,a.dailyGoal,a.streak,a.imageCache])) === JSON.stringify(canonical([b.state,b.dailyGoal,b.streak,b.imageCache]));
    }
    constructor(options) { Object.assign(this, options); this.running = false; this.conflict = null; }
    async run(choice) {
      if (this.running || (this.conflict && !choice)) return false;
      this.running = true;
      this.status('syncing');
      try {
        const queued = this.queue();
        const local = JSON.parse(JSON.stringify(this.snapshot()));
        const remote = await this.rpc(null, null);
        const base = this.revision();
        if (choice && this.conflict && this.conflict.revision !== remote.revision) {
          this.conflict = remote; this.status('conflict'); return false;
        }
        const same = BookWordsSync.equal;
        const changedDuringRead = this.queue() !== queued;
        if (changedDuringRead) { this.status('pending'); return false; }
        if (!choice && queued && base !== remote.revision && !same(local, remote.data)) {
          this.conflict = remote;
          this.status('conflict');
          return false;
        }
        if (choice === 'local' || (choice !== 'cloud' && queued && !same(local, remote.data))) {
          if (choice) this.backup(remote.data, 'cloud');
          const saved = await this.rpc(remote.revision, local);
          if (!saved.accepted) { this.conflict = saved; this.status('conflict'); return false; }
          this.setRevision(saved.revision);
          this.clearQueue(queued);
        } else {
          if (!same(local, remote.data)) {
            this.backup(local, 'local');
            this.apply(remote.data);
          }
          this.setRevision(remote.revision);
          this.clearQueue(queued);
        }
        this.conflict = null;
        this.status(this.queue() ? 'pending' : 'synced');
        return true;
      } catch (error) { this.status('offline', error); return false; }
      finally { this.running = false; this.idle?.(); }
    }
  }
  if (typeof module !== 'undefined') module.exports = BookWordsSync;
  else root.BookWordsSync = BookWordsSync;
})(typeof window === 'undefined' ? globalThis : window);
