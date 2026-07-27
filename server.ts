import fs from 'fs';
import path from 'path';
import http from 'http';
import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';

const APP_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ROOT = path.resolve(__dirname);
const PUBLIC_DIR = path.join(ROOT, 'public'); // put your HTML/CSS/JS here
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(ROOT, 'db.json');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- Simple JSON DB ---
type VideoMeta = {
  id: string;
  originalName: string;
  filename: string;
  url: string;
  createdAt: number;
  likes: number;
};

let db: { videos: VideoMeta[] } = { videos: [] };
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf8') || '';
    db = raw ? JSON.parse(raw) : { videos: [] };
    if (!db.videos) db.videos = [];
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
} catch (err) {
  console.error('Failed reading db.json, starting with empty DB', err);
  db = { videos: [] };
}
function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Failed saving DB:', err);
  }
}

// --- Express + HTTP + Socket.IO setup ---
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve client assets (HTML+JS)
app.use('/', express.static(PUBLIC_DIR));

// Serve uploaded videos
app.use('/videos', express.static(UPLOAD_DIR));

// Multer storage config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // up to 2GB

// Helpers
function makeVideoMeta(file: Express.Multer.File, req: Request): VideoMeta {
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
function broadcastNewVideo(video: VideoMeta) {
  io.emit('new-video', video);
}
function broadcastLikeUpdate(id: string, likes: number) {
  io.emit('update-like', { id, likes });
}

// --- API endpoints ---

// List videos
app.get('/api/videos', (_req: Request, res: Response) => {
  const videos = db.videos.slice().sort((a, b) => b.createdAt - a.createdAt);
  res.json({ ok: true, videos });
});

// Upload a video (multipart/form-data, field name "video")
app.post('/api/upload', upload.single('video'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    const meta = makeVideoMeta(req.file, req);
    db.videos.push(meta);
    saveDb();
    broadcastNewVideo(meta);
    res.json({ ok: true, video: meta });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// Like/unlike a video
// body: { action: "like" | "unlike" }
app.post('/api/like/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const action = req.body?.action || req.query?.action;
  if (!id || !action) return res.status(400).json({ ok: false, error: 'Missing id or action' });

  const video = db.videos.find(v => v.id === id);
  if (!video) return res.status(404).json({ ok: false, error: 'Video not found' });

  if (action === 'like') video.likes = (video.likes || 0) + 1;
  else if (action === 'unlike') video.likes = Math.max(0, (video.likes || 0) - 1);
  else return res.status(400).json({ ok: false, error: 'Invalid action' });

  saveDb();
  broadcastLikeUpdate(video.id, video.likes);
  res.json({ ok: true, id: video.id, likes: video.likes });
});

// Delete video (removes metadata and file)
app.delete('/api/video/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const idx = db.videos.findIndex(v => v.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Video not found' });

  const removed = db.videos.splice(idx, 1)[0];
  saveDb();
  // delete file
  const filePath = path.join(UPLOAD_DIR, removed.filename);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') console.warn('Failed to delete file:', err);
  });
  io.emit('remove-video', { id: removed.id });
  res.json({ ok: true });
});

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);
  socket.on('disconnect', () => console.log('socket disconnected:', socket.id));
});

// --- Start ---
server.listen(APP_PORT, () => {
  console.log(`Server listening: http://localhost:${APP_PORT}`);
  console.log(`Public dir: ${PUBLIC_DIR}`);
  console.log(`Uploads dir: ${UPLOAD_DIR}`);
});
