import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import qrRouter from './qr.js';
import pairRouter from './pair.js';

const app = express();

// ☠️ CORS (important pour Vercel → Render)
app.use(cors());

// 📁 Chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚙️ PORT
const PORT = process.env.PORT || 8000;

// 🔥 Fix limite events (Baileys)
import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

// 🧠 Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ================= API =================

// QR
app.use('/qr', qrRouter);

// Pair code
app.use('/code', pairRouter);

// ================= PAGES =================

// Page Pair
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// Page QR
app.get('/qrpage', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr.html'));
});

// Page principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// ================= SERVER =================

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
        ☠️ THE PAIN MD SYSTEM ☠️
╚══════════════════════════════════════╝

🩸 STATUS   : ONLINE
🩸 MODE     : DARK SYSTEM ACTIVE
🩸 PORT     : ${PORT}

🌐 BACKEND  : https://the-pain-md-session-id-zjus.onrender.com

📢 CHANNEL  :
https://whatsapp.com/channel/0029Vb7FTvDICVfgeK27ul2S

💀 OWNER    : ⏤͟͟͞𝐓𝐇𝐄 ➪ 𝐏𝐀𝐈𝐍 ᭄

========================================
`);
});

export default app;