Data Cruncher
==

This folder contains a CLI tool that processes and compiles Thailand postal code data from multiple sources to create the target data type (defined in TypeScript models).

## Usage

The CLI tool can be run directly with execute permissions:

```bash
# Run commands directly
./cli.ts compile
./cli.ts help
./cli.ts --version

# Or via Bun
bun cli.ts compile
bun cli.ts help

# Or via npm scripts
npm run compile
npm run help
```

## Commands

- **compile** - Compile and merge data sources (postalcode.pdf + tumbon.xlsx) into final output
- **help** - Show usage information and available commands

## Options

- `-h, --help` - Show help message
- `-v, --version` - Show version number

## Data Sources

The tool processes the following source files:
- `sources/postalcode.pdf` - Thailand postal code data
- `sources/tumbon.xlsx` - Sub-district (Tambon) data

The compilation process merges these sources to create a comprehensive dataset for the zip.maketh.dev application.

