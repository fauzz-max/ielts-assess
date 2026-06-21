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

// 🧠 Обновленный промпт (без противоречий)
function buildPrompt(taskPrompt, essay) {
  return `
You are a highly experienced and strict IELTS examiner. 
Evaluate the following IELTS Task 2 essay based on the official IELTS Public Band Descriptors.

CRITICAL RULES:
1. Do not default to Band 7.0. Use the full 0-9.0 range. If it's a 5.5, give a 5.5.
2. The 'overallScore' MUST be the exact mathematical average of the 4 criteria, rounded to the nearest 0.5.
3. Your feedback should clearly state why the essay received a specific score based on the four criteria. Point out specific grammatical or lexical errors.

Task Prompt:
${taskPrompt}

User Essay:
${essay}
`;
}

// Схема, которая ТОЧНО совпадает с тем, что нам нужно
const responseSchema = {
  type: "OBJECT",
  properties: {
    overallScore: { type: "NUMBER" },
    summary: { type: "STRING" },
    criteria: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          score: { type: "NUMBER" },
          feedback: { type: "STRING" }
        }
      }
    },
    improvements: { 
      type: "ARRAY", 
      items: { type: "STRING" } 
    }
  }
};

app.post("/evaluate", async (req, res) => {
  try {
    const { taskPrompt, essay } = req.body;

    if (!essay || essay.trim().length === 0) {
      return res.status(400).json({ error: "Essay is empty." });
    }

    // Запрос к модели
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Рекомендую использовать 2.0-flash, так как она актуальнее
      contents: buildPrompt(taskPrompt, essay),
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1 // Низкая температура для строгости и следования формату
      }
    });

    // В новом SDK текст достается гораздо проще
    const rawText = response.text;
    
    if (!rawText) {
       return res.status(500).json({ error: "Failed to generate evaluation." });
    }

    const evaluation = JSON.parse(rawText);

    return res.json(evaluation);
  } catch (error) {
    console.error("AI ERROR:", error);
    return res.status(500).json({ 
      error: "Oops! The AI is a bit overwhelmed right now. Take a quick breather and try again in a few seconds!" 
    });
  }
});

// Роут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`IELTS Assess running on port ${PORT}`);
});