const globals = require('./globals')

const _ = require('lodash')
const axios = require('axios')
const SocketIO = require('socket.io-client')
const QRCode = require('qrcode')

const template = require('../statics/template.html')
const tick = require('../statics/tick.svg')
const cross = require('../statics/cross.svg')

/**
  * Invoice
  *
  * Any field that is prefixed with an underscore is private and should
  * never be accessed directly.
  * Any field that is not prefixed by an underscore is considered public
  * and stable (hence there are no "getter" functions in this class).
  * Only use setters to modify the parameters of an invoice - do not set
  * values directly.
  */
class Invoice {
  constructor (options = {}, invoice = {}) {
    this._options = Object.assign({}, _.cloneDeep(globals.options), options)

    this.invoice = {
      options: Object.assign({}, _.cloneDeep(globals.invoice.options), invoice)
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
  static fromExisting (existingInvoice, options = {}) {
    const invoice = new Invoice()
    invoice.invoice = existingInvoice
    invoice._options = Object.assign({}, invoice._options, options)

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
   * Note if an ID is already allocated to the invoice, a new invoice is not
   * created.
   */
  async create (container, options) {
    if (container) {
      this._setupContainer(container, Object.assign({ margin: 0 }, options))
    }

    try {
      if (!this.invoice.id) {
        const invoiceRes = await axios.post(this._options.endpoint + '/invoice/create', this.invoice.options)
        this.invoice = invoiceRes.data
      }

      if (this._options.listen) {
        // Setup expiration timer
        if (this.invoice.details.behavior === 'normal') {
          this._setupExpirationTimer()
        }

        // Setup event listener for expired and broadcasted to stop Websocket listener
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
   * Get the raw invoice object
   */
  getPayload (fullPayload = false) {
    if (!fullPayload) {
      return _.omit(this.invoice, 'options')
    }

    return this.invoice
  }

  /**
   * Set memo
   * @param memo Memo text
   * @example
   * let invoice = new Invoice();
   * invoice.setMemo("Example payment");
   */
  setMemo (memo) {
    this.invoice.options.memo = memo
    return this
  }

  /**
   * Set Private Data
   * @param data Private Data
   * @example
   * // Expects a string
   * invoice.setPrivateData("Example payment");
   *
   * // Objects will be automatically cast to a string
   */
  setPrivateData (data) {
    if (typeof data === 'object') {
      data = JSON.stringify(data)
    }

    this.invoice.options.privateData = data
    return this
  }

  /**
   * The unit of fiat (e.g. USD) that will be displayed to the user
   * @param currency The currency code
   * @example
   * // Show amount in Australian Dollars
   * invoice.setUserCurrency('AUD')
   */
  setUserCurrency (currency) {
    this.invoice.options.userCurrency = currency
    return this
  }

  /**
   * Set expiration time
   * @param seconds Seconds from time of creation that Payment Request expires
   * @example
   * // 15 minutes
   * invoice.setExpiration(15 * 60)
   */
  setExpires (seconds) {
    this.invoice.options.expires = seconds
    return this
  }

  /**
   * Sets the Merchant Key
   *
   * This can be used to debug invoices. It essentially behaves like an API Key
   * of sorts. If you use this, you should add a point-of-contact so that the
   * CashPayServer admin can contact you if necessary (e.g. for breaking changes
   * or critical security vulnerabilities).
   * @example
   * invoice.setMerchantKey('https://t.me/yourname|SECURE_STRING')
   */
  setMerchantKey (key) {
    this._options.merchantKey = key
  }

  /**
   * Set Webhook
   * @param {Array|String} events The type of Webhook (requested, broadcasted, etc)
   * @param {String} endpoint The endpoint that should be hit
   * @example
   * let invoice = new Invoice();
   * invoice.setWebhook("broadcasted", ');
   */
  setWebhook (events, endpoint) {
    if (typeof events === 'string') {
      events = [events]
    }

    events.forEach(event => { this.invoice.options.webhooks[event] = endpoint })

    return this
  }

  /**
   * Add an address output to Invoice.
   * @param {String} address Bitcoin Cash address
   * @param {String|Number} amount Amount in satoshis or string with currency code suffix
   * @example
   * let invoice = new Invoice();
   * invoice.addAddress("bitcoincash:qzeup9lysjazfvqnv07ns9c846aaul7dtuqqncf6jg", 100000);
   *
   * // Or specify a currency code for on-the-fly conversion
   * invoice.addAddress("bitcoincash:qzeup9lysjazfvqnv07ns9c846aaul7dtuqqncf6jg", "2.50USD");
   */
  addAddress (address, amount) {
    this.invoice.options.outputs.push({
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
    this.invoice.options.outputs.push({
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
  /* hasOutput (address, amount) {
    const output = this.invoice.options.outputs.find(output => output.address === address)

    if (!output) {
      return false
    }

    return output.amount === amount
  } */

  /**
   * Make this invoice a static invoice
   * @param {object} opts Options for static invoice
   * @example
   * // Infinite re-use, no expiration
   * invoice.staticInvoice()
   *
   * // Re=usable ten times, valid until end of 2020
   * invoice.staticInvoice({
   *   quantity: 10,
   *   validUntil: "2020-12-31T01:00:00.992Z"
   * })
   */
  staticInvoice (opts) {
    this.invoice.options.behavior = 'static'
    this.invoice.options.static = opts

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
   * Setup WebSocket listener.
   * This should not need to be called manually
   */
  async _listen () {
    this._instance.socket = SocketIO(this.invoice.service.webSocketURI)

    this._instance.socket.on('connect', () => {
      this._instance.socket.emit('subscribe', {
        invoiceId: this.invoice.id
      })
    })

    this._instance.socket.on('subscribed', (msg) => {
      this._options.on.subscribed.forEach(cb => cb(msg))
    })

    this._instance.socket.on('requested', (msg) => {
      this.invoice = msg.invoice
      this._options.on.requested.forEach(cb => cb(msg))
    })

    this._instance.socket.on('broadcasted', (msg) => {
      this.invoice = msg.invoice
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
      const expires = new Date(this.invoice.details.expires * 1000).getTime()
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

    // Inject template (otherwise, assume it's already there)
    if (options.template) {
      container.innerHTML = options.template
    }

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
      qrCodeEl.src = await QRCode.toDataURL(this.invoice.service.walletURI, {
        color: {
          dark: options.color
        },
        scale: options.scale,
        margin: options.margin
      })

      // Set totals for BCH and Fiat
      totalFiatEl.innerText = `${this.invoice.details.meta.userCurrencyTotal}${this.invoice.details.meta.userCurrency}`

      // Only show in BCH if this is not a static invoice
      if (this.invoice.details.behavior === 'normal') {
        totalBCHEl.innerText = `${this.invoice.details.meta.satoshiTotal / 100000000}BCH`
      }

      // Set the button text and url
      buttonEl.innerText = options.lang.openInWallet
      buttonEl.href = this.invoice.service.walletURI

      // Show the subcontainer
      subContainerEl.style.display = 'block'
    })

    // Trigger on invoice broadcasted...
    this.on('broadcasted', () => {
      buttonEl.innerText = options.lang.paymentReceived
      buttonEl.classList.add('animate__pulse')

      // If this is a static invoice
      if (this.invoice.details.behavior === 'static') {
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
