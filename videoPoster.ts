 n // Lightweight video posting system for Splice HTML page with Like button support.
// Save as videoPoster.ts and compile to JS, or use the provided JS file.

type StoredVideo = {
  id: string;
  filename: string;
  format: string;
  createdAt: number;
  source: 'upload' | 'record';
  blob?: Blob;
  likes?: number; // new: persistent like count
};

class IDBStore {
  private dbName = 'splice_videos_db';
  private storeName = 'videos';
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.open();
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(video: StoredVideo): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(video);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll(): Promise<StoredVideo[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).getAll();
      req.onsuccess = () => resolve(req.result as StoredVideo[]);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

class VideoService {
  private idb = new IDBStore();
  private feedRoot: HTMLElement | null = null;
  private localLikesKey = 'splice_likes'; // stores map of liked ids for this user

  async init() {
    this.setupDomHooks();
    await this.renderFromDB();
  }

  private setupDomHooks() {
    // Hook into existing handlers (no HTML edits)
    (window as any).handleFileSelected = (input: HTMLInputElement) => {
      if (!input || !input.files || input.files.length === 0) return;
      const file = input.files[0];
      this.addFile(file).then(() => {
        const msg = document.getElementById('modalStatusMsg');
        if (msg) msg.textContent = `🎬 Uploaded "${file.name}" (${this.extOf(file.name)}) successfully!`;
        setTimeout(() => {
          try { (window as any).closeVideoModal(); } catch (_) {}
          input.value = '';
        }, 1200);
      }).catch(err => {
        console.error('Failed to add file', err);
        const msg = document.getElementById('modalStatusMsg');
        if (msg) msg.textContent = `Upload failed: ${err?.message ?? err}`;
      });
    };

    (window as any).triggerRecordMode = async () => {
      const msg = document.getElementById('modalStatusMsg');
      if (msg) msg.textContent = '🔴 Initializing camera recording stream...';

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const filename = `recorded-${Date.now()}.webm`;
          await this.addBlob(blob, filename, 'record');
          if (msg) msg.textContent = `🔴 Recorded live clip saved as ${filename}!`;
          setTimeout(() => {
            try { (window as any).closeVideoModal(); } catch (_) {}
          }, 1000);
          stream.getTracks().forEach(t => t.stop());
        };

        recorder.start();
        if (msg) msg.textContent = '🔴 Recording... (5s)';
        setTimeout(() => recorder.stop(), 5000);
      } catch (err) {
        console.error('Recording error', err);
        if (msg) msg.textContent = `Recording failed: ${err?.message ?? err}`;
      }
    };
  }

  private extOf(name: string) {
    const m = name.match(/\.[^.]+$/);
    return m ? m[0] : '';
  }

  private createId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  async addFile(file: File) {
    const id = this.createId();
    const stored: StoredVideo = {
      id,
      filename: file.name,
      format: this.extOf(file.name),
      createdAt: Date.now(),
      source: 'upload',
      blob: file,
      likes: 0
    };
    await this.idb.put(stored);
    await this.renderFromDB();
  }

  async addBlob(blob: Blob, filename: string, source: 'upload' | 'record') {
    const id = this.createId();
    const stored: StoredVideo = {
      id,
      filename,
      format: this.extOf(filename) || (blob.type || 'video/webm'),
      createdAt: Date.now(),
      source,
      blob,
      likes: 0
    };
    await this.idb.put(stored);
    await this.renderFromDB();
  }

  private ensureFeedRoot(): HTMLElement {
    if (this.feedRoot) return this.feedRoot;

    const pageHome = document.getElementById('page-home');
    if (!pageHome) throw new Error('Home page container not found');

    const hero = pageHome.querySelector('.home-hero');
    const container = document.createElement('div');
    container.id = 'spliceVideoFeed';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '18px';
    container.style.marginTop = '12px';
    container.style.maxWidth = '900px';

    if (hero && hero.parentElement) {
      hero.parentElement.insertBefore(container, hero.nextSibling);
    } else {
      pageHome.appendChild(container);
    }

    this.feedRoot = container;
    return container;
  }

  private getLocalLikes(): Record<string, true> {
    try {
      const raw = localStorage.getItem(this.localLikesKey);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, true>;
    } catch {
      return {};
    }
  }

  private setLocalLikes(map: Record<string, true>) {
    try {
      localStorage.setItem(this.localLikesKey, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  private isLikedByLocal(id: string): boolean {
    const map = this.getLocalLikes();
    return !!map[id];
  }

  private async toggleLike(id: string) {
    // read all, find video, update likes and local map
    const videos = await this.idb.getAll();
    const video = videos.find(v => v.id === id);
    if (!video) return;

    const local = this.getLocalLikes();
    const liked = !!local[id];

    if (liked) {
      // unlike
      local[id] = undefined as any;
      delete local[id];
      video.likes = Math.max(0, (video.likes || 0) - 1);
    } else {
      // like
      local[id] = true;
      video.likes = (video.likes || 0) + 1;
    }

    // persist changes
    this.setLocalLikes(local);
    await this.idb.put(video);
    await this.renderFromDB();
  }

  private async renderFromDB() {
    const videos = await this.idb.getAll();
    // sort newest first
    videos.sort((a, b) => b.createdAt - a.createdAt);
    const container = this.ensureFeedRoot();
    container.innerHTML = '';

    // Hide the default hero "NO VIDEOS POSTED RN" if we have videos
    const hero = document.querySelector('#page-home .home-hero');
    if (hero) hero.style.display = videos.length ? 'none' : '';

    if (videos.length === 0) {
      return;
    }

    for (const v of videos) {
      const card = document.createElement('div');
      card.style.background = 'var(--bg-panel)';
      card.style.border = '1px solid var(--card-border)';
      card.style.borderRadius = '12px';
      card.style.padding = '12px';
      card.style.display = 'flex';
      card.style.gap = '12px';
      card.style.alignItems = 'flex-start';

      const left = document.createElement('div');
      left.style.width = '320px';
      left.style.maxWidth = '40%';
      left.style.flex = '1 1 320px';

      const right = document.createElement('div');
      right.style.flex = '1 1 320px';
      right.style.display = 'flex';
      right.style.flexDirection = 'column';
      right.style.gap = '8px';

      let url = '';
      if (v.blob) {
        url = URL.createObjectURL(v.blob);
      }

      const videoEl = document.createElement('video');
      videoEl.controls = true;
      videoEl.style.width = '100%';
      if (url) videoEl.src = url;

      left.appendChild(videoEl);

      const title = document.createElement('div');
      title.textContent = v.filename;
      title.style.fontWeight = '700';
      title.style.color = 'var(--ink)';
      title.style.fontSize = '15px';

      const meta = document.createElement('div');
      meta.textContent = `${new Date(v.createdAt).toLocaleString()} · ${v.source === 'record' ? 'Recorded' : 'Uploaded'}`;
      meta.style.color = 'var(--ink-dim)';
      meta.style.fontSize = '13px';

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.marginTop = '8px';
      actions.style.alignItems = 'center';

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn';
      downloadBtn.textContent = 'Download';
      downloadBtn.onclick = () => {
        if (!v.blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(v.blob);
        a.download = v.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = async () => {
        await this.idb.delete(v.id);
        if (videoEl.src) URL.revokeObjectURL(videoEl.src);
        // remove local like if present
        const local = this.getLocalLikes();
        if (local[v.id]) {
          delete local[v.id];
          this.setLocalLikes(local);
        }
        await this.renderFromDB();
      };

      // Like button
      const likeBtn = document.createElement('button');
      likeBtn.className = 'btn';
      const liked = this.isLikedByLocal(v.id);
      likeBtn.innerHTML = `${liked ? '♥' : '♡'} <span style="margin-left:6px;">${v.likes || 0}</span>`;
      likeBtn.style.display = 'inline-flex';
      likeBtn.style.alignItems = 'center';
      likeBtn.onclick = async () => {
        await this.toggleLike(v.id);
      };
      if (liked) likeBtn.style.color = 'var(--accent)' || '#e5484d';

      actions.appendChild(downloadBtn);
      actions.appendChild(deleteBtn);
      actions.appendChild(likeBtn);

      right.appendChild(title);
      right.appendChild(meta);
      right.appendChild(actions);

      card.appendChild(left);
      card.appendChild(right);

      container.appendChild(card);
    }
  }
}

// Initialize on DOM ready
(function () {
  const service = new VideoService();
  document.addEventListener('DOMContentLoaded', () => {
    service.init().catch(err => console.error('VideoService init failed', err));
  });
})();
