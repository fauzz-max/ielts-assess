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

function buildPrompt(taskPrompt, essay) {
  return `
You are an IELTS examiner. Grade this essay based on IELTS criteria.
Return ONLY a JSON object with this structure:
{
  "overallScore": number,
  "summary": "brief summary",
  "criteria": [{"name": "Task Achievement", "score": number, "feedback": "feedback text"}, ...],
  "improvements": ["tip 1", "tip 2"]
}
Essay: "${essay}"
Task: "${taskPrompt}"
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

    // 1. ПРЕДОХРАНИТЕЛЬ: Ограничиваем длину эссе (защита от перегрузки)
    // 5000 символов — это примерно 700-800 слов, чего с запасом хватит для IELTS.
    if (essay.length > 5000) {
      return res.status(400).json({ 
        error: "Your essay is too long. Please keep it under 800 words." 
      });
    }

    // Запрос к модели
const response = await ai.models.generateContent({
  model: "gemini-2.0-flash", // Используй самую быструю модель
  contents: buildPrompt(taskPrompt, essay),
  config: {
    responseMimeType: "application/json",
    responseSchema: responseSchema,
    temperature: 0.1, // Меньше температура = быстрее генерация
    maxOutputTokens: 600 // Сократи лимит — этого хватит для краткого фидбека
  }
});
    const rawText = response.text;
    
    if (!rawText) {
       return res.status(500).json({ error: "Failed to generate evaluation." });
    }

    // 3. ПРЕДОХРАНИТЕЛЬ: Безопасный парсинг JSON с обработкой ошибки
    let evaluation;
    try {
      evaluation = JSON.parse(rawText);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw Text snippet:", rawText.substring(0, 500));
      return res.status(500).json({ 
        error: "AI generated a malformed response. Please try evaluating again." 
      });
    }

    return res.json(evaluation);
  } catch (error) {
    console.error("AI ERROR:", error);
    return res.status(500).json({ 
      error: "Oops! The AI is a bit overwhelmed right now. Take a quick breather and try again in a few seconds!" 
    });
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

// Запускаем app.listen только при локальной разработке
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`IELTS Assess running locally on port ${PORT}`);
  });
}

// Экспортируем приложение для бессерверной среды Vercel
export default app;