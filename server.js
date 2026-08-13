const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const AUTH_KEY = 'cumpleaños2026';

// --- Settings ---
const getSettingsPath = () => path.join(DATA_DIR, 'settings.json');

const defaultSettings = {
  title: 'Cata & Dani',
  people: [
    { id: 'cata', name: 'Cata' },
    { id: 'dani', name: 'Dani' },
  ],
};

const readSettings = () => {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
  } catch {
    return { ...defaultSettings };
  }
};

const writeSettings = (settings) => {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
};

// Ensure data directories exist
const ensureDirs = () => {
  const dirs = [DATA_DIR, path.join(DATA_DIR, 'photos')];
  const settings = readSettings();
  settings.people.forEach((p) => {
    dirs.push(path.join(DATA_DIR, 'photos', p.id));
  });
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  const wishesFile = path.join(DATA_DIR, 'wishes.json');
  if (!fs.existsSync(wishesFile)) fs.writeFileSync(wishesFile, '[]', 'utf8');
  if (!fs.existsSync(getSettingsPath())) writeSettings(defaultSettings);
};
ensureDirs();

// --- Helpers ---
const getWishesPath = () => path.join(DATA_DIR, 'wishes.json');

const readWishes = () => {
  try {
    return JSON.parse(fs.readFileSync(getWishesPath(), 'utf8'));
  } catch {
    return [];
  }
};

const writeWishes = (wishes) => {
  fs.writeFileSync(getWishesPath(), JSON.stringify(wishes, null, 2), 'utf8');
};

// --- Middleware ---
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
app.use('/photos', express.static(path.join(DATA_DIR, 'photos')));

// Auth middleware
const requireAuth = (req, res, next) => {
  const key = req.headers['x-auth-key'];
  if (key !== AUTH_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// --- Routes: Pages ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// --- Routes: Auth ---
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === AUTH_KEY) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
});

// --- Routes: Settings ---
app.get('/api/settings', (req, res) => {
  res.json(readSettings());
});

app.put('/api/settings/title', requireAuth, (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const settings = readSettings();
  settings.title = title.trim();
  writeSettings(settings);
  res.json(settings);
});

// --- Routes: People ---
app.post('/api/people', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const settings = readSettings();
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + crypto.randomBytes(3).toString('hex');
  const person = { id, name: name.trim() };
  settings.people.push(person);
  writeSettings(settings);
  // Create photo directory
  const dir = path.join(DATA_DIR, 'photos', id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  res.status(201).json(settings);
});

app.put('/api/people/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const settings = readSettings();
  const idx = settings.people.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Person not found' });
  settings.people[idx].name = name.trim();
  writeSettings(settings);
  res.json(settings);
});

app.delete('/api/people/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const settings = readSettings();
  if (settings.people.length <= 1) {
    return res.status(400).json({ error: 'Debe haber al menos una persona' });
  }
  const idx = settings.people.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Person not found' });
  settings.people.splice(idx, 1);
  writeSettings(settings);
  // Remove wishes for this person
  let wishes = readWishes();
  wishes = wishes.filter((w) => w.person !== id);
  writeWishes(wishes);
  // Remove photo directory
  const dir = path.join(DATA_DIR, 'photos', id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  res.json(settings);
});

// --- Routes: Wishes ---
app.get('/api/wishes', (req, res) => {
  const wishes = readWishes();
  const { person } = req.query;
  if (person) {
    return res.json(wishes.filter((w) => w.person === person));
  }
  res.json(wishes);
});

app.post('/api/wishes', requireAuth, (req, res) => {
  const { text, person } = req.body;
  if (!text || !person) {
    return res.status(400).json({ error: 'text and person are required' });
  }
  const wishes = readWishes();
  const wish = {
    id: crypto.randomUUID(),
    text,
    person,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  wishes.push(wish);
  writeWishes(wishes);
  res.status(201).json(wish);
});

app.put('/api/wishes/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { text, person } = req.body;
  const wishes = readWishes();
  const idx = wishes.findIndex((w) => w.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Wish not found' });
  if (text !== undefined) wishes[idx].text = text;
  if (person !== undefined) wishes[idx].person = person;
  writeWishes(wishes);
  res.json(wishes[idx]);
});

app.delete('/api/wishes/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  let wishes = readWishes();
  const idx = wishes.findIndex((w) => w.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Wish not found' });
  wishes.splice(idx, 1);
  writeWishes(wishes);
  res.json({ success: true });
});

app.patch('/api/wishes/:id/toggle', (req, res) => {
  const { id } = req.params;
  const wishes = readWishes();
  const idx = wishes.findIndex((w) => w.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Wish not found' });
  wishes[idx].completed = !wishes[idx].completed;
  writeWishes(wishes);
  res.json(wishes[idx]);
});

// --- Routes: Photos ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const settings = readSettings();
    const person = req.body.person || (settings.people[0] && settings.people[0].id) || 'default';
    const dir = path.join(DATA_DIR, 'photos', person);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp)'));
    }
  },
});

app.get('/api/photos', (req, res) => {
  const { person } = req.query;
  const settings = readSettings();
  const personIds = person ? [person] : settings.people.map((p) => p.id);
  const photos = [];
  personIds.forEach((p) => {
    const dir = path.join(DATA_DIR, 'photos', p);
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((file) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
        if (allowed.test(file)) {
          photos.push({
            filename: file,
            person: p,
            url: `/photos/${p}/${file}`,
          });
        }
      });
    }
  });
  res.json(photos);
});

app.post('/api/photos', requireAuth, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const settings = readSettings();
  const person = req.body.person || (settings.people[0] && settings.people[0].id) || 'default';
  res.status(201).json({
    filename: req.file.filename,
    person,
    url: `/photos/${person}/${req.file.filename}`,
  });
});

app.delete('/api/photos/:person/:filename', requireAuth, (req, res) => {
  const { person, filename } = req.params;
  // Sanitize to prevent path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(DATA_DIR, 'photos', person, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`Wishlist server running on http://localhost:${PORT}`);
});
