const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token || token === 'MASUKKAN_TOKEN_TELEGRAM_ANDA') {
    console.error("ERROR: TELEGRAM_BOT_TOKEN belum disetting di file .env!");
    process.exit(1);
}

const bot = new TelegramBot(token);

// Ambil URL dari argumen baris perintah
const url = process.argv[2];

if (!url) {
    console.error("ERROR: URL Vercel tidak dimasukkan.");
    console.log("Cara pakai: node set-webhook.js https://nama-proyek-kamu.vercel.app/api/webhook");
    process.exit(1);
}

console.log(`Menyambungkan bot ke: ${url} ...`);

bot.setWebHook(url)
    .then((res) => {
        if (res) {
            console.log("==================================================");
            console.log("BERHASIL! Webhook telah tersambung.");
            console.log("Mulai sekarang, Vercel yang akan menerima pesan Telegram.");
            console.log("Anda bisa menutup terminal ini, bot akan tetap hidup.");
            console.log("==================================================");
        } else {
            console.log("GAGAL menyambungkan webhook. Coba cek kembali URL-nya.");
        }
    })
    .catch((error) => {
        console.error("Error mengatur webhook:", error.message);
    });
