const TelegramBot = require('node-telegram-bot-api');
const { getJaneDoeResponse } = require('../gemini');
const { logError } = require('../utils/logger');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

// Helper function untuk delay buatan (Typing Rhythm)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            const body = req.body;
            
            if (body && body.message && body.message.text) {
                const msg = body.message;
                const chatId = msg.chat.id;
                const text = msg.text;

                if (text === '/start') {
                    await bot.sendMessage(chatId, "hmm? siapa kamu? panggil aku jane doe aja. mau ngobrol apa hari ini, sayang?");
                } else {
                    console.log(`[Chat] ${msg.from.first_name}: ${text}`);
                    
                    bot.sendChatAction(chatId, 'typing').catch(console.error);

                    const reply = await getJaneDoeResponse(chatId.toString(), text);
                    
                    // Memisahkan teks berdasarkan simbol pipa (|)
                    const messages = reply.split('|').map(m => m.trim()).filter(m => m.length > 0);
                    
                    // Loop untuk mengirim setiap pesan secara terpisah dengan jeda
                    for (let i = 0; i < messages.length; i++) {
                        // Berikan jeda dan efek typing untuk pesan kedua dan seterusnya
                        if (i > 0) {
                            bot.sendChatAction(chatId, 'typing').catch(console.error);
                            await sleep(1500); // Jeda 1.5 detik (Aman untuk Vercel timeout 10s)
                        }
                        await bot.sendMessage(chatId, messages[i]);
                    }
                }
            }
            return res.status(200).send('OK');
        } else {
            return res.status(200).send('Jane Doe Webhook is active!');
        }
    } catch (error) {
        await logError('Webhook', 'General Error', error);
        return res.status(200).send('OK');
    }
};
