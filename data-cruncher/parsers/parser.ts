import type {
  IParser,
  IParserTarget,
  IPostcodeParser,
  ITumbonParser,
  IParserDataKeyGenerator
} from './interface'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { TumbonFileParser } from './tumbon'
import { BoundSubDistrict } from '@types'

export class Parser implements IParser {
  public constructor(
    protected tumbon: ITumbonParser,
    protected postcode?: IPostcodeParser
  ) {}

  static create(): Parser {
    const tumbonParser = new TumbonFileParser()
    return new Parser(tumbonParser)
  }

  async parse(target: IParserTarget): Promise<void> {
    await this.parseTumbon(target)
  }

  private async parseTumbon(target: IParserTarget): Promise<BoundSubDistrict[]> {
    console.log('🔄 Starting data parsing...')

    // Parse Tumbon file
    console.log('📊 Processing tumbon.xlsx...')
    const tumbonPath = join(target.ditPath, target.files.tumbon)
    const tumbonBuffer = await readFile(tumbonPath)
    const tumbonStream = new ReadableStream({
      start(controller) {
        controller.enqueue(tumbonBuffer)
        controller.close()
      }
    })

    // Create default key generator
    const keyGenerator: IParserDataKeyGenerator = {
      province: (record) => record.code,
      district: (record) => record.code,
      subDistrict: (record) => record.code
    }

    const tumbonData = await this.tumbon.parse(tumbonStream, keyGenerator)

    console.log(`✅ Parsed ${Object.keys(tumbonData.provinces).length} provinces`)
    console.log(`✅ Parsed ${Object.keys(tumbonData.districts).length} districts`)
    console.log(`✅ Parsed ${Object.keys(tumbonData.subDistricts).length} sub-districts`)

    // TODO: Parse postcode file when IPostcodeParser is implemented
    if (this.postcode) {
      console.log('📄 Processing postalcode.pdf...')
      // Implementation will be added when postcode parser is ready
    } else {
      console.log('⚠️  Postcode parser not implemented yet')
    }

    console.log('🔗 Data parsing completed!')
  }
}
