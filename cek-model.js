const dotenv = require("dotenv");
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY || API_KEY.includes("MASUKKAN")) {
  console.log("Error: API Key belum dimasukkan ke file .env");
  process.exit(1);
}

async function checkModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await response.json();
    
    if (data.error) {
      console.log("API Error:", data.error.message);
    } else {
      console.log("Model yang tersedia untuk API Key Anda:");
      const modelNames = data.models.map(m => m.name);
      console.log(modelNames.join("\n"));
    }
  } catch (error) {
    console.log("Gagal menghubungi Google API:", error.message);
  }
}

checkModels();
