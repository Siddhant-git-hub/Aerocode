import OpenAI from 'openai';
import { GeneratedFile } from '../types/agent.types.js';

export class CoderAgent {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async generateFile(
    filePath: string,
    purpose: string,
    blueprintContext: string
  ): Promise<GeneratedFile> {
    const modelsToTry = [
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b'
    ];

    let systemInstruction = '';

    if (filePath.endsWith('.html')) {
      systemInstruction = `You are a Principal Frontend Engineer.
Generate the complete, production-ready "index.html" file.
CRITICAL TECHNICAL REQUIREMENTS:
- Target element: <canvas id="three-canvas"></canvas> wrapped inside <div id="canvas-container" class="fixed inset-0 -z-10"></div>.
- Load required CDNs in <head>: 
  1. Tailwind CSS (<script src="https://cdn.tailwindcss.com"></script>)
  2. FontAwesome (<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">)
  3. Three.js r128 (<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>)
- Include Google Fonts (Playfair Display + Plus Jakarta Sans).
- Link <link rel="stylesheet" href="styles.css"> in <head> and <script src="script.js"></script> at the very end of <body>.
- Build clean, accessible glassmorphic UI overlay sections (Hero, Features, Interactive Booking/Form, Footer).
- Return ONLY raw code without markdown backticks or extra commentary. Do NOT truncate.`;
    } else if (filePath.endsWith('.css')) {
      systemInstruction = `You are an Award-Winning UI/UX Designer.
Generate the complete "styles.css" file.
CRITICAL DESIGN REQUIREMENTS:
- Define CSS custom variables for root colors (--bg-main: #0b0a09, --gold: #d4af37, --bronze: #b0895f).
- Implement reusable glassmorphic classes (.glass-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(16px); border: 1px solid rgba(212,175,55,0.2); }).
- Add custom smooth scrollbar styling, keyframe floating animation utility classes, and custom cursor glow treatments.
- Return ONLY raw CSS code without markdown backticks or commentary.`;
    } else {
      systemInstruction = `You are a Senior 3D WebGL Developer specializing in Three.js.
Generate the complete "script.js" file.
CRITICAL THREE.JS REQUIREMENTS:
- Select existing canvas: const canvas = document.getElementById('three-canvas');
- Set up WebGLRenderer with { canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }.
- Configure PerspectiveCamera, ambient light, key point lights, and dynamic rim lighting.
- Construct complex multi-part meshes (e.g., layered geometries, metallic materials with roughness/metalness, ambient floating particle fields) instead of simple default cubes or basic shapes.
- Implement mouse parallax easing (lerp) for smooth camera/mesh movement.
- Add window resize handler to update camera aspect ratio and renderer size.
- Return ONLY raw JavaScript code without markdown backticks or commentary.`;
    }

    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        console.log(`Coder crafting ${filePath} via model: ${model}...`);
        const response = await this.openai.chat.completions.create({
          model: model,
          max_tokens: 4000,
          messages: [
            {
              role: 'system',
              content: systemInstruction,
            },
            {
              role: 'user',
              content: `Blueprint Context: ${blueprintContext}\nGenerate complete source code for: ${filePath}`,
            },
          ],
        });

        const code = response.choices[0]?.message?.content || '';
        const cleanCode = code.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();

        let lang = 'javascript';
        if (filePath.endsWith('.html')) lang = 'html';
        if (filePath.endsWith('.css')) lang = 'css';

        return {
          path: filePath,
          content: cleanCode,
          language: lang,
        };
      } catch (err: any) {
        console.warn(`Coder model ${model} failed for ${filePath}, trying next...`);
        lastError = err;
      }
    }

    throw new Error(`Coder pipeline failed for ${filePath}: ${lastError?.message || 'Unknown error'}`);
  }
}