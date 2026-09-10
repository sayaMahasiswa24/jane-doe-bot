const { Redis } = require("@upstash/redis");
require('dotenv').config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Mencatat error ke Upstash Redis
 * @param {string} context - Konteks terjadinya error (misal: 'Webhook', 'Gemini API')
 * @param {string} message - Pesan error singkat
 * @param {object|string} errorDetail - Detail error dari try-catch
 */
async function logError(context, message, errorDetail) {
    try {
        console.error(`[${context}] ${message}:`, errorDetail);
        
        let detailString = "";
        if (errorDetail instanceof Error) {
            detailString = errorDetail.message || errorDetail.toString();
        } else if (typeof errorDetail === 'object') {
            detailString = JSON.stringify(errorDetail);
        } else {
            detailString = String(errorDetail);
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            context: context,
            message: message,
            detail: detailString
        };

        // Simpan ke list Redis
        await redis.lpush("bot_errors", JSON.stringify(logEntry));
        
        // Batasi log maksimal 50 agar Redis tidak penuh
        await redis.ltrim("bot_errors", 0, 49);
    } catch (err) {
        console.error("Gagal menyimpan log ke Redis:", err);
    }
}

module.exports = { logError };
