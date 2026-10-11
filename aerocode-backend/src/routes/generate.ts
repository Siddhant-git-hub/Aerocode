import { Router } from 'express';
import { PlannerAgent } from '../agents/planner.agent.js';
import { CoderAgent } from '../agents/coder.agent.js'; // or .js depending on your tsx/ESM resolution

const router = Router();

router.post('/', async (req, res) => {
  const { prompt, category } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured in .env' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const planner = new PlannerAgent(apiKey);
    const coder = new CoderAgent(apiKey);

    // 1. Planning Phase
    res.write(`data: ${JSON.stringify({ phase: 'PLANNING', message: 'Architecting UI layout with Llama 3.3...' })}\n\n`);
    const blueprint = await planner.createBlueprint(prompt, category || 'landing-page');

    // 2. Coding Phase
    res.write(`data: ${JSON.stringify({ phase: 'CODING', message: 'Generating production component code...' })}\n\n`);

    const generatedFiles = [];
    for (const fileSpec of blueprint.filesToGenerate) {
      res.write(`data: ${JSON.stringify({ phase: 'CODING', message: `Building ${fileSpec.path}...` })}\n\n`);
      
      const generatedFile = await coder.generateFile(
        fileSpec.path,
        fileSpec.purpose,
        JSON.stringify(blueprint)
      );

      generatedFiles.push(generatedFile);

      // Stream each file to frontend immediately upon completion
      res.write(`data: ${JSON.stringify({ phase: 'CODING', file: generatedFile })}\n\n`);
    }

    // 3. Complete Phase
    res.write(`data: ${JSON.stringify({ phase: 'COMPLETE', message: 'Generation finished successfully!', files: generatedFiles })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Pipeline error:', error);
    res.write(`data: ${JSON.stringify({ phase: 'ERROR', message: error.message || 'Pipeline generation failed' })}\n\n`);
    res.end();
  }
});

export default router;