# BIP70.Cash

A Bitcoin Cash service to take the hassle out of receiving BIP70 payments. Tested with:

- Electron Cash
- Bitcoin.com Wallet

## Usage

Include the bip70cash NPM package in your project.

```
npm install bip70cash --save
```

... or alternatively, load it from a CDN:

```
Coming soon.
```

Then just simply create an invoice:

```
const BIP70Invoice = require('bip70cash');

// ...

let invoice = await BIP70Invoice({
  address: 'bitcoincash:qz2fn6wwwxs2wcdf9cfdhv4ln0qvjadg6csjcjasuf',
  amount: 10000,
  on: {
    requested: (invoice) => {
      console.log('Payment request has been received');
    },
    broadcasted: (invoice) => {
      console.log('Payment request has been broadcasted');
    }
  }
});
```

The bip70cash package will automatically check to see if the payment has been broadcasted and gives you hooks to work with.

Alternatively, if you're using a Reactive Framework like Vue, you can also check the state directly.

```
<div v-if="invoice && !invoice.state.broadcasted">
  <qrcode :value="invoice.walletURI" />
</div>
<div v-if="invoice && invoice.state.broadcasted">
  <q-icon name="check_circle_outline" class="text-primary" style="font-size:400px;" />
</div>
```

## Options

The bip70cash package allows you to specify additional options:

```
let invoice = await BIP70Invoice({
  // Address you wish to send to
  address: 'bitcoincash:qz2fn6wwwxs2wcdf9cfdhv4ln0qvjadg6csjcjasuf',

  // Amount to send to (in satoshis)
  amount: 10000,
  
  // Or you can specify multiple outputs (the above is just shorthand)
  outputs: [
    {
      address: 'bitcoincash:qz2fn6wwwxs2wcdf9cfdhv4ln0qvjadg6csjcjasuf',
      amount: 10000
    },
    {
      address: 'bitcoincash:qz2fn6wwwxs2wcdf9cfdhv4ln0qvjadg6csjcjasuf',
      amount: 1000
    },
    // You can also attach a script
    // NOTE: DOES NOT WORK WITH BITCOIN.COM WALLET (TESTED AS OF 2020-01-10)
    {
      "script": "OP_RETURN 14 0x68656c6c6f20776f726c64212121"
    }
  ],
  
  // Callback hooks for events
  on: {
    requested: (invoice) => {
      console.log('Payment request has been received');
    },
    broadcasted: (invoice) => {
      console.log('Payment request has been broadcasted');
    }
  },
  
  // Receive a Webhook when a wallet retrieves information about this invoice (Payment Request)
  requestedWebhook: "http://webhook.site/ce7174b4-ce9f-41de-81b6-f7aafbbcb14f",
  
  // Receive a Webhook when the transaction is broadcasted
  broadcastedWebhook: "http://webhook.site/ce7174b4-ce9f-41de-81b6-f7aafbbcb14f",
  
  // Receive a Webhook when an error occurs
  errorWebhook: "http://webhook.site/ce7174b4-ce9f-41de-81b6-f7aafbbcb14f",
  
  // Many wallets don't implement BIP70 correctly. Some workarounds have been implemented to handle this.
  // This parameter should be used for Wallet Testing and the errorWebhook above intends to complement it:
  workarounds: false
});
```
