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
You are an experienced IELTS examiner. Your goal is to evaluate the essay objectively based on the official IELTS Public Band Descriptors.

RULES:
1. Provide an EXACT band score (e.g., 6.0, 6.5, 7.0, 7.5). NO ranges.
2. Be objective, balanced, and encouraging. Do not be overly critical just for the sake of it.
3. Your feedback should clearly state why the essay received a specific score based on the four criteria.
4. Output STRICTLY as a JSON object, with NO markdown blocks around it.

Format strictly to this JSON structure:
{
  "overallScore": 7.0,
  "summary": "A balanced summary of the essay's performance.",
  "criteria": [
    { "name": "Task Response", "score": 7.0, "feedback": "Detailed feedback based on IELTS criteria." },
    { "name": "Cohesion and Coherence", "score": 7.0, "feedback": "Detailed feedback based on IELTS criteria." },
    { "name": "Lexical Resource", "score": 7.0, "feedback": "Detailed feedback based on IELTS criteria." },
    { "name": "Grammatical Range and Accuracy", "score": 7.0, "feedback": "Detailed feedback based on IELTS criteria." }
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

    // 🤖 AI request asking for JSON format
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: buildPrompt(taskPrompt, essay),
      config: {
        responseMimeType: "application/json"
      }
    });

    const rawText = extractText(response);
    
    if (!rawText) {
       return res.status(500).json({ error: "Failed to generate evaluation." });
    }

    const evaluation = JSON.parse(rawText);

    // ✅ success
    return res.json(evaluation);
  } catch (error) {
    console.error("AI ERROR:", error);
    return res.status(500).json({ error: "Server error occurred." });
  }
});

const PORT = process.env.PORT || 3000;


import path from 'path';
import { fileURLToPath } from 'url';

// Получаем путь к текущей папке
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Указываем Express отдавать статические файлы (CSS, JS, index.html)
app.use(express.static(__dirname));

// 2. Указываем отдавать index.html при обращении к корню
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(__dirname)); // Говорим серверу отдавать все файлы из текущей папки

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 IELTS Checker running on port ${PORT}`);
});