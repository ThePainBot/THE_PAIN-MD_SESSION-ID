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
  jidNormalizedUser,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import { upload as megaUpload } from './mega.js'

const router = express.Router()

const MESSAGE = `
☠️ 𝐓𝐇𝐄_𝐏𝐀𝐈𝐍-MD ☠️

❄️ SESSION EXTRAITE DU NÉANT ❄️

⚠️ Garde cette clé.
Elle ne sera jamais renvoyée.

📢 https://whatsapp.com/channel/0029Vb7FTvDICVfgeK27ul2S
`

async function removeFile(path) {
  if (fs.existsSync(path)) await fs.remove(path)
}

function randomMegaId(len = 6, numLen = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  const number = Math.floor(Math.random() * Math.pow(10, numLen))
  return `${out}${number}`
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

  async function runSession() {
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

      sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {

        if (connection === 'open') {
          const credsFile = `${dirs}/creds.json`
          if (!fs.existsSync(credsFile)) return

          try {
            const id = randomMegaId()

            const megaLink = await megaUpload(
              fs.createReadStream(credsFile),
              `${id}.json`
            )

            const match = megaLink.match(/mega\.nz\/file\/([^#]+)#(.+)/)

            const sessionId = `pain~${match[1]}#${match[2]}`

            const userJid = jidNormalizedUser(num + '@s.whatsapp.net')

            const msg = await sock.sendMessage(userJid, {
              text:
`☠️ 𝐓𝐇𝐄_𝐏𝐀𝐈𝐍-MD ☠️

❄️ SESSION EXTRAITE DU NÉANT ❄️

${sessionId}

⚠️ Garde cette clé.
Elle ne sera jamais renvoyée.`
            })

            await sock.sendMessage(userJid, {
              text: MESSAGE,
              quoted: msg
            })

            await delay(800)
            await removeFile(dirs)

          } catch (err) {
            await removeFile(dirs)
          }
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode
          if (code === 401) {
            await removeFile(dirs)
          } else {
            runSession()
          }
        }
      })

      if (!sock.authState.creds.registered) {
        await delay(1500)
        let code = await sock.requestPairingCode(num)
        code = code?.match(/.{1,4}/g)?.join('-') || code
        if (!res.headersSent) res.send({ code })
      }

      sock.ev.on('creds.update', saveCreds)

    } catch (err) {
      await removeFile(dirs)
      exec('pm2 restart qasim')
      if (!res.headersSent) res.status(503).send({ code: 'SYSTEM ERROR' })
    }
  }

  await runSession()
})

export default router