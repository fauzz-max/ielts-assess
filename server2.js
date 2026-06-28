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
You are an expert, strict, and certified IELTS Writing examiner. Your task is to evaluate the provided essay based strictly on the official IELTS Writing Task 2 Band Descriptors.

Analyze the text deeply and honestly. Assign scores dynamically and strictly based on the text's actual merit. 

You must respond STRICTLY in pure JSON format with the following structure. Replace the capitalized string placeholders with your actual calculated float numbers (0.0 to 9.0) and text.

{
  "overallScore": "FLOAT_NUMBER",
  "summary": "STRING_DETAILED_SUMMARY",
  "criteria": [
    {
      "name": "Task Achievement",
      "score": "FLOAT_NUMBER",
      "feedback": "STRING_DETAILED_ANALYSIS"
    },
    {
      "name": "Coherence and Cohesion",
      "score": "FLOAT_NUMBER",
      "feedback": "STRING_DETAILED_ANALYSIS"
    },
    {
      "name": "Lexical Resource",
      "score": "FLOAT_NUMBER",
      "feedback": "STRING_DETAILED_ANALYSIS"
    },
    {
      "name": "Grammatical Range and Accuracy",
      "score": "FLOAT_NUMBER",
      "feedback": "STRING_DETAILED_ANALYSIS"
    }
  ],
  "improvements": [
    "STRING_ACTIONABLE_TIP_1",
    "STRING_ACTIONABLE_TIP_2"
  ]
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