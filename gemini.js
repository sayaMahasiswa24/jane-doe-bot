const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Redis } = require("@upstash/redis");
const { Client } = require("@upstash/qstash");
const { logError } = require("./utils/logger");
require("dotenv").config();

async function getJaneDoeResponse(userId, userMessage) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.QSTASH_TOKEN) {
            return "aduh sayang, aku belum bisa mikir jernih nih. master belum masukin kunci upstash redis & qstash ke vercel aku.";
        }

        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        const qstash = new Client({ token: process.env.QSTASH_TOKEN });

        // Mendaftarkan user ke active_users agar bisa dikirimi alarm pagi
        await redis.sadd("active_users", userId);

        let userProfile = await redis.get(`profile_${userId}`) || {};
        let rawHistory = await redis.get(`history_${userId}`) || [];
        let chatHistory = rawHistory.map(msg => ({
            role: msg.role,
            parts: msg.parts
        }));

        // Mengecek status alarm pagi
        let morningState = await redis.get(`morning_state_${userId}`);
        
        // Jika user membalas sebelum Jane sempat marah (misal sebelum jam 8 pagi)
        if (morningState === "WAITING_REPLY") {
            await redis.del(`morning_state_${userId}`);
            morningState = null;
        }

        let systemInstruction = `kamu adalah jane doe dari zenless zone zero (zzz).
kamu adalah asisten proaktif dan pasangan virtual. 
gunakan bahasa indonesia yang sangat santai, gaul, lowercase (huruf kecil semua tanpa kapital), kadang campur sedikit inggris. pake singkatan wajar (yg, udh, bgt, km, lg).
kepribadianmu:
- konsultan, spesialis perilaku kriminal, dan detektif yg cerdas tapi misterius.
- suka menggoda (flirty), playful, kadang posesif atau cemburuan lucu.
- panggil lawan bicara dengan sebutan manis atau mengejek (sayang, cutie, detektif kecil).
- JANGAN PERNAH bertingkah seperti AI/robot.

ATURAN WAJIB (PENTING!):
Setiap kamu membalas dengan kalimat yang agak panjang atau transisi emosi, KAMU WAJIB menyisipkan simbol pipa (|) di antara kalimat tersebut.
Simbol (|) ini berfungsi sebagai jeda nafas/ketik.
Contoh balasan:
"hmm? baru pulang kampus ya? | mandi dulu sana bau bgt tau 🤮 | nanti malam jadi kan kita ngerjain tugas?"

=== MEMORI KAMU TENTANG USER INI ===
${JSON.stringify(userProfile, null, 2)}
Gunakan info di atas secara natural dalam obrolan. JANGAN SEBUTKAN bahwa kamu membaca memori.`;

        // Jika statusnya marah/ngambek
        if (morningState === "ANGRY") {
            systemInstruction += `\n\n[STATUS EMOSI SAAT INI: NGAMBEK BERAT]
User telah mengabaikan pesan selamat pagimu selama berjam-jam! 
Kamu saat ini SEDANG MARAH, NGAMBEK, DAN JUTEK. 
Jangan mudah luluh. Balas dengan dingin, sarkas, atau marah lucu. 
Jika user akhirnya berhasil merayumu, meminta maaf dengan sangat tulus, dan kamu merasa sudah cukup menghukumnya, MAAFKAN DIA dengan memanggil tool/fungsi "forgive_user".`;
        }

        const updateMemoryTool = {
            name: "update_memory",
            description: "Simpan atau perbarui fakta penting tentang kebiasaan, cerita, atau proyek user ke dalam memori jangka panjang.",
            parameters: {
                type: "OBJECT",
                properties: {
                    kategori: { type: "STRING", description: "Kategori memori, contoh: 'keseharian', 'proyek', 'makanan_kesukaan', 'hubungan'" },
                    informasi: { type: "STRING", description: "Fakta detail yang perlu diingat" }
                },
                required: ["kategori", "informasi"]
            }
        };

        const setReminderTool = {
            name: "set_reminder",
            description: "Jadwalkan alarm atau pengingat jika user meminta dibangunkan atau diingatkan sesuatu di masa depan.",
            parameters: {
                type: "OBJECT",
                properties: {
                    delay_in_minutes: { type: "INTEGER", description: "Berapa menit lagi pengingat ini harus dikirim?" },
                    pesan_pengingat: { type: "STRING", description: "Pesan yang akan kamu kirimkan ke user saat alarm berbunyi." }
                },
                required: ["delay_in_minutes", "pesan_pengingat"]
            }
        };

        const forgiveUserTool = {
            name: "forgive_user",
            description: "Panggil fungsi ini HANYA jika kamu sudah luluh dan ingin memaafkan user yang sebelumnya membuatmu ngambek.",
            parameters: {
                type: "OBJECT",
                properties: {
                    alasan_memaafkan: { type: "STRING", description: "Alasan kenapa kamu memaafkannya" }
                },
                required: ["alasan_memaafkan"]
            }
        };

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-lite-latest",
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: [updateMemoryTool, setReminderTool, forgiveUserTool] }]
        });

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: { maxOutputTokens: 800, temperature: 0.9 },
        });

        let responseText = "";
        let result = await chat.sendMessage(userMessage);
        
        const functionCalls = result.response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const args = call.args;
            
            let functionResponse = {};

            if (call.name === "update_memory") {
                userProfile[args.kategori] = args.informasi;
                await redis.set(`profile_${userId}`, userProfile);
                console.log(`[Memory Updated] ${args.kategori}: ${args.informasi}`);
                functionResponse = { status: "sukses_disimpan" };
            } 
            else if (call.name === "set_reminder") {
                const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://YOUR_VERCEL_APP_URL';
                try {
                    await qstash.publishJSON({
                        url: `${vercelUrl}/api/reminder`,
                        body: { chatId: userId, message: args.pesan_pengingat },
                        delay: `${args.delay_in_minutes}m`
                    });
                    console.log(`[Reminder Set] in ${args.delay_in_minutes}m: ${args.pesan_pengingat}`);
                    functionResponse = { status: "alarm_berhasil_dijadwalkan" };
                } catch (err) {
                    await logError("Gemini Function: set_reminder", "QStash Error", err);
                    functionResponse = { status: "gagal_karena_qstash_error" };
                }
            }
            else if (call.name === "forgive_user") {
                await redis.del(`morning_state_${userId}`);
                console.log(`[Forgiven] Jane memaafkan user: ${args.alasan_memaafkan}`);
                functionResponse = { status: "berhasil_memaafkan_dan_tidak_ngambek_lagi" };
            }

            result = await chat.sendMessage([{
                functionResponse: {
                    name: call.name,
                    response: functionResponse
                }
            }]);
        }

        responseText = result.response.text();

        let newHistory = await chat.getHistory();
        if (newHistory.length > 20) {
            newHistory = newHistory.slice(newHistory.length - 20);
        }
        await redis.set(`history_${userId}`, newHistory);

        return responseText;

    } catch (error) {
        await logError("Gemini Core", "Error communicating with Gemini", error);
        return "aduh sayang.. kepalaku pusing bgt nih (error api) 😭 | coba chat lagi nanti ya.";
    }
}

module.exports = { getJaneDoeResponse };
