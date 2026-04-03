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

async function removeFile(path) {
  if (fs.existsSync(path)) await fs.remove(path)
}

function randomMegaId() {
  return Math.random().toString(36).substring(2, 10)
}

router.get('/', async (req, res) => {
  let num = req.query.number

  if (!num) return res.status(400).json({ code: "NO NUMBER" })

  const dirs = './auth_info_baileys'
  await removeFile(dirs)

  num = num.replace(/[^0-9]/g, '')
  const phone = pn('+' + num)

  if (!phone.isValid()) {
    return res.status(400).json({ code: 'INVALID NUMBER' })
  }

  num = phone.getNumber('e164').replace('+', '')

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

  sock.ev.on('connection.update', async ({ connection }) => {
    if (connection === 'open') {
      const credsFile = `${dirs}/creds.json`
      if (!fs.existsSync(credsFile)) return

      try {
        const megaLink = await megaUpload(
          fs.readFileSync(credsFile),
          `${randomMegaId()}.json`
        )

        const match = megaLink.match(/mega\.nz\/file\/([^#]+)#(.+)/)

        if (!match) {
          console.log("❌ Mega link invalide")
          return
        }

        const sessionId = `pain~${match[1]}#${match[2]}`

        const userJid = jidNormalizedUser(num + '@s.whatsapp.net')

        await sock.sendMessage(userJid, {
          text: `SESSION:\n${sessionId}`
        })

        await delay(1000)
        await removeFile(dirs)

      } catch (e) {
        console.log(e)
        await removeFile(dirs)
      }
    }
  })

  if (!sock.authState.creds.registered) {
    await delay(1500)
    try {
      let code = await sock.requestPairingCode(num)
      code = code.match(/.{1,4}/g).join('-')
      res.json({ code })
    } catch {
      res.status(500).json({ code: "ERROR" })
    }
  }

  sock.ev.on('creds.update', saveCreds)
})

export default router