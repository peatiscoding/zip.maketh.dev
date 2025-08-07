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
