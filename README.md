zip.maketh.dev
==

The OpenSource -- Thailand's Zip Code.

# Feature

- It provides the searchable web interface for resolving the Thai Postal Code.
- It provides the JSON endpoint for serving the backed data of Thai Postal Code in JSON format.
- It does NOT provide the filterable API.

## About This Repository

This is the [zip.maketh.dev](https://zip.maketh.dev) website's repository.

> **LORE**
>
> Thailand Postal code represented by 5 digits number with first 2 being the Province and last 3 being the Postal Branch within that Province. Hence it is possible that each Postal code may spread across multiple Sub-District or even District. But it will be bound to the Province.

## About This Repository Data Source

Item|Source
--|--
Sub-District's Lat + Long|[data.go.th](https://data.go.th/dataset/item_c6d42e1b-3219-47e1-b6b7-dfe914f27910)
PostalCode Information|??

# Implementation

## Stack

### Website

- Svelte5 (Rune)
- SvelteKit
- TypeScript
- SPA
- Hosted as static website over CloudFlare
- Node22

### Data Cruncher

Aside from Svelte5 website. The Data was consume and computed from multiple source. The script to compute the final result is written in TypeScript run on Bun within folder. `data-curncher`.
