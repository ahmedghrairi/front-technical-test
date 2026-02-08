export interface Item {
  id: string;
  parentId: string | null;
  name: string;
  folder: boolean;
  creation: string;
  modification: string;
  filePath?: string;
  mimeType?: string;
  size?: number;
}
