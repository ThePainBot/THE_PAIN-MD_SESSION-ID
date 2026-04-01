import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import qrRouter from './qr.js';
import pairRouter from './pair.js';

const app = express();

// 🔥 Autoriser Vercel à appeler le backend
app.use(cors());

// 📁 Gestion des chemins
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚙️ PORT
const PORT = process.env.PORT || 8000;

// 🔥 Fix limite events (important Baileys)
import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

// 🧠 Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// 🚀 ROUTES API
app.use('/qr', qrRouter);
app.use('/code', pairRouter);

// 🌐 PAGES FRONT
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/qrpage', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// 🚀 START SERVER
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════╗
   ☠️  THE PAIN MD BACKEND ☠️
╚════════════════════════════╝

❖ Server running on port ${PORT}
❖ Status : ONLINE
❖ Mode : DARK SYSTEM ACTIVE
`);
});

export default app;