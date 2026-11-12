import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Sign in to upload a receipt.' }, { status: 401 })
  const body = await request.formData()
  const file = body.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a receipt image.' }, { status: 400 })
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: 'Use a JPG, PNG, GIF, or WebP image.' }, { status: 415 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Receipt images must be 5 MB or smaller.' }, { status: 413 })
  try {
    const pathname = `users/${session.user.id}/receipts/${crypto.randomUUID()}.${extensions[file.type]}`
    const blob = await put(pathname, file, { access: 'private', addRandomSuffix: false, contentType: file.type })
    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('Receipt upload failed', error)
    return NextResponse.json({ error: 'Receipt upload is unavailable right now.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const pathname = request.nextUrl.searchParams.get('pathname')
  if (!pathname || !pathname.startsWith(`users/${session.user.id}/receipts/`) || pathname.includes('..')) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  try {
    const { get } = await import('@vercel/blob')
    const result = await get(pathname, { access: 'private', ifNoneMatch: request.headers.get('if-none-match') ?? undefined })
    if (!result) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } })
    return new NextResponse(result.stream, { headers: { 'Content-Type': result.blob.contentType, ETag: result.blob.etag, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    console.error('Receipt delivery failed', error)
    return NextResponse.json({ error: 'Receipt is unavailable.' }, { status: 500 })
  }
}
