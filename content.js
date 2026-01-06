// Content script to extract transaction details from detail pages

function extractTransactionDetails() {
  const details = {
    url: window.location.href,
    extracted: {}
  };

  // Parse URL to get transaction type and ID
  const urlMatch = window.location.pathname.match(/\/transactions\/(withdrawal|deposit|check|market|invoice)\/([^/?]+)/);
  if (urlMatch) {
    details.type = urlMatch[1];
    details.id = urlMatch[2];
  }

  // Wait for content to load and extract from DOM
  const rows = document.querySelectorAll('[class*="InfoRow"], [class*="info-row"], tr, div[class*="row"]');

  // Extract all text content that looks like key-value pairs
  const infoContainer = document.querySelector('[class*="Transaction"], [class*="transaction"], main, [class*="content"]');
  if (infoContainer) {
    const text = infoContainer.innerText;

    // Extract fee
    const feeMatch = text.match(/Fee[:\s]+([0-9.]+)\s*([A-Z]+)/i);
    if (feeMatch) {
      details.extracted.fee_amount = feeMatch[1];
      details.extracted.fee_currency = feeMatch[2];
    }

    // Extract transaction hash
    const txHashMatch = text.match(/Transaction[:\s]+([a-zA-Z0-9]{8,})/i);
    if (txHashMatch) {
      details.extracted.tx_hash = txHashMatch[1];
    }

    // Extract network
    const networkMatch = text.match(/Network[:\s]+([^\n]+)/i);
    if (networkMatch) {
      details.extracted.network = networkMatch[1].trim();
    }

    // Extract destination address (To field)
    const toMatch = text.match(/To[:\s]+([a-zA-Z0-9]{10,})/i);
    if (toMatch) {
      details.extracted.to_address = toMatch[1];
    }

    // Extract "You sent" amount (actual amount after fee)
    const youSentMatch = text.match(/You sent[:\s]+([0-9.]+)\s*([A-Z]+)/i);
    if (youSentMatch) {
      details.extracted.net_amount = youSentMatch[1];
      details.extracted.net_currency = youSentMatch[2];
    }
  }

  // Try to get links for tx hash
  const links = document.querySelectorAll('a[href*="tonviewer"], a[href*="tonscan"], a[href*="bscscan"], a[href*="etherscan"]');
  links.forEach(link => {
    const href = link.href;
    if (href.includes('transaction/') || href.includes('tx/')) {
      const hashMatch = href.match(/(?:transaction|tx)\/([a-zA-Z0-9]+)/);
      if (hashMatch) {
        details.extracted.tx_hash = hashMatch[1];
      }
    }
  });

  return details;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractDetails') {
    // Give page time to fully render
    setTimeout(() => {
      const details = extractTransactionDetails();
      sendResponse(details);
    }, 500);
    return true; // Keep channel open for async response
  }
});

// Auto-extract and store when page loads (for detailed export)
if (window.location.pathname.includes('/transactions/')) {
  setTimeout(() => {
    const details = extractTransactionDetails();
    if (details.id) {
      chrome.storage.local.get(['transactionDetails'], (result) => {
        const stored = result.transactionDetails || {};
        stored[details.id] = details.extracted;
        chrome.storage.local.set({ transactionDetails: stored });
      });
    }
  }, 1000);
}
