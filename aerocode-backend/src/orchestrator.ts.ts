import { PlannerAgent } from './agents/planner.agent.js';
import { CoderAgent } from './agents/coder.agent.js';
import { StreamPayload } from './types/agent.types.js';

export class AgentOrchestrator {
  private planner: PlannerAgent;
  private coder: CoderAgent;

  constructor(apiKey: string) {
    this.planner = new PlannerAgent(apiKey);
    this.coder = new CoderAgent(apiKey);
  }

  async *executePipeline(
    prompt: string,
    category: string
  ): AsyncGenerator<StreamPayload> {
    try {
      yield { phase: 'PLANNING', message: `Planner Agent analyzing scope for ${category}...` };
      const blueprint = await this.planner.createBlueprint(prompt, category);

      yield {
        phase: 'PLANNING',
        message: `Plan ready. Generating ${blueprint.filesToGenerate.length} files...`,
      };

      const generatedFiles = [];
      const contextStr = `${blueprint.title}: ${blueprint.description}`;

      for (const fileSpec of blueprint.filesToGenerate) {
        yield { phase: 'CODING', message: `Building ${fileSpec.path}...` };

        const fileNode = await this.coder.generateFile(
          fileSpec.path,
          fileSpec.purpose,
          contextStr
        );

        generatedFiles.push(fileNode);

        yield {
          phase: 'CODING',
          message: `Generated ${fileSpec.path}`,
          file: fileNode,
        };
      }

      yield {
        phase: 'COMPLETE',
        message: 'Generation complete!',
        files: generatedFiles,
      };
    } catch (error: any) {
      yield { phase: 'ERROR', message: error.message || 'Pipeline error encountered.' };
    }
  }
}