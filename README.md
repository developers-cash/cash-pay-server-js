
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
    // Do things - get list of items in order, etc

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
<!-- Or install via NPM -->

<!-- body -->
<div id="invoice-container"></div>

<script>
async function fetchInvoice() {
  // Request invoice from server endpoint
  let invoice = await CashPay.Invoice.fromServerEndpoint('https://api.yoursite.com/request-invoice', {
    // Optional POST params to pass to server-side
    // items: [ ... ]
  })

  // Setup event listener for broadcasted event
  invoice.on(['broadcasted'], e => {
    axios.post('https://api.yoursite.com/invoice-paid', {
      event: e
    })
    
    invoice.destroy()
  })

  // Render the default Invoice UI in a HTML container
  await invoice.create(document.getElementById('invoice-container'))
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

#invoice-container .cashpay-tick {
  fill: #00c58a !important;
}

#invoice-container .cashpay-cross {
  fill: #F00 !important;
}
```

## Webhooks

Webhooks are also available.

```javascript
async function requestInvoice(req, res) {
  // ...
  invoice.setWebhook('https://api.your-site.com/webhook-endpoint', ['confirmed'])
  // ...
}

async function webhookEndpoint(req, res) {
  try {
    await CashPay.Signatures.verifyWebhook(req.body, req.headers)
    
    // Do things - mark as confirmed, etc
    
    // If a JSON response is given, you can modify "data" and "privateData" on the invoice
    res.send({
      data: "SomeData",
      privateData: "SomeOtherData"
    })
  } catch (err) {
    return res.send(err)
  }
}
```

Webhooks that do not give a 200 status code are considered failures.

## Using a different CashPayServer Instance

See documentation about [Self-Hosting](https://developers-cash.github.io/cash-pay-server-js/).

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

<!-- body -->
<div id="invoice-container"></div>

<script>
// Create the invoice
async function createInvoice() {
  let invoice = new CashPay.Invoice()
    .addAddress('bitcoincash:qz8dt7dlwkc5n4x9u6gclfwte8lr7n58gyavxt0vmp', "0.25USD")
  await invoice.create(document.getElementById('invoice-container'))
}

createInvoice()
</script>
```

## Other common use-cases

```javascript
// Changing the expiry time on an invoice
invoice.setExpires(60*5) // Five minutes

// Set the memo that the user sees
invoice.setMemo('Please confirm your order')

//Set Merchant Data (as per BIP70 spec)
invoice.setMerchantData(JSON.stringify({
  someWalletFeature: true
}))

// Set Public Data (will be available in WebSocket events - i.e. not private)
invoice.setData("InvoiceID:1000") // String
invoice.setData({
  redirectURL: '/download/someSecureFile.mp4'
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
