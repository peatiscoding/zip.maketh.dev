#!/usr/bin/env bun

import { parseArgs } from 'util'
import { Parser } from './parsers'
import { join } from 'path'

interface CLIOptions {
  help?: boolean
  version?: boolean
}

interface CLIArgs {
  values: CLIOptions
  positionals: string[]
}

class DataCruncherCLI {
  private version = '1.0.0'

  public async run(): Promise<void> {
    try {
      const args = this.parseArguments()

      if (args.values.help) {
        this.showHelp()
        return
      }

      if (args.values.version) {
        this.showVersion()
        return
      }

      const command = args.positionals[0]

      switch (command) {
        case 'compile':
          await this.handleCompile(args.positionals.slice(1))
          break
        case 'help':
          this.showHelp()
          break
        default:
          if (!command) {
            this.showHelp()
          } else {
            console.error(`Unknown command: ${command}`)
            console.error("Run 'bun cli.ts help' for available commands")
            process.exit(1)
          }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  private parseArguments(): CLIArgs {
    const { values, positionals } = parseArgs({
      args: Bun.argv.slice(2),
      options: {
        help: {
          type: 'boolean',
          short: 'h'
        },
        version: {
          type: 'boolean',
          short: 'v'
        }
      },
      allowPositionals: true
    })

    return { values: values as CLIOptions, positionals }
  }

  private showVersion(): void {
    console.log(`Data Cruncher CLI v${this.version}`)
  }

  private showHelp(): void {
    console.log(`Data Cruncher CLI v${this.version}

USAGE:
  bun cli.ts <command> [options]

COMMANDS:
  compile     Compile and merge data sources into final output
  help        Show this help message

OPTIONS:
  -h, --help     Show help
  -v, --version  Show version

EXAMPLES:
  bun cli.ts compile
  bun cli.ts help
  bun cli.ts --version`)
  }

  private async handleCompile(args: string[]): Promise<void> {
    try {
      const parser = Parser.create()

      const sourcesPath = join(process.cwd(), 'sources')
      const target = {
        ditPath: sourcesPath,
        files: {
          tumbon: 'tumbon.xlsx',
          postcodes: 'postalcode.pdf'
        }
      }

      await parser.parse(target)
      console.log('\n📍 Output: Compiled Thai postal code data ready for use')
    } catch (error) {
      console.error(
        '❌ Compilation failed:',
        error instanceof Error ? error.message : String(error)
      )
      throw error
    }
  }
}

// Run CLI if this file is executed directly
if (import.meta.main) {
  const cli = new DataCruncherCLI()
  await cli.run()
}

export { DataCruncherCLI }
