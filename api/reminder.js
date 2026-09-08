const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            const body = req.body;
            
            // Memastikan data (payload) dari QStash sesuai format
            if (body && body.chatId && body.message) {
                console.log(`[Reminder Triggered] Mengirim pesan ke ${body.chatId}: ${body.message}`);
                
                await bot.sendMessage(body.chatId, body.message);
                return res.status(200).send('Reminder successfully sent');
            } else {
                console.error('Invalid QStash Payload:', body);
                return res.status(400).send('Invalid payload structure');
            }
        } else {
            return res.status(405).send('Method Not Allowed');
        }
    } catch (error) {
        console.error('Reminder Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};
