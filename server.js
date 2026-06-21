import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// 🔐 AI init
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// 🧠 helper: safe extract response
function extractText(response) {
  try {
    return (
      response?.candidates?.[0]?.content?.parts
        ?.map(p => p.text)
        .join("") || null
    );
  } catch (e) {
    return null;
  }
}

// 🧠 main prompt (strict and precise)
function buildPrompt(taskPrompt, essay) {
  return `
  You are a strict, highly experienced IELTS examiner. 
    Evaluate the following IELTS Task 2 essay based on the official Band Descriptors.

    CRITICAL RULES:
    1. Do not default to Band 7.0. Use the full 0-9.0 range. Be brutally honest. If it's a 5.5, give a 5.5. If it's a 9.0, give a 9.0.
    2. The 'overallScore' MUST be the exact mathematical average of the 4 criteria, rounded to the nearest 0.5.
    3. Be highly critical of grammar errors, repetitive vocabulary, and poor task response.

You are an experienced IELTS examiner. Your goal is to evaluate the essay objectively based on the official IELTS Public Band Descriptors.

RULES:
1. Provide an EXACT band score (e.g., 6.0, 6.5, 7.0, 7.5). NO ranges.
2. Be objective, balanced, and encouraging. Do not be overly critical just for the sake of it.
3. Your feedback should clearly state why the essay received a specific score based on the four criteria.
4. Output STRICTLY as a JSON object, with NO markdown blocks around it.

Format strictly to this JSON structure:
{
  "overallScore": 0.0,
  "summary": "A balanced summary of the essay's performance.",
  "criteria": [
    { "name": "Task Response", "score": 0.0, "feedback": "Detailed feedback based on IELTS criteria." },
    { "name": "Cohesion and Coherence", "score": 0.0, "feedback": "Detailed feedback based on IELTS criteria." },
    { "name": "Lexical Resource", "score": 0.0, "feedback": "Detailed feedback based on IELTS criteria." },
    { "name": "Grammatical Range and Accuracy", "score": 0.0, "feedback": "Detailed feedback based on IELTS criteria." }
  ],
  "improvements": ["Specific improvement 1", "Specific improvement 2"]
}

Task Prompt:
${taskPrompt}

User Essay:
${essay}
`;
}

app.post("/evaluate", async (req, res) => {
  try {
    const { taskPrompt, essay } = req.body;

    if (!essay || essay.trim().length === 0) {
      return res.status(400).json({ error: "Essay is empty." });
    }

// 1. Определяем схему (чтобы модель знала формат и не подглядывала в примеры с 7.0)
const responseSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    criteria: {
      type: "OBJECT",
      properties: {
        task_response: { type: "OBJECT", properties: { score: { type: "NUMBER" }, reasoning: { type: "STRING" } } },
        coherence_cohesion: { type: "OBJECT", properties: { score: { type: "NUMBER" }, reasoning: { type: "STRING" } } },
        lexical_resource: { type: "OBJECT", properties: { score: { type: "NUMBER" }, reasoning: { type: "STRING" } } },
        grammatical_range: { type: "OBJECT", properties: { score: { type: "NUMBER" }, reasoning: { type: "STRING" } } }
      }
    },
    overallScore: { type: "NUMBER" },
    improvements: { type: "ARRAY", items: { type: "STRING" } }
  }
};

// 2. Делаем запрос
const response = await ai.models.generateContent({
  model: "gemini-1.5-flash", // Проверь версию, gemini-2.5 еще официально нет (может глючить)
  contents: buildPrompt(taskPrompt, essay),
  config: {
    responseMimeType: "application/json",
    responseSchema: responseSchema, // Это лучший способ заставить модель следовать формату
    temperature: 0.1 // Снижаем творчество до минимума для строгой оценки
  }
});

    const rawText = extractText(response);
    
    if (!rawText) {
       return res.status(500).json({ error: "Failed to generate evaluation." });
    }

    const evaluation = JSON.parse(rawText);

    //  success
    return res.json(evaluation);
} catch (error) {
    console.error("AI ERROR:", error);
    return res.status(500).json({ 
      error: "Oops! The AI is a bit overwhelmed right now. Take a quick breather and try again in a few seconds!" 
    });
}
});

const PORT = process.env.PORT || 3000;


import path from 'path';
import { fileURLToPath } from 'url';

// Получаем путь к текущей папке
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Указываем Express отдавать статические файлы (CSS, JS, index.html)
app.use(express.static(__dirname));

// Указываем отдавать index.html при обращении к корню
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === ВСЕ ДУБЛИКАТЫ ОТСЮДА МЫ СТЕРЛИ ===

app.listen(PORT, () => {
  console.log(`IELTS Assess running on port ${PORT}`);
});