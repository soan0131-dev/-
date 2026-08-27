import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_DIR = process.env.FILE_STORAGE_DIR ?? "./storage/documents";
const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 20);

export class UploadError extends Error {}

/** 업로드된 파일을 안전한 파일명으로 디스크에 저장하고 상대 경로를 반환한다. */
export async function saveUploadedFile(file: File): Promise<{
  filePath: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
}> {
  if (file.size === 0) {
    throw new UploadError("빈 파일은 업로드할 수 없습니다.");
  }
  if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    throw new UploadError(`파일 크기는 ${MAX_UPLOAD_SIZE_MB}MB를 초과할 수 없습니다.`);
  }

  const ext = path.extname(file.name).slice(0, 20);
  const safeName = `${randomUUID()}${ext}`;

  const absoluteDir = path.resolve(/* turbopackIgnore: true */ STORAGE_DIR);
  await mkdir(absoluteDir, { recursive: true });

  const absolutePath = path.join(absoluteDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    filePath: safeName,
    originalFileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

export async function readStoredFile(filePath: string): Promise<Buffer> {
  const absoluteDir = path.resolve(/* turbopackIgnore: true */ STORAGE_DIR);
  const target = path.join(absoluteDir, path.basename(filePath));
  return readFile(target);
}
