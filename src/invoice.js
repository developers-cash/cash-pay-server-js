const config = require('./config')

const _ = require('lodash')
const axios = require('axios')
const SocketIO = require('socket.io-client')
const QRCode = require('qrcode')

const template = require('../statics/template.html')
const tick = require('../statics/tick.svg')
const cross = require('../statics/cross.svg')

/**
  * A Cash Payment Server Invoice
  *
  * Any field that is prefixed with an underscore is private and should
  * never be accessed directly.
  * Any field that is not prefixed by an underscore is considered public
  * and stable (hence there are no "getter" functions in this class).
  * Only use setters to modify the parameters of an invoice - do not set
  * values directly.
  * @param {object} opts Options for invoice instance (use setters instead)
  * @param {object} invoice Invoice properties (use setters instead)
  * @example
  * //
  * // Server-side
  * //
  * let invoice = new CashPay.Invoice()
  *   .setMerchantKey('your.site|SOMRTHING_RANDOM_123')
  *   .addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1USD')
  *   .setWebhooks(['broadcasting', 'broadcasted', 'confirmed'], 'https://webhook.site/1aa1cc3b-8ee8-4f70-a4cd-abc0c9b8d1f2')
  * await invoice.create()
  * 
  * // Send Payload JSON to browser
  * return invoice.getPayload()
  * 
  * //
  * // Client-side
  * //
  * let invoice = await CashPay.Invoice.fromServerEndpoint('your-endpoint-above')
  * invoice.on(['broadcasting', 'broadcasted'], (event) {
  *   console.log(event)
  * })
  * invoice.create(document.getElementById('invoice-container'))
  */
class Invoice {
  constructor (opts = {}, invoice = {}) {
    /**
     * ID of the invoice
     * 
     * Only accessible once invoice is created and should not be mutated directly.
     * @example
     * let invoice = new Invoice()
     *  .addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1USD')
     * await invoice.create()
     * 
     * console.log(invoice.id)
     */
    this.id = null
    
    /**
     * Details of the invoice
     * 
     * Only accessible once invoice is created and should not be mutated directly.
     * 
     * An example of properties available is provided below.
     * @example
     * {
     *   "behavior": String, // "normal" or "static" for Static Invoice
     *   "network": String, // "main" or "testnet"
     *   "time": Number, // Unix timestamp of Invoice creation
     *   "expires": Number, // Unix timestamp of when Invoice expires
     *   "outputs": [], // Outputs of transaction
     *   "memo": String, // Memo of transaction
     *   "meta": { // Meta information about the invoice (e.g. totals
     *     "satoshiTotal": Number,
     *     "baseCurrency": String,
     *     "baseCurrencyTotal": Number,
     *     "userCurrency": String,
     *     "userCurrencyTotal": Number,
     *   }
     *   "txIds": [String], // Array of Strings
     * }
     */
    this.details = {}
    
    /**
     * State of the invoice
     * 
     * This can be used in reactive applications to render UI state.
     * 
     * Only accessible once invoice is created and should not be mutated directly.
     * 
     * An example of properties available is provided below.
     * @example
     * {
     *   "events": { // Dates for when these events first occurred on the invoice
     *     "requested": Date,
     *     "broadcasting": Date,
     *     "broadcasted": Date,
     *     "confirmed": Date
     *   },
     *   "static": { // If this is a static invoice, these properties will be available
     *     "quantityUsed": Number
     *   }
     * }
     */
    this.state = {}
    
    /**
     * Service URL's for this invoice
     * 
     * Only accessible once invoice is created and should not be mutated directly.
     * 
     * An example of properties available is provided below.
     * @example
     * {
     *   "paymentURI": String,
     *   "stateURI": String,
     *   "walletURI": String,
     *   "webSocketURI": String,
     * }
     */
    this.service = {}
    
    /**
     * Options that will be passed to the CashPayServer upon invoice creation
     * 
     * @example
     * {
     *   behavior: { type: String, default: 'normal' },
     *   network: { type: String, default: 'main' },
     *   outputs: [{ amount: String, address: String, script: String }],
     *   expires: Number,
     *   memo: String,
     *   merchantKey: { type: String, index: true },
     *   privateData: String,
     *   static: {
     *     validUntil: Date,
     *     quantity: Number
     *   },
     *   userCurrency: { type: String, default: 'USD' },
     *   webhooks: {
     *     requested: String,
     *     broadcasting: String,
     *     broadcasted: String,
     *     confirmed: String,
     *     error: String
     *   }
     * }
     */
    this.options = Object.assign({ static: {} }, _.cloneDeep(config.invoice), invoice)
    
    this._instance = Object.assign({}, _.cloneDeep(config.options), opts)
  }

  /**
   * Create an instance from an existing invoice.
   * 
   * This should be used if, for example, the invoice is being created from a server-side endpoint.
   * @param {object} existingInvoice The existing invoice (created from the server-side)
   * @param {object} options List of options to set upon creation.
   * @example
   * let invoice = CashPay.Invoice.fromExisting(invoicePayload)
   * await invoice.create(document.getElementById('invoice-container'))
   */
  static fromExisting (existingInvoice, options = {}) {
    const invoice = new Invoice()
    Object.assign(invoice, existingInvoice)
    invoice._options = Object.assign({}, invoice._options, options)

    return invoice
  }

