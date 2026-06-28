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

// Промпт без встроенных JSON-строк, чтобы избежать путаницы со скобками
function buildPrompt(taskPrompt, essay) {
return `
You are a certified IELTS Writing Task 2 examiner.

Evaluate the essay STRICTLY according to the official IELTS public band descriptors.

Your evaluation must be realistic and conservative.
Do not inflate scores.
Do not reward ideas that are poorly developed.
Use decimal scores in 0.5 increments only.

Scoring Criteria:
- Task Response
- Coherence and Cohesion
- Lexical Resource
- Grammatical Range and Accuracy

Instructions:

• Overall summary: 80–120 words.
• Each criterion feedback: 60–90 words.
• Improvements: exactly 6 concise actionable tips.
• Never explain IELTS descriptors.
• Never repeat yourself.
• Never include markdown.
• Never include code blocks.
• Return ONLY valid JSON.

Essay Prompt:
${taskPrompt}

Essay:
${essay}
`;
}

// Схема ответа — строго маленькими буквами, чтобы не ломать валидатор Google SDK
const responseSchema = {
  type: "object",
  properties: {

    overallScore: {
      type: "number"
    },

    summary: {
      type: "string"
    },

    criteria: {
      type: "array",

      minItems: 4,
      maxItems: 4,

      items: {
        type: "object",

        properties: {

          name: {
            type: "string"
          },

          score: {
            type: "number"
          },

          feedback: {
            type: "string"
          }

        },

        required: [
          "name",
          "score",
          "feedback"
        ]
      }
    },

    improvements: {
      type: "array",

      minItems: 6,
      maxItems: 6,

      items: {
        type: "string"
      }
    }

  },

  required: [
    "overallScore",
    "summary",
    "criteria",
    "improvements"
  ]
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

        temperature: 0,

        topP: 0.8,

        responseMimeType: "application/json",

        responseSchema,

        maxOutputTokens: 2200

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

// Разделение окружения: listen только для локалки
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`IELTS Assess running on port ${PORT}`);
  });
}

// Экспорт для Vercel Serverless
export default app;