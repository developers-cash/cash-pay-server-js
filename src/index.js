import _ from 'lodash';
import axios from 'axios';
import SocketIO from 'socket.io-client';
import QRCode from 'qrcode';

import './cashpay.css'

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
      },
      webhooks: {}
    }, options);

    this._invoice = {
      params: Object.assign({}, {
          network: 'main',
          outputs: [],
      }, params),
    };
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
  async create(container) {
    if (container) {
      this._setupContainer(container);
    }
    
    let invoiceRes = await axios.post(this._options.endpoint+'/invoice/create', this._invoice.params);

    this._service = invoiceRes.data.service;
    this._invoice = invoiceRes.data.invoice;
    
    if (this._options.listen) {
      await this.listen();
    }
    
    this._options.on.created.forEach(cb => cb());

    return this;
  }

  /**
   * Setup WebSocket listener.
   * This should not need to be called manually
   */
  async listen() {
    var socket = SocketIO(this._service.webSocketURI);
    
    socket.on('connect', () => {
      socket.emit('subscribe', {
        invoiceId: this._invoice.id
      });
    });
    
    socket.on('subscribed', (msg) => {
      this._options.on.subscribed.forEach(cb => cb(msg));
    });
    
    socket.on('requested', (msg) => {
      this._invoice = msg.invoice;
      this._options.on.requested.forEach(cb => cb(msg));
    });
    
    socket.on('broadcasted', (msg) => {
      this._invoice = msg.invoice;
      this._options.on.broadcasted.forEach(cb => cb(msg));
    });
    
    socket.on('error', (msg) => {
      this._invoice = msg.invoice;
      this._options.on.error.forEach(cb => cb(msg));
    });

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
   * invoice.addAddress(
   *   "bitcoincash:qzeup9lysjazfvqnv07ns9c846aaul7dtuqqncf6jg",
   *   100000
   * );
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
  
  /**
   * Returns the QR Code URI (for easier embedding on client-side).
   * @example
   * invoice.getQrCodeURI()
   * // https://pay.bip70.cash/invoice/qrcode/5e5a332c356cbd08f218521a
   */
  getQRCodeURI() {
    return _.get(this, '_service.qrCodeURI', '');
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
   * TODO Sort this shit out
   */
  _setupContainer(container) {
    let img = document.createElement('img');
    img.style.width = '100%';
    img.style.height = '100%';
    img.src = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NDAgNjQwIj4KICA8Y2lyY2xlIGN4PSIzMjAiIGN5PSIzMjAiIHI9IjMyMCIgZmlsbD0iI2ZmZiIvPgogIDxjaXJjbGUgY3g9IjMyMCIgY3k9IjMyMCIgcj0iMjc4IiBmaWxsPSIjMDBjNThhIi8+CiAgPHBhdGggZmlsbD0iI2ZmZiIgZD0iTTI5Ni43IDQ0MS4yTDIzNiA0NTZsLTEtMzkgMTEuNC0zYzEzLjYtMy40IDE2LjgtMy44IDE2LjgtOSAwLTIuMy03LjgtMzUuNS0xNy42LTcyLjUtMjEuMi04MS42LTE5LTc3LjgtNDUuNC03MC42bC0xNCAzLjctOC0zMi40IDYxLjEtMTUuMi0xMy00OC4yIDMwLjctNy41IDEyLjggNDcuOSAyMS42LTUuNS0xMi00OC42IDMwLjctNy43IDEyLjcgNDkuMmMzNC4yLTEwLjkgNjguMyAwIDgyLjggMjguNiA4LjcgMjQuOSA4IDM2LjYtMTAgNjAuMyAxOC43IDUuMSA1NC42IDE0LjggNTYuNyA1OCAyLjEgNDMuMi0zOC40IDY4LjUtNzIgNzUuMmwxMiA0OC42LTMwLjMgOC0xMi00OC42LTIyIDUuNiAxMS40IDQ4LjYtMzAuMSA3LjZ6bTk3LTk4LjljLTguMy0zNi4yLTkxLjMtOS05MS4zLTlsMTUuNyA2My4zczg1LjgtMTAuMSA3NS42LTU0LjN6bS0zMi4yLTg3LjdjLTkuMi0zNy04Mi4zLTEwLTgyLjMtMTBsMTUuMyA1OHM3Ny41LTUuNSA2Ny00OHoiLz4KPC9zdmc+Cg==`;
    container.appendChild(img);
    
    let p = document.createElement('p');
    p.className = "cashpay-invoice-status";
    p.innerHTML = 'Creating invoice...';
    container.appendChild(p);
    
    this.on('created', async () => {
      img.src = await QRCode.toDataURL(this.getWalletURI());
      p.innerHTML = 'Awaiting payment...';
    });
    
    this.on('broadcasted', () => {
      img.src = 'data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJDYXBhXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAzNjcuODA1IDM2Ny44MDUiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDM2Ny44MDUgMzY3LjgwNTsiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8Zz4KCTxwYXRoIHN0eWxlPSJmaWxsOiMzQkI1NEE7IiBkPSJNMTgzLjkwMywwLjAwMWMxMDEuNTY2LDAsMTgzLjkwMiw4Mi4zMzYsMTgzLjkwMiwxODMuOTAycy04Mi4zMzYsMTgzLjkwMi0xODMuOTAyLDE4My45MDIKCQlTMC4wMDEsMjg1LjQ2OSwwLjAwMSwxODMuOTAzbDAsMEMtMC4yODgsODIuNjI1LDgxLjU3OSwwLjI5LDE4Mi44NTYsMC4wMDFDMTgzLjIwNSwwLDE4My41NTQsMCwxODMuOTAzLDAuMDAxeiIvPgoJPHBvbHlnb24gc3R5bGU9ImZpbGw6I0Q0RTFGNDsiIHBvaW50cz0iMjg1Ljc4LDEzMy4yMjUgMTU1LjE2OCwyNjMuODM3IDgyLjAyNSwxOTEuMjE3IDExMS44MDUsMTYxLjk2IDE1NS4xNjgsMjA0LjgwMSAKCQkyNTYuMDAxLDEwMy45NjggCSIvPgo8L2c+Cjwvc3ZnPg==';
      p.innerHTML = 'Payment received!';
    });
    
    this.on('error', () => {
      p.innerHTML = 'An error occurred';
    });
  }
}
