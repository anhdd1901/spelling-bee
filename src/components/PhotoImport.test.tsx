import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoImport } from './PhotoImport'
import { WordInput } from './WordInput'

const { wordsFromImage, wordsFromPdf } = vi.hoisted(() => ({
  wordsFromImage: vi.fn(),
  wordsFromPdf: vi.fn(),
}))
vi.mock('../lib/ocr', () => ({ wordsFromImage }))
vi.mock('../lib/pdf', async (orig) => ({ ...(await orig<typeof import('../lib/pdf')>()), wordsFromPdf }))

const pdfFile = () => new File(['%PDF-1.7'], 'bai-tap.pdf', { type: 'application/pdf' })
const pngFile = () => new File(['x'], 'anh.png', { type: 'image/png' })

beforeEach(() => {
  wordsFromImage.mockReset()
  wordsFromPdf.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

const renderImport = (file: File) =>
  render(<PhotoImport file={file} existing={new Set()} onAdd={vi.fn()} onClose={vi.fn()} />)

describe('PhotoImport', () => {
  it('ảnh vẫn đi qua OCR ảnh như cũ', async () => {
    wordsFromImage.mockResolvedValue(['apple'])
    renderImport(pngFile())
    expect(await screen.findByRole('button', { name: /apple/ })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Từ trong ảnh' })).toBeInTheDocument()
    expect(wordsFromPdf).not.toHaveBeenCalled()
  })

  it('PDF đi qua wordsFromPdf, tiêu đề "Từ trong tài liệu"', async () => {
    wordsFromPdf.mockResolvedValue({ words: ['banana', 'cherry'], truncated: false })
    renderImport(pdfFile())
    expect(await screen.findByRole('button', { name: /banana/ })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Từ trong tài liệu' })).toBeInTheDocument()
    expect(wordsFromImage).not.toHaveBeenCalled()
    expect(screen.queryByText(/10 trang đầu/)).not.toBeInTheDocument()
  })

  it('PDF dài thì báo chỉ đọc 10 trang đầu', async () => {
    wordsFromPdf.mockResolvedValue({ words: ['banana'], truncated: true })
    renderImport(pdfFile())
    expect(await screen.findByText(/Chỉ đọc 10 trang đầu/)).toBeInTheDocument()
  })

  it('PDF lỗi thì báo không mở được', async () => {
    wordsFromPdf.mockRejectedValue(new Error('PasswordException'))
    renderImport(pdfFile())
    expect(await screen.findByText(/không mở được file PDF này/)).toBeInTheDocument()
  })

  it('PDF hiện ảnh trang 1 khi có, chưa có thì không hiện ảnh hỏng', async () => {
    let preview: ((b: Blob) => void) | undefined
    wordsFromPdf.mockImplementation((_f: File, opts: { onPreview: (b: Blob) => void }) => {
      preview = opts.onPreview
      return new Promise(() => {})
    })
    renderImport(pdfFile())
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    preview!(new Blob(['png']))
    expect(await screen.findByRole('img', { name: 'Trang đầu của tài liệu' })).toHaveAttribute('src', 'blob:preview')
  })
})

describe('WordInput', () => {
  it('nút tải lên nhận cả ảnh và PDF, nút chụp chỉ nhận ảnh', () => {
    const { container } = render(<WordInput onAdd={vi.fn()} onPhoto={vi.fn()} />)
    const inputs = container.querySelectorAll('input[type=file]')
    const upload = screen.getByText('Tải ảnh / PDF').closest('label')!.querySelector('input')!
    const camera = screen.getByText('Chụp ảnh').closest('label')!.querySelector('input')!
    expect(inputs).toHaveLength(2)
    expect(upload.accept).toBe('image/*,application/pdf')
    expect(camera.accept).toBe('image/*')
  })
})
