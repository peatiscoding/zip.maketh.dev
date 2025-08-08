import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export class AbstractParser {
  protected async streamToBuffer(stream: ReadableStream): Promise<Buffer> {
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const buffer = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    return Buffer.from(buffer)
  }
}

export abstract class WebCachedParser {
  protected readonly cacheDir = join(process.cwd(), 'cache')
  protected readonly cacheDays = 7 // Cache for 7 days

  /**
   * Gets cached HTML content or fetches fresh content from URL
   * @param url The URL to fetch
   * @param cachePrefix The prefix for cache file naming
   * @returns The HTML content
   */
  protected async getCachedHtml(url: string, cachePrefix: string): Promise<string> {
    // Create cache directory if it doesn't exist
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true })
    }

    // Calculate expiration date (current date + cache days)
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + this.cacheDays)
    const expirationString = expirationDate.toISOString().split('T')[0] // YYYY-MM-DD format

    const cacheFileName = `${cachePrefix}_expires-${expirationString}.html`
    const cacheFilePath = join(this.cacheDir, cacheFileName)

    // Check for any existing cache files (including expired ones)
    const existingCacheFiles = existsSync(this.cacheDir)
      ? require('fs')
          .readdirSync(this.cacheDir)
          .filter(
            (file: string) => file.startsWith(`${cachePrefix}_expires-`) && file.endsWith('.html')
          )
      : []

    // Find the most recent non-expired cache file
    const currentDate = new Date().toISOString().split('T')[0]
    const validCacheFile = existingCacheFiles.find((file: string) => {
      const match = file.match(/expires-(\d{4}-\d{2}-\d{2})\.html$/)
      if (!match) return false

      const fileExpirationDate = match[1]
      return fileExpirationDate >= currentDate
    })

    if (validCacheFile) {
      const validCacheFilePath = join(this.cacheDir, validCacheFile)
      console.log(`📁 Using cached data: ${validCacheFile}`)
      return readFileSync(validCacheFilePath, 'utf8')
    }

    // Clean up expired cache files
    for (const file of existingCacheFiles) {
      const expiredFilePath = join(this.cacheDir, file)
      try {
        require('fs').unlinkSync(expiredFilePath)
        console.log(`🗑️  Removed expired cache file: ${file}`)
      } catch (err) {
        console.warn(`⚠️  Could not remove expired cache file: ${file}`)
      }
    }

    // Fetch new data
    console.log(`🌐 Fetching fresh data from: ${url}`)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${url}: ${response.statusText}`)
    }

    const html = await response.text()

    // Save to cache
    writeFileSync(cacheFilePath, html, 'utf8')
    console.log(`💾 Cached data: ${cacheFileName}`)

    return html
  }
}
