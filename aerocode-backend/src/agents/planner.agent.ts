import OpenAI from 'openai';
import { ProjectBlueprint } from '../types/agent.types.js';

export class PlannerAgent {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async createBlueprint(prompt: string, category: string): Promise<ProjectBlueprint> {
    const modelsToTry = [
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b'
    ];
    
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        console.log(`Planner architecting 3D Web experience via model: ${model}...`);
        const response = await this.openai.chat.completions.create({
          model: model,
          response_format: { type: 'json_object' },
          max_tokens: 2000,
          messages: [
            {
              role: 'system',
              content: `You are the Lead Creative Technologist and UI Architect for Aerocode.
Your task is to convert user ideas into production-grade 3D web experience blueprints using vanilla HTML, custom CSS, and Three.js.

STRICT BLUEPRINT CONSTRAINTS:
1. Always mandate exactly 3 files:
   - "index.html": Base structure, Google Fonts, Tailwind CDN, FontAwesome, Three.js (r128) CDN, and semantic UI overlay markup.
   - "styles.css": Glassmorphic UI surfaces, custom CSS variables, responsive typography, scrollbars, and keyframe animations.
   - "script.js": WebGL initialization, procedural lighting, ambient particle systems, interactive 3D objects, and mouse parallax.
2. Ensure high-end luxury aesthetic tokens (dark obsidian themes, gold/amber accents, high contrast typography).

Return ONLY valid JSON matching this exact structure:
{
  "title": "Project Title",
  "category": "Category Name",
  "description": "Brief description of the 3D experience",
  "filesToGenerate": [
    { "path": "index.html", "purpose": "HTML5 layout with CDNs for Tailwind and Three.js", "language": "html" },
    { "path": "styles.css", "purpose": "Glassmorphism styling, animations, and custom UI system", "language": "css" },
    { "path": "script.js", "purpose": "Three.js WebGL scene, camera rig, lights, and mesh interactions", "language": "javascript" }
  ]
}`,
            },
            {
              role: 'user',
              content: `User Request: "${prompt}". Category: "${category}"`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content || '{}';
        
        try {
          return JSON.parse(content) as ProjectBlueprint;
        } catch (parseErr) {
          console.warn(`JSON parsing failed for model ${model}, attempting recovery...`);
          throw new Error('Malformed JSON received from model');
        }
      } catch (err: any) {
        console.warn(`Planner model ${model} failed (${err.status || err.message}), trying next...`);
        lastError = err;
      }
    }

    throw new Error(`Planner pipeline failed: ${lastError?.message || 'Unknown error'}`);
  }
}