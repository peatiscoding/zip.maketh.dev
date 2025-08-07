import type { RawSubDistrict, RawZipCode, RawProvince, RawDistrict } from '@types'

interface IParserTarget {
  ditPath: string
  files: {
    tumbon: string
    postcodes: string
  }
}

export interface IParserDataKeyGenerator {
  province: (record: RawProvince) => string
  district: (record: RawDistrict) => string
  subDistrict: (record: RawSubDistrict) => string
}

export interface IParser {
  /**
   * Start parsing and look for the files
   */
  parse(target: IParserTarget): Promise<void>
}

export interface ITumbonParser {
  /**
   * parse the buffer content
   */
  parse(
    sourceStream: ReadableStream,
    keyGenerator: IParserDataKeyGenerator
  ): Promise<{
    provinces: Record<string, RawProvince>
    districts: Record<string, RawDistrict>
    subDistricts: Record<string, RawSubDistrict>
  }>
}

export interface IPostcodeParser {
  /**
   * parse the zip code
   */

  parse(
    sourceStream: ReadableStream,
    referenceSubDistrict: BoundSubDistrict[]
  ): Promise<BoundZipCode[]>
}
