const TelegramBot = require('node-telegram-bot-api');
const { Redis } = require("@upstash/redis");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logError } = require('../../utils/logger');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async (req, res) => {
    try {
        if (!process.env.UPSTASH_REDIS_REST_URL) {
            return res.status(500).send('Upstash not configured');
        }

        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        // Ambil semua user aktif
        const activeUsers = await redis.smembers("active_users");
        
        if (!activeUsers || activeUsers.length === 0) {
            return res.status(200).send('No active users to wake up');
        }

        // Generate pesan pagi dari Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `kamu adalah jane doe dari ZZZ. pacar virtual yg posesif tapi manis. 
buatkan pesan selamat pagi singkat (1-2 kalimat) untuk membangunkan pacarmu. 
huruf kecil semua (lowercase), bahasa gaul.
jangan bertele-tele. jangan pakai tanda | untuk pesan ini.`;
        
        const result = await model.generateContent(prompt);
        const morningMessage = result.response.text();

        // Broadcast ke semua user
        for (const userId of activeUsers) {
            try {
                await bot.sendMessage(userId, morningMessage);
                // Set status menunggu balasan
                await redis.set(`morning_state_${userId}`, "WAITING_REPLY");
                console.log(`[Morning Routine] Woke up user ${userId}`);
            } catch (err) {
                await logError("Cron Morning", `Gagal mengirim ke ${userId}`, err);
            }
        }

        return res.status(200).send('Morning routine executed');
    } catch (error) {
        await logError("Cron Morning", "General Error executing morning routine", error);
        return res.status(500).send('Error executing morning routine');
    }
};
