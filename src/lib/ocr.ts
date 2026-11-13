import { extractWords } from './words'

export type OcrFn = (image: Blob, onProgress?: (p: number) => void) => Promise<string>

/**
 * Mở một worker tesseract.js (nạp lười để không làm nặng lần tải đầu) dùng được cho nhiều ảnh.
 * Nhớ gọi `close()` khi xong.
 */
export async function openOcr(): Promise<{ recognize: OcrFn; close: () => Promise<void> }> {
  const { createWorker } = await import('tesseract.js')
  let report: ((p: number) => void) | undefined
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') report?.(m.progress)
    },
  })
  return {
    recognize: async (image, onProgress) => {
      report = onProgress
      try {
        const { data } = await worker.recognize(image)
        return data.text
      } finally {
        report = undefined
      }
    },
    close: async () => {
      await worker.terminate()
    },
  }
}

/** Đọc chữ trong ảnh bằng tesseract.js. */
export async function wordsFromImage(file: Blob, onProgress?: (p: number) => void): Promise<string[]> {
  const ocr = await openOcr()
  try {
    return extractWords(await ocr.recognize(file, onProgress), { minLength: 2 })
  } finally {
    await ocr.close()
  }
}
