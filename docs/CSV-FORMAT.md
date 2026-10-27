# CSV format

The prototype reads 1 generic CSV format. Exchange-specific exports (Bitpanda, Kraken, Coinbase, Trade Republic) will be mapped onto these same columns in a later version.

## Columns

| Column | Required | Meaning |
| --- | --- | --- |
| `date` | always | When the transaction happened. See formats below. |
| `type` | always | `buy`, `sell`, `swap`, `transfer` or `reward`. German names also work: `Kauf`, `Verkauf`, `Tausch`, `Übertragung`, `Staking`. |
| `wallet` | always | Where it happened: an exchange account or a wallet, for example `Bitpanda` or `Ledger`. Lots are tracked separately per wallet. |
| `asset_in` | buy, swap, reward | Asset received, for example `BTC`. |
| `amount_in` | buy, swap, reward | Units received. |
| `asset_out` | sell, swap, transfer | Asset given away or moved. |
| `amount_out` | sell, swap, transfer | Units given away or moved. |
| `eur_value` | buy, sell, swap, reward | Euro value, see the table below. |
| `fee_eur` | optional | Fee in euro. Added to the cost of a purchase, deducted from the proceeds of a sale or swap. |
| `to_wallet` | transfer | Target wallet of a transfer between own wallets. |
| `note` | optional | Free text. |

## What `eur_value` means per type

| Type | `eur_value` is |
| --- | --- |
| `buy` | Euro paid, without the fee |
| `sell` | Euro received, before the fee |
| `swap` | Market value of the trade in euro at that moment |
| `reward` | Market value of the received units at that moment |

## Formats accepted

- Delimiter: comma, semicolon or tab, detected from the header line.
- Numbers: `1234.56`, `1234,56`, `1.234,56` and `1,234.56`. The separator that appears last is read as the decimal separator.
- Dates: `2025-03-14T10:22:00Z` and `2025-03-14T10:22:00+01:00` are converted to Berlin time. `2025-03-14 10:22` and `14.03.2025 10:22` are read as Berlin time.
- Encoding: UTF-8, with or without BOM.

## Example

```csv
date,type,wallet,asset_in,amount_in,asset_out,amount_out,eur_value,fee_eur,to_wallet,note
2024-03-05 14:12,buy,Kraken,ETH,2,,,7000.00,18.00,,
2025-01-15 18:40,transfer,Bitpanda,,,BTC,0.0186,,,Ledger,Cold Storage
2025-08-20 19:20,swap,Kraken,SOL,23.03,ETH,1,3800.00,9.50,,
2025-09-01 02:00,reward,Kraken,ETH,0.004,,,14.80,,,Staking
2025-10-08 10:45,sell,Kraken,,,BTC,0.05,5250.00,13.65,,
```

## Known limits of the prototype

- Transfer fees paid in crypto are not supported. A transfer moves exactly `amount_out`.
- Margin, futures, lending principal, DeFi positions and NFTs are out of scope.
- Fees can only be given in euro.
