import express from 'express';
import fs from 'fs-extra';
import pino from 'pino';
import QRCode from 'qrcode';
import { exec } from 'child_process';
import {
    makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    fetchLatestBaileysVersion,
    delay
} from '@whiskeysockets/baileys';

const router = express.Router();

const MESSAGE = `
╭━━━━━━━━━━━━━━━☠️━━━━━━━━━━━━━━━╮
┃        𝐓𝐇𝐄 𝐏𝐀𝐈𝐍-MD
┃        ❖ RITUEL ACCOMPLI ❖
┃
┃ 🩸 SESSION LIÉE AU SYSTÈME
┃ ⚠️ NE LA PARTAGE JAMAIS
┃
┃ 📢 CHANNEL OFFICIEL :
┃ https://whatsapp.com/channel/0029Vb7FTvDICVfgeK27ul2S
┃
┃ ☠️ POWERED BY THE PAIN ☠️
╰━━━━━━━━━━━━━━━☠️━━━━━━━━━━━━━━━╯
`;

async function removeFile(filePath) {
    if (fs.existsSync(filePath)) await fs.remove(filePath);
}

router.get('/', async (req, res) => {
    const sessionId = Date.now().toString();
    const dirs = `./qr_sessions/session_${sessionId}`;

    if (!fs.existsSync('./qr_sessions')) {
        await fs.mkdir('./qr_sessions', { recursive: true });
    }

    async function initiateSession() {
        if (!fs.existsSync(dirs)) await fs.mkdir(dirs, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();

            let sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                browser: Browsers.windows('Chrome'),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                markOnlineOnConnect: false
            });

            sock.ev.on('connection.update', async ({ connection, qr }) => {

                if (qr) {
                    const qrDataURL = await QRCode.toDataURL(qr);
                    res.send({ qr: qrDataURL });
                }

                if (connection === 'open') {
                    const credsFile = dirs + '/creds.json';

                    if (fs.existsSync(credsFile)) {
                        const credsData = fs.readFileSync(credsFile, 'utf-8');
                        const base64Session = Buffer.from(credsData).toString('base64');

                        const session = `pain==${base64Session}`;

                        const userJid = jidNormalizedUser(sock.authState.creds.me.id);

                        const msg = await sock.sendMessage(userJid, { text: session });
                        await sock.sendMessage(userJid, { text: MESSAGE, quoted: msg });
                    }

                    await delay(4000);
                    await removeFile(dirs);
                }
            });

            sock.ev.on('creds.update', saveCreds);

        } catch (err) {
            exec('pm2 restart qasim');
            if (!res.headersSent) res.status(503).send({ error: 'Service error' });
            await removeFile(dirs);
        }
    }

    await initiateSession();
});

export default router;