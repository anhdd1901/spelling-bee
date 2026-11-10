import { extractWords } from './words'

/** Đọc chữ trong ảnh bằng tesseract.js (nạp lười để không làm nặng lần tải đầu). */
export async function wordsFromImage(file: Blob, onProgress?: (p: number) => void): Promise<string[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return extractWords(data.text, { minLength: 2 })
  } finally {
    await worker.terminate()
  }
}
