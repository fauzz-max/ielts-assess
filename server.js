import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Настройка middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🔐 Инициализация AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Промпт очищен от дублирования JSON-структуры, чтобы ИИ не зацикливался
function buildPrompt(taskPrompt, essay) {
  return `You are an expert, strict, and certified IELTS Writing examiner. Your task is to evaluate the provided essay based strictly on the official IELTS Writing Task 2 Band Descriptors.

Analyze the text deeply and honestly. Assign scores dynamically and strictly based on the text's actual merit. Provide an overall score, a detailed summary feedback, scores and specific feedback for each of the 4 standard IELTS criteria, and a list of actionable improvements.

Task Prompt:
${taskPrompt}

User Essay:
${essay}`;
}

// ИСПРАВЛЕНО: Все типы переведены в нижний регистр ("object", "number", "string", "array")
const responseSchema = {
  type: "object",
  properties: {
    overallScore: { type: "number" },
    summary: { type: "string" },
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          score: { type: "number" },
          feedback: { type: "string" }
        },
        required: ["name", "score", "feedback"]
      }
    },
    improvements: { 
      type: "array", 
      items: { type: "string" } 
    }
  },
  required: ["overallScore", "summary", "criteria", "improvements"]
};

app.post("/evaluate", async (req, res) => {
  try {
    const { taskPrompt, essay } = req.body;

    if (!essay || essay.trim().length === 0) {
      return res.status(400).json({ error: "Essay is empty." });
    }

    // Запрос к модели
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: buildPrompt(taskPrompt, essay),
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1 // Низкая температура для точности
      }
    });

    const rawText = response.text;
    
    if (!rawText) {
       return res.status(500).json({ error: "Failed to generate evaluation." });
    }

    const evaluation = JSON.parse(rawText);
    return res.json(evaluation);

  } catch (error) {
    console.error("AI ERROR:", error);
    return res.status(500).json({ 
      error: "Oops! The AI is a bit overwhelmed right now. Take a quick breather and try again!" 
    });
  }
});

// Роут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ИСПРАВЛЕНО: app.listen не вызывается внутри Vercel, предотвращая баги окружения
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`IELTS Assess running on port ${PORT}`);
  });
}

// Экспорт приложения для Vercel Serverless
export default app;