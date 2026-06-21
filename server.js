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

function buildPrompt(taskPrompt, essay, wordCount) {
  return `
You are a highly experienced, uncompromising, and strict IELTS examiner. 
Evaluate the following IELTS Task 2 essay based strictly on the official IELTS Public Band Descriptors.

CRITICAL RULES:
1. STRICT GRADING: Be highly critical. Look for reasons to deduct points. Do not inflate scores. Band 5.0 to 6.0 is the standard for average, flawed essays. 
2. WORD COUNT: The exact word count of this essay is ${wordCount}. If ${wordCount} is less than 250 words, the essay fails to fully develop the topic. In this case, the 'Task Response' score MUST NOT exceed 5.5.
3. REASONING FIRST: In your reasoning for each criterion, explicitly list the exact grammatical errors, awkward phrases, or logical gaps BEFORE assigning the score. Focus on what went wrong.
4. CALCULATION: The 'total_band' MUST be the exact mathematical average of the 4 criteria scores, rounded to the nearest 0.5 (e.g., 6.125 rounds to 6.0, 6.25 rounds to 6.5).

OUTPUT FORMAT:
You MUST return your evaluation strictly as a valid JSON object. Do not include any markdown formatting like \`\`\`json, conversational text, or explanations outside the JSON.

{
  "task_response": { "score": 0.0, "reasoning": "..." },
  "coherence_and_cohesion": { "score": 0.0, "reasoning": "..." },
  "lexical_resource": { "score": 0.0, "reasoning": "..." },
  "grammatical_range_and_accuracy": { "score": 0.0, "reasoning": "..." },
  "total_band": 0.0
}

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
      model: "gemini-2.5-flash", 
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