// Client integration for the Splice page to use the server back-end.
// Place this file in public/ and include <script src="/videoClient.js"></script> on your page,
// or paste into the console to run dynamically. The script hooks into existing handlers
// (handleFileSelected, triggerRecordMode) and populates a feed under page-home.

(function () {
  // Dynamically load socket.io client script (served at /socket.io/socket.io.js)
  function loadSocketIoClient(cb) {
    if (window.io) return cb();
    const s = document.createElement('script');
    s.src = '/socket.io/socket.io.js';
    s.onload = cb;
    s.onerror = () => {
      console.warn('Could not load socket.io client from /socket.io/socket.io.js');
      cb();
    };
    document.head.appendChild(s);
  }

  // --- DOM helpers & feed management ---
  function ensureFeedRoot() {
    let container = document.getElementById('spliceVideoFeed');
    if (container) return container;

    const pageHome = document.getElementById('page-home');
    if (!pageHome) throw new Error('Home page container not found');

    const hero = pageHome.querySelector('.home-hero');
    container = document.createElement('div');
    container.id = 'spliceVideoFeed';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '18px';
    container.style.marginTop = '12px';
    container.style.maxWidth = '900px';

    if (hero && hero.parentElement) hero.parentElement.insertBefore(container, hero.nextSibling);
    else pageHome.appendChild(container);

    return container;
  }

  function createVideoCard(metadata) {
    const { id, originalName, url, createdAt, likes } = metadata;
    const card = document.createElement('div');
    card.dataset.id = id;
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

    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.style.width = '100%';
    videoEl.src = url;

    left.appendChild(videoEl);

    const title = document.createElement('div');
    title.textContent = originalName;
    title.style.fontWeight = '700';
    title.style.color = 'var(--ink)';
    title.style.fontSize = '15px';

    const meta = document.createElement('div');
    meta.textContent = new Date(createdAt).toLocaleString();
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
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = async () => {
      try {
        const r = await fetch(`/api/video/${id}`, { method: 'DELETE' });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'delete failed');
        // remove node
        card.remove();
      } catch (err) {
        console.error('Delete failed', err);
        alert('Delete failed: ' + (err.message || err));
      }
    };

    // Like button and simple local toggling to prevent double likes by same browser client.
    const likeBtn = document.createElement('button');
    likeBtn.className = 'btn';
    function getLocalLikedMap() {
      try {
        return JSON.parse(localStorage.getItem('splice_likes') || '{}');
      } catch { return {}; }
    }
    function setLocalLikedMap(m) {
      try { localStorage.setItem('splice_likes', JSON.stringify(m)); } catch {}
    }
    function isLiked() { return !!getLocalLikedMap()[id]; }
    function refreshLikeBtn(count) {
      likeBtn.innerHTML = (isLiked() ? '♥' : '♡') + ` <span style="margin-left:6px;">${count}</span>`;
      likeBtn.style.color = isLiked() ? 'var(--accent)' : '';
    }
    likeBtn.onclick = async () => {
      try {
        const liked = isLiked();
        const action = liked ? 'unlike' : 'like';
        const r = await fetch(`/api/like/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'like toggle failed');
        // update local map
        const map = getLocalLikedMap();
        if (action === 'like') map[id] = true; else delete map[id];
        setLocalLikedMap(map);
        refreshLikeBtn(j.likes);
      } catch (err) {
        console.error('Like toggle failed', err);
      }
    };

    // init like button state
    refreshLikeBtn(likes || 0);

    actions.appendChild(downloadBtn);
    actions.appendChild(deleteBtn);
    actions.appendChild(likeBtn);

    right.appendChild(title);
    right.appendChild(meta);
    right.appendChild(actions);

    card.appendChild(left);
    card.appendChild(right);

    return card;
  }

  async function loadInitialFeed() {
    try {
      const res = await fetch('/api/videos');
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load videos');
      const videos = j.videos || [];
      const container = ensureFeedRoot();
      // hide default hero when we have any
      const hero = document.querySelector('#page-home .home-hero');
      if (hero) hero.style.display = videos.length ? 'none' : '';
      container.innerHTML = '';
      videos.forEach(v => {
        const card = createVideoCard(v);
        container.appendChild(card);
      });
    } catch (err) {
      console.error('Failed loading feed', err);
    }
  }

  function prependVideoToFeed(videoMeta) {
    const container = ensureFeedRoot();
    const hero = document.querySelector('#page-home .home-hero');
    if (hero) hero.style.display = 'none';
    const card = createVideoCard(videoMeta);
    container.insertBefore(card, container.firstChild);
  }

  function updateLikeCountOnFeed(id, likes) {
    const card = document.querySelector(`#spliceVideoFeed [data-id="${id}"]`);
    if (!card) return;
    const likeBtn = card.querySelector('button.btn:nth-last-child(1)') || card.querySelector('button.btn:last-child');
    if (!likeBtn) return;
    // update number in innerText (it's like "♡  3" or "♥  4")
    likeBtn.innerHTML = (likeBtn.textContent.trim().startsWith('♥') ? '♥' : '♡') + ` <span style="margin-left:6px;">${likes}</span>`;
  }

  // --- Hook into existing HTML handlers (no HTML edit required) ---
  window.handleFileSelected = async function (input) {
    if (!input || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    const msg = document.getElementById('modalStatusMsg');
    try {
      const fd = new FormData();
      fd.append('video', file, file.name);
      if (msg) msg.textContent = `Uploading ${file.name}...`;
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'upload failed');
      if (msg) msg.textContent = `🎬 Uploaded "${file.name}" successfully!`;
      // close modal and clear file input (the page already has helpers)
      setTimeout(() => {
        try { window.closeVideoModal(); } catch (_) {}
        input.value = '';
      }, 900);
      // prepend to feed
      prependVideoToFeed(j.video);
    } catch (err) {
      console.error('Upload failed', err);
      if (msg) msg.textContent = 'Upload failed.';
    }
  };

  window.triggerRecordMode = async function () {
    const msg = document.getElementById('modalStatusMsg');
    if (msg) msg.textContent = '🔴 Initializing camera recording stream...';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const filename = `recorded-${Date.now()}.webm`;
        try {
          const fd = new FormData();
          fd.append('video', blob, filename);
          if (msg) msg.textContent = 'Uploading recorded clip...';
          const r = await fetch('/api/upload', { method: 'POST', body: fd });
          const j = await r.json();
          if (!j.ok) throw new Error(j.error || 'upload failed');
          if (msg) msg.textContent = `🔴 Recorded clip saved!`;
          setTimeout(() => { try { window.closeVideoModal(); } catch (_) {} }, 700);
          prependVideoToFeed(j.video);
        } catch (err) {
          console.error('Upload recorded clip failed', err);
          if (msg) msg.textContent = 'Upload failed.';
        }
        // stop tracks
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      if (msg) msg.textContent = '🔴 Recording... (5s)';
      setTimeout(() => recorder.stop(), 5000);
    } catch (err) {
      console.error('Recording error', err);
      if (msg) msg.textContent = 'Recording failed.';
    }
  };

  // --- initialize: load feed + connect to socket.io ---
  (async function init() {
    await loadInitialFeed().catch(() => {});
    loadSocketIoClient(() => {
      if (!window.io) {
        console.warn('Socket.IO client not available; realtime updates disabled');
        return;
      }
      const socket = window.io();
      socket.on('connect', () => console.log('socket connected', socket.id));
      socket.on('new-video', (video) => {
        prependVideoToFeed(video);
      });
      socket.on('update-like', ({ id, likes }) => {
        updateLikeCountOnFeed(id, likes);
      });
      socket.on('remove-video', ({ id }) => {
        const card = document.querySelector(`#spliceVideoFeed [data-id="${id}"]`);
        if (card) card.remove();
      });
    });
  })();

  // expose small helpers for manual refresh if needed
  window.spliceClient = {
    reloadFeed: loadInitialFeed
  };
})();
