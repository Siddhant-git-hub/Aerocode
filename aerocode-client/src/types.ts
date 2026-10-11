export interface FileNode {
  path: string;
  content: string;
  language: string;
}

export type Phase = 'idle' | 'planning' | 'coding' | 'done' | 'error';

export interface GenerateResult {
  files: FileNode[];
}
