const {
    default: Baileys,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState
  } = require('@whiskeysockets/baileys')
  
  const P = require('pino')
  
  const { imageSync } = require('qr-image')
  
  const { Boom } = require('@hapi/boom')
  
  const express = require('express')
  const app = express()
  
  const fs = require('fs-extra')
  
  const port = 8000
  
  const makeWaJid = (str) => {
    if(/\d/.test(str)) {
      return str.replace(/\\D/g, '') + '@s.whatsapp.net'
    } else {
      return '123@s.whatsapp.net'
    }
  }
  
  const isWaNumber = async (phone, client) => {
    try {
      const result = await client.onWhatsApp(phone)
      return result[0]?.exists || false
    } catch(err) {
      console.error(err)
      return false
    }
  }
  
  const start = async () => {
    try {
      const { state, saveCreds } = await useMultiFileAuthState('session')
    
      const client = Baileys({
        version: (await fetchLatestBaileysVersion()).version,
        printQRInTerminal: true,
        auth: state,
        logger: P({ level: 'fatal' }),
        browser: ['WhatsApp-Bot', 'fatal', '1.0.0']
      })
    
      client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
      
        if(connection === 'connecting') {
          console.log('Connecting to WhatsApp...')
        }
      
        if(connection === 'open') {
          console.log('Connected to WhatsApp')
        }
      
        if(connection === 'close') {
          const { statusCode } = new Boom(lastDisconnect?.error).output
        
          if(statusCode !== DisconnectReason.loggedOut) {
            console.log('Reconnecting...')
            setTimeout(() => start(), 3000)
          } else {
            console.log('Logged out')
            await fs.remove('session')
            console.log('Starting...')
            setTimeout(() => start(), 3000)
          }
        }
      
        if(update.qr) {
          console.log('QR code generated. Scan it to continue')
          client.QR = imageSync(update.qr)
        }
      })
    
      app.get('/', (req, res) => {
        if(!client.QR) {
          return res.sendStatus(404)
        }
      
        res.status(200).contentType('image/png').send(client.QR)
      })
      
      app.post('/send', async (req, res) => {
        const { phone, text } = req.body
      
        if(!phone || !text) {
          return res.sendStatus(400)
        }
      
        const jid = makeWaJid(phone)
        const valid = await isWaNumber(jid,client)
      
        if(!valid) {
          return res.status(404).json({ 
            error: 'Number not available on WhatsApp'
          })
        }
      
        try {
          await client.sendMessage(jid, { text })
        
          return res.status(200).send('Message sent successfully!')
        } catch(err) {
          console.error(err)
          return res.status(500).send('Error sending message')  
        }
      })
      
      app.get('/say', async (req, res) => {
        const { phone } = req.query
      
        if(!phone ) {
          return res.sendStatus(400)
        }
      
        const jid = makeWaJid(phone)
        const valid = await isWaNumber(jid,client)
      
        if(!valid) {
          return res.status(404).json({
            error: 'Number not available on WhatsApp' 
          })
        }
      
        try {
          const status = await client.fetchStatus(jid)
          var ppUrl = "N/A";
          try {
            ppUrl = await client.profilePictureUrl(jid,"image");
        } catch (_) {
            ppUrl = "N/A"
        }
          const profile = await client.getBusinessProfile(jid)
        
          return res.status(200).json({
            available: true,
            status,
            profilepic: ppUrl || "No profile pic found",
            businessProfile: profile
          })
        } catch(err) {
          console.error(err)
          return res.status(500).send('Error fetching profile')
        }
      })
    
      client.ev.on('creds.update', saveCreds)
    
      app.listen(port, () => {
        console.log(`Server started on PORT: ${port}`)
      })
    
      return client
    } catch(err) {
      console.error('Error starting server', err)
      process.exit(1)
    }
  }
  
  start()