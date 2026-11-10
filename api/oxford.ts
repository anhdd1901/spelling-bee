import { handleOxfordRequest } from '../src/server/oxfordProxy.js' // Node ESM trên Vercel cần đuôi .js

// Hàm serverless của Vercel: GET /api/oxford?q=word → HTML trang Oxford của từ đó.
export function GET(request: Request): Promise<Response> {
  return handleOxfordRequest(request.url)
}
