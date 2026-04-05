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
  fetchLatestBaileysVersion,
  jidNormalizedUser
} from '@whiskeysockets/baileys'
import { upload as megaUpload } from './mega.js'

const router = express.Router()

const AUTH_DIR = './auth_info_baileys'

// 🩸 MESSAGE
const MESSAGE = `
☠️ 𝐓𝐇𝐄 𝐏𝐀𝐈𝐍-MD ☠️

❄️ SESSION GÉNÉRÉE ❄️

⚠️ NE PARTAGE PAS CE CODE

📢 https://whatsapp.com/channel/0029Vb7FTvDICVfgeK27ul2S
`

// 🧹 clean
async function removeDir(dir) {
  if (fs.existsSync(dir)) await fs.remove(dir)
}

// 🎲 ID
function randomId(len = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

// 🚀 ROUTE
router.get('/', async (req, res) => {
  let num = req.query.number

  if (!num) {
    return res.status(400).json({ code: "NO NUMBER" })
  }

  await removeDir(AUTH_DIR)

  num = num.replace(/[^0-9]/g, '')
  const phone = pn('+' + num)

  if (!phone.isValid()) {
    return res.status(400).json({ code: "INVALID NUMBER" })
  }

  num = phone.getNumber('e164').replace('+', '')

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
      },
      logger: pino({ level: 'silent' }),
      browser: Browsers.windows('Chrome'),
      markOnlineOnConnect: false
    })

    sock.ev.on('creds.update', saveCreds)

    let codeSent = false
    let sessionSent = false

    // 🔗 CONNECTION
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {

      if (connection === 'open' && !sessionSent) {
        try {
          const credsFile = `${AUTH_DIR}/creds.json`
          if (!fs.existsSync(credsFile)) return

          const id = randomId()

          const megaLink = await megaUpload(
            fs.createReadStream(credsFile),
            `${id}.json`
          )

          const match = megaLink.match(/mega\.nz\/file\/([^#]+)#(.+)/)

          if (!match) throw new Error("BAD MEGA LINK")

          // ✅ FORMAT COMPATIBLE BOT
          const sessionId = `pain~${match[1]}#${match[2]}`

          const userJid = jidNormalizedUser(num + '@s.whatsapp.net')

          const m1 = await sock.sendMessage(userJid, {
            text: sessionId
          })

          await sock.sendMessage(userJid, {
            text: MESSAGE,
            quoted: m1
          })

          sessionSent = true

          await delay(2000)
          await removeDir(AUTH_DIR)

        } catch (err) {
          console.log("SESSION ERROR:", err)
          await removeDir(AUTH_DIR)
        }
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode

        if (code !== 401 && !sessionSent) {
          console.log("🔄 RECONNECT...")
        } else {
          await removeDir(AUTH_DIR)
        }
      }
    })

    // 🔥 IMPORTANT → PAS DE DELAY 6s QUI CASSE
    if (!sock.authState.creds.registered) {
      try {
        let code = await sock.requestPairingCode(num)

        code = code?.match(/.{1,4}/g)?.join('-') || code

        if (!codeSent) {
          codeSent = true
          return res.json({ code })
        }

      } catch (err) {
        console.log("PAIR ERROR:", err)
        return res.status(500).json({ code: "PAIR FAILED" })
      }
    }

  } catch (err) {
    console.log("SYSTEM ERROR:", err)
    await removeDir(AUTH_DIR)
    exec('pm2 restart qasim')

    return res.status(500).json({ code: "SYSTEM ERROR" })
  }
})

export default router