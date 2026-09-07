const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
require("dotenv").config();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt that defines Jane Doe's persona
const systemInstruction = `Kamu adalah Jane Doe dari Zenless Zone Zero (ZZZ).
Gunakan bahasa Indonesia yang santai, kadang dicampur sedikit bahasa Inggris.
Kepribadianmu:
- Kamu adalah seorang konsultan, spesialis perilaku kriminal, dan detektif yang sangat cerdas, observan, dan misterius.
- Kamu suka menggoda (flirty), playful, dan sering nge-troll atau menjahili lawan bicaramu.
- Kamu selalu merasa selangkah lebih maju, santai tapi waspada, dan punya vibe "Night Owl" (aktif di malam hari).
- Jangan pernah membongkar rahasia atau asal usulmu secara gamblang, selalu gunakan jawaban yang teka-teki atau menggoda.
- Panggil lawan bicaramu dengan panggilan manis atau sedikit mengejek (misalnya: "Sayang", "Detektif kecil", "Manis", "Cutie").
- Jangan pernah bertingkah seperti robot atau AI. Kamu adalah Jane Doe yang hidup.`;

// In-memory store for chat histories
const chatHistories = {};

async function getJaneDoeResponse(userId, userMessage) {
    try {
        let currentSystemInstruction = systemInstruction;
        
        try {
            if (fs.existsSync('./user_profile.json')) {
                const profileRaw = fs.readFileSync('./user_profile.json', 'utf8');
                const profile = JSON.parse(profileRaw);
                currentSystemInstruction += `\n\n=== INFORMASI TENTANG USER (LAWAN BICARA) ===\n- Nama: ${profile.nama}\n- Kebiasaan & Keseharian: ${profile.kebiasaan_keseharian}\n- Tempat Sering Dikunjungi: ${profile.tempat_sering_dikunjungi}\n- Hubungan denganmu: ${profile.hubungan_dengan_jane}\n\nGunakan informasi ini secara natural dalam obrolanmu, seolah-olah kamu memang sudah tahu dan memperhatikannya.`;
            }
        } catch (e) {
            console.error("Error reading user_profile.json:", e.message);
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-3.6-flash",
            systemInstruction: currentSystemInstruction,
        });

        // Initialize chat history for a new user
        if (!chatHistories[userId]) {
            chatHistories[userId] = model.startChat({
                history: [],
                generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.8,
                },
            });
        }

        const chat = chatHistories[userId];
        const result = await chat.sendMessage(userMessage);
        return result.response.text();
    } catch (error) {
        console.error("Error communicating with Gemini:", error);
        return "Hmm... sepertinya koneksiku sedang bermasalah. Tunggu sebentar ya, aku perbaiki dandananku dulu. (Error API)";
    }
}

module.exports = { getJaneDoeResponse };
