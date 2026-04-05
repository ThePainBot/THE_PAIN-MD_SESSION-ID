import express from 'express'
import fs from 'fs-extra'
import pino from 'pino'
import pn from 'awesome-phonenumber'
import {
  makeWASocket,
  useMultiFileAuthState,
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

  if (!num) return res.status(400).send({ code: "NO NUMBER" })

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
      logger: pino({ level: 'silent' }),
      browser: Browsers.windows('Chrome'),
      markOnlineOnConnect: false
    })

    // 🔥 ATTENDRE que la connexion soit prête
    let sent = false

    sock.ev.on('connection.update', async ({ connection }) => {

      if (connection === 'connecting') {
        console.log("🔄 Connecting...")
      }

      if (connection === 'open' || connection === 'connecting') {
        if (sent) return

        try {
          // 🔥 attendre un peu que WA soit ready
          await new Promise(r => setTimeout(r, 4000))

          let code = await sock.requestPairingCode(num)

          code = code?.match(/.{1,4}/g)?.join('-') || code

          sent = true

          if (!res.headersSent) {
            res.send({ code })
          }

        } catch (err) {
          console.log("PAIR ERROR:", err)
          if (!res.headersSent) {
            res.status(500).send({ code: "PAIR FAILED" })
          }
        }
      }
    })

    sock.ev.on('creds.update', saveCreds)

  } catch (err) {
    console.log(err)
    if (!res.headersSent) {
      res.status(500).send({ code: "SYSTEM ERROR" })
    }
  }
})

export default router