  /**
   * Convenience function to create an invoice from the data returned from
   * the given server-side endpoint.
   * @param {string} endpoint The endpoint to retreive the invoice from
   * @param {object} params The parameters to pass to the endpoint
   * @param {object} options The options to specify (see axios.post options)
   * @example
   * let invoice = CashPay.Invoice.fromServerEndpoint('/create-invoice', {
   *   orderId: "xxxx"
   * });
   *
   * await invoice.create(document.getElementById('invoice-container'))
   */
  static async fromServerEndpoint (endpoint, params, options) {
    const res = await axios.post(endpoint, params, options)
    return this.fromExisting(res.data)
  }
  
  /**
   * Add an event handler.
   * 
   * Most of these events will be sent by the WebSocket connection.
   * 
   * Supported events are:
   * 
   * "created", "broadcasting", "broadcasted", "expired", "failed"
   * @param {(string|array)} events Event to handle (or array of events)
   * @param callback Callback function
   * @example
   * // Add listener for failed event
   * let invoice = new CashPay.Invoice()
   *   .addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1AAAA')
   *   .on('failed', (err) {
   *     alert(err.message)
   *   }
   * 
   * // Add event listener for broadcasting and broadcasted event
   * let invoice = new CashPay.Invoice()
   *   .addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1AAAA')
   *   .on(['broadcasting', 'broadcasted'], (event) {
   *     console.log(event)
   *   }
   */
  on (events, callback) {
    if (typeof events === 'string') {
      events = [events]
    }

    events.forEach(event => this._instance.on[event].push(callback))

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
    this.options.outputs.push({
      address: address,
      amount: amount || 0
    })

    return this
  }

  /**
   * Add a script output to the Invoice.
   * 
   * Note that this is not supported by JSONPaymentProtocol.
   * @param {string} script Raw output script (in hexadecimal)
   * @param {number} [amount=0] Amount in satoshis
   * @example
   * // Set OP_RETURN data to "EXAMPLE_OP_RETURN_DATA"
   * invoice.addOutput('6a164558414d504c455f4f505f52455455524e5f44415441')
   */
  addOutput (script, amount = 0) {
    this.options.outputs.push({
      script: script,
      amount: amount
    })

    return this
  }
  
  /**
   * Set expiration time
   * @param {number} seconds Seconds from time of creation that Payment Request expires
   * @example
   * // 15 minutes
   * invoice.setExpiration(15 * 60)
   */
  setExpires (seconds) {
    this.options.expires = seconds
    return this
  }
  
  /**
   * Sets the Merchant Key
   *
   * If a Merchant sets this key, it gives them elevated access to an invoice meaning they
   * can use this later to retrieve a list of invoices (with this key set) that failed and
   * manually re-trigger the sending of Webhooks.
   * @example
   * invoice.setMerchantKey('https://t.me/yourname|SECURE_STRING')
   */
  setMerchantKey (key) {
    this._instance.merchantKey = key
  }

  /**
   * Sets a BIP70/JPP memo
   * @param {string} memo Memo text
   * @example
   * // Memos are not supported by all wallets
   * invoice.setMemo("Payment to YOUR_SERVICE_NAME");
   */
  setMemo (memo) {
    this.options.memo = memo
    return this
  }

  /**
   * Sets Private Data against the invoice.
   * 
   * Private data is stored under the 'options' object of an invoice and should never be exposed to the end user.
   * @param {(string|object)} data If an object is passed, this will be converted to a string.
   * @example
   * // Using a string
   * invoice.setPrivateData("ORDERID: 12345");
   *
   * // Using an object
   * invoice.setPrivateData({
   *  orderId: '12345'
   * })
   */
  setPrivateData (data) {
    if (typeof data === 'object') {
      data = JSON.stringify(data)
    }

    this.options.privateData = data
    return this
  }

  /**
   * The unit of fiat (e.g. USD) that will be displayed to the user
   * @param {string} currency The currency code
   * @example
   * // Show invoice total in Australian Dollars
   * invoice.setUserCurrency('AUD')
   */
  setUserCurrency (currency) {
    this.options.userCurrency = currency
    return this
  }
  
  /**
   * Set Webhook
   * @param {(Array|String)} events The type of Webhook (requested, broadcasted, etc)
   * @param {String} endpoint The endpoint that should be hit
   * @example
   * // Set single Webhook
   * let invoice = new Invoice();
   * invoice.setWebhook("broadcasted", 'https://webhook.site/1aa1cc3b-8ee8-4f70-a4cd-abc0c9b8d1f2');
   * 
   * // Set multiple Webhooks
   * let invoice = new Invoice();
   * invoice.setWebhook(['broadcasting', 'broadcasted', 'confirmed'], 'https://webhook.site/1aa1cc3b-8ee8-4f70-a4cd-abc0c9b8d1f2')
   */
  setWebhook (events, endpoint) {
    if (typeof events === 'string') {
      events = [events]
    }

    events.forEach(event => { this.options.webhooks[event] = endpoint })

    return this
  }

