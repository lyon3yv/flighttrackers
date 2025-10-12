// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'please-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// ======================== CONFIGURACIÓN DE SUBIDAS ========================
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const name = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, name);
  }
});
const upload = multer({ storage });

// ======================== MARCA DE AGUA ========================
function createTiledWatermarkSVG(width, height, text = 'FlightTrackers') {
  const fontSize = Math.round(Math.min(width, height) / 20);
  const opacity = 0.08;
  const gap = Math.round(fontSize * 5);
  let texts = '';
  for (let y = -gap; y < height + gap; y += gap) {
    for (let x = -gap; x < width + gap; x += gap) {
      const rotate = -30 + ((x + y) % 10);
      texts += `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" font-family="Poppins, Arial, sans-serif" font-size="${fontSize}" fill="rgba(255,255,255,${opacity})">${text}</text>`;
    }
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><g>${texts}</g></svg>`;
}

async function addWatermark(filePath) {
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    const svg = createTiledWatermarkSVG(metadata.width || 1200, metadata.height || 800, 'FlightTrackers');
    await image.composite([{ input: Buffer.from(svg), blend: 'over' }]).toFile(filePath + '.watermarked');
    fs.renameSync(filePath + '.watermarked', filePath);
  } catch (err) {
    console.error('Error watermarking image:', err);
  }
}

// ======================== AUTH ADMIN ========================
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

// ======================== RUTAS BASE ========================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/galeria', (req, res) => res.sendFile(path.join(__dirname, 'gallery.html')));

// ======================== FORMULARIO JOIN ========================
app.post('/api/join', async (req, res) => {
  const d = req.body;
  const edad = parseInt(d.edad, 10);
  if (isNaN(edad) || edad < 11 || edad > 25)
    return res.status(400).json({ success: false, message: 'La edad debe estar entre 11 y 25 años.' });

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const html = `
        <h2>Nuevo miembro (FlightTrackers)</h2>
        <p><strong>Nombre:</strong> ${d.nombre || ''}</p>
        <p><strong>Email:</strong> ${d.email}</p>
        <p><strong>Edad:</strong> ${d.edad}</p>
        <p><strong>Teléfono:</strong> ${d.telefono || '—'}</p>
        <p><strong>Instagram:</strong> ${d.instagram || '—'}</p>
        <p><strong>Aeropuerto:</strong> ${d.aeropuerto || '—'}</p>
        <p><strong>Sobre:</strong> ${d.sobre || '—'}</p>`;
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: 'flighttrackersspotters@gmail.com',
        subject: `Nuevo miembro: ${d.nombre || d.email}`,
        html
      });
    } catch (err) {
      console.error('Error enviando correo:', err);
    }
  }
  return res.json({ success: true, message: 'Solicitud recibida. Pronto te contactaremos.' });
});

// ======================== LOGIN ADMIN ========================
app.get('/admin/login', (req, res) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Admin Login</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body{font-family:Poppins,Arial;margin:40px;background:#f2f7fb}
      form{max-width:420px;margin:0 auto;background:white;padding:24px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.08)}
      input{width:100%;padding:12px;margin:8px 0;border-radius:6px;border:1px solid #ddd}
      button{background:#004d99;color:#fff;padding:10px 16px;border:none;border-radius:6px;cursor:pointer}
    </style></head>
    <body><form method="POST" action="/admin/login"><h2>Acceso Admin</h2><input type="password" name="password" placeholder="Contraseña" required /><button type="submit">Entrar</button></form></body></html>`;
  res.send(html);
});

app.post('/admin/login', (req, res) => {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'FX7!k9qZrT#pL2sV8uYw';
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  return res.send('<p>Contraseña incorrecta. <a href="/admin/login">Intenta otra vez</a></p>');
});

// ======================== PANEL ADMIN ========================
app.get('/admin', requireAdmin, (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f));
  const listHtml = files.map(f => {
    const metaPath = path.join(UPLOAD_DIR, f + '.json');
    let meta = {};
    if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return `
      <div style="margin:10px;text-align:center;">
        <img src="/uploads/${encodeURIComponent(f)}" style="width:220px;height:140px;object-fit:cover;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,0.15)"/>
        <div style="font-size:13px;margin-top:6px;color:#333">
          ${meta.author || 'Sin autor'}<br>${f}
        </div>
        <form method="POST" action="/admin/delete/${encodeURIComponent(f)}" onsubmit="return confirm('¿Eliminar esta imagen?')">
          <button type="submit" style="margin-top:6px;background:#e53935;color:white;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;">🗑️ Eliminar</button>
        </form>
      </div>`;
  }).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Admin - FlightTrackers</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body{font-family:Poppins,Arial;margin:24px;background:#f2f7fb}
      .card{background:white;padding:18px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.06);max-width:1100px;margin:0 auto}
      input,textarea{width:100%;padding:8px;margin:6px 0;border:1px solid #ddd;border-radius:6px;font-family:Poppins}
      button{background:#004d99;color:#fff;padding:10px 16px;border:none;border-radius:8px;cursor:pointer;margin-top:8px}
      button:hover{background:#005bbb}
    </style></head>
    <body>
      <div class="card">
        <h2>Panel Admin ✈️</h2>
        <form method="POST" action="/admin/upload" enctype="multipart/form-data">
          <label>Imagen *</label>
          <input type="file" name="photo" accept="image/*" required><br>
          <label>Autor</label>
          <input type="text" name="author" placeholder="Nombre del spotter">
          <label>Cámara usada</label>
          <input type="text" name="camera" placeholder="Ej: Canon R6, Sony A7 III...">
          <label>Lugar / Aeropuerto</label>
          <input type="text" name="place" placeholder="Ej: Madrid-Barajas (LEMD)">
          <label>Descripción breve</label>
          <textarea name="description" rows="2" placeholder="Ej: A350 Emirates aterrizando pista 18R"></textarea>
          <button type="submit">Subir y publicar 🚀</button>
        </form>
        <hr><h3>📸 Imágenes publicadas</h3>
        <div style="display:flex;flex-wrap:wrap">${listHtml}</div>
      </div>
    </body></html>`;
  res.send(html);
});

// ======================== SUBIDA CON METADATOS ========================
app.post('/admin/upload', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No se subió archivo');
    const filePath = path.join(UPLOAD_DIR, req.file.filename);
    await addWatermark(filePath);

    const meta = {
      author: req.body.author || 'Desconocido',
      camera: req.body.camera || 'No especificada',
      place: req.body.place || '—',
      description: req.body.description || '',
      date: new Date().toLocaleString('es-ES')
    };
    fs.writeFileSync(filePath + '.json', JSON.stringify(meta, null, 2));

    return res.redirect('/admin');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error subiendo la imagen');
  }
});

// ======================== ELIMINAR IMAGEN ========================
app.post('/admin/delete/:filename', requireAdmin, (req, res) => {
  try {
    const fileName = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, fileName);
    const metaPath = filePath + '.json';
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    console.log(`🗑️ Imagen eliminada: ${fileName}`);
    res.redirect('/admin');
  } catch (err) {
    console.error('Error eliminando imagen:', err);
    res.status(500).send('Error al eliminar la imagen.');
  }
});

// ======================== API GALERÍA ========================
app.use('/uploads', express.static(UPLOAD_DIR));
app.get('/api/gallery', (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR)
    .filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f))
    .map(f => {
      const metaPath = path.join(UPLOAD_DIR, f + '.json');
      let meta = {};
      if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      return { url: '/uploads/' + encodeURIComponent(f), name: f, ...meta };
    });
  res.json(files);
});

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));
