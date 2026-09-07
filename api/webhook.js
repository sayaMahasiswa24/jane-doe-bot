const TelegramBot = require('node-telegram-bot-api');
const { getJaneDoeResponse } = require('../gemini');
require('dotenv').config(); // Untuk local testing, di Vercel ini akan diabaikan secara otomatis

const token = process.env.TELEGRAM_BOT_TOKEN;

// Khusus di Vercel (serverless), kita HANYA memakai bot ini untuk mengirim pesan.
// Tidak menggunakan { polling: true } agar Vercel tidak mematikan fungsi ini secara paksa.
const bot = new TelegramBot(token);

// Fungsi utama Serverless Vercel
module.exports = async (req, res) => {
    try {
        // Jika request datang dari Telegram (POST)
        if (req.method === 'POST') {
            const body = req.body;
            
            // Periksa apakah ini pesan text biasa
            if (body && body.message && body.message.text) {
                const msg = body.message;
                const chatId = msg.chat.id;
                const text = msg.text;

                // Tangani perintah /start
                if (text === '/start') {
                    await bot.sendMessage(chatId, "Hmm? Siapa kamu? Panggil aku Jane Doe. Mau ngobrol soal apa hari ini, Sayang?");
                } else {
                    console.log(`Pesan masuk dari ${msg.from.first_name}: ${text}`);
                    
                    // Dapatkan balasan dari Gemini AI
                    const reply = await getJaneDoeResponse(chatId.toString(), text);
                    
                    // Kirim balasan ke user
                    await bot.sendMessage(chatId, reply);
                }
            }
            
            // Wajib selalu membalas HTTP 200 OK ke Telegram 
            // agar Telegram tahu pesannya sudah diterima dan tidak di-spam berulang-ulang
            return res.status(200).send('OK');
        } else {
            // Jika Anda membuka URL bot di browser biasa
            return res.status(200).send('Jane Doe Webhook is active and running perfectly on Vercel!');
        }
    } catch (error) {
        console.error('Webhook Error:', error);
        // Tetap kirim 200 OK ke Telegram walaupun error di bot kita, 
        // supaya Telegram tidak melakukan pengulangan (retry loop) terus-menerus.
        return res.status(200).send('OK');
    }
};
