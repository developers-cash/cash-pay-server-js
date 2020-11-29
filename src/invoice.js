const config = require('./config')

const _ = require('lodash')
const axios = require('axios')
const SocketIO = require('socket.io-client')
const QRCode = require('qrcode')

const template = require('../statics/template.html')
const tick = require('../statics/tick.svg')
const cross = require('../statics/cross.svg')

/**
  * <p>A Cash Payment Server Invoice</p>
  * <p>Invoices can be created client-side or server-side. However, for security
  * reasons, it is recommended that invoices are created server-side and passed
  * back to the client-side.</p>
  * <p><small><strong>Note:</strong> Any field that is prefixed with an underscore
  * is private and should never be accessed directly.</small></p>
  * <p><small><strong>Note:</strong> Any field that is not prefixed by an
  * underscore is considered public
  * and stable (hence there are no "getter" functions in this class).
  * Only use setters to modify the parameters of an invoice - do not set
  * values directly.</small></p>
  *
  * @param {object} opts Options for invoice instance (use setters instead)
  * @param {object} invoice Invoice properties (use setters instead)
  * @example
  * //
  * // Server-side
  * //
  * let invoice = new CashPay.Invoice()
  *   .setMerchantKey('your.site|SECURE_KEY_123')
  *   .addAddress('bitcoincash:qpfsrgdeq49fsjrg5qk4xqhswjl7g248950nzsrwvn', '1USD')
  *   .setWebhooks(['https://webhook.site/1aa1cc3b-8ee8-4f70-a4cd-abc0c9b8d1f2')
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
    this._instance = {}

    Object.assign(this, _.cloneDeep(config.invoice), invoice)
    Object.assign(this._instance, _.cloneDeep(config.options), opts)
  }

  /**
   * <p>Create an instance from an existing invoice.</p>
   * <p>This should be used if, for example, the invoice is being created from a server-side endpoint.</p>
   * @param {object} existingInvoice The existing invoice (created from the server-side)
   * @param {object} options List of options to set upon creation.
   * @example
   * let invoice = CashPay.Invoice.fromExisting(invoicePayload)
   * await invoice.create(document.getElementById('invoice-container'))
   */
  static fromExisting (existingInvoice, options = {}) {
    const invoice = new Invoice()
    Object.assign(invoice, existingInvoice)
    invoice._instance = Object.assign({}, config.options, options)

    return invoice
  }

  /**
   * <p>Convenience function to create an invoice from the data returned from
   * the given server-side endpoint.</p>
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
   * <p>Add an event handler.</p>
   * <p>Most of these events will be sent by the WebSocket connection.</p>
   * <p>Supported events are:</p>
   * <ul>
   *  <li>created</li>
   *  <li>broadcasting</li>
   *  <li>broadcasted</li>
   *  <li>expired</li>
   *  <li>failed</li>
   * </ul>
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
    this.outputs.push({
      address: address,
      amount: amount || 0
    })

    return this
  }

  /**
   * <p>Add a script output to the Invoice.</p>
   * <p>Note that this is not supported by JSONPaymentProtocol.</p>
   * @param {string} script Raw output script (in hexadecimal)
   * @param {number} [amount=0] Amount in satoshis
   * @example
   * // Set OP_RETURN data to "EXAMPLE_OP_RETURN_DATA"
   * invoice.addOutput('6a164558414d504c455f4f505f52455455524e5f44415441')
   */
  addOutput (script, amount = 0) {
    this.outputs.push({
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
    this.expires = seconds
    return this
  }

  /**
   * Sets a BIP70/JPP memo
   * @param {string} memo Memo text
   * @example
   * // Memos are not supported by all wallets
   * invoice.setMemo("Payment to YOUR_SERVICE_NAME")
   */
  setMemo (memo) {
    this.memo = memo
    return this
  }

  /**
   * <p>Sets Merchant Data associated with invoice</p>
   * <p><strong>This must be Base64 encoded</strong></p>
   * @param {string} data Base64 encoded string
   * @example
   * // Node
   * invoice.setMerchantData(Buffer.from('INVOICE_001', 'base64'))
   *
   * // Browser
   * invoice.setMerchantData(btoa('INVOICE_001'))
   */
  setMerchantData (base64) {
    this.merchantData = base64
    return this
  }

  /**
   * <p>Sets the API Key</p>
   * <p>An arbitrary API Key that can be used to later retrieve invoice information.</p>
   * <p><small>This should never be used if the invoice is created client-side (in the browser).</small></p>
   * @example
   * invoice.setAPIKey('https://t.me/yourname|SECURE_STRING')
   */
  setAPIKey (key) {
    this.apiKey = key
    return this
  }

  /**
   * <p>Sets Private Data against the invoice.</p>
   * <p>Private data is stored under the 'options' object of an invoice and should never be exposed to the end user.</p>
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

    this.privateData = data
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
    this.userCurrency = currency
    return this
  }

  /**
   * <p>Set Webhook</p>
   * <p>Used to notify server endpoint of transaction event.</p>
   * <p>Note that a JSON response can be returned by the server to modify the fields:
   * "data" and "privateData".</p>
   * @param {String} endpoint The endpoint that should be hit
   * @param {(Array|String)} events The type of Webhook (broadcasting, broadcasted, confirmed)
   * @example
   * // Set Webhook (defaults to broadcasting, broadcasted and confirmed)
   * let invoice = new Invoice();
   * invoice.setWebhook('https://webhook.site/1aa1cc3b-8ee8-4f70-a4cd-abc0c9b8d1f2');
   *
   * // Only trigger on "broadcasting" and "broadcasted"
   * let invoice = new Invoice();
   * invoice.setWebhook('https://webhook.site/1aa1cc3b-8ee8-4f70-a4cd-abc0c9b8d1f2', ['broadcasting', 'broadcasted'])
   */
  setWebhook (endpoint, events = ['broadcasting', 'broadcasted', 'confirmed']) {
    if (typeof events === 'string') {
      events = [events]
    }

    events.forEach(event => {
      this.webhook[event] = endpoint
    })

    return this
  }

  /**
   * <p>Create the invoice.</p>
   * <p>If "id" does not exist on invoice, a new Invoice will be requested from the CashPayServer.</p>
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
      if (!this._id) {
        const invoiceRes = await axios.post(this._instance.endpoint + '/invoice/create', _.omit(this, '_instance'))
        Object.assign(this, invoiceRes.data)
      }

      if (this._instance.listen) {
        // Setup expiration timer
        this._setupExpirationTimer()

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
   * <p>Get the payload of the invoice.</p>
   * <p>This function can be used to pass the invoice back to the browser from the server-side.</p>
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
      const expires = new Date(this.expires * 1000).getTime()
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
      color: '#000',
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
    const qrCodeLinkEl = container.querySelector('.cashpay-qr-code-link')
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

      // Set link on QR Code
      qrCodeLinkEl.href = this.service.walletURI

      // Set totals for BCH and Fiat
      totalFiatEl.innerText = `${this.totals.userCurrencyTotal}${this.userCurrency}`

      // Show value in BCH
      totalBCHEl.innerText = `${this.totals.satoshiTotal / 100000000}BCH`

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

      qrCodeEl.src = `data:image/svg+xml;base64,${btoa(tick.replace('#000', options.color))}`
      qrCodeEl.classList.add('animate__pulse')
      buttonEl.removeAttribute('href')
      expiresEl.innerText = ''
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
