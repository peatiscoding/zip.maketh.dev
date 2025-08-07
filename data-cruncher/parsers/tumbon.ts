import type { RawSubDistrict } from '@types'
import type { ITumbonParser } from './interface'

export class TumbonFileParser implements ITumbonParser {
  parse(sourceStream: ReadableStream): Promise<RawSubDistrict[]> {
    throw new Error('Method not implemented.')
  }
}
