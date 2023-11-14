const {
    default: Baileys,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys')
const P = require('pino')
const { imageSync } = require('qr-image')
const { Boom } = require('@hapi/boom')
const app = require('express')()
const fs = require('fs-extra')
const { json } = require('express')
const port = 8000

const start = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('session')
    const client = Baileys({
        version: (await fetchLatestBaileysVersion()).version,
        printQRInTerminal: true,
        auth: state,
        logger: P({ level: 'fatal' }),
        browser: ['WhatsApp-Bot', 'fatal', '1.0.0']
    })

    client.ev.on('connection.update', async (update) => {
        if (update.qr) {
            console.log(`QR code generated. Scan it to continue | You can also authenicate in http://localhost:${port}`)
            client.QR = imageSync(update.qr)
        }
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const { statusCode } = new Boom(lastDisconnect?.error).output
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('Reconnecting...')
                setTimeout(() => start(), 3000)
            } else {
                console.log('Disconnected.')
                await fs.remove('session')
                console.log('Starting...')
                setTimeout(() => start(), 3000)
            }
        }
        if (connection === 'connecting') console.log('Connecting to WhatsApp...')
        if (connection === 'open')
            console.log('Connected to WhatsApp')
    })

    /**
     * @param {string} str
     * @returns {string}
     */

    const makeWaJid = str => (/\d/.test(str) ? str.replace(/\D/g, '') : 123) + '@s.whatsapp.net'

    /**
     * @param {string} phone
     * @returns {boolean}
     */

    const isWaNumber = async (phone) => (await client.onWhatsApp(phone))[0]?.exists || false

    app.get('/', (req, res) => res.status(200).contentType('image/png').send(client.QR))

    app.get('/send', async (req, res) => {
        const { phone, text } = req.method === 'GET' ? req.query : req.body
        if (!phone || !text) return void res.sendStatus(404)
        const jid = makeWaJid(phone)
        const valid = await isWaNumber(jid)
        if (!valid) return void res.status(404).json({ error: 'Number not available on WhatsApp' })
        await client.sendMessage(jid, { text })
        return void res.status(200).setHeader('Content-Type', 'text/plain').send(' Successfully, Send message on WhatsApp!')
    });

    app.get('/say', async (req, res) => {
        const { phone, text } = req.method === 'GET' ? req.query : req.body
        if (!phone) return void res.sendStatus(404)
        const jid = makeWaJid(phone)
        const valid = await isWaNumber(jid)
        if (!valid) return void res.status(404).json({ error: 'Number not available on WhatsApp' })
        {
            var status = "N/A";
            try {
                status = await client.fetchStatus(jid);
            } catch (_) {
                status = "N/A"
            }


            var ppUrl = "N/A";
            try {
                ppUrl = await client.profilePictureUrl(jid, "image");
            } catch (_) {
                ppUrl = "N/A"
            }
            var profile = "N/A"
            try {
                profile = await client.getBusinessProfile(jid);
            } catch (_) {
                profile = "N/A"
            }
            return void res.status(200).json(
                {
                    available: true,
                    status: status,
                    profilepic: ppUrl,
                    businessProfile: profile
                });
        }
    })

    client.ev.on('creds.update', saveCreds)
    return client
}

start()
app.listen(port, () => console.log(`Server started on PORT : ${port}`))