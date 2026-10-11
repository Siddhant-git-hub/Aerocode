export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

export interface FileSpec {
  path: string;
  purpose: string;
  language: string;
}

export interface ProjectBlueprint {
  title: string;
  category: string;
  description: string;
  filesToGenerate: FileSpec[];
}