  /**
   * Make this invoice a static invoice
   * @param {object} [opts={}] Options for static invoice
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
    this.options.behavior = 'static'
    this.options.static = opts

    return this
  }
  
  /**
   * Create the invoice.
   * 
   * If "id" does not exist on invoice, a new Invoice will be requested from the CashPayServer.
   * @param {DOMElement} [container] DOM Element to render CashPay in
   * @param {Object} [options] Options for container rendering
   * @example
   * // Using default container 
   * let invoice = new CashPay.Invoice()
   * invoice.addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1USD')
   * await invoice.create(document.getElementById('invoice-container'))
   * 
   * // Using default container with options
   * let invoice = new CashPay.Invoice()
   * invoice.addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1USD')
   * await invoice.create(document.getElementById('invoice-container'), { color: '#000' })
   * 
   * // No Container (e.g. handle rendering with reactive properties)
   * let invoice = new CashPay.Invoice()
   * invoice.addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1USD')
   * await invoice.create();
   */
  async create (container, options) {
    if (container) {
      this._setupContainer(container, Object.assign({ margin: 0 }, options))
    }

    try {
      if (!this.id) {
        const invoiceRes = await axios.post(this._instance.endpoint + '/invoice/create', this.options)
        Object.assign(this, invoiceRes.data)
      }

      if (this._instance.listen) {
        // Setup expiration timer
        if (this.details.behavior === 'normal') {
          this._setupExpirationTimer()
        }

        // Setup event listener for expired and broadcasted to stop Websocket listener
        this.on(['expired', 'broadcasted'], (secondsRemaining) => {
          clearInterval(this._instance.expiryTimer)
          this._instance.socket.disconnect(true)
        })

        await this._listen()
      }

      this._instance.on.created.forEach(cb => cb())

      return this
    } catch (err) {
      this._instance.on.failed.forEach(cb => cb(err))
      console.error(err)
      throw err
    }
  }

  /**
   * Get the payload of the invoice.
   * 
   * This function can be used to pass the invoice back to the browser from the server-side.
   * @param {boolean} [publicOnly=true] Only return properties that should be visible to the end user (hide private options)
   * @example
   * // Get JSON payload
   * let payload = invoice.getPayload()
   * 
   * // Get FULL JSON payload (security risk!)
   * let payload = invoice.getPayload(true) 
   */
  payload (publicOnly = true) {
    if (publicOnly) {
      return _.omit(this, 'options', '_instance')
    }

    return _.omit(this, '_instance')
  }
  
  /**
   * @private
   * Setup WebSocket listener.
   * This should not need to be called manually
   */
  async _listen () {
    this._instance.socket = SocketIO(this.service.webSocketURI)

    this._instance.socket.on('connect', () => {
      this._instance.socket.emit('subscribe', {
        invoiceId: this.id
      })
    })

    this._instance.socket.on('subscribed', (msg) => {
      this._instance.on.subscribed.forEach(cb => cb(msg))
    })

    this._instance.socket.on('requested', (msg) => {
      Object.assign(this, _.omit(msg.invoice, 'id'))
      this._instance.on.requested.forEach(cb => cb(msg))
    })

    this._instance.socket.on('broadcasted', (msg) => {
      Object.assign(this, _.omit(msg.invoice, 'id'))
      this._instance.on.broadcasted.forEach(cb => cb(msg))
    })

    this._instance.socket.on('failed', (msg) => {
      this._instance.on.failed.forEach(cb => cb(msg))
    })

    return this
  }

  /**
   * @private
   */
  _setupExpirationTimer () {
    this._instance.expiryTimer = setInterval(() => {
      const expires = new Date(this.details.expires * 1000).getTime()
      const now = new Date().getTime()
      const secondsRemaining = Math.round((expires - now) / 1000)

      if (secondsRemaining) {
        this._instance.on.timer.forEach(cb => cb(secondsRemaining))
      } else {
        this._instance.on.expired.forEach(cb => cb())
      }
    }, 1000)
  }

  /**
   * @private
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
      qrCodeEl.src = await QRCode.toDataURL(this.service.walletURI, {
        color: {
          dark: options.color
        },
        scale: options.scale,
        margin: options.margin
      })

      // Set totals for BCH and Fiat
      totalFiatEl.innerText = `${this.details.meta.userCurrencyTotal}${this.details.meta.userCurrency}`

      // Only show in BCH if this is not a static invoice
      if (this.details.behavior === 'normal') {
        totalBCHEl.innerText = `${this.details.meta.satoshiTotal / 100000000}BCH`
      }

      // Set the button text and url
      buttonEl.innerText = options.lang.openInWallet
      buttonEl.href = this.service.walletURI

      // Show the subcontainer
      subContainerEl.style.display = 'block'
    })

    // Trigger on invoice broadcasted...
    this.on('broadcasted', () => {
      buttonEl.innerText = options.lang.paymentReceived
      buttonEl.classList.add('animate__pulse')

      // If this is a static invoice
      if (this.details.behavior === 'static') {
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
