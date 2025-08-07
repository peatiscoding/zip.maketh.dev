import type { BoundSubDistrict, BoundZipCode } from '@types'
import type { IPostcodeParser } from './interface'

export class PostcodePDFParser implements IPostcodeParser {
  parse(
    sourceStream: ReadableStream,
    referenceSubDistrict: BoundSubDistrict[]
  ): Promise<BoundZipCode[]> {
    throw new Error('Method not implemented.')
  }
}
