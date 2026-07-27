/* server.js
   Simple video-sharing server with Socket.IO real-time updates.
   Usage: npm install express multer uuid cors
          node server.js
*/
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { Server } = require('socket.io');

const APP_PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public'); // put your HTML/CSS/JS here
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(__dirname, 'db.json');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- Very small JSON "DB" ---
let db = { videos: [] };
try {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}');
    if (!db.videos) db.videos = [];
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
} catch (err) {
  console.error('Failed to read/write DB file:', err);
  db = { videos: [] };
}
function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// --- Express + HTTP + Socket.IO setup ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve client assets (place your existing HTML in /public)
app.use('/', express.static(PUBLIC_DIR));

// Serve uploaded video files at /videos/*
app.use('/videos', express.static(UPLOAD_DIR));

// Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // unique filename preserving extension
    const ext = path.extname(file.originalname) || '';
    const filename = uuidv4() + ext;
    cb(null, filename);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // up to 2GB (adjust)

// --- Helpers ---
function makeVideoMeta(file, req) {
  const id = uuidv4();
  const createdAt = Date.now();
  const url = `${req.protocol}://${req.get('host')}/videos/${file.filename}`;
  return {
    id,
    originalName: file.originalname,
    filename: file.filename,
    url,
    createdAt,
    likes: 0
  };
}

function broadcastNewVideo(video) {
  io.emit('new-video', video);
}

function broadcastLikeUpdate(id, likes) {
  io.emit('update-like', { id, likes });
}

// --- API endpoints ---

// List videos (newest first)
app.get('/api/videos', (req, res) => {
  const videos = (db.videos || []).slice().sort((a, b) => b.createdAt - a.createdAt);
  res.json({ ok: true, videos });
});

// Upload a video
// Client should POST multipart/form-data with field "video"
app.post('/api/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file' });

    const meta = makeVideoMeta(req.file, req);
    db.videos.push(meta);
    saveDb();

    // Broadcast to connected clients
    broadcastNewVideo(meta);

    res.json({ ok: true, video: meta });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// Toggle like (action: "like" | "unlike")
app.post('/api/like/:id', (req, res) => {
  const id = req.params.id;
  const action = (req.body && req.body.action) || req.query.action;
  if (!id || !action) return res.status(400).json({ ok: false, error: 'Missing id or action' });

  const video = db.videos.find(v => v.id === id);
  if (!video) return res.status(404).json({ ok: false, error: 'Video not found' });

  if (action === 'like') {
    video.likes = (video.likes || 0) + 1;
  } else if (action === 'unlike') {
    video.likes = Math.max(0, (video.likes || 0) - 1);
  } else {
    return res.status(400).json({ ok: false, error: 'Invalid action' });
  }
  saveDb();

  // broadcast updated like count
  broadcastLikeUpdate(video.id, video.likes);

  res.json({ ok: true, id: video.id, likes: video.likes });
});

// Delete video (removes file and metadata)
app.delete('/api/video/:id', (req, res) => {
  const id = req.params.id;
  const idx = db.videos.findIndex(v => v.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Video not found' });

  const removed = db.videos.splice(idx, 1)[0];
  saveDb();
  // delete file if exists
  const filePath = path.join(UPLOAD_DIR, removed.filename);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') console.warn('Failed to delete file:', err);
  });

  io.emit('remove-video', { id: removed.id });
  res.json({ ok: true });
});

// --- Socket.IO real-time connection ---
io.on('connection', (socket) => {
  // optional: log connections
  console.log('socket connected:', socket.id);
  socket.on('disconnect', () => console.log('socket disconnected:', socket.id));
});

// --- Start server ---
server.listen(APP_PORT, () => {
  console.log(`Server listening on http://localhost:${APP_PORT}`);
  console.log(`Public files served from: ${PUBLIC_DIR}`);
  console.log(`Uploaded videos served at: /videos/<filename>`);
});
