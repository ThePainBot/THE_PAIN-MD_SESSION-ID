import express from 'express'
import fs from 'fs-extra'
import pino from 'pino'
import pn from 'awesome-phonenumber'
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

  if (!num) {
    return res.status(400).json({ code: "NO NUMBER" })
  }

  const dirs = './auth_info_baileys'

  num = num.replace(/[^0-9]/g, '')
  const phone = pn('+' + num)

  if (!phone.isValid()) {
    return res.status(400).json({ code: 'INVALID NUMBER' })
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

    sock.ev.on('creds.update', saveCreds)

    // 🔥 IMPORTANT : plus long
    await delay(3000)

    if (!sock.authState.creds.registered) {
      try {
        let code = await sock.requestPairingCode(num)
        code = code?.match(/.{1,4}/g)?.join('-') || code

        return res.json({ code })
      } catch (err) {
        console.log(err)
        return res.status(500).json({ code: "PAIR FAILED" })
      }
    }

  } catch (err) {
    console.log(err)
    return res.status(500).json({ code: "SYSTEM ERROR" })
  }
})

export default router