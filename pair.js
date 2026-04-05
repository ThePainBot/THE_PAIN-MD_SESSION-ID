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
  try {
    let num = req.query.number

    if (!num) {
      return res.status(400).json({ code: 'NUMERO MANQUANT' })
    }

    // 🔥 Nettoyage numéro
    num = num.replace(/[^0-9]/g, '')

    const phone = pn('+' + num)

    if (!phone.isValid()) {
      return res.status(400).json({ code: 'NUMERO INVALIDE' })
    }

    num = phone.getNumber('e164').replace('+', '')

    const dir = './auth_pair'

    await removeFile(dir)

    const { state, saveCreds } = await useMultiFileAuthState(dir)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      browser: Browsers.windows('Chrome'),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
      }
    })

    sock.ev.on('creds.update', saveCreds)

    // 🔥 IMPORTANT : attendre que socket soit prêt
    await delay(2000)

    try {
      const code = await sock.requestPairingCode(num)

      if (!code) {
        return res.status(500).json({ code: 'ECHEC GENERATION' })
      }

      const formatted = code.match(/.{1,4}/g)?.join('-') || code

      return res.json({ code: formatted })

    } catch (err) {
      console.log("PAIR ERROR:", err)
      return res.status(500).json({ code: 'SYSTEM FAILURE' })
    }

  } catch (err) {
    console.log("GLOBAL ERROR:", err)
    return res.status(500).json({ code: 'SERVER ERROR' })
  }
})

export default router