import express from 'express'
import fs from 'fs-extra'
import pino from 'pino'
import QRCode from 'qrcode'
import { exec } from 'child_process'
import {
  makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
  fetchLatestBaileysVersion,
  delay
} from '@whiskeysockets/baileys'
import { upload } from './mega.js'

const router = express.Router()

async function removeFile(path) {
  if (fs.existsSync(path)) await fs.remove(path)
}

router.get('/', async (req, res) => {
  const dirs = './qr_session'

  await removeFile(dirs)

  const { state, saveCreds } = await useMultiFileAuthState(dirs)
  const { version } = await fetchLatestBaileysVersion()

  let sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    browser: Browsers.windows('Chrome'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
    },
  })

  sock.ev.on('connection.update', async ({ connection, qr }) => {

    if (qr) {
      const qrData = await QRCode.toDataURL(qr)
      res.send({ qr: qrData })
    }

    if (connection === 'open') {
      const credsFile = `${dirs}/creds.json`

      const megaUrl = await upload(
        fs.createReadStream(credsFile),
        `${Date.now()}.json`
      )

      const match = megaUrl.match(/mega\.nz\/file\/([^#]+)#(.+)/)
      const sessionId = `pain~${match[1]}#${match[2]}`

      const userJid = jidNormalizedUser(sock.authState.creds.me.id)

      await sock.sendMessage(userJid, {
        text:
`☠️ 𝐓𝐇𝐄_𝐏𝐀𝐈𝐍-MD ☠️

❄️ SESSION EXTRAITE DU NÉANT ❄️

${sessionId}

⚠️ Garde cette clé.`
      })

      await delay(1000)
      await removeFile(dirs)
    }
  })

  sock.ev.on('creds.update', saveCreds)
})

export default router