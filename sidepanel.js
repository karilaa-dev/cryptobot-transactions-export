// Stop export flag
let stopRequested = false;

// Asset decimals mapping
const ASSET_DECIMALS = {
  USDT: 18, TON: 9, BTC: 8, ETH: 18, USDC: 18, NOT: 9, DOGS: 9, LTC: 8,
};
const DEFAULT_DECIMALS = 18;

function convertAmount(amountStr, asset) {
  if (!amountStr) return '0';
  if (amountStr.includes('.') && !amountStr.match(/^\d{10,}$/)) {
    return amountStr;
  }
  const decimals = ASSET_DECIMALS[asset] || DEFAULT_DECIMALS;
  try {
    const amount = BigInt(amountStr.replace(/\./g, ''));
    const divisor = BigInt(10 ** decimals);
    const intPart = amount / divisor;
    const fracPart = amount % divisor;
    if (fracPart === 0n) return intPart.toString();
    const fracStr = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${intPart}.${fracStr}`;
  } catch {
    return amountStr;
  }
}

function formatDate(isoDate) {
  const dt = new Date(isoDate);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  const hours = String(dt.getUTCHours()).padStart(2, '0');
  const minutes = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function formatDomDate(dateStr, timeStr) {
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
                   Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const parts = dateStr.split(' ');
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]] || '01';
    const year = parts[2];
    const time = timeStr || '00:00';
    return `${year}-${month}-${day} ${time} UTC`;
  }
  return dateStr;
}

function toKoinlyCSV(rows) {
  const headers = [
    'Date', 'Sent Amount', 'Sent Currency', 'Received Amount', 'Received Currency',
    'Fee Amount', 'Fee Currency', 'Net Worth Amount', 'Net Worth Currency',
    'Label', 'Description', 'TxHash'
  ];
  const csvRows = rows.map(row => {
    return headers.map(h => {
      const val = String(row[h] || '');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  });
  return [headers.join(','), ...csvRows].join('\n');
}

function toRawCSV(rows) {
  const headers = [
    'ID', 'Date', 'Type', 'TX Type', 'Amount 1', 'Currency 1', 'Amount 2', 'Currency 2',
    'Fee Amount', 'Fee Currency', 'Net Amount', 'Network', 'To Address', 'TxHash', 'URL'
  ];
  const csvRows = rows.map(row => {
    return headers.map(h => {
      const val = String(row[h] || '');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  });
  return [headers.join(','), ...csvRows].join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
}

function setProgress(current, total, phase) {
  const container = document.getElementById('progressContainer');
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  container.style.display = 'block';
  fill.style.width = total > 0 ? `${(current / total) * 100}%` : '0%';
  text.textContent = phase ? `${phase}: ${current} / ${total}` : `${current} transactions found`;
}

function hideProgress() {
  document.getElementById('progressContainer').style.display = 'none';
}

function setButtons(enabled) {
  document.getElementById('exportRawBtn').disabled = !enabled;
  document.getElementById('exportKoinlyBtn').disabled = !enabled;
  document.getElementById('stopBtn').style.display = enabled ? 'none' : 'block';
}

function showStopButton(show) {
  document.getElementById('stopBtn').style.display = show ? 'block' : 'none';
}

function toggleInstructions() {
  const instructions = document.getElementById('instructions');
  const btn = document.getElementById('instructionsBtn');
  if (instructions.style.display === 'block') {
    instructions.style.display = 'none';
    btn.textContent = 'How to Use';
  } else {
    instructions.style.display = 'block';
    btn.textContent = 'Hide Instructions';
  }
}

function log(message, type = 'info') {
  const container = document.getElementById('logContainer');
  container.style.display = 'block';
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function clearLog() {
  const container = document.getElementById('logContainer');
  container.innerHTML = '';
  container.style.display = 'none';
}

// Full Export - scrolls through page, then fetches details for each transaction
async function exportAll(format = 'koinly') {
  stopRequested = false;
  setButtons(false);
  clearLog();
  setStatus('Phase 1: Scrolling to load all transactions...', 'info');
  setProgress(0, 0, 'Scanning');
  log(`Starting ${format === 'raw' ? 'Raw' : 'Koinly'} export...`);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.includes('app.send.tg')) {
      setStatus('Please navigate to app.send.tg/transactions first', 'warning');
      log('Error: Not on app.send.tg', 'error');
      setButtons(true);
      return;
    }

    // Navigate to transactions page if not there
    if (!tab.url.includes('/transactions')) {
      log('Navigating to transactions page...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { window.location.href = 'https://app.send.tg/transactions'; }
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    log('Scanning page for transactions...');

    // Phase 1: Scroll and collect all transaction links
    const scanResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        const transactions = new Map();
        let lastHeight = 0;
        let noChangeAttempts = 0;
        let lastTxCount = 0;
        let txCountStableAttempts = 0;
        const maxScrollAttempts = 200;
        const scrollWaitMs = 500;
        const noChangeThreshold = 8;  // More patient before giving up
        const txStableThreshold = 5;  // Tx count must be stable for 5 checks

        const collectTransactions = () => {
          const items = document.querySelectorAll('a[href*="/transactions/"]');
          items.forEach(item => {
            try {
              const href = item.getAttribute('href') || '';
              const match = href.match(/\/transactions\/(\w+)\/([^?/]+)/);
              if (!match) return;

              const txType = match[1];
              const id = match[2];
              if (transactions.has(id)) return;

              const text = item.innerText || '';
              const lines = text.split('\n').map(l => l.trim()).filter(l => l);

              let type = lines[0] || txType;
              let dateStr = '';
              let timeStr = '';
              let amounts = [];

              for (const line of lines) {
                const dateMatch = line.match(/(\d{1,2}\s+\w{3}\s+\d{4})\s+(\d{2}:\d{2})/);
                if (dateMatch) {
                  dateStr = dateMatch[1];
                  timeStr = dateMatch[2];
                }
                const amtMatch = line.match(/([+-]?[\d.,]+)\s*([A-Z]{2,})/);
                if (amtMatch) {
                  amounts.push({
                    value: amtMatch[1].replace(/,/g, ''),
                    currency: amtMatch[2],
                    isNegative: amtMatch[1].startsWith('-')
                  });
                }
              }

              transactions.set(id, { id, txType, type, dateStr, timeStr, amounts, href });
            } catch (e) {}
          });
        };

        // Initial collection
        collectTransactions();

        // Scroll incrementally by viewport height to ensure lazy-loading triggers
        const viewportHeight = window.innerHeight;
        let currentScrollPos = 0;

        for (let i = 0; i < maxScrollAttempts; i++) {
          // Scroll incrementally - this triggers lazy loading better than jumping to bottom
          currentScrollPos += viewportHeight * 0.8;
          window.scrollTo(0, currentScrollPos);
          await new Promise(resolve => setTimeout(resolve, scrollWaitMs));

          // Also scroll to absolute bottom to trigger any remaining loads
          const maxScroll = document.body.scrollHeight;
          if (currentScrollPos >= maxScroll) {
            window.scrollTo(0, maxScroll);
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          // Collect any new transactions
          collectTransactions();

          const newHeight = document.body.scrollHeight;
          const currentTxCount = transactions.size;

          // Check if height changed
          if (newHeight === lastHeight) {
            noChangeAttempts++;
          } else {
            noChangeAttempts = 0;
            lastHeight = newHeight;
            // Reset scroll position tracking when page grows
            if (currentScrollPos >= newHeight) {
              currentScrollPos = window.scrollY;
            }
          }

          // Check if transaction count stabilized
          if (currentTxCount === lastTxCount) {
            txCountStableAttempts++;
          } else {
            txCountStableAttempts = 0;
            lastTxCount = currentTxCount;
          }

          // Stop only when BOTH height is stable AND tx count is stable
          if (noChangeAttempts >= noChangeThreshold && txCountStableAttempts >= txStableThreshold) {
            break;
          }
        }

        // Final aggressive scroll - scroll through entire page again to catch any missed items
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 300));
        const finalMaxScroll = document.body.scrollHeight;
        for (let pos = 0; pos <= finalMaxScroll; pos += viewportHeight * 0.5) {
          window.scrollTo(0, pos);
          await new Promise(resolve => setTimeout(resolve, 400));
          collectTransactions();
        }
        // One final jump to absolute bottom
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 500));
        collectTransactions();

        window.scrollTo(0, 0);
        return Array.from(transactions.values());
      }
    });

    const transactions = scanResults[0]?.result || [];

    if (transactions.length === 0) {
      setStatus('No transactions found.', 'error');
      log('No transactions found on page', 'error');
      hideProgress();
      setButtons(true);
      return;
    }

    log(`Found ${transactions.length} transactions`, 'success');

    // Phase 2: Fetch details for withdrawals and deposits (they have fees/tx hashes)
    setStatus(`Phase 2: Fetching details for ${transactions.length} transactions...`, 'info');

    const detailsMap = {};
    const txsNeedingDetails = transactions.filter(tx =>
      tx.txType === 'withdrawal' || tx.txType === 'deposit'
    );

    log(`Fetching details for ${txsNeedingDetails.length} withdrawal/deposit transactions...`);

    for (let i = 0; i < txsNeedingDetails.length; i++) {
      if (stopRequested) {
        log('Export stopped by user', 'error');
        setStatus('Export stopped', 'warning');
        hideProgress();
        setButtons(true);
        return;
      }

      const tx = txsNeedingDetails[i];
      setProgress(i + 1, txsNeedingDetails.length, 'Fetching details');

      try {
        // Navigate to detail page
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (href) => { window.location.href = href; },
          args: [`https://app.send.tg${tx.href}`]
        });

        await new Promise(resolve => setTimeout(resolve, 1500));

        // Extract details
        const detailResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const details = {};
            const text = document.body.innerText;

            // Extract fee
            const feeMatch = text.match(/Fee\s*\n?\s*([0-9.]+)\s*([A-Z]+)/i);
            if (feeMatch) {
              details.fee_amount = feeMatch[1];
              details.fee_currency = feeMatch[2];
            }

            // Extract network
            const networkMatch = text.match(/Network\s*\n?\s*([^\n]+)/i);
            if (networkMatch) {
              details.network = networkMatch[1].trim().replace(/^[^a-zA-Z]+/, '');
            }

            // Extract "You sent" (net amount after fee for withdrawals)
            const youSentMatch = text.match(/You sent\s*\n?\s*([0-9.]+)\s*([A-Z]+)/i);
            if (youSentMatch) {
              details.net_amount = youSentMatch[1];
            }

            // Extract To address (supports TON, BTC, ETH, TRX addresses)
            const toMatch = text.match(/To\s*\n?\s*([A-Za-z0-9_-]{20,})/i);
            if (toMatch) {
              details.to_address = toMatch[1];
            }

            // Also try extracting from "Recipient" field
            if (!details.to_address) {
              const recipientMatch = text.match(/Recipient\s*\n?\s*([A-Za-z0-9_-]{20,})/i);
              if (recipientMatch) {
                details.to_address = recipientMatch[1];
              }
            }

            // Try extracting address from explorer links if still not found
            if (!details.to_address) {
              const addressLinks = document.querySelectorAll('a[href*="tonviewer.com"], a[href*="tonscan.org"], a[href*="bscscan.com"], a[href*="etherscan.io"], a[href*="tronscan.org"]');
              for (const link of addressLinks) {
                const href = link.href;
                const addrMatch = href.match(/address\/([A-Za-z0-9_-]{20,})/);
                if (addrMatch) {
                  details.to_address = addrMatch[1];
                  break;
                }
              }
            }

            // Extract real blockchain tx hash from links
            const links = document.querySelectorAll('a[href*="tonviewer"], a[href*="tonscan"], a[href*="bscscan"], a[href*="etherscan"], a[href*="tronscan"]');
            for (const link of links) {
              const href = link.href;
              const hashMatch = href.match(/(?:transaction|tx)\/([a-zA-Z0-9:_-]{20,})/);
              if (hashMatch) {
                details.tx_hash = hashMatch[1];
                break;
              }
            }

            return details;
          }
        });

        detailsMap[tx.id] = detailResults[0]?.result || {};
        log(`Fetched details for ${tx.txType} ${tx.id.slice(0, 8)}...`);
      } catch (e) {
        log(`Error fetching ${tx.id}: ${e.message}`, 'error');
      }
    }

    // Navigate back to transactions
    log('Navigating back to transactions page...');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { window.location.href = 'https://app.send.tg/transactions'; }
    });

    // Phase 3: Generate CSV
    setStatus('Generating CSV...', 'info');
    log('Generating CSV...');

    let csv, filename;

    if (format === 'raw') {
      // Raw format - all collected data
      const rows = transactions.map(tx => {
        const details = detailsMap[tx.id] || {};
        const amt1 = tx.amounts[0] || {};
        const amt2 = tx.amounts[1] || {};

        return {
          ID: tx.id,
          Date: formatDomDate(tx.dateStr, tx.timeStr),
          Type: tx.type,
          'TX Type': tx.txType,
          'Amount 1': amt1.value || '',
          'Currency 1': amt1.currency || '',
          'Amount 2': amt2.value || '',
          'Currency 2': amt2.currency || '',
          'Fee Amount': details.fee_amount || '',
          'Fee Currency': details.fee_currency || '',
          'Net Amount': details.net_amount || '',
          Network: details.network || '',
          'To Address': details.to_address || '',
          TxHash: details.tx_hash || '',
          URL: `https://app.send.tg${tx.href}`
        };
      });

      rows.sort((a, b) => new Date(a.Date) - new Date(b.Date));
      csv = toRawCSV(rows);
      filename = `sendtg_raw_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      // Koinly format
      const rows = transactions.map(tx => {
        const details = detailsMap[tx.id] || {};
        const type = tx.type.toLowerCase();

        const row = {
          Date: formatDomDate(tx.dateStr, tx.timeStr),
          'Sent Amount': '',
          'Sent Currency': '',
          'Received Amount': '',
          'Received Currency': '',
          'Fee Amount': details.fee_amount || '',
          'Fee Currency': details.fee_currency || '',
          'Net Worth Amount': '',
          'Net Worth Currency': '',
          Label: '',
          Description: tx.type + (details.network ? ` | Network: ${details.network}` : '') + (details.to_address ? ` | To: ${details.to_address}` : ''),
          TxHash: details.tx_hash || ''
        };

        // Handle different transaction types
        if (type.includes('swap') || type.includes('exchange')) {
          const sent = tx.amounts.find(a => a.isNegative);
          const received = tx.amounts.find(a => !a.isNegative);
          if (sent) {
            row['Sent Amount'] = sent.value.replace('-', '');
            row['Sent Currency'] = sent.currency;
          }
          if (received) {
            row['Received Amount'] = received.value.replace('+', '');
            row['Received Currency'] = received.currency;
          }
        } else if (type.includes('buy') || type.includes('sell')) {
          const crypto = tx.amounts.find(a => ['TON', 'USDT', 'BTC', 'ETH', 'LTC', 'USDC', 'NOT'].includes(a.currency));
          const fiat = tx.amounts.find(a => ['RUB', 'UAH', 'USD', 'EUR', 'KZT'].includes(a.currency));

          if (type.includes('buy')) {
            if (crypto) {
              row['Received Amount'] = crypto.value.replace(/[+-]/g, '');
              row['Received Currency'] = crypto.currency;
            }
            if (fiat) {
              row['Sent Amount'] = fiat.value.replace(/[+-]/g, '');
              row['Sent Currency'] = fiat.currency;
            }
          } else {
            if (crypto) {
              row['Sent Amount'] = crypto.value.replace(/[+-]/g, '');
              row['Sent Currency'] = crypto.currency;
            }
            if (fiat) {
              row['Received Amount'] = fiat.value.replace(/[+-]/g, '');
              row['Received Currency'] = fiat.currency;
            }
          }
        } else {
          const amt = tx.amounts[0];
          if (amt) {
            const isReceived = !amt.isNegative || type.includes('deposit');
            const value = amt.value.replace(/[+-]/g, '');

            if (tx.txType === 'withdrawal') {
              row['Sent Amount'] = details.net_amount || value;
              row['Sent Currency'] = amt.currency;
              row.Label = 'transfer';
            } else if (tx.txType === 'deposit') {
              row['Received Amount'] = value;
              row['Received Currency'] = amt.currency;
              row.Label = 'transfer';
            } else if (tx.txType === 'check') {
              if (isReceived) {
                row['Received Amount'] = value;
                row['Received Currency'] = amt.currency;
              } else {
                row['Sent Amount'] = value;
                row['Sent Currency'] = amt.currency;
              }
              row.Label = 'gift';
            } else if (tx.txType === 'invoice') {
              row['Sent Amount'] = value;
              row['Sent Currency'] = amt.currency;
              row.Label = 'cost';
            } else {
              if (isReceived) {
                row['Received Amount'] = value;
                row['Received Currency'] = amt.currency;
              } else {
                row['Sent Amount'] = value;
                row['Sent Currency'] = amt.currency;
              }
            }
          }
        }

        return row;
      });

      rows.sort((a, b) => new Date(a.Date) - new Date(b.Date));
      csv = toKoinlyCSV(rows);
      filename = `sendtg_koinly_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    downloadCSV(csv, filename);

    hideProgress();
    setStatus(`Exported ${transactions.length} transactions with details!`, 'success');
    log(`Export complete! ${transactions.length} transactions saved to ${filename}`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message}`, 'error');
    log(`Export failed: ${error.message}`, 'error');
    hideProgress();
  }

  setButtons(true);
}

document.getElementById('exportRawBtn').addEventListener('click', () => exportAll('raw'));
document.getElementById('exportKoinlyBtn').addEventListener('click', () => exportAll('koinly'));
document.getElementById('stopBtn').addEventListener('click', () => {
  stopRequested = true;
  log('Stop requested...', 'warning');
});
document.getElementById('instructionsBtn').addEventListener('click', toggleInstructions);
