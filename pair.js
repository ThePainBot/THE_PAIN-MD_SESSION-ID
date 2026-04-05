import express from 'express'
import fs from 'fs-extra'
import pino from 'pino'
import pn from 'awesome-phonenumber'
import { exec } from 'child_process'
import {
  makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'

const router = express.Router()

async function removeFile(path) {
  if (fs.existsSync(path)) await fs.remove(path)
}

router.get('/', async (req, res) => {
  let num = req.query.number
  const dirs = './auth_info_baileys'

  await removeFile(dirs)

  num = num.replace(/[^0-9]/g, '')
  const phone = pn('+' + num)

  if (!phone.isValid()) {
    return res.status(400).send({ code: 'INVALID NUMBER' })
  }

  num = phone.getNumber('e164').replace('+', '')

  try {
    const { state, saveCreds } = await useMultiFileAuthState(dirs)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
      },
      logger: pino({ level: 'fatal' }),
      browser: Browsers.windows('Chrome'),
      markOnlineOnConnect: false
    })

    // 🔥 ATTENDRE QUE ÇA SE CONNECTE AVANT CODE
    sock.ev.on('connection.update', async ({ connection }) => {

      if (connection === 'connecting') {
        console.log("🔄 Connecting to WhatsApp...")
      }

      if (connection === 'open') {
        console.log("✅ CONNECTED SUCCESS")

        if (!sock.authState.creds.registered) {
          try {
            let code = await sock.requestPairingCode(num)

            code = code?.match(/.{1,4}/g)?.join('-') || code

            if (!res.headersSent) {
              res.send({ code })
            }

          } catch (err) {
            console.log("❌ Pairing error:", err)
            if (!res.headersSent) {
              res.status(500).send({ code: 'PAIR ERROR' })
            }
          }
        }
      }

      if (connection === 'close') {
        console.log("❌ CONNECTION CLOSED")
        await removeFile(dirs)
      }

    })

    sock.ev.on('creds.update', saveCreds)

    // ⏱ Timeout sécurité
    setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).send({ code: 'TIMEOUT' })
      }
    }, 20000)

  } catch (err) {
    console.log("❌ FATAL:", err)
    await removeFile(dirs)
    exec('pm2 restart qasim')

    if (!res.headersSent) {
      res.status(503).send({ code: 'SYSTEM ERROR' })
    }
  }
})

export default router