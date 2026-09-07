const TelegramBot = require('node-telegram-bot-api');
const { getJaneDoeResponse } = require('./gemini');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token || token === 'MASUKKAN_TOKEN_TELEGRAM_ANDA') {
    console.error("ERROR: TELEGRAM_BOT_TOKEN belum disetting di file .env!");
    process.exit(1);
}

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MASUKKAN_API_KEY_GEMINI_ANDA_DI_SINI') {
    console.error("ERROR: GEMINI_API_KEY belum disetting di file .env!");
    process.exit(1);
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

console.log('Bot Jane Doe sudah siap dan terhubung ke Telegram!');

// Listen for any kind of message
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore non-text messages
    if (!text) return;

    // Handle /start command
    if (text === '/start') {
        bot.sendMessage(chatId, "Hmm? Siapa kamu? Panggil aku Jane Doe. Mau ngobrol soal apa hari ini, Sayang?");
        return;
    }

    console.log(`Pesan masuk dari ${msg.from.first_name}: ${text}`);

    try {
        // Tampilkan status "mengetik..." di Telegram
        bot.sendChatAction(chatId, 'typing');

        // Dapatkan balasan dari Gemini AI
        const reply = await getJaneDoeResponse(chatId.toString(), text);
        
        // Kirim balasan ke user
        bot.sendMessage(chatId, reply);
    } catch (error) {
        console.error("Error handling message:", error);
        bot.sendMessage(chatId, "Ups, kayaknya aku lagi sibuk sedikit. Nanti lagi ya~ (Error)");
    }
});

// Handle polling errors gracefully so it doesn't crash or spam the console with stack traces
bot.on('polling_error', (error) => {
    if (error.code !== 'EFATAL') {
        console.error(`Polling Error: ${error.code}`);
    }
});

// ==========================================
// DUMMY SERVER UNTUK RENDER.COM
// ==========================================
// Render (jika disetting sebagai Web Service) mengharuskan aplikasi 
// membuka sebuah "Port" (misal port 3000 atau port 80). 
// Jika tidak, Render akan mengira aplikasinya rusak dan mematikannya.
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Jane Doe Bot is running on Render!');
    res.end();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Dummy server berjalan di port ${PORT} agar Render.com tidak mematikan bot ini.`);
});
