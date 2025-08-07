import type { RawSubDistrict } from '@types'

export interface ITumbonParser {
  /**
   * parse the buffer content
   */
  parse(sourceStream: ReadableStream): Promise<RawSubDistrict[]>
}
