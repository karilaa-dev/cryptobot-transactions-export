# Crypto Bot Transactions Export

A Chrome extension to export your [Crypto Bot](https://t.me/CryptoBot) (send.tg) transaction history to CSV format for tax reporting and record keeping.

## Features

- **Export to Raw CSV** - All collected data including internal IDs, URLs, and detailed transaction info
- **Export to Koinly CSV** - Formatted for direct import into [Koinly](https://koinly.io) tax software
- **Auto-scroll** - Automatically scrolls through your transaction history to load all transactions
- **Detail fetching** - Fetches additional details for withdrawals/deposits including:
  - Network fees
  - Blockchain transaction hashes
  - Destination addresses
  - Network information

## Supported Transaction Types

- Withdrawals (to external wallets)
- Deposits (from external wallets)
- P2P trades (buy/sell)
- Swaps/Exchanges
- Checks (gifts)
- Invoices

## Installation

### From Chrome Web Store

<!-- TODO: Add Chrome Web Store link when published -->
*Coming soon*

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the folder containing the extension files

## Usage

1. Navigate to [app.send.tg](https://app.send.tg) and log in
2. Go to the Transactions page
3. Click the extension icon in your toolbar to open the side panel
4. Click **Export Raw CSV** or **Export Koinly CSV**
5. Wait for the extension to:
   - Scroll through all transactions
   - Fetch details for each withdrawal/deposit
   - Generate and download the CSV file

## CSV Formats

### Raw CSV Columns

| Column | Description |
|--------|-------------|
| ID | Internal transaction ID |
| Date | Transaction date (UTC) |
| Type | Transaction type label |
| TX Type | Transaction category |
| Amount 1 | Primary amount |
| Currency 1 | Primary currency |
| Amount 2 | Secondary amount (for swaps) |
| Currency 2 | Secondary currency |
| Fee Amount | Network fee |
| Fee Currency | Fee currency |
| Net Amount | Amount after fees |
| Network | Blockchain network |
| To Address | Destination address |
| TxHash | Blockchain transaction hash |
| URL | Link to transaction details |

### Koinly CSV Columns

Standard Koinly import format with Date, Sent/Received amounts, fees, labels, and transaction hashes.

## Privacy

This extension:
- Only works on `app.send.tg`
- Does not send your data anywhere
- Processes everything locally in your browser
- Does not require any API keys or authentication

## License

MIT License
