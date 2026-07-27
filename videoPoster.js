// Compiled JS for videoPoster.ts (includes Like button)
// Paste into console or save and load as a script. No HTML edits required.

(function () {
    var IDBStore = /** @class */ (function () {
        function IDBStore() {
            this.dbName = 'splice_videos_db';
            this.storeName = 'videos';
            this.dbPromise = this.open();
        }
        IDBStore.prototype.open = function () {
            var _this = this;
            return new Promise(function (resolve, reject) {
                var req = indexedDB.open(_this.dbName, 1);
                req.onupgradeneeded = function () {
                    var db = req.result;
                    if (!db.objectStoreNames.contains(_this.storeName)) {
                        db.createObjectStore(_this.storeName, { keyPath: 'id' });
                    }
                };
                req.onsuccess = function () { return resolve(req.result); };
                req.onerror = function () { return reject(req.error); };
            });
        };
        IDBStore.prototype.put = function (video) {
            return __awaiter(this, void 0, void 0, function () {
                var db;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.dbPromise];
                        case 1:
                            db = _a.sent();
                            return [2 /*return*/, new Promise(function (resolve, reject) {
                                    var tx = db.transaction(_this.storeName, 'readwrite');
                                    tx.objectStore(_this.storeName).put(video);
                                    tx.oncomplete = function () { return resolve(); };
                                    tx.onerror = function () { return reject(tx.error); };
                                })];
                    }
                });
            });
        };
        IDBStore.prototype.getAll = function () {
            return __awaiter(this, void 0, void 0, function () {
                var db;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.dbPromise];
                        case 1:
                            db = _a.sent();
                            return [2 /*return*/, new Promise(function (resolve, reject) {
                                    var tx = db.transaction(_this.storeName, 'readonly');
                                    var req = tx.objectStore(_this.storeName).getAll();
                                    req.onsuccess = function () { return resolve(req.result); };
                                    req.onerror = function () { return reject(req.error); };
                                })];
                    }
                });
            });
        };
        IDBStore.prototype.delete = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var db;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.dbPromise];
                        case 1:
                            db = _a.sent();
                            return [2 /*return*/, new Promise(function (resolve, reject) {
                                    var tx = db.transaction(_this.storeName, 'readwrite');
                                    tx.objectStore(_this.storeName).delete(id);
                                    tx.oncomplete = function () { return resolve(); };
                                    tx.onerror = function () { return reject(tx.error); };
                                })];
                    }
                });
            });
        };
        return IDBStore;
    }());
    // TS helpers
    var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var __generator = (this && this.__generator) || function (thisArg, body) {
        var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y.return) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [0, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };
    var VideoService = /** @class */ (function () {
        function VideoService() {
            this.idb = new IDBStore();
            this.feedRoot = null;
            this.localLikesKey = 'splice_likes';
        }
        VideoService.prototype.init = function () {
            return __awaiter(this, void 0, void 0, function () {
                this.setupDomHooks();
                // render existing
                this.renderFromDB().catch(function (err) { return console.error('VideoService init render failed', err); });
                return [2 /*return*/];
            });
        };
        VideoService.prototype.setupDomHooks = function () {
            var _this = this;
            (window).handleFileSelected = function (input) {
                if (!input || !input.files || input.files.length === 0)
                    return;
                var file = input.files[0];
                _this.addFile(file).then(function () {
                    var msg = document.getElementById('modalStatusMsg');
                    if (msg)
                        msg.textContent = "\uD83C\uDFAC Uploaded \"" + file.name + "\" (" + _this.extOf(file.name) + ") successfully!";
                    setTimeout(function () {
                        try {
                            window.closeVideoModal();
                        }
                        catch (_) { }
                        input.value = '';
                    }, 1200);
                }).catch(function (err) {
                    console.error('Failed to add file', err);
                    var msg = document.getElementById('modalStatusMsg');
                    if (msg)
                        msg.textContent = "Upload failed: " + (err === null || err === void 0 ? void 0 : err.message) + err;
                });
            };
            (window).triggerRecordMode = function () { return __awaiter(_this, void 0, void 0, function () {
                var msg, stream, recorder, chunks;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            msg = document.getElementById('modalStatusMsg');
                            if (msg)
                                msg.textContent = '🔴 Initializing camera recording stream...';
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 5, , 6]);
                            return [4 /*yield*/, navigator.mediaDevices.getUserMedia({ audio: true, video: true })];
                        case 2:
                            stream = _a.sent();
                            recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
                            chunks = [];
                            recorder.ondataavailable = function (e) { if (e.data && e.data.size)
                                chunks.push(e.data); };
                            recorder.onstop = function () { return __awaiter(_this, void 0, void 0, function () {
                                var blob, filename;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            blob = new Blob(chunks, { type: 'video/webm' });
                                            filename = "recorded-" + Date.now() + ".webm";
                                            return [4 /*yield*/, this.addBlob(blob, filename, 'record')];
                                        case 1:
                                            _a.sent();
                                            if (msg)
                                                msg.textContent = "\uD83D\uDD34 Recorded live clip saved as " + filename + "!";
                                            setTimeout(function () {
                                                try {
                                                    window.closeVideoModal();
                                                }
                                                catch (_) { }
                                            }, 1000);
                                            stream.getTracks().forEach(function (t) { return t.stop(); });
                                            return [2 /*return*/];
                                    }
                                });
                            }); };
                            recorder.start();
                            if (msg)
                                msg.textContent = '🔴 Recording... (5s)';
                            setTimeout(function () { return recorder.stop(); }, 5000);
                            return [3 /*break*/, 6];
                        case 5:
                            _a.sent();
                            console.error('Recording error', _a.sent());
                            if (msg)
                                msg.textContent = "Recording failed: " + (_a.sent() ? _a.sent().message : '');
                            return [3 /*break*/, 6];
                        case 6: return [2 /*return*/];
                    }
                });
            }); };
        };
        VideoService.prototype.extOf = function (name) {
            var m = name.match(/\.[^.]+$/);
            return m ? m[0] : '';
        };
        VideoService.prototype.createId = function () {
            return Date.now() + "-" + Math.random().toString(36).slice(2, 9);
        };
        VideoService.prototype.addFile = function (file) {
            return __awaiter(this, void 0, void 0, function () {
                var id, stored;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            id = this.createId();
                            stored = {
                                id: id,
                                filename: file.name,
                                format: this.extOf(file.name),
                                createdAt: Date.now(),
                                source: 'upload',
                                blob: file,
                                likes: 0
                            };
                            return [4 /*yield*/, this.idb.put(stored)];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.renderFromDB()];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        VideoService.prototype.addBlob = function (blob, filename, source) {
            return __awaiter(this, void 0, void 0, function () {
                var id, stored;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            id = this.createId();
                            stored = {
                                id: id,
                                filename: filename,
                                format: this.extOf(filename) || (blob.type || 'video/webm'),
                                createdAt: Date.now(),
                                source: source,
                                blob: blob,
                                likes: 0
                            };
                            return [4 /*yield*/, this.idb.put(stored)];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.renderFromDB()];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        VideoService.prototype.ensureFeedRoot = function () {
            if (this.feedRoot)
                return this.feedRoot;
            var pageHome = document.getElementById('page-home');
            if (!pageHome)
                throw new Error('Home page container not found');
            var hero = pageHome.querySelector('.home-hero');
            var container = document.createElement('div');
            container.id = 'spliceVideoFeed';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '18px';
            container.style.marginTop = '12px';
            container.style.maxWidth = '900px';
            if (hero && hero.parentElement) {
                hero.parentElement.insertBefore(container, hero.nextSibling);
            }
            else {
                pageHome.appendChild(container);
            }
            this.feedRoot = container;
            return container;
        };
        VideoService.prototype.getLocalLikes = function () {
            try {
                var raw = localStorage.getItem(this.localLikesKey);
                if (!raw)
                    return {};
                return JSON.parse(raw);
            }
            catch (_a) {
                return {};
            }
        };
        VideoService.prototype.setLocalLikes = function (map) {
            try {
                localStorage.setItem(this.localLikesKey, JSON.stringify(map));
            }
            catch (_a) {
                // ignore
            }
        };
        VideoService.prototype.isLikedByLocal = function (id) {
            var map = this.getLocalLikes();
            return !!map[id];
        };
        VideoService.prototype.toggleLike = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var videos, video, local, liked;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.idb.getAll()];
                        case 1:
                            videos = _a.sent();
                            video = videos.find(function (v) { return v.id === id; });
                            if (!video)
                                return [2 /*return*/];
                            local = this.getLocalLikes();
                            liked = !!local[id];
                            if (liked) {
                                local[id] = undefined;
                                delete local[id];
                                video.likes = Math.max(0, (video.likes || 0) - 1);
                            }
                            else {
                                local[id] = true;
                                video.likes = (video.likes || 0) + 1;
                            }
                            this.setLocalLikes(local);
                            return [4 /*yield*/, this.idb.put(video)];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.renderFromDB()];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        VideoService.prototype.renderFromDB = function () {
            return __awaiter(this, void 0, void 0, function () {
                var videos, container, hero, _i, videos_1, v, card, left, right, url, videoEl, title, meta, actions, downloadBtn, deleteBtn, likeBtn, liked;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.idb.getAll()];
                        case 1:
                            videos = _a.sent();
                            videos.sort(function (a, b) { return b.createdAt - a.createdAt; });
                            container = this.ensureFeedRoot();
                            container.innerHTML = '';
                            hero = document.querySelector('#page-home .home-hero');
                            if (hero)
                                hero.style.display = videos.length ? 'none' : '';
                            if (videos.length === 0) {
                                return [2 /*return*/];
                            }
                            _i = 0, videos_1 = videos;
                            _a.label = 2;
                        case 2:
                            if (!(_i < videos_1.length)) return [3 /*break*/, 5];
                            v = videos_1[_i];
                            card = document.createElement('div');
                            card.style.background = 'var(--bg-panel)';
                            card.style.border = '1px solid var(--card-border)';
                            card.style.borderRadius = '12px';
                            card.style.padding = '12px';
                            card.style.display = 'flex';
                            card.style.gap = '12px';
                            card.style.alignItems = 'flex-start';
                            left = document.createElement('div');
                            left.style.width = '320px';
                            left.style.maxWidth = '40%';
                            left.style.flex = '1 1 320px';
                            right = document.createElement('div');
                            right.style.flex = '1 1 320px';
                            right.style.display = 'flex';
                            right.style.flexDirection = 'column';
                            right.style.gap = '8px';
                            url = '';
                            if (v.blob) {
                                url = URL.createObjectURL(v.blob);
                            }
                            videoEl = document.createElement('video');
                            videoEl.controls = true;
                            videoEl.style.width = '100%';
                            if (url)
                                videoEl.src = url;
                            left.appendChild(videoEl);
                            title = document.createElement('div');
                            title.textContent = v.filename;
                            title.style.fontWeight = '700';
                            title.style.color = 'var(--ink)';
                            title.style.fontSize = '15px';
                            meta = document.createElement('div');
                            meta.textContent = new Date(v.createdAt).toLocaleString() + " \u00B7 " + (v.source === 'record' ? 'Recorded' : 'Uploaded');
                            meta.style.color = 'var(--ink-dim)';
                            meta.style.fontSize = '13px';
                            actions = document.createElement('div');
                            actions.style.display = 'flex';
                            actions.style.gap = '8px';
                            actions.style.marginTop = '8px';
                            actions.style.alignItems = 'center';
                            downloadBtn = document.createElement('button');
                            downloadBtn.className = 'btn';
                            downloadBtn.textContent = 'Download';
                            downloadBtn.onclick = function () {
                                if (!v.blob)
                                    return;
                                var a = document.createElement('a');
                                a.href = URL.createObjectURL(v.blob);
                                a.download = v.filename;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                            };
                            deleteBtn = document.createElement('button');
                            deleteBtn.className = 'btn';
                            deleteBtn.textContent = 'Delete';
                            deleteBtn.onclick = function () { return __awaiter(_this, void 0, void 0, function () {
                                var local;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.idb.delete(v.id)];
                                        case 1:
                                            _a.sent();
                                            if (videoEl.src)
                                                URL.revokeObjectURL(videoEl.src);
                                            local = this.getLocalLikes();
                                            if (local[v.id]) {
                                                delete local[v.id];
                                                this.setLocalLikes(local);
                                            }
                                            return [4 /*yield*/, this.renderFromDB()];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); };
                            likeBtn = document.createElement('button');
                            likeBtn.className = 'btn';
                            liked = this.isLikedByLocal(v.id);
                            likeBtn.innerHTML = (liked ? '♥' : '♡') + " <span style=\"margin-left:6px;\">" + (v.likes || 0) + "</span>";
                            likeBtn.style.display = 'inline-flex';
                            likeBtn.style.alignItems = 'center';
                            likeBtn.onclick = function () {
                                return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.toggleLike(v.id)];
                                            case 1:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                });
                            };
                            if (liked)
                                likeBtn.style.color = 'var(--accent)' || '#e5484d';
                            actions.appendChild(downloadBtn);
                            actions.appendChild(deleteBtn);
                            actions.appendChild(likeBtn);
                            right.appendChild(title);
                            right.appendChild(meta);
                            right.appendChild(actions);
                            card.appendChild(left);
                            card.appendChild(right);
                            container.appendChild(card);
                            _a.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 2];
                        case 4: return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        return VideoService;
    }());
    (function () {
        var service = new VideoService();
        document.addEventListener('DOMContentLoaded', function () {
            service.init().catch(function (err) { return console.error('VideoService init failed', err); });
        });
    })();
})();
