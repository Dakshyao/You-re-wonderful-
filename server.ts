import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set up large JSON payload support for base64 images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route for prompt generation
  app.post("/api/generate-prompt", async (req, res) => {
    const {
      productPhotoBase64,
      styleReferenceBase64,
      useCustomScene,
      customScene,
      aspectRatio,
      lighting,
      cameraAngle,
      composition,
      colorMood
    } = req.body;

    if (!productPhotoBase64) {
      return res.status(400).json({ error: "Product photo is required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "undefined" || apiKey === "") {
      return res.status(401).json({
        error: "Gemini API key is missing. Please add 'GEMINI_API_KEY' under Settings > Secrets."
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const parts: any[] = [
        { text: `Generate a highly detailed, professional product photography prompt for an AI image generator. 
          The product is shown in the first image. 
          ${styleReferenceBase64 ? "The desired style should be influenced by the second image." : ""}
          ${useCustomScene && customScene ? `The scene should be: ${customScene}` : ""}
          
          Parameters:
          - Aspect Ratio: ${aspectRatio}
          - Lighting: ${lighting}
          - Camera Angle: ${cameraAngle}
          - Composition: ${composition}
          ${colorMood && colorMood !== "None" ? `- Color Mood: ${colorMood}` : ""}
          
          The prompt should describe the environment, background, textures, and mood. 
          Focus on making the product look premium and appealing.
          Output ONLY the prompt text, no extra commentary.` }
      ];

      parts.push({
        inlineData: {
          data: productPhotoBase64,
          mimeType: "image/jpeg"
        }
      });

      if (styleReferenceBase64) {
        parts.push({
          inlineData: {
            data: styleReferenceBase64,
            mimeType: "image/jpeg"
          }
        });
      }

      // Use gemini-2.5-flash for prompt generation
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts }
      });

      const promptText = response.text || "";
      res.json({ prompt: promptText });
    } catch (err: any) {
      console.log("Server generate-prompt handled error:", err.message || err);
      
      // Provide a high-quality local template-based prompt generation fallback
      const aspectText = aspectRatio ? `at ${aspectRatio} aspect ratio` : "";
      const compositionText = composition ? `with ${composition.toLowerCase()} composition` : "";
      const lightingText = lighting ? `illuminated by professional ${lighting.toLowerCase()}` : "under studio lighting";
      const cameraText = cameraAngle ? `captured from a ${cameraAngle.toLowerCase()} perspective` : "captured from eye-level";
      const moodText = colorMood && colorMood !== "None" ? `with a cohesive ${colorMood.toLowerCase()} color grade` : "";
      const sceneText = useCustomScene && customScene ? `placed elegantly in a ${customScene}` : "styled in a minimalist high-end professional studio scene";

      const fallbackPrompt = `A premium professional commercial product shoot. The product is featured as the center focus, ${sceneText}, ${cameraText}, ${compositionText}. The environment is ${lightingText}, creating beautiful soft highlights, subtle realistic shadows, and reflections, ${moodText}, extremely clean details, 8k resolution, photorealistic, cinematic render ${aspectText}.`;
      
      console.log("Successfully generated robust local fallback product prompt.");
      res.json({ prompt: fallbackPrompt, fallbackUsed: true });
    }
  });

  // API Route for image generation via Gemini
  app.post("/api/generate-image", async (req, res) => {
    const { productPhotoBase64, generatedPrompt, aspectRatio } = req.body;

    if (!productPhotoBase64 || !generatedPrompt) {
      return res.status(400).json({ error: "Product photo and prompt are required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "undefined" || apiKey === "") {
      return res.status(401).json({
        error: "Gemini API key is missing. Please add 'GEMINI_API_KEY' under Settings > Secrets."
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            {
              inlineData: {
                data: productPhotoBase64,
                mimeType: "image/jpeg"
              }
            },
            { text: generatedPrompt }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any
          }
        }
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned from AI model.");
      }

      const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
      if (imagePart?.inlineData?.data) {
        res.json({ image: `data:image/png;base64,${imagePart.inlineData.data}` });
      } else {
        const textPart = response.candidates[0].content.parts.find(p => p.text);
        if (textPart?.text) {
          throw new Error(`AI returned text instead of image: ${textPart.text}`);
        }
        throw new Error("No image data received from the model.");
      }
    } catch (err: any) {
      // Extract error details safely
      let parsedErr = err;
      let msg = "";
      let code: any = null;

      if (typeof err.message === 'string') {
        try {
          const match = err.message.match(/\{.*\}/);
          if (match) {
            parsedErr = JSON.parse(match[0]);
          } else {
            msg = err.message;
          }
        } catch (e) {
          msg = err.message;
        }
      }

      code = parsedErr?.status || parsedErr?.error?.code || parsedErr?.error?.status || err?.status || err?.code || parsedErr?.code;
      msg = msg || parsedErr?.message || parsedErr?.error?.message || err?.message || String(err);

      const isPermissionError = code === 403 || msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("forbidden");
      const isQuotaError = code === 429 || code === "RESOURCE_EXHAUSTED" || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("resource_exhausted");

      console.error(`[API Error] Gemini Image generation failure (Code: ${code}, Quota Error: ${isQuotaError}). Message: ${msg}`);

      res.status(500).json({
        error: msg,
        code: code,
        isPermissionError,
        isQuotaError
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
