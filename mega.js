import { Storage } from 'megajs'

const auth = {
  email: 'rubangomoses000@gmail.com',
  password: 'rubangomoses123',
  userAgent: 'THE-PAIN-MD'
}

// 🔥 Connexion UNIQUE (pas à chaque requête)
let storage

async function getStorage() {
  if (!storage) {
    storage = await new Storage(auth).ready
    console.log("☠️ MEGA CONNECTED")
  }
  return storage
}

export const upload = async (data, name) => {
  try {

    if (!auth.email || !auth.password) {
      throw new Error("MEGA CONFIG MISSING")
    }

    if (typeof data === 'string') {
      data = Buffer.from(data)
    }

    const mega = await getStorage()

    const file = await mega.upload(
      { name, allowUploadBuffering: true },
      data
    ).complete

    const url = await file.link()

    return url

  } catch (err) {
    console.error("MEGA UPLOAD ERROR:", err)
    return null
  }
}