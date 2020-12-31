
# Cash-Pay-Server-JS

Javascript/Node library for use with Cash Pay Server.

Documentation: [https://developers-cash.github.io/cash-pay-server-js/](https://developers-cash.github.io/cash-pay-server-js/)

## Quick Start

Include the `cash-pay-server-js` NPM package in your project.

```bash
npm install @developers.cash/cash-pay-server-js --save
```

... or alternatively, load it from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@developers.cash/cash-pay-server-js/dist/cashpay.min.js"></script>
```

Server-side Code for creating and marking as paid:

```javascript
const CashPay = require('@developers-cash/cash-pay-server-js')

// ...

// Create invoice 
async function requestInvoice(req, res) {
  try {
    // Do things - get list of items in order, calculate totals, etc
    // req.body.items

    // Create the invoice
    let invoice = new CashPay.Invoice()
      .setAPIKey('someRandomString') // Optional (but allows use of Admin Interface)
      .addAddress('bitcoincash:qz8dt7dlwkc5n4x9u6gclfwte8lr7n58gyavxt0vmp', "0.25USD")
    await invoice.create()
    
    // Save invoiceId to database, etc
    // const invoiceId = invoice.id

    // Return payload to client-side (ExpressJS Example)
    return res.send(invoice.payload())
  } catch (err) {
    return res.send(err)
  }
}

// Mark invoice as paid
async function invoicePaid(req, res) {
  try {
    // Verify signature of event (to prevent spoofing)
    await CashPay.Signatures.verifyEvent(req.body.event)
    
    // Do things - mark as paid in database, etc
    if (req.body.event.event === 'broadcasted') {
      // const invoiceId = event.invoice.id
    }
    
    return res.send({ status: 'ok' })
  } catch (err) {
    return res.send(err)
  }
}
```

Render the created invoice on your client-side

```html
<!-- head -->
<script src="https://cdn.jsdelivr.net/npm/@developers.cash/cash-pay-server-js/dist/cashpay.min.js"></script>
<!-- Or if using NPM, use the browser optimized version -->
<!-- const CashPay = require('@developers.cash/cash-pay-server-js/browser')

<!-- body -->
<div id="invoice-container"></div>

<script>
async function fetchInvoice() {
  // Request invoice from server endpoint
  let invoice = new CashPay.Invoice()
    .intoContainer(document.getElementById('invoice-container'))
    .on(['broadcasted'], e => {
      axios.post('https://api.yoursite.com/invoice-paid', {
        event: e
      })
    })

  // Fetch the invoice that we created on the server-side
  await invoice.createFrom('https://api.yoursite.com/request-invoice', {
    items: ['ITEM_001', 'ITEM-002']
  })
}

fetchInvoice()
</script>
```

The default template uses inline SVG's and can be styled using CSS:

```css
#invoice-container {
  margin: auto;
  max-width: 150px;
  font-size: 0.8em;
}

.cashpay-loading {
  fill: #00c58a !important;
}

.cashpay-tick {
  fill: #00c58a !important;
}

.cashpay-cross {
  fill: #F00 !important;
}
```

## Webhooks

Webhooks are also available. Using Webhooks instead of the Websocket Events generally provides more resilience
over passing Websocket events to the server-side, but are also more difficult to implement as they require
a public facing URL.

```javascript
async function requestInvoice(req, res) {
  // ...
  // It's recommended to include "broadcasting" even if you do not use it explicitly.
  // If your server is down and the "broadcasting" hook fails - the payment will not be broadcasted.
  invoice.setWebhook('https://api.your-site.com/webhook-endpoint', ['broadcasting', 'broadcasted', 'confirmed'])
  // ...
}

async function webhookEndpoint(req, res) {
  try {
    // Verify signature of event (to prevent spoofing) - or check API Key if you don't want to play with signatures
    await CashPay.Signatures.verifyWebhook(req.body, req.headers)
    
    // TODO You'll also want to check the InvoiceID to make sure YOU created this invoice
    
    if (req.body.event === 'broadcasted') {
      // Do things - mark as paid in database, etc
      
      // If a JSON response is given, you can modify "data" and "privateData" on the invoice.
      // 'data' will be available in the corresponding Websocket Event in the browser.
      return res.send({
        data: JSON.stringify({
          redirectURL: 'https://your-site.com/link-to-some-secure-file.mp4'
        })
        privateData: 'SomeOtherData'
      })
    }
    
    if (req.body.event === 'confirmed') {
      // Do things - mark as confirmed in database, etc
    }
    
    res.send({ status: 'OK' })
  } catch (err) {
    return res.send(err)
  }
}
```

Webhooks that do not give a 200 status code are considered failures.

## Using a different CashPayServer Instance

See documentation about [Self-Hosting](https://developers-cash.github.io/cash-pay-server/).

```javascript
const CashPay = require('@developers-cash/cash-pay-server-js')

CashPay.config.options.endpoint = 'https://pay.your-instance.com'

```

## Creating an Invoice Client-Side

Invoices can also be created directly in the browser.

Note that creating the invoice in the browser is insecure for most use-cases.

However, it can be useful for testing.

```html
<!-- head -->
<script src="https://cdn.jsdelivr.net/npm/@developers.cash/cash-pay-server-js/dist/cashpay.min.js"></script>
<!-- Or if using NPM, use the browser optimized version -->
<!-- const CashPay = require('@developers.cash/cash-pay-server-js/browser')

<!-- body -->
<div id="invoice-container"></div>

<script>
// Create the invoice
async function createInvoice() {
  let invoice = new CashPay.Invoice()
    .intoContainer(document.getElementById('invoice-container'))
    .addAddress('bitcoincash:qz8dt7dlwkc5n4x9u6gclfwte8lr7n58gyavxt0vmp', "0.25USD")
  await invoice.create()
}

createInvoice()
</script>
```

## Other common use-cases

```javascript
// Setting API Key across all new invoices
CashPay.config.invoice.apiKey = 'someRandomString'

// Changing the expiry time on an invoice
invoice.setExpires(60*5) // Five minutes

// Set the memo that the user sees in wallet
invoice.setMemo('Please confirm your order')

//Set Merchant Data (as per BIP70 spec)
invoice.setMerchantData(JSON.stringify({
  someWalletFeature: true
}))

// Set Public Data (will be available in WebSocket events - i.e. not private)
invoice.setData("InvoiceID:1000") // String
invoice.setData({
  redirectURL: '/gated-content/some-page'
})

// Set Private Data (only accessible through Admin and Webhooks)
invoice.setPrivateData("Some String") // String
invoice.setPrivateData({ some: "String"}) // Objects will be cast to a string

// Set user currency (Currency equivalent of BCH will be shown on rendered invoice)
invoice.setUserCurrency('AUD') // Australian Dollars
```

## Issues/Feature Requests

Please submit any issues with the library to the [Github Repo's Issues Tracker](https://github.com/developers-cash/cash-pay-server-js/issues).

I'm also contactable on Telegram via [https://t.me/jimtendo](https://t.me/jimtendo)
