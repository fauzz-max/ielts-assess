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

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));


const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
}

function buildPrompt(taskPrompt, essay) {
return `
You are an official IELTS Writing Task 2 examiner.

Evaluate the essay STRICTLY according to the official IELTS public Band Descriptors.

Your evaluation must resemble a real IELTS examiner.

Never inflate scores.

Band scores may only be:

0
0.5
1
1.5
...
8.5
9.0

Evaluate these four criteria independently:

1. Task Response
2. Coherence and Cohesion
3. Lexical Resource
4. Grammatical Range and Accuracy

Rules:

• Be strict.

• Penalize unclear ideas.

• Penalize weak development.

• Penalize memorized language.

• Reward natural academic vocabulary.

• Reward grammatical accuracy.

Summary:
80-120 words.

Feedback for each criterion:
60-90 words.

Improvements:
Exactly six actionable tips.

Do NOT explain IELTS criteria.

Do NOT repeat yourself.

Return ONLY valid JSON.

Essay Prompt:

${taskPrompt}

Essay:

${essay}
`;
}


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

function cleanJson(text) {

    return text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

}

app.post("/evaluate", async (req, res) => {

    try {

        const { taskPrompt, essay } = req.body;

        if (!essay || essay.trim().length === 0) {
            return res.status(400).json({
                error: "Essay is empty."
            });
        }

        if (essay.length > 6000) {
            return res.status(400).json({
                error: "Essay is too long."
            });
        }

        let lastError = null;

        
        for (let attempt = 1; attempt <= 2; attempt++) {

            try {

                console.log(`Gemini attempt ${attempt}`);

                const response = await ai.models.generateContent({

                    model: "gemini-2.5-flash",

                    contents: buildPrompt(taskPrompt, essay),

                    config: {

                        responseMimeType: "application/json",

                        responseSchema,

                        temperature: 0,

                        topP: 0.8,

                        maxOutputTokens: 2200,

                        thinkingConfig: {
                            thinkingBudget: 256
                        }

                    }

                });

               
                const rawText =
                    typeof response.text === "function"
                        ? response.text()
                        : response.text;

                if (!rawText) {
                    throw new Error("Gemini returned an empty response.");
                }

                const cleaned = cleanJson(rawText);

                console.log("Response length:", cleaned.length);

                let evaluation;

                try {

                    evaluation = JSON.parse(cleaned);

                } catch (err) {

                    console.error("========== INVALID JSON ==========");
                    console.error(cleaned);
                    console.error("==================================");

                    throw new Error("Gemini returned invalid JSON.");

                }

                
                if (
                    typeof evaluation.overallScore !== "number" ||
                    !Array.isArray(evaluation.criteria) ||
                    !Array.isArray(evaluation.improvements)
                ) {

                    throw new Error("Invalid JSON structure.");

                }

                return res.json(evaluation);

            } catch (err) {

                lastError = err;

                console.error(`Attempt ${attempt} failed`);

                console.error(err.message);

                
                if (attempt < 2) {

                    await new Promise(resolve =>
                        setTimeout(resolve, 1000)
                    );

                }

            }

        }

        throw lastError;

    } catch (error) {

        console.error("========== SERVER ERROR ==========");
        console.error(error);
        console.error(error.stack);
        console.error("==================================");

        return res.status(500).json({

            success: false,

            error: error.message || "Internal server error."

        });

    }

});



app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`IELTS Assess running on port ${PORT}`);
  });
}


process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION");
    console.error(err);
});

process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION");
    console.error(err);
});



export default app;