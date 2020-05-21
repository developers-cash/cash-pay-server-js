import _ from 'lodash';
import axios from 'axios';
import SocketIO from 'socket.io-client';
import QRCode from 'qrcode';

import template from './template.html';
import tick from './tick.svg';
import cross from './cross.svg';
import './cashpay.css';

/**
  * Payment Invoice
  * @example
  * let invoice = new Invoice({ // Parameters to send to Payment Server
  *   memo: 'Example Invoice',
  *   outputs: [ // Multiple Outputs are supported
  *     {
  *       address: "bitcoincash:qrhtcm743tttn9spked5y9709dva49t6s5axg730jf"
  *       amount: 100000 // Amount in Satoshis
  *     }
  *   ]
  * }, { // SDK Options
  *   endpoint: 'https://payment-service.developers.cash', // Default
  *   on: { // WebSocket Listeners
  *     subscribed: (event) => {
  *       // Websocket is ready and listening
  *     },
  *     requested: (event) => {
  *       // Payment has been requested
  *     },
  *     broadcasted: (event) => {
  *       // Payment has been broadcasted to the network 
  *     },
  *     error: (event) => {
  *       // An error occurred
  *     }
  *   }
  * });
  * 
  * // Create Invoice
  * await invoice.create();
  * 
  * // Output URI to Console
  * // You probably want to output this as a QR code and link.
  * console.log(invoice.getWalletURI);
  */
export class Invoice {
  constructor(options, params) {
    this._options = Object.assign({}, {
      endpoint: 'https://pay.infra.cash',
      listen: true,
      on: {
        created: [],
        connected: [],
        subscribed: [],
        requested: [],
        broadcasted: [],
        error: [],
        expires: [],
      }
    }, options);

    this._invoice = {
      params: Object.assign({}, {
          network: 'main',
          outputs: [],
          webhooks: {}
      }, params),
    };
    
    // These are computed variables
    this._instance = {};
  }

  /**
   * Create an instance and listen to Websocket events from an Invoice that
   * was created server-side. This is useful if you don't want the user to
   * be able to see private data associated with the invoice.
   * @example
   * Server-Side:
   * let invoice = new Invoice({
   *   outputs: [
   *     {
   *       address: ""
   *       amount: 100000
   *     }
   *   ]
   * });
   *
   * return JSON.stringify(invoice);
   *
   * Client-Side:
   * // let payload = http.get('endpoint-for-above-invoice');
   * let invoice = Invoice.fromExisting(payload);
   * // Websocket events will trigger client-side for above invoice
   */
  static async fromExisting(payload, options) {
    let invoice = new Invoice();
    invoice._options = Object.assign(payload.options, { listen: true }, options);
    invoice._invoice = payload.invoice;
    invoice._service = payload.service;

    if (invoice._options.listen) {
      await invoice.listen();
    }

    return invoice;
  }

  /**
   * Create the invoice.
   * This performs an AJAX request to the given server to create the invoice
   * and then sets up the Websocket listener so that the invoice is updated
   * in real-time.
   */
  async create(container, options) {
    if (container) {
      this._setupContainer(container, Object.assign({ margin: 0 }, options));
    }
    
    let invoiceRes = await axios.post(this._options.endpoint+'/invoice/create', this._invoice.params);

    this._service = invoiceRes.data.service;
    this._invoice = invoiceRes.data.invoice;
    
    // Setup expiry timer
    this._instance.expiryTimer = setInterval(() => {
      let expires = new Date(this._invoice.params.expires*1000).getTime();
      let now = new Date().getTime();
      let secondsRemaining = Math.round((expires - now) / 1000);
      this._options.on.expires.forEach(cb => cb(secondsRemaining));
    }, 1000);
    
    // If it has expired, stop listener and clear interva;
    this.on('expires', (secondsRemaining) => {
      if (!secondsRemaining) {
        
      }
    });
    
    if (this._options.listen) {
      await this._listen();
    }
    
    this._options.on.created.forEach(cb => cb());
    
    

    return this;
  }

  /**
   * Set memo
   * @param memo Memo text
   * @example
   * let invoice = new Invoice();
   * invoice.setMemo("Example payment");
   */
  setMemo(memo) {
    this._invoice.params.memo = memo;
    return this;
  }
  
  /**
   * Set Merchant Data
   * @param data Merchant Data
   * @example
   * let invoice = new Invoice();
   * invoice.setData("Example payment");
   */
  setData(data) {
    this._invoice.params.data = data;
    return this;
  }
  
  /**
   * The unit of fiat (e.g. USD) that will be displayed to the user
   * @param seconds Seconds from time of creation that Payment Request expires
   * @example
   * let invoice = new Invoice();
   * invoice.setExpiration(15 * 60); // 15 Minutes
   */
  setUserCurrency(currency) {
    this._invoice.params.userCurrency = currency;
    return this;
  }
  
  /**
   * Set expiration time
   * @param seconds Seconds from time of creation that Payment Request expires
   * @example
   * let invoice = new Invoice();
   * invoice.setExpiration(15 * 60); // 15 Minutes
   */
  setExpires(seconds) {
    this._invoice.params.expires = seconds;
    return this;
  }
  
  /**
   * Set Webhook
   * @param event The type of Webhook (requested, broadcasted, etc)
   * @param endpoint The endpoint that should be hit
   * @example
   * let invoice = new Invoice();
   * invoice.setWebhook("broadcasted", ');
   */
  setWebhook(event, endpoint) {
    this._invoice.params.webhooks[event] = endpoint;
    return this;
  }
  
  /**
   * Add an address output to Invoice.
   * @param address CashAddress
   * @param amount Amount in satoshis
   * @example
   * let invoice = new Invoice();
   * invoice.addAddress("bitcoincash:qzeup9lysjazfvqnv07ns9c846aaul7dtuqqncf6jg", 100000);
   * 
   * // Or specify a currency code for on-the-fly conversion
   * invoice.addAddress("bitcoincash:qzeup9lysjazfvqnv07ns9c846aaul7dtuqqncf6jg", "2.50USD");
   */
  addAddress(address, amount) {
    this._invoice.params.outputs.push({
      address: address,
      amount: amount || 0
    });

    return this;
  }

  /**
   * Add a script output to the Invoice.
   * @param script Raw output script
   * @param amount Amount in satoshis
   */
  addOutput(script, amount) {
    this._invoice.params.outputs.push({
      script: script,
      amount: amount || 0
    });
    
    return this;
  }
  
  /**
   * Add an event handler.
   * @param event Event to handle
   * @param callback Callback function
   */
  on(event, callback) {
    this._options.on[event].push(callback);
    return this;
  }

  /**
   * Returns the Wallet URI.
   * @example
   * invoice.getWalletURI()
   * // bitcoincash:?r=https://pay.bip70.cash/invoice/pay/5e5a332c356cbd08f218521a
   */
  getWalletURI() {
    return _.get(this, '_service.walletURI', '');
  }
  
  getTotalAmount() {
    return this._invoice.params.outputs.reduce((total, output) => total + output.amount, 0);
  }

  /**
   * Returns true if the payment details of this invoice have been requested.
   * If you are using a Reactive Framework (e.g. VueJS) you can render state based on this.
   */
  isRequested() {
    return _.get(this, '_invoice.state.requested');
  }

  /**
   * Returns true if the payment has been broadcasted to the network.
   * If you are using a Reactive Framework (e.g. VueJS) you can render state based on this.
   */
  isBroadcasted() {
    return _.get(this, '_invoice.state.broadcasted');
  }
  
  /**
   * Setup WebSocket listener.
   * This should not need to be called manually
   */
  async _listen() {
    this._instance.socket = SocketIO(this._service.webSocketURI);
    
    this._instance.socket.on('connect', () => {
      this._instance.socket.emit('subscribe', {
        invoiceId: this._invoice.id
      });
    });
    
    this._instance.socket.on('subscribed', (msg) => {
      this._options.on.subscribed.forEach(cb => cb(msg));
    });
    
    this._instance.socket.on('requested', (msg) => {
      this._invoice = msg.invoice;
      this._options.on.requested.forEach(cb => cb(msg));
    });
    
    this._instance.socket.on('broadcasted', (msg) => {
      this._invoice = msg.invoice;
      this._options.on.broadcasted.forEach(cb => cb(msg));
    });
    
    this._instance.socket.on('error', (msg) => {
      this._invoice = msg.invoice;
      this._options.on.error.forEach(cb => cb(msg));
    });

    return this;
  }
  
  /**
   * TODO Sort this shit out
   */
  _setupContainer(container, options) {
    options = Object.assign({
      color: '#14244c',
      scale: 12,
      margin: 0
    }, options);
    
    container.innerHTML = template;
    
    let qrCodeEl = container.querySelector('.cashpay-qr-code');
    let totalEl = container.querySelector('.cashpay-total');
    let totalFiatEl = container.querySelector('.cashpay-total-fiat');
    let expiresEl = container.querySelector('.cashpay-expires');
    let buttonEl = container.querySelector('.cashpay-button');
    let errorEl = container.querySelector('.cashpay-error');
    
    console.log(options.color);
    
    this.on('created', async () => {
      qrCodeEl.src = await QRCode.toDataURL(this.getWalletURI(), {
        color: {
          dark: options.color
        },
        scale: options.scale,
        margin: options.margin
      });
      totalEl.innerHTML = `${this.getTotalAmount()/100000000}BCH`;
      totalFiatEl.innerHTML = `${this._invoice.meta.userCurrencyTotal}${this._invoice.params.userCurrency}`;
      buttonEl.href = this.getWalletURI();
      buttonEl.innerHTML = 'Open in Wallet';
    });
    
    this.on('expires', (secondsRemaining) => {
      if (secondsRemaining) {
        let minutes = Math.floor(secondsRemaining / 60);
        let seconds = secondsRemaining % 60;
        expiresEl.innerHTML = `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
      } else {
        clearInterval(this._instance.expiryTimer);
        qrCodeEl.src = `data:image/svg+xml;base64,${btoa(cross.replace('#000', options.color))}`;
        buttonEl.removeAttribute('href');
        buttonEl.innerHTML = 'Expired';
        expiresEl.innerHTML = 'Invoice has Expired';
      }
    });
    
    this.on('broadcasted', () => {
      qrCodeEl.src = `data:image/svg+xml;base64,${btoa(tick.replace('#000', options.color))}`;
      buttonEl.removeAttribute('href');
      buttonEl.innerHTML = 'Payment Received';
      clearInterval(this._instance.expiryTimer);
      expiresEl.innerHTML = '';
    });
    
    this.on('error', (err) => {
      console.log(err);
      errorEl.innerHTML = 'An error occurred';
    });
  }
}
