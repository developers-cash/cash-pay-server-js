const _ = require('lodash')
const axios = require('axios')
const SocketIO = require('socket.io-client')
const QRCode = require('qrcode')

const template = require('../statics/template.html')
const tick = require('../statics/tick.svg')
const cross = require('../statics/cross.svg')

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
class Invoice {
  constructor (options, params) {
    this._options = Object.assign({}, {
      endpoint: 'https://pay.infra.cash',
      listen: typeof window !== 'undefined',
      on: {
        created: [],
        connected: [],
        subscribed: [],
        requested: [],
        broadcasted: [],
        expired: [],
        timer: [],
        failed: []
      }
    }, options)

    this._invoice = {
      params: Object.assign({}, {
        network: 'main',
        outputs: [],
        webhooks: {}
      }, params)
    }

    // These are computed variables
    this._instance = {}
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
  static fromExisting (existingInvoice, options) {
    const invoice = new Invoice()
    invoice._invoice = Object.assign(invoice._invoice, existingInvoice)
    invoice._options = Object.assign(invoice._options, options)

    return invoice
  }

  /**
   * Convenience function to create an invoice from the data returned from
   * the given endpoint.
   * @example
   * let invoice = CashPay.Invoice.fromServerEndpoint('/create-invoice', {
   *   invoiceId: "xxxx"
   * });
   *
   * await invoice.create(document.getElementById('invoice-container'))
   */
  static async fromServerEndpoint (endpoint, params, options) {
    const res = await axios.post(endpoint, params, options)
    return this.fromExisting(res.data)
  }

  /**
   * Create the invoice.
   * This performs an AJAX request to the given server to create the invoice
   * and then sets up the Websocket listener so that the invoice is updated
   * in real-time.
   */
  async create (container, options) {
    if (container) {
      this._setupContainer(container, Object.assign({ margin: 0 }, options))
    }

    try {
      if (!this._invoice.id) {
        const invoiceRes = await axios.post(this._options.endpoint + '/invoice/create', this._invoice.params)

        this._invoice.service = invoiceRes.data.service
        this._invoice = invoiceRes.data.invoice
      }

      if (this._options.listen) {
        // Setup expiration timer
        if (!this._invoice.params.static) {
          this._setupExpirationTimer()
        }

        // If it has broadcasted or expired, disconnect socket and clear timer
        this.on(['expired', 'broadcasted'], (secondsRemaining) => {
          clearInterval(this._instance.expiryTimer)
          this._instance.socket.disconnect(true)
        })

        await this._listen()
      }

      this._options.on.created.forEach(cb => cb())

      return this
    } catch (err) {
      this._options.on.failed.forEach(cb => cb(err))
      console.error(err)
      throw err
    }
  }

  /**
   * Get the invoiceID
   */
  getId () {
    return this._invoice.id
  }

  /**
   * Get the raw invoice object
   */
  getRawInvoice (omit) {
    return _.omit(this._invoice)
  }

  /**
   * Set memo
   * @param memo Memo text
   * @example
   * let invoice = new Invoice();
   * invoice.setMemo("Example payment");
   */
  setMemo (memo) {
    this._invoice.params.memo = memo
    return this
  }

  /**
   * Get memo
   */
  getMemo () {
    return this._invoice.params.memo
  }

  /**
   * Set Merchant Data
   * @param data Merchant Data
   * @example
   * let invoice = new Invoice();
   * invoice.setData("Example payment");
   */
  setData (data) {
    this._invoice.params.data = data
    return this
  }

  /**
   * Get merchant data
   */
  getData () {
    return this._invoice.params.data
  }

  /**
   * The unit of fiat (e.g. USD) that will be displayed to the user
   * @param seconds Seconds from time of creation that Payment Request expires
   * @example
   * let invoice = new Invoice();
   * invoice.setExpiration(15 * 60); // 15 Minutes
   */
  setUserCurrency (currency) {
    this._invoice.params.userCurrency = currency
    return this
  }

  /**
   * Get user currency
   */
  getUserCurrency () {
    return this._invoice_params.userCurrency
  }

  /**
   * Set expiration time
   * @param seconds Seconds from time of creation that Payment Request expires
   * @example
   * let invoice = new Invoice();
   * invoice.setExpiration(15 * 60); // 15 Minutes
   */
  setExpires (seconds) {
    this._invoice.params.expires = seconds
    return this
  }

  /**
   * Get epxiration time
   */
  getExpires () {
    return this._invoice.params.expires
  }

  /**
   * Set Webhook
   * @param events The type of Webhook (requested, broadcasted, etc)
   * @param endpoint The endpoint that should be hit
   * @example
   * let invoice = new Invoice();
   * invoice.setWebhook("broadcasted", ');
   */
  setWebhook (events, endpoint) {
    if (typeof events === 'string') {
      events = [events]
    }

    events.forEach(event => { this._invoice.params.webhooks[event] = endpoint })

    return this
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
  addAddress (address, amount) {
    this._invoice.params.outputs.push({
      address: address,
      amount: amount || 0
    })

    return this
  }

  /**
   * Add a script output to the Invoice.
   * @param script Raw output script
   * @param amount Amount in satoshis
   */
  addOutput (script, amount) {
    this._invoice.params.outputs.push({
      script: script,
      amount: amount || 0
    })

    return this
  }

  /**
   * Check if invoice contains a particular output
   * @param address The address to look for
   * @param amount The amount it must equal
   */
  hasOutput (address, amount) {
    const output = this._invoice.params.outputs.find(output => output.address === address)

    if (!output) {
      return false
    }

    return output.amount === amount
  }

  /**
   * Make this invoice a static invoice
   * @param quantity Number of re-uses allowed
   * @param expires How long this static invoice can be used for
   */
  staticInvoice () {
    this._invoice.params.static = true

    return this
  }

  /**
   * Add an event handler.
   * @param events Event to handle (or array of events)
   * @param callback Callback function
   */
  on (events, callback) {
    if (typeof events === 'string') {
      events = [events]
    }

    events.forEach(event => this._options.on[event].push(callback))

    return this
  }

  /**
   * Returns the Wallet URI.
   * @example
   * invoice.getWalletURI()
   * // bitcoincash:?r=https://pay.bip70.cash/invoice/pay/5e5a332c356cbd08f218521a
   */
  getWalletURI () {
    return _.get(this, '_invoice.service.walletURI', '')
  }

  getTotalAmount () {
    return this._invoice.state.outputs.reduce((total, output) => total + output.amount, 0)
  }

  /**
   * Returns true if the payment details of this invoice have been requested.
   * If you are using a Reactive Framework (e.g. VueJS) you can render state based on this.
   */
  isRequested () {
    return _.get(this, '_invoice.state.requested')
  }

  /**
   * Returns true if the payment has been broadcasted to the network.
   * If you are using a Reactive Framework (e.g. VueJS) you can render state based on this.
   */
  isBroadcasted () {
    return _.get(this, '_invoice.state.broadcasted')
  }

  /**
   * Setup WebSocket listener.
   * This should not need to be called manually
   */
  async _listen () {
    this._instance.socket = SocketIO(this._invoice.service.webSocketURI)

    this._instance.socket.on('connect', () => {
      this._instance.socket.emit('subscribe', {
        invoiceId: this._invoice.id
      })
    })

    this._instance.socket.on('subscribed', (msg) => {
      this._options.on.subscribed.forEach(cb => cb(msg))
    })

    this._instance.socket.on('requested', (msg) => {
      this._invoice = msg.invoice
      this._options.on.requested.forEach(cb => cb(msg))
    })

    this._instance.socket.on('broadcasted', (msg) => {
      this._invoice = msg.invoice
      this._options.on.broadcasted.forEach(cb => cb(msg))
    })

    this._instance.socket.on('failed', (msg) => {
      this._options.on.failed.forEach(cb => cb(msg))
    })

    return this
  }

  /**
   * Setup expiration timer
   */
  _setupExpirationTimer () {
    this._instance.expiryTimer = setInterval(() => {
      const expires = new Date(this._invoice.state.expires * 1000).getTime()
      const now = new Date().getTime()
      const secondsRemaining = Math.round((expires - now) / 1000)

      if (secondsRemaining) {
        this._options.on.timer.forEach(cb => cb(secondsRemaining))
      } else {
        this._options.on.expired.forEach(cb => cb())
      }
    }, 1000)
  }

  /**
   * TODO Sort this shit out
   */
  _setupContainer (container, options) {
    options = Object.assign({
      color: '#14244c',
      scale: 12,
      margin: 0,
      template: template,
      lang: {
        openInWallet: 'Open in Wallet',
        expiresIn: 'Expires in ',
        invoiceHasExpired: 'Invoice has expired',
        expired: 'Expired',
        paymentReceived: 'Payment received'
      }
    }, options)

    // Inject template
    container.innerHTML = options.template

    // Find container elements
    const subContainerEl = container.querySelector('.cashpay-container')
    const qrCodeEl = container.querySelector('.cashpay-qr-code')
    const totalBCHEl = container.querySelector('.cashpay-total-bch')
    const totalFiatEl = container.querySelector('.cashpay-total-fiat')
    const expiresEl = container.querySelector('.cashpay-expires')
    const buttonEl = container.querySelector('.cashpay-button')
    const errorEl = container.querySelector('.cashpay-error')

    // Trigger on invoice creation...
    this.on('created', async () => {
      // Render QR Code
      qrCodeEl.src = await QRCode.toDataURL(this.getWalletURI(), {
        color: {
          dark: options.color
        },
        scale: options.scale,
        margin: options.margin
      })

      // Set totals for BCH and Fiat
      totalFiatEl.innerText = `${this._invoice.state.totals.userCurrency}${this._invoice.params.userCurrency}`

      // Only show in BCH if this is not a static invoice
      if (!this._invoice.params.static) {
        totalBCHEl.innerText = `${this.getTotalAmount() / 100000000}BCH`
      }

      // Set the button text and url
      buttonEl.innerText = options.lang.openInWallet
      buttonEl.href = this.getWalletURI()

      // Show the subcontainer
      subContainerEl.style.display = 'block'
    })

    // Trigger on invoice broadcasted...
    this.on('broadcasted', () => {
      buttonEl.innerText = options.lang.paymentReceived
      buttonEl.classList.add('animate__pulse')

      // If this is a static invoice
      if (this._invoice.params.static) {
        setTimeout(() => {
          buttonEl.innerText = options.lang.openInWallet
          buttonEl.classList.remove('animate__pulse')
        }, 5000)
      } else { // Otherwise...
        qrCodeEl.src = `data:image/svg+xml;base64,${btoa(tick.replace('#000', options.color))}`
        qrCodeEl.classList.add('animate__pulse')
        buttonEl.removeAttribute('href')
        expiresEl.innerText = ''
      }
    })

    // Trigger on invoice expiry
    this.on('expired', () => {
      qrCodeEl.src = `data:image/svg+xml;base64,${btoa(cross.replace('#000', options.color))}`
      qrCodeEl.classList.add('animate__pulse')
      buttonEl.removeAttribute('href')
      buttonEl.innerText = options.lang.expired
      buttonEl.classList.add('animate__pulse')
      expiresEl.innerText = options.lang.invoiceHasExpired
    })

    // Trigger each time expiration timer updates
    this.on('timer', (secondsRemaining) => {
      const minutes = Math.floor(secondsRemaining / 60)
      const seconds = secondsRemaining % 60
      expiresEl.innerText = `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`
    })

    // Trigger on failed
    this.on('failed', (err) => {
      errorEl.innerText = err.message
    })
  }
}

module.exports = Invoice
