
# Cash-Pay-Server-JS

Javascript library for use with Cash Pay Servers.

## Usage

Include the `cash-pay-server-js` NPM package in your project.

```bash
npm install @developers.cash/cash-pay-server-js --save
```

... or alternatively, load it from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@developers.cash/cash-pay-server-js/dist/cashpay.min.js"></script>
```

Create an invoice on your server-side:

```javascript
const CashPay = require('cash-pay-server-js')

// ...

// Create invoice
let invoice = new CashPay.Invoice()
  .addAddress('bitcoincash:qz8dt7dlwkc5n4x9u6gclfwte8lr7n58gyavxt0vmp', "0.25USD")
  .setPrivateData({ invoiceId: 'ABC123' })
  .setWebhook(['broadcasting', 'broadcasted'], 'https://webhook.site/63295fd3-132c-45ac-a198-d26e1abdef19')
await invoice.create()

// Return payload to client-side
return invoice.payload()
```

Render the created invoice on your client-side

```javascript
// Request invoice from server endpoint
let invoice = await CashPay.Invoice.fromServerEndpoint('./request-invoice', {
  // Params to pass to server-side
})

invoice.on(['broadcasting', 'broadcasted'], e => {
  // Do something when invoice has been paid paid
  console.log(e)
})

// Render the default Invoice UI in a HTML container
await invoice.create(document.getElementById('invoice-container'))
```

If you need to mark the invoice as paid in your backend database (or similar), setup a Webhook endpoint:

```javascript
const CashPay = require('cash-pay-server-js')

// Add the CashPayServer you're using as trusted
let webhook = new CashPay.Webhook()
await webhook.addTrusted('https://pay.infra.cash')

//
// HTTP POST /webhook endpoint
//
await webhook.verifySignature(req.body, req.headers)

// Save to server (or similar)
console.log(req.body)
```

For more in-depth guides, see the following resources:

[Guides](https://github.com/developers-cash/cash-pay-server-resources/tree/master/guide)
[Javascript API](https://github.com/developers-cash/cash-pay-server-resources/blob/master/api/cash-pay-server-js.md)
