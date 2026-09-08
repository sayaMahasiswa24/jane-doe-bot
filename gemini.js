const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Redis } = require("@upstash/redis");
const { Client } = require("@upstash/qstash");
require("dotenv").config();

async function getJaneDoeResponse(userId, userMessage) {
    try {
        // Initialize connections
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // Cek jika API key Upstash belum ada
        if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.QSTASH_TOKEN) {
            return "aduh sayang, aku belum bisa mikir jernih nih. master belum masukin kunci upstash redis & qstash ke vercel aku.";
        }

        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        const qstash = new Client({ token: process.env.QSTASH_TOKEN });

        // Fetch User Profile dari Redis
        let userProfile = await redis.get(`profile_${userId}`) || {};
        
        // Fetch Chat History dari Redis (Ambil 20 percakapan terakhir saja agar tidak berat)
        let rawHistory = await redis.get(`history_${userId}`) || [];
        // Pastikan format history sesuai standar Gemini
        let chatHistory = rawHistory.map(msg => ({
            role: msg.role,
            parts: msg.parts
        }));

        // System Instruction yang ketat sesuai PRD
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

        // Deklarasi fungsi yang bisa dipanggil Gemini (Function Calling)
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

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-lite-latest",
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: [updateMemoryTool, setReminderTool] }]
        });

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: { maxOutputTokens: 800, temperature: 0.9 },
        });

        let responseText = "";
        let result = await chat.sendMessage(userMessage);
        
        // Cek jika Gemini ingin memanggil fungsi (Function Calling)
        const functionCalls = result.response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const args = call.args;
            
            let functionResponse = {};

            if (call.name === "update_memory") {
                // Simpan ke Redis Profile
                userProfile[args.kategori] = args.informasi;
                await redis.set(`profile_${userId}`, userProfile);
                console.log(`[Memory Updated] ${args.kategori}: ${args.informasi}`);
                functionResponse = { status: "sukses_disimpan" };
            } 
            else if (call.name === "set_reminder") {
                // Jadwalkan dengan QStash
                const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://YOUR_VERCEL_APP_URL';
                
                try {
                    await qstash.publishJSON({
                        url: `${vercelUrl}/api/reminder`,
                        body: {
                            chatId: userId,
                            message: args.pesan_pengingat
                        },
                        delay: `${args.delay_in_minutes}m`
                    });
                    console.log(`[Reminder Set] in ${args.delay_in_minutes}m: ${args.pesan_pengingat}`);
                    functionResponse = { status: "alarm_berhasil_dijadwalkan" };
                } catch (err) {
                    console.error("QStash Error:", err);
                    functionResponse = { status: "gagal_karena_qstash_error" };
                }
            }

            // Kembalikan hasil fungsi ke Gemini agar dia bisa memberikan jawaban final ke user
            result = await chat.sendMessage([{
                functionResponse: {
                    name: call.name,
                    response: functionResponse
                }
            }]);
        }

        responseText = result.response.text();

        // Ambil history baru dan simpan ke Redis (Potong jadi 20 pesan terakhir saja)
        let newHistory = await chat.getHistory();
        if (newHistory.length > 20) {
            newHistory = newHistory.slice(newHistory.length - 20);
        }
        await redis.set(`history_${userId}`, newHistory);

        return responseText;

    } catch (error) {
        console.error("Error communicating with Gemini:", error);
        return "aduh sayang.. kepalaku pusing bgt nih (error api) 😭 | coba chat lagi nanti ya.";
    }
}

module.exports = { getJaneDoeResponse